/* probe-drive.js — list immediate children of a Drive folder.
   Usage: node scripts/probe-drive.js <folderId>
*/
const fs = require('node:fs');
const path = require('node:path');
const { google } = require('googleapis');

const KEY_PATH = path.join(__dirname, '..', '.secrets', 'exceed-drive-sync.json');
if (!fs.existsSync(KEY_PATH)) {
  console.error('Missing .secrets/exceed-drive-sync.json'); process.exit(1);
}
const SA = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'));
const [, , folderId] = process.argv;
if (!folderId) { console.error('usage: probe-drive.js <folderId>'); process.exit(1); }

const auth = new google.auth.GoogleAuth({
  credentials: SA,
  scopes: ['https://www.googleapis.com/auth/drive.readonly']
});
const drive = google.drive({ version: 'v3', auth });

(async () => {
  try {
    const r = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType)',
      pageSize: 200,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    const items = r.data.files || [];
    const folders = items.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    const files   = items.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
    console.log(`Folders (${folders.length}):`);
    folders.forEach(f => console.log(`  📁 ${f.name}  (${f.id})`));
    if (files.length) {
      console.log(`\nLoose files (${files.length}):`);
      files.slice(0, 20).forEach(f => console.log(`  📄 ${f.name}`));
      if (files.length > 20) console.log(`  …and ${files.length - 20} more`);
    }
  } catch (e) {
    console.error('✗ Drive access failed:', e.message);
    if ((e.message || '').match(/File not found|not found/i)) {
      console.error('  Share the folder with: exceed-drive-sync@exceed-portal.iam.gserviceaccount.com');
    }
    process.exit(2);
  }
})();
