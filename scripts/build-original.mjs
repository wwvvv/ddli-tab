import { build, transformSync } from 'esbuild';
import { loadEnvFile } from 'node:process';
import { applyBranding } from './brand-original.mjs';
import { withStagedOutput } from './lib/build-output.mjs';
import { readPublicCloudConfig, writeArtifactManifest } from './lib/deployment-checks.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
try {
  loadEnvFile(path.join(root, '.env.local'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const cloudConfig = readPublicCloudConfig(process.env);
const source = path.join(root, 'legacy/gotab/web');
const report = await withStagedOutput(root, async (out) => {
  await fs.cp(source, out, { recursive: true });
  await fs.mkdir(path.join(out, 'local'), { recursive: true });
  const hashes = {};
  async function inventory(dir, prefix = '') {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const item of entries) {
      if (item.isSymbolicLink()) throw new Error('Legacy source must not contain symlinks');
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
  // Only this reviewed public template is shipped, never the entire config directory.
  await fs.mkdir(path.join(out, 'config'), { recursive: true });
  const templateFile = path.join(root, 'config/default-template.json');
  const templateStat = await fs.lstat(templateFile);
  if (!templateStat.isFile() || templateStat.isSymbolicLink())
    throw new Error('Public default template must be a regular file');
  await fs.copyFile(templateFile, path.join(out, 'config/default-template.json'));
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
  for (const script of ['build-original.mjs', 'lib/build-output.mjs', 'lib/deployment-checks.mjs'])
    cacheVersion.update(await fs.readFile(path.join(root, 'scripts', script)));
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
      'artifact-manifest.json',
      'LICENSE',
    ],
  };
  await writeArtifactManifest(out);
  return report;
});
await fs.mkdir(path.join(root, 'docs'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/original-baseline.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  `Original GoTab: ${report.files} files copied. UI assets preserved; local API/bootstrap compiled.`,
);
