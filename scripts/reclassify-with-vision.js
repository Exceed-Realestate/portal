/* reclassify-with-vision.js — re-run AI classification on /databaseFiles
   docs that currently sit in 'image' or 'other' buckets. Uses Claude vision
   so images get classified by their actual content (floor plan / brochure /
   payment plan / etc).

   Reads each file's bytes from Firebase Storage, sends them to Claude,
   updates aiCategory + subcategory on the doc.

   Usage:
     node scripts/reclassify-with-vision.js [--dev=binghatti] [--limit=N] [--dry]
*/
const fs = require('node:fs');
const path = require('node:path');
const admin = require('firebase-admin');
const Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');
const sharp = require('sharp');

const CATEGORIES = [
  'brochure', 'render', 'inventory', 'payment_plan', 'floor_plan',
  'fact_sheet', 'logo', 'video', 'image', 'other'
];

const SA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.secrets', 'exceed-drive-sync.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(SA), storageBucket: 'exceed-portal-files' });
const db = admin.firestore();
const bucket = admin.storage().bucket();

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Set ANTHROPIC_API_KEY env var first.'); process.exit(1);
}
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const args = process.argv.slice(2);
const devArg = args.find(a => a.startsWith('--dev='));
const DEV_SLUG = devArg ? devArg.split('=')[1] : 'binghatti';
const limArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limArg ? parseInt(limArg.split('=')[1], 10) : Infinity;
const DRY = args.includes('--dry');

const MEDIA_TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png', webp: 'image/webp', gif: 'image/gif'
};
function mediaTypeFor(name, contentType) {
  if (contentType && contentType.startsWith('image/')) return contentType;
  const m = (name || '').toLowerCase().match(/\.([a-z]+)$/);
  return m ? (MEDIA_TYPES[m[1]] || null) : null;
}

/* Claude vision max 5MB per image. Resize anything bigger to ~1024px on the
   long edge and re-encode as JPEG at q80 — keeps it well under 1MB. */
async function shrinkIfNeeded(buf, mime) {
  const MAX = 4.5 * 1024 * 1024; // leave headroom under 5MB
  if (buf.length <= MAX) return { buf, mime };
  try {
    const out = await sharp(buf, { failOn: 'none' })
      .rotate()
      .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    return { buf: out, mime: 'image/jpeg' };
  } catch (e) {
    throw new Error(`resize failed: ${e.message}`);
  }
}

async function classifyImage({ name, drivePath, project, buf, mime }) {
  ({ buf, mime } = await shrinkIfNeeded(buf, mime));
  const sys = `You classify real-estate developer images into ONE of these categories:
- brochure        — a page from a multi-page marketing brochure or sales deck (text + multiple visuals)
- render          — a single architectural rendering: exterior view, interior view, aerial, lifestyle CGI
- floor_plan      — a unit/apartment layout drawing or blueprint
- inventory       — a unit availability table or price list (rows + columns)
- payment_plan    — a payment schedule or instalment table
- fact_sheet      — a one-page project summary (specs, location, amenities)
- logo            — a developer or project logo / wordmark
- video           — a video frame (don't pick unless clearly a video)
- image           — generic / unclassifiable real photo
- other           — anything that doesn't fit above

Most architectural images are RENDERS, not brochures. Only pick brochure if you see brochure-style page layout with text + branding.

Return ONLY JSON: {"category":"<one>","confidence":0..1}.`;
  const user = [
    { type: 'text', text: `Filename: ${name}\nProject: ${project}\nDrive path: ${drivePath}\n\nWhich category?` },
    { type: 'image', source: { type: 'base64', media_type: mime, data: buf.toString('base64') } }
  ];
  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 60,
    system: sys,
    messages: [{ role: 'user', content: user }]
  });
  const txt = resp.content?.[0]?.text || '{}';
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no JSON: ' + txt);
  const parsed = JSON.parse(m[0]);
  if (!CATEGORIES.includes(parsed.category)) return { category: 'other', confidence: 0.4 };
  return { category: parsed.category, confidence: parsed.confidence ?? 0.85 };
}

(async () => {
  const snap = await db.collection('databaseFiles')
    .where('developerSlug', '==', DEV_SLUG)
    .where('aiCategory', 'in', ['image', 'other'])
    .get();
  console.log(`Found ${snap.size} docs to reclassify for ${DEV_SLUG}.`);

  let done = 0, changed = 0, skipped = 0, failed = 0;
  for (const d of snap.docs) {
    if (done >= LIMIT) { console.log(`(limit ${LIMIT} hit)`); break; }
    const x = d.data();
    const oldCat = x.aiCategory;
    const mime = mediaTypeFor(x.name, x.type);
    if (!mime) { skipped++; continue; } // not an image — skip for now

    try {
      const [buf] = await bucket.file(x.storagePath).download();
      const newCls = await classifyImage({
        name: x.name, drivePath: x.drivePath, project: x.project,
        buf, mime
      });
      done++;
      if (newCls.category === oldCat) continue;
      changed++;
      if (DRY) {
        console.log(`  [DRY] ${x.drivePath}  ${oldCat} → ${newCls.category}`);
      } else {
        await d.ref.update({
          aiCategory: newCls.category,
          subcategory: newCls.category,
          aiConfidence: newCls.confidence,
          aiVia: 'claude-vision',
          aiReclassifiedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`  ✓ ${x.drivePath}  ${oldCat} → ${newCls.category}`);
      }
    } catch (e) {
      failed++;
      console.error(`  ✗ ${x.drivePath}: ${e.message}`);
    }
  }

  console.log(`\nDone. processed=${done}, changed=${changed}, skipped(non-image)=${skipped}, failed=${failed}`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
