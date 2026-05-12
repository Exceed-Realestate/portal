/* ========================================================================
   sync-developer-folder.js
   Pulls a developer's Drive folder into Firebase Storage + /databaseFiles
   and asks Claude Haiku to classify every NEW file into a fixed taxonomy.

   Runs daily from GitHub Actions (or locally for testing).

   Reads its developer registry from Firestore — `/developers/{slug}` docs
   with shape: { name, folderId, whatsapp, active }. To onboard a new
   developer, add a row in that collection — no code change needed.

   Idempotent: each file's Drive id is recorded on the index doc as
   `driveFileId`. Subsequent runs skip files already imported.

   Env / secrets:
     ANTHROPIC_API_KEY                  — required for AI classification
     GOOGLE_APPLICATION_CREDENTIALS_JSON — service-account JSON (one-line)
       OR the file at .secrets/exceed-drive-sync.json for local runs.
     CLASSIFY_OFF=1                     — skip AI; use filename heuristics

   Usage:
     node scripts/sync-developer-folder.js                # all active devs
     node scripts/sync-developer-folder.js binghatti      # one developer
     node scripts/sync-developer-folder.js binghatti --dry  # no writes
   ======================================================================== */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { google } = require('googleapis');
const admin = require('firebase-admin');
const Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');
const pdf = require('pdf-parse');

const CATEGORIES = [
  'brochure', 'render', 'inventory', 'payment_plan', 'floor_plan',
  'fact_sheet', 'logo', 'video', 'image', 'other'
];

// ---------- Service-account credentials ----------
function loadServiceAccount() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    return JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  }
  const local = path.join(__dirname, '..', '.secrets', 'exceed-drive-sync.json');
  if (fs.existsSync(local)) return JSON.parse(fs.readFileSync(local, 'utf8'));
  throw new Error('No service-account credentials. Set GOOGLE_APPLICATION_CREDENTIALS_JSON or place file at .secrets/exceed-drive-sync.json');
}

const SA = loadServiceAccount();

// ---------- CLI ----------
const args = process.argv.slice(2);
const onlySlug = args.find(a => !a.startsWith('--'));
const DRY = args.includes('--dry');
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;
const CLASSIFY_OFF = process.env.CLASSIFY_OFF === '1';

// ---------- Init Firebase Admin ----------
admin.initializeApp({
  credential: admin.credential.cert(SA),
  storageBucket: 'exceed-portal-files'
});
const db = admin.firestore();
const bucket = admin.storage().bucket();

// ---------- Init Drive ----------
const auth = new google.auth.GoogleAuth({
  credentials: SA,
  scopes: ['https://www.googleapis.com/auth/drive.readonly']
});
const drive = google.drive({ version: 'v3', auth });

// ---------- Init Claude ----------
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

if (!anthropic && !CLASSIFY_OFF) {
  console.log('⚠ ANTHROPIC_API_KEY not set — falling back to filename-only classification');
}

