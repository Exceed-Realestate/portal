/* Delete already-synced /databaseFiles docs (and their Storage files)
   that match the junk filter (Unreal-Engine crash dumps, .log/.ini/.dmp,
   files inside /Crashes/ or /Saved/, etc).

   Usage: node scripts/cleanup-junk.js [--dry]
*/
const fs = require('node:fs');
const path = require('node:path');
const admin = require('firebase-admin');

const KEY_PATH = path.join(__dirname, '..', '.secrets', 'exceed-drive-sync.json');
const SA = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'));
const DRY = process.argv.includes('--dry');

admin.initializeApp({
  credential: admin.credential.cert(SA),
  storageBucket: 'exceed-portal-files'
});
const db = admin.firestore();
const bucket = admin.storage().bucket();

function isJunk(drivePath, name) {
  const p = (drivePath || '').toLowerCase();
  const n = (name || '').toLowerCase();
  if (/\/(crashes|saved|cache|tmp|temp|node_modules|\.git|__pycache__)\//i.test('/' + p)) return true;
  if (/\.(dmp|log|ini|runtime-xml|crash|tmp|bak|swp|pyc|class)$/i.test(n)) return true;
  if (/^(thumbs\.db|desktop\.ini|\.ds_store)$/i.test(n)) return true;
  if (/^uecc-windows-/i.test(n) || /crashreportclient/i.test(n)) return true;
  return false;
}

(async () => {
  const snap = await db.collection('databaseFiles')
    .where('section', '==', 'developer').get();
  console.log(`Scanning ${snap.size} developer-section docs...`);
  let purged = 0, kept = 0, storageDeleted = 0;
  for (const d of snap.docs) {
    const x = d.data();
    if (!isJunk(x.drivePath, x.name)) { kept++; continue; }
    if (DRY) { console.log(`  [DRY] would purge: ${x.drivePath}`); purged++; continue; }
    try {
      if (x.storagePath) {
        try { await bucket.file(x.storagePath).delete({ ignoreNotFound: true }); storageDeleted++; }
        catch (e) { /* ignore — already gone */ }
      }
      await d.ref.delete();
      purged++;
      if (purged % 20 === 0) process.stdout.write('.');
    } catch (e) { console.error(`! ${x.drivePath}: ${e.message}`); }
  }
  console.log(`\n✓ Purged ${purged} junk docs (storage objects deleted: ${storageDeleted}). Kept ${kept} legit docs.`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
