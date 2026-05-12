/* check-duplicates.js — find duplicate /databaseFiles docs in the developer
   section, grouped by driveFileId (the authoritative dedupe key).

   Usage:
     node scripts/check-duplicates.js                # report only
     node scripts/check-duplicates.js --delete       # delete dupes (keep oldest)
*/
const fs = require('node:fs');
const path = require('node:path');
const admin = require('firebase-admin');

const SA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.secrets', 'exceed-drive-sync.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(SA), storageBucket: 'exceed-portal-files' });

const DELETE = process.argv.includes('--delete');
const db = admin.firestore();
const bucket = admin.storage().bucket();

(async () => {
  const snap = await db.collection('databaseFiles').where('section', '==', 'developer').get();
  const byDriveId = new Map();
  snap.forEach(d => {
    const x = d.data();
    const key = x.driveFileId || `__no_drive_id__/${x.drivePath}`;
    if (!byDriveId.has(key)) byDriveId.set(key, []);
    byDriveId.get(key).push({ id: d.id, ref: d.ref, ...x });
  });

  const dupes = [...byDriveId.entries()].filter(([, arr]) => arr.length > 1);
  console.log(`Scanned ${snap.size} developer docs.`);
  console.log(`Distinct Drive IDs: ${byDriveId.size}`);
  console.log(`Duplicate groups: ${dupes.length}`);
  let extra = 0;
  dupes.forEach(([, arr]) => extra += arr.length - 1);
  console.log(`Extra duplicate docs (to remove): ${extra}\n`);

  if (!dupes.length) { process.exit(0); }

  // Show first 5 groups as a sample
  console.log('Sample (first 5 groups):');
  dupes.slice(0, 5).forEach(([key, arr]) => {
    console.log(`  ${arr.length}× ${arr[0].drivePath}`);
  });

  if (!DELETE) {
    console.log(`\nRe-run with --delete to remove duplicates (keeps the oldest doc in each group).`);
    process.exit(0);
  }

  console.log('\nDeleting duplicates...');
  let deleted = 0, storageGone = 0;
  for (const [, arr] of dupes) {
    // Keep oldest createdAt — sort ascending
    arr.sort((a, b) => {
      const at = a.createdAt?.toMillis?.() ?? 0;
      const bt = b.createdAt?.toMillis?.() ?? 0;
      return at - bt;
    });
    const [keep, ...rest] = arr;
    for (const dup of rest) {
      try {
        if (dup.storagePath) {
          try { await bucket.file(dup.storagePath).delete({ ignoreNotFound: true }); storageGone++; }
          catch (_) {}
        }
        await dup.ref.delete();
        deleted++;
      } catch (e) { console.error(`! ${dup.drivePath}: ${e.message}`); }
    }
  }
  console.log(`✓ Deleted ${deleted} duplicate docs (storage objects deleted: ${storageGone}). Kept ${byDriveId.size}.`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