// ---------- Helpers ----------
function safeName(s) {
  return (s || 'file')
    .replace(/[ <>:"/\\|?*]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 200);
}

/* Junk filter — keeps real-estate content, drops software/system noise.
   Triggered by Unreal-Engine crash dumps in Jacob & Co/One by Binghatti
   (a VR tour project). Catches the obvious culprits. */
function isJunk(file) {
  const p = (file._path || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  // Path segments that scream "not a real-estate document"
  if (/\/(crashes|saved|cache|tmp|temp|node_modules|\.git|__pycache__)\//i.test('/' + p)) return true;
  if (/\.(dmp|log|ini|runtime-xml|crash|tmp|bak|swp|pyc|class)$/i.test(name)) return true;
  if (/^(thumbs\.db|desktop\.ini|\.ds_store)$/i.test(name)) return true;
  // Unreal Engine prefixes
  if (/^uecc-windows-/i.test(name) || /crashreportclient/i.test(name)) return true;
  return false;
}

function slugFromDrivePath(p) {
  // First segment of the drive path = project folder name (e.g. "Skyrise")
  const seg = (p || '').split('/').filter(Boolean)[0] || 'general';
  return seg.toLowerCase()
    .replace(/^\d+\s*/, '')             // strip "01 " prefixes
    .replace(/-all-assets$/i, '')        // strip "-all-assets" suffix
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function prettyProject(p) {
  const seg = (p || '').split('/').filter(Boolean)[0] || 'General';
  return seg
    .replace(/^\d+\s*/, '')
    .replace(/-all-assets$/i, '')
    .replace(/\bbinghatti\b/i, '')
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ') || 'General';
}

/* Filename-only fallback classifier — cheap heuristic. */
function classifyByName(name) {
  const n = (name || '').toLowerCase();
  if (/\.(mp4|mov|avi|mkv)$/i.test(n)) return 'video';
  if (/\.(jpg|jpeg|png|webp|gif)$/i.test(n)) return 'image';
  if (/(payment|payment.plan|installment|schedule)/i.test(n)) return 'payment_plan';
  if (/(brochure|teaser|presentation|deck|booklet)/i.test(n)) return 'brochure';
  if (/(inventory|availability|price.list|stock|unit.list)/i.test(n)) return 'inventory';
  if (/(floor.plan|layout|typical.unit)/i.test(n)) return 'floor_plan';
  if (/(fact.sheet|spec|summary|overview)/i.test(n)) return 'fact_sheet';
  return 'other';
}

/* Read first ~3000 chars of a PDF (for AI classification context). */
async function extractPdfHead(streamRes) {
  try {
    const chunks = [];
    streamRes.data.on('data', c => chunks.push(c));
    await new Promise(r => streamRes.data.on('end', r));
    const buf = Buffer.concat(chunks);
    const parsed = await pdf(buf, { max: 1 }); // first page only
    return { text: (parsed.text || '').slice(0, 3000), buffer: buf };
  } catch (e) {
    return { text: '', buffer: null, error: e.message };
  }
}

async function classifyWithClaude({ filename, drivePath, sampleText }) {
  if (!anthropic) return { category: classifyByName(filename), confidence: 0.6, via: 'heuristic' };
  try {
    const sys = `You classify real-estate developer documents into ONE of:
- brochure        — multi-page marketing brochure / sales deck
- render          — single architectural render (exterior/interior/aerial)
- floor_plan      — unit layout drawing
- inventory       — unit availability / price list table
- payment_plan    — payment schedule / instalment table
- fact_sheet      — one-page project summary
- logo            — developer or project logo
- video           — video file
- image           — generic real photo
- other           — anything else

Return ONLY JSON: {"category":"<one>","confidence":0..1}. No prose.`;
    const user = `Filename: ${filename}
Drive path: ${drivePath}
First-page extract:
"""
${sampleText || '(none — non-PDF or extract failed)'}
"""

Which category does this file belong to?`;
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 60,
      system: sys,
      messages: [{ role: 'user', content: user }]
    });
    const txt = resp.content?.[0]?.text || '{}';
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('no JSON in response: ' + txt);
    const parsed = JSON.parse(m[0]);
    if (!CATEGORIES.includes(parsed.category)) {
      return { category: 'other', confidence: 0.4, via: 'claude-invalid' };
    }
    return { category: parsed.category, confidence: parsed.confidence ?? 0.85, via: 'claude' };
  } catch (e) {
    console.warn(`   ! classify failed: ${e.message} — falling back to heuristic`);
    return { category: classifyByName(filename), confidence: 0.5, via: 'heuristic-fallback' };
  }
}

/* ----- Drive walk ----- */
async function listAllFiles(rootFolderId) {
  const out = [];
  async function walk(folderId, pathPrefix) {
    let pageToken = null;
    do {
      const r = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime)',
        pageSize: 200,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });
      for (const f of (r.data.files || [])) {
        if (f.mimeType === 'application/vnd.google-apps.folder') {
          await walk(f.id, pathPrefix + f.name + '/');
        } else if (f.mimeType.startsWith('application/vnd.google-apps.')) {
          // Native Google doc — would need export. Skip for now.
        } else {
          out.push({ ...f, _path: pathPrefix + f.name });
        }
      }
      pageToken = r.data.nextPageToken;
    } while (pageToken);
  }
  await walk(rootFolderId, '');
  return out;
}

/* ----- Already-synced index (by Drive fileId, scoped to developer) ----- */
async function loadAlreadyImported(developerSlug) {
  const seen = new Set();
  const snap = await db.collection('databaseFiles')
    .where('developerSlug', '==', developerSlug)
    .get();
  snap.forEach(d => {
    const x = d.data();
    if (x.driveFileId) seen.add(x.driveFileId);
  });
  return seen;
}

