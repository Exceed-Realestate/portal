/* Register a developer in /developers/{slug}.
   Usage: node scripts/register-developer.js <slug> <name> <folderId> [whatsapp]
*/
const fs = require('node:fs');
const path = require('node:path');
const admin = require('firebase-admin');

const SA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.secrets', 'exceed-drive-sync.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(SA) });

const [, , slug, name, folderId, whatsapp] = process.argv;
if (!slug || !name || !folderId) {
  console.error('usage: register-developer.js <slug> <name> <folderId> [whatsapp]');
  process.exit(1);
}

(async () => {
  await admin.firestore().collection('developers').doc(slug).set({
    name, folderId, whatsapp: whatsapp || null, active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  console.log(`✓ /developers/${slug} registered (${name})`);
  process.exit(0);
})();
