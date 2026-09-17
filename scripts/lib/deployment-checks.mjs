import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const ARTIFACT_MANIFEST = 'artifact-manifest.json';
const ENTRIES = ['index.html', 'newtab.html', 'popup.html'];
const REQUIRED = [...ENTRIES, 'ddli-local-sw.js', 'local/bootstrap.js',
  'local/api.js', 'local/cache-manifest.js', 'local/cloud-panel.js',
  'local/site-settings.js', 'siteConfig.js', 'config/default-template.json', 'LICENSE'];
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

export function readPublicCloudConfig(env) {
  const url = String(env.VITE_SUPABASE_URL || '').trim();
  const publishableKey = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (Boolean(url) !== Boolean(publishableKey))
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must both be configured');
  if (!url) return { url: '', publishableKey: '' };
  // Never include the rejected value (possibly a secret) in an error message.
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey))
    throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY must be a publishable key, not a private or legacy key');
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('Invalid VITE_SUPABASE_URL'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
      parsed.search || parsed.hash || parsed.pathname !== '/')
    throw new Error('VITE_SUPABASE_URL must be an HTTPS root URL without credentials, query or fragment');
  return { url: parsed.origin, publishableKey };
}

function publicFilePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') ||
      /[\\?#%\x00-\x20\x7f]/.test(value) ||
      value.split('/').some((part) => part === '.' || part === '..'))
    throw new Error('Invalid public resource path');
  return value === '/' ? 'index.html' : value.slice(1);
}

async function inventory(directory) {
  const files = [];
  const rootStat = await fs.lstat(directory);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink())
    throw new Error('Artifact root must be a real directory');
  async function walk(current, prefix = '') {
    const entries = await fs.readdir(current, { withFileTypes: true });
    entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const entry of entries) {
      const relative = prefix + entry.name;
      const name = entry.name.toLowerCase();
      if (entry.isSymbolicLink()) throw new Error(`Symlink in artifact: ${relative}`);
      if (name === '.git' || name === 'node_modules' || /^\.env(?:\.|$)/.test(name) ||
          /^(?:id_rsa|id_ed25519|credentials\.json|service-account\.json)$/.test(name) ||
          /\.(?:pem|key|p12|pfx)$/.test(name))
        throw new Error(`Non-public file in artifact: ${relative}`);
      if (entry.isDirectory()) await walk(path.join(current, entry.name), relative + '/');
      else if (entry.isFile()) {
        if (relative === ARTIFACT_MANIFEST) continue;
        publicFilePath('/' + relative);
        const bytes = await fs.readFile(path.join(current, entry.name));
        files.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes) });
      } else throw new Error(`Unsupported artifact entry: ${relative}`);
    }
  }
  await walk(directory);
  return files;
}

/** Check generated local module references, not an exhaustive JS parser. */
async function checkLocalReferences(directory, files) {
  const names = new Set(files.map((file) => file.path));
  const requireFile = (url) => {
    const relative = publicFilePath(url);
    if (!names.has(relative)) throw new Error(`Missing referenced artifact: ${relative}`);
  };
  for (const entry of ENTRIES) {
    const html = await fs.readFile(path.join(directory, entry), 'utf8');
    const original = html.match(/data-original-entry=["']([^"']+)["']/);
    if (!original) throw new Error(`Missing original entry in ${entry}`);
    requireFile(original[1]);
    if (!html.includes('/local/bootstrap.js')) throw new Error(`Missing bootstrap in ${entry}`);
    for (const tag of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
      for (const attribute of tag[0].matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
        if (attribute[1].startsWith('/') && !attribute[1].startsWith('//')) requireFile(attribute[1]);
      }
    }
  }
  for (const file of files.filter((item) => item.path === 'ddli-local-sw.js' ||
      (item.path.startsWith('local/') && item.path.endsWith('.js')))) {
    const source = await fs.readFile(path.join(directory, file.path), 'utf8');
    for (const match of source.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g)) {
      const specifier = match[1];
      if (specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/')) {
        // Reject traversal above artifact root before URL normalization can hide it.
        const joined = specifier.startsWith('/') ? specifier : '/' + path.posix.join(path.posix.dirname(file.path), specifier);
        requireFile(joined);
      }
    }
  }
}