/* ----- Per-file: download → upload → classify → write doc ----- */
async function ingest(developer, file) {
  const slug = developer.slug;
  const project = prettyProject(file._path);
  const cleaned = safeName(file.name);
  const stamp = Date.now().toString(36);
  const storagePath = `database/developer/${slug}/${slugFromDrivePath(file._path)}/${stamp}-${cleaned}`;

  // 1. Stream download (one pass — we need a buffer for both upload AND PDF parse)
  const dlRes = await drive.files.get(
    { fileId: file.id, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  );

  const chunks = [];
  await new Promise((resolve, reject) => {
    dlRes.data.on('data', c => chunks.push(c));
    dlRes.data.on('error', reject);
    dlRes.data.on('end', resolve);
  });
  const buf = Buffer.concat(chunks);

  // 2. Classify (PDF → first-page text → Claude; other → heuristic)
  let sampleText = '';
  if (file.mimeType === 'application/pdf') {
    try {
      const parsed = await pdf(buf, { max: 1 });
      sampleText = (parsed.text || '').slice(0, 3000);
    } catch (e) { /* swallow — classify with filename only */ }
  }
  const cls = CLASSIFY_OFF
    ? { category: classifyByName(file.name), confidence: 0.6, via: 'off' }
    : await classifyWithClaude({ filename: file.name, drivePath: file._path, sampleText });

  if (DRY) {
    console.log(`   [DRY] ${file._path}  →  ${cls.category} (${cls.via})`);
    return;
  }

  // 3. Upload to Storage
  const remote = bucket.file(storagePath);
  const downloadToken = crypto.randomUUID();
  await remote.save(buf, {
    metadata: {
      contentType: file.mimeType,
      metadata: {
        uploadedBy: 'drive-sync',
        driveFileId: file.id,
        firebaseStorageDownloadTokens: downloadToken
      }
    },
    resumable: false
  });
  const downloadUrl =
    `https://firebasestorage.googleapis.com/v0/b/${bucket.name}` +
    `/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;

  // 4. Index doc
  await db.collection('databaseFiles').add({
    section: 'developer',
    subcategory: cls.category,        // brochure/inventory/etc — drives filter UI
    developerSlug: slug,
    developerName: developer.name,
    project,
    aiCategory: cls.category,
    aiConfidence: cls.confidence,
    aiVia: cls.via,
    name: file.name,
    storagePath,
    size: Number(file.size) || buf.length,
    type: file.mimeType,
    downloadUrl,
    driveFileId: file.id,
    drivePath: file._path,
    uploadedBy:      'drive-sync',
    uploadedByName:  'Drive Sync',
    uploadedByEmail: 'exceed-drive-sync@exceed-portal.iam.gserviceaccount.com',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`   ✓ ${file._path}  →  ${cls.category} (${cls.via})`);
}

/* ----- Per-developer loop ----- */
async function syncDeveloper(developer) {
  console.log(`\n▶ ${developer.name}  (folder: ${developer.folderId})`);
  let files;
  try {
    files = await listAllFiles(developer.folderId);
  } catch (e) {
    if (e.code === 404 || (e.message || '').includes('not found')) {
      console.error(`✗ Folder not visible to service account. Share it with:`);
      console.error(`  exceed-drive-sync@exceed-portal.iam.gserviceaccount.com`);
      return { added: 0, skipped: 0, failed: 0 };
    }
    throw e;
  }
  const seen = await loadAlreadyImported(developer.slug);
  const beforeJunk = files.length;
  const usable = files.filter(f => !isJunk(f));
  const junk = beforeJunk - usable.length;
  console.log(`  ${beforeJunk} files in Drive | junk filtered: ${junk} | already synced: ${seen.size}`);

  let added = 0, skipped = 0, failed = 0;
  for (const f of usable) {
    if (seen.has(f.id)) { skipped++; continue; }
    if (added >= LIMIT) { console.log(`  (limit ${LIMIT} hit — stopping)`); break; }
    try { await ingest(developer, f); added++; }
    catch (e) { console.error(`   ✗ ${f._path}: ${e.message}`); failed++; }
  }
  console.log(`  ✓ added ${added}, skipped ${skipped}, failed ${failed}, junk ${junk}`);
  return { added, skipped, failed, junk };
}

/* ----- Main ----- */
(async () => {
  let devsSnap;
  if (onlySlug) {
    const d = await db.collection('developers').doc(onlySlug).get();
    if (!d.exists) { console.error(`No /developers/${onlySlug} doc.`); process.exit(2); }
    devsSnap = { docs: [d] };
  } else {
    devsSnap = await db.collection('developers').where('active', '==', true).get();
  }
  if (devsSnap.docs.length === 0) {
    console.log('No active developers registered. Add /developers/{slug} docs first.');
    process.exit(0);
  }

  const totals = { added: 0, skipped: 0, failed: 0 };
  for (const d of devsSnap.docs) {
    const dev = { slug: d.id, ...d.data() };
    if (!dev.folderId) { console.warn(`! ${dev.slug}: no folderId — skipping`); continue; }
    const r = await syncDeveloper(dev);
    totals.added += r.added; totals.skipped += r.skipped; totals.failed += r.failed;
  }
  console.log(`\n✓ Done. added=${totals.added}, skipped=${totals.skipped}, failed=${totals.failed}`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
