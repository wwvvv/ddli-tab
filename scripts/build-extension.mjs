import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'dist-extension');
await fs.mkdir(out, { recursive: true });
for (const file of ['manifest.json', 'popup.html', 'popup.css', 'popup.js'])
  await fs.copyFile(path.join(root, 'extension', file), path.join(out, file));
await fs.copyFile(path.join(root, 'src/branding/logo.png'), path.join(out, 'logo.png'));
console.log('DTab MV3 extension built at ' + out);