export async function inspectStaticArtifact(directory) {
  const files = await inventory(directory);
  const sizes = new Map(files.map((file) => [file.path, file.bytes]));
  for (const required of REQUIRED)
    if (!sizes.get(required)) throw new Error(`Missing or empty artifact: ${required}`);
  const text = await fs.readFile(path.join(directory, 'local/cache-manifest.js'), 'utf8');
  // Parse JSON literals only; never execute a generated module to inspect it.
  const match = text.match(/^\s*export const CORE_FILES = (\[[^\n]*\]);\s*export const CACHE_VERSION = ("[^"\n]*");\s*$/);
  if (!match) throw new Error('Unexpected cache manifest format');
  let coreFiles, cacheVersion;
  try { coreFiles = JSON.parse(match[1]); cacheVersion = JSON.parse(match[2]); }
  catch { throw new Error('Invalid cache manifest JSON'); }
  if (!coreFiles.length || new Set(coreFiles).size !== coreFiles.length || !/^[a-f0-9]{16}$/.test(cacheVersion))
    throw new Error('Invalid or duplicate cache manifest entries/version');
  for (const url of coreFiles) {
    const file = publicFilePath(url);
    if (!sizes.has(file)) throw new Error(`Missing precache artifact: ${file}`);
  }
  for (const entry of ['/', ...ENTRIES.map((file) => '/' + file), '/local/bootstrap.js'])
    if (!coreFiles.includes(entry)) throw new Error(`Required entry is not precached: ${entry}`);
  await checkLocalReferences(directory, files);
  const manifest = { schemaVersion: 1, kind: 'legacy-static', cacheVersion, files };
  return { ...manifest, digest: sha256(JSON.stringify(manifest)) };
}

export async function writeArtifactManifest(directory) {
  const manifest = await inspectStaticArtifact(directory);
  await fs.writeFile(path.join(directory, ARTIFACT_MANIFEST), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

export async function verifyArtifactManifest(directory) {
  const stored = JSON.parse(await fs.readFile(path.join(directory, ARTIFACT_MANIFEST), 'utf8'));
  const actual = await inspectStaticArtifact(directory);
  if (JSON.stringify(stored) !== JSON.stringify(actual))
    throw new Error('Artifact manifest mismatch: files changed, are missing, or were added after build');
  return actual;
}

export function inspectEdgeOneConfig(config, pkg) {
  if (config.installCommand !== 'npm ci --omit=dev' ||
      config.buildCommand !== 'npm run verify:edge' || config.outputDirectory !== 'dist-original')
    throw new Error('Unexpected legacy EdgeOne install/build/output configuration');
  if (!/^\d+\.\d+\.\d+$/.test(config.nodeVersion || '')) throw new Error('Pin the EdgeOne build Node version');
  if (pkg.scripts?.['build:edge'] !== 'node scripts/build-original.mjs' ||
      pkg.scripts?.['check:edge'] !== 'node scripts/check-deployment.mjs' ||
      pkg.scripts?.['verify:edge'] !== 'npm run build:edge && npm run check:edge')
    throw new Error('EdgeOne scripts do not match the verified legacy build chain');
  const header = (source, key) => config.headers?.flatMap((rule) => rule.source === source ? rule.headers : [])
    .filter((item) => item.key.toLowerCase() === key.toLowerCase()).at(-1)?.value;
  if (header('/ddli-local-sw.js', 'Service-Worker-Allowed') !== '/' ||
      header('/ddli-local-sw.js', 'Cache-Control') !== 'no-store' ||
      header('/*', 'Cache-Control') !== 'no-cache' || header('/*', 'X-Content-Type-Options') !== 'nosniff')
    throw new Error('Required legacy cache/Service Worker response headers are missing');
  return ['Checks cover static artifacts/config only, not EdgeOne, Auth, RLS or browser execution.',
    ...(config.rewrites?.some((rule) => rule.source === '/*')
      ? ['Legacy catch-all rewrite remains. Do not expose /os or new APIs until SW AND server routing are migrated.'] : [])];
}
