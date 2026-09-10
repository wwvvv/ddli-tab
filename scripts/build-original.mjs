import { build, transformSync } from 'esbuild';
import { loadEnvFile } from 'node:process';
import { applyBranding } from './brand-original.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
try {
  loadEnvFile(path.join(root, '.env.local'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const cloudConfig = {
  url: process.env.VITE_SUPABASE_URL || '',
  publishableKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
};
if (Boolean(cloudConfig.url) !== Boolean(cloudConfig.publishableKey))
  throw new Error('Supabase URL/key must both be configured');
if (cloudConfig.publishableKey && !cloudConfig.publishableKey.startsWith('sb_publishable_'))
  throw new Error('Only a publishable key is allowed in frontend builds');
const source = path.join(root, 'legacy/gotab/web');
const out = path.join(root, 'dist-original');
await fs.mkdir(out, { recursive: true });
await fs.cp(source, out, { recursive: true });
await fs.mkdir(path.join(out, 'local'), { recursive: true });
const hashes = {};
async function inventory(dir, prefix = '') {
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const relative = prefix + item.name;
    if (item.isDirectory()) await inventory(path.join(dir, item.name), relative + '/');
    else
      hashes[relative] = crypto
        .createHash('sha256')
        .update(await fs.readFile(path.join(dir, item.name)))
        .digest('hex');
  }
}
await inventory(source);
for (const name of [
  'bootstrap',
  'api',
  'policies',
  'branding',
  'defaults',
  'site-settings',
  'extension-bridge',
  'service-worker',
]) {
  const src = await fs.readFile(path.join(root, 'src/local', name + '.ts'), 'utf8');
  let compiled = transformSync(src, { loader: 'ts', target: 'es2022', format: 'esm' }).code;
  if (name === 'service-worker')
    compiled = compiled
      .replaceAll('./api.js', './local/api.js')
      .replaceAll('./cache-manifest.js', './local/cache-manifest.js');
  await fs.writeFile(
    path.join(out, name === 'service-worker' ? 'ddli-local-sw.js' : `local/${name}.js`),
    compiled,
  );
}
await build({
  entryPoints: [path.join(root, 'src/local/cloud-panel.ts')],
  outfile: path.join(out, 'local/cloud-panel.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  define: { __DTAB_CLOUD__: JSON.stringify(cloudConfig) },
});
const entryMap = {};
for (const htmlName of ['index.html', 'newtab.html', 'popup.html']) {
  let html = await fs.readFile(path.join(source, htmlName), 'utf8');
  const entry = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/);
  if (!entry) throw new Error('Original entry was not found: ' + htmlName);
  entryMap[htmlName] = entry[1];
  html = html
    .replace(
      entry[0],
      `<script type="module" data-original-entry="${entry[1]}" src="/local/bootstrap.js"></script>`,
    )
    .replace('{{ .Title }}', 'DTab · 本地版')
    .replace('{{ .Description }}', 'DTab 个性化本地导航')
    .replace('{{ .Keywords }}', 'DTab,本地导航');
  await fs.writeFile(path.join(out, htmlName), html);
}
const settings = await fs.readFile(path.join(out, 'local/site-settings.js'), 'utf8');
await fs.writeFile(
  path.join(out, 'siteConfig.js'),
  settings.replace(/export\s*\{[\s\S]*?\};?\s*$/, '') + '\nglobalThis.siteConfig = SITE_CONFIG;\n',
);
await fs.copyFile(path.join(root, 'legacy/gotab/LICENSE'), path.join(out, 'LICENSE'));
await fs.cp(path.join(root, 'config'), path.join(out, 'config'), { recursive: true });
const brandingChanged = await applyBranding(root, out, Object.keys(hashes));
const cacheVersion = crypto.createHash('sha256');
for (const name of [
  'bootstrap.ts',
  'service-worker.ts',
  'api.ts',
  'policies.ts',
  'branding.ts',
  'defaults.ts',
  'extension-bridge.ts',
  'site-settings.ts',
])
  cacheVersion.update(await fs.readFile(path.join(root, 'src/local', name)));
cacheVersion.update(JSON.stringify(hashes));
cacheVersion.update(await fs.readFile(path.join(root, 'scripts/build-original.mjs')));
cacheVersion.update(await fs.readFile(path.join(out, 'local/cloud-panel.js')));
cacheVersion.update(await fs.readFile(path.join(root, 'config/default-template.json')));
cacheVersion.update(await fs.readFile(path.join(root, 'scripts/brand-original.mjs')));
cacheVersion.update(await fs.readFile(path.join(root, 'src/branding/logo.svg')));
const cacheFiles = [
  '/',
  ...Object.keys(hashes).map((file) => '/' + file),
  '/local/bootstrap.js',
  '/local/api.js',
  '/local/policies.js',
  '/local/branding.js',
  '/local/defaults.js',
  '/local/extension-bridge.js',
  '/local/cloud-panel.js',
  '/local/site-settings.js',
  '/config/default-template.json',
];
await fs.writeFile(
  path.join(out, 'local/cache-manifest.js'),
  `export const CORE_FILES = ${JSON.stringify(cacheFiles)};\nexport const CACHE_VERSION = ${JSON.stringify(cacheVersion.digest('hex').slice(0, 16))};\n`,
);
const report = {
  source: 'D:/work/gotab-personal-main/web',
  files: Object.keys(hashes).length,
  entryMap,
  sha256: hashes,
  changedAtBuild: [
    ...new Set(['index.html', 'newtab.html', 'popup.html', 'siteConfig.js', ...brandingChanged]),
  ],
  addedAtBuild: [
    'local/bootstrap.js',
    'local/api.js',
    'local/policies.js',
    'local/branding.js',
    'local/defaults.js',
    'local/extension-bridge.js',
    'local/cloud-panel.js',
    'local/site-settings.js',
    'config/default-template.json',
    'local/cache-manifest.js',
    'ddli-local-sw.js',
    'LICENSE',
  ],
};
await fs.mkdir(path.join(root, 'docs'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/original-baseline.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  `Original GoTab: ${Object.keys(hashes).length} files copied. UI assets preserved; local API/bootstrap compiled.`,
);
