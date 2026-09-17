import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { withStagedOutput } from './lib/build-output.mjs';
import { ARTIFACT_MANIFEST, readPublicCloudConfig, inspectStaticArtifact,
  writeArtifactManifest, verifyArtifactManifest, inspectEdgeOneConfig } from './lib/deployment-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const config = JSON.parse(await fs.readFile(path.join(root, 'edgeone.json'), 'utf8'));
const KEY = 'sb_publishable_test_fixture';
const URL = 'https://fixture.supabase.co';
async function temp(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dtab-deploy-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}
async function put(directory, relative, content) {
  const target = path.join(directory, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
}
async function fixture(directory) {
  const files = {
    'index.html': '<script type="module" data-original-entry="/assets/app.js" src="/local/bootstrap.js"></script>',
    'newtab.html': '<script type="module" data-original-entry="/assets/app.js" src="/local/bootstrap.js"></script>',
    'popup.html': '<script type="module" data-original-entry="/assets/app.js" src="/local/bootstrap.js"></script>',
    'assets/app.js': 'export const fixture = true;',
    'ddli-local-sw.js': "import { CORE_FILES } from './local/cache-manifest.js';\nimport { handleLocalApi } from './local/api.js';",
    'local/bootstrap.js': "import { installCloudPanel } from './cloud-panel.js';",
    'local/api.js': 'export function handleLocalApi() {}',
    'local/cloud-panel.js': 'export function installCloudPanel() {}',
    'local/site-settings.js': 'export const SITE_CONFIG = {};',
    'siteConfig.js': 'globalThis.siteConfig = {};',
    'config/default-template.json': '{"schemaVersion":1,"version":"fixture","data":{"appData":{"listData":[]}}}',
    'LICENSE': 'Test fixture; not upstream application code.',
  };
  for (const [name, content] of Object.entries(files)) await put(directory, name, content);
  const core = ['/', ...Object.keys(files).map((name) => '/' + name)];
  await put(directory, 'local/cache-manifest.js', `export const CORE_FILES = ${JSON.stringify(core)};\nexport const CACHE_VERSION = "0123456789abcdef";\n`);
}
async function mutateCache(directory, mutate) {
  const file = path.join(directory, 'local/cache-manifest.js');
  const text = await fs.readFile(file, 'utf8');
  const current = JSON.parse(text.match(/CORE_FILES = (.*);/)[1]);
  await fs.writeFile(file, text.replace(JSON.stringify(current), JSON.stringify(mutate(current))));
}

test('no cloud configuration remains a supported local-only build', () => {
  assert.deepEqual(readPublicCloudConfig({}), { url: '', publishableKey: '' });
});
test('only explicitly public configuration enters the bundle', () => {
  assert.deepEqual(readPublicCloudConfig({ VITE_SUPABASE_URL: URL + '/', VITE_SUPABASE_PUBLISHABLE_KEY: KEY,
    SUPABASE_SERVICE_ROLE_KEY: 'private-not-forwarded', IMGBED_TOKEN: 'private-not-forwarded' }),
    { url: URL, publishableKey: KEY });
});
test('configuration trims harmless whitespace', () => {
  assert.deepEqual(readPublicCloudConfig({ VITE_SUPABASE_URL: ` ${URL} `, VITE_SUPABASE_PUBLISHABLE_KEY: ` ${KEY} ` }), { url: URL, publishableKey: KEY });
});
for (const env of [{ VITE_SUPABASE_URL: URL }, { VITE_SUPABASE_PUBLISHABLE_KEY: KEY }]) {
  test('partial cloud configuration fails without echoing input', () => {
    assert.throws(() => readPublicCloudConfig(env), /both be configured/);
  });
}
for (const key of ['sb_secret_private_fixture', 'eyJhbGciOiJIUzI1NiJ9.secret', 'sk-private-fixture', 'sb_publishable_bad\nsecret']) {
  test(`rejects non-public key category ${key.split('_')[0]}`, () => {
    assert.throws(() => readPublicCloudConfig({ VITE_SUPABASE_URL: URL, VITE_SUPABASE_PUBLISHABLE_KEY: key }), (error) => {
      assert.ok(!error.message.includes(key)); return /publishable key/.test(error.message);
    });
  });
}
for (const url of ['http://example.com', 'https://u:private@example.com', 'https://example.com/api',
  'https://example.com?token=private', 'https://example.com#private', 'not-a-url']) {
  test(`rejects invalid public URL ${url.split(':')[0]}`, () => {
    assert.throws(() => readPublicCloudConfig({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: KEY }),
      (error) => !error.message.includes('private') && /VITE_SUPABASE_URL/.test(error.message));
  });
}

test('valid fixture produces deterministic manifest and verifies', async (t) => {
  const directory = await temp(t); await fixture(directory);
  const first = await writeArtifactManifest(directory);
  const second = await verifyArtifactManifest(directory);
  assert.deepEqual(second, first);
  assert.equal(first.kind, 'legacy-static');
  assert.ok(!first.files.some((file) => file.path === ARTIFACT_MANIFEST));
  assert.equal((await writeArtifactManifest(directory)).digest, first.digest);
});
test('equivalent artifacts in different directories have the same digest', async (t) => {
  const a = await temp(t), b = await temp(t); await fixture(a); await fixture(b);
  assert.equal((await writeArtifactManifest(a)).digest, (await writeArtifactManifest(b)).digest);
});
for (const file of ['index.html', 'local/bootstrap.js', 'local/cloud-panel.js', 'LICENSE']) {
  test(`missing required artifact is rejected: ${file}`, async (t) => {
    const directory = await temp(t); await fixture(directory);
    await fs.unlink(path.join(directory, file));
    await assert.rejects(inspectStaticArtifact(directory), /Missing or empty/);
  });
}
test('empty required output is rejected', async (t) => {
  const directory = await temp(t); await fixture(directory); await put(directory, 'index.html', '');
  await assert.rejects(inspectStaticArtifact(directory), /Missing or empty/);
});
test('missing original entry dependency is detected', async (t) => {
  const directory = await temp(t); await fixture(directory);
  await put(directory, 'index.html', '<script data-original-entry="/assets/missing.js" src="/local/bootstrap.js"></script>');
  await assert.rejects(inspectStaticArtifact(directory), /Missing referenced/);
});
test('HTML without the legacy entry hook is not deployable', async (t) => {
  const directory = await temp(t); await fixture(directory); await put(directory, 'index.html', '<h1>broken build</h1>');
  await assert.rejects(inspectStaticArtifact(directory), /Missing original entry/);
});
test('local stylesheet reference is checked', async (t) => {
  const directory = await temp(t); await fixture(directory);
  await fs.appendFile(path.join(directory, 'index.html'), '<link rel="stylesheet" href="/assets/missing.css">');
  await assert.rejects(inspectStaticArtifact(directory), /Missing referenced/);
});
test('worker import path relocation is checked', async (t) => {
  const directory = await temp(t); await fixture(directory);
  await put(directory, 'ddli-local-sw.js', "import { handleLocalApi } from './api.js';");
  await assert.rejects(inspectStaticArtifact(directory), /Missing referenced/);
});
test('missing bootstrap module is detected', async (t) => {
  const directory = await temp(t); await fixture(directory);
  await fs.appendFile(path.join(directory, 'local/bootstrap.js'), "\nimport { x } from './not-built.js';");
  await assert.rejects(inspectStaticArtifact(directory), /Missing referenced/);
});
test('module path cannot traverse outside output', async (t) => {
  const directory = await temp(t); await fixture(directory);
  await put(directory, 'local/bootstrap.js', "import '../../private.js';");
  await assert.rejects(inspectStaticArtifact(directory), /Invalid public resource path/);
});
for (const extra of ['/missing.js', '/api/v1/private?token=private', '/../secret', '//evil.invalid/x', '/assets/%2e%2e/x']) {
  test(`reject invalid or missing precache resource ${extra}`, async (t) => {
    const directory = await temp(t); await fixture(directory);
    await mutateCache(directory, (items) => [...items, extra]);
    await assert.rejects(inspectStaticArtifact(directory), /Invalid public resource path|Missing precache/);
  });
}
test('duplicate precache entry is rejected', async (t) => {
  const directory = await temp(t); await fixture(directory);
  await mutateCache(directory, (items) => [...items, '/']);
  await assert.rejects(inspectStaticArtifact(directory), /duplicate/);
});
test('required HTML must remain precached for legacy offline entry', async (t) => {
  const directory = await temp(t); await fixture(directory);
  await mutateCache(directory, (items) => items.filter((url) => url !== '/newtab.html'));
  await assert.rejects(inspectStaticArtifact(directory), /not precached/);
});
test('manifest inspection never evaluates appended JavaScript', async (t) => {
  const directory = await temp(t); await fixture(directory);
  await fs.appendFile(path.join(directory, 'local/cache-manifest.js'), '\nglobalThis.DTAB_EXECUTED = true;');
  await assert.rejects(inspectStaticArtifact(directory), /Unexpected cache manifest/);
  assert.equal(globalThis.DTAB_EXECUTED, undefined);
});
for (const secret of ['.env', 'config/.env.local', '.git/config', 'node_modules/pkg/a.js', 'config/service-account.json', 'private.pem']) {
  test(`rejects forbidden artifact filename ${secret}`, async (t) => {
    const directory = await temp(t); await fixture(directory); await put(directory, secret, 'test-private-placeholder');
    await assert.rejects(inspectStaticArtifact(directory), /Non-public file/);
  });
}
test('symlink artifact is rejected without traversing its target', async (t) => {
  const directory = await temp(t); await fixture(directory);
  const elsewhere = await temp(t); await put(elsewhere, 'untouched', 'keep');
  await fs.symlink(elsewhere, path.join(directory, 'link'), 'junction');
  await assert.rejects(inspectStaticArtifact(directory), /Symlink/);
  assert.equal(await fs.readFile(path.join(elsewhere, 'untouched'), 'utf8'), 'keep');
});
for (const mutation of ['change', 'add', 'remove']) {
  test(`manifest detects post-build ${mutation}`, async (t) => {
    const directory = await temp(t); await fixture(directory); await writeArtifactManifest(directory);
    if (mutation === 'change') await put(directory, 'assets/app.js', 'changed');
    if (mutation === 'add') await put(directory, 'assets/stale.js', 'stale');
    if (mutation === 'remove') await fs.unlink(path.join(directory, 'assets/app.js'));
    await assert.rejects(verifyArtifactManifest(directory), /mismatch|Missing precache/);
  });
}

test('staging removes stale artifacts and keeps output readable during build', async (t) => {
  const repository = await temp(t);
  await put(repository, 'dist-original/index.html', 'old'); await put(repository, 'dist-original/stale.js', 'old');
  await put(repository, '.dtab-build-unrelated/keep', 'keep');
  const result = await withStagedOutput(repository, async (output) => {
    assert.equal(await fs.readFile(path.join(repository, 'dist-original/index.html'), 'utf8'), 'old');
    await put(output, 'index.html', 'new'); return 'result';
  });
  assert.equal(result, 'result');
  assert.equal(await fs.readFile(path.join(repository, 'dist-original/index.html'), 'utf8'), 'new');
  await assert.rejects(fs.access(path.join(repository, 'dist-original/stale.js')), { code: 'ENOENT' });
  assert.equal(await fs.readFile(path.join(repository, '.dtab-build-unrelated/keep'), 'utf8'), 'keep');
  assert.deepEqual((await fs.readdir(repository)).sort(), ['.dtab-build-unrelated', 'dist-original']);
});
test('compilation or validation error preserves previous artifact', async (t) => {
  const repository = await temp(t); await put(repository, 'dist-original/keep', 'previous');
  await assert.rejects(withStagedOutput(repository, async (output) => {
    await put(output, 'partial', 'bad'); throw new Error('fixture compilation failure');
  }), /fixture compilation/);
  assert.equal(await fs.readFile(path.join(repository, 'dist-original/keep'), 'utf8'), 'previous');
  assert.deepEqual(await fs.readdir(repository), ['dist-original']);
});
test('first failed build leaves no half-built output', async (t) => {
  const repository = await temp(t);
  await assert.rejects(withStagedOutput(repository, async () => { throw new Error('failed'); }), /failed/);
  assert.deepEqual(await fs.readdir(repository), []);
});
test('failed publication restores previous output', async (t) => {
  const repository = await temp(t); await put(repository, 'dist-original/keep', 'previous');
  await assert.rejects(withStagedOutput(repository, async (output) => {
    // Simulates loss of the staged artifact after the builder returns.
    await fs.rm(output, { recursive: true });
  }), { code: 'ENOENT' });
  assert.equal(await fs.readFile(path.join(repository, 'dist-original/keep'), 'utf8'), 'previous');
  assert.deepEqual(await fs.readdir(repository), ['dist-original']);
});
test('pre-existing lock is never removed or stolen', async (t) => {
  const repository = await temp(t); await put(repository, '.dtab-build.lock/owner.json', 'owner');
  await assert.rejects(withStagedOutput(repository, async () => assert.fail('must not run')), /Build lock exists/);
  assert.equal(await fs.readFile(path.join(repository, '.dtab-build.lock/owner.json'), 'utf8'), 'owner');
});
test('concurrent invocation is rejected while first continues', async (t) => {
  const repository = await temp(t); let release, entered;
  const wait = new Promise((resolve) => { release = resolve; });
  const ready = new Promise((resolve) => { entered = resolve; });
  const first = withStagedOutput(repository, async (output) => { entered(); await wait; await put(output, 'ok', 'yes'); });
  await ready;
  try { await assert.rejects(withStagedOutput(repository, async () => {}), /Build lock exists/); }
  finally { release(); await first; }
  assert.equal(await fs.readFile(path.join(repository, 'dist-original/ok'), 'utf8'), 'yes');
});
test('symlink output does not replace or delete external files', async (t) => {
  const repository = await temp(t), elsewhere = await temp(t); await put(elsewhere, 'keep', 'keep');
  await fs.symlink(elsewhere, path.join(repository, 'dist-original'), 'junction');
  await assert.rejects(withStagedOutput(repository, async () => {}), /real directory/);
  assert.equal(await fs.readFile(path.join(elsewhere, 'keep'), 'utf8'), 'keep');
});
test('file in place of output directory is not overwritten', async (t) => {
  const repository = await temp(t); await put(repository, 'dist-original', 'keep');
  await assert.rejects(withStagedOutput(repository, async () => {}), /real directory/);
  assert.equal(await fs.readFile(path.join(repository, 'dist-original'), 'utf8'), 'keep');
});
test('repository EdgeOne build chain is validated but reports legacy-only scope', () => {
  const warnings = inspectEdgeOneConfig(config, pkg);
  assert.ok(warnings.some((text) => text.includes('not EdgeOne')));
  assert.ok(warnings.some((text) => text.includes('Legacy catch-all')));
});
for (const patch of [{ outputDirectory: '.' }, { buildCommand: 'next start' }, { installCommand: 'npm install' }, { nodeVersion: 'latest' }, { headers: [] }]) {
  test(`deployment config drift fails: ${Object.keys(patch)[0]}`, () => {
    assert.throws(() => inspectEdgeOneConfig({ ...config, ...patch }, pkg));
  });
}
test('recursive/mismatched build command is rejected', () => {
  assert.throws(() => inspectEdgeOneConfig(config, { ...pkg, scripts: { ...pkg.scripts, 'build:edge': 'npm run verify:edge' } }), /scripts/);
});
test('preflight CLI runs on a fixture without npm packages; cloud is not marked passed', async (t) => {
  const repository = await temp(t);
  await fs.cp(path.join(root, 'scripts/lib'), path.join(repository, 'scripts/lib'), { recursive: true });
  await fs.copyFile(path.join(root, 'scripts/check-deployment.mjs'), path.join(repository, 'scripts/check-deployment.mjs'));
  await put(repository, 'package.json', JSON.stringify(pkg)); await put(repository, 'edgeone.json', JSON.stringify(config));
  await fixture(path.join(repository, 'dist-original')); await writeArtifactManifest(path.join(repository, 'dist-original'));
  const output = execFileSync(process.execPath, ['scripts/check-deployment.mjs', '--json'], { cwd: repository, encoding: 'utf8' });
  const result = JSON.parse(output);
  assert.equal(result.status, 'passed'); assert.equal(result.cloudRuntime, 'not-run'); assert.equal(result.browser, 'not-run');
  await put(repository, 'dist-original/stale.js', 'stale');
  const failed = spawnSync(process.execPath, ['scripts/check-deployment.mjs', '--json'], { cwd: repository, encoding: 'utf8' });
  assert.equal(failed.status, 1); assert.equal(JSON.parse(failed.stdout).status, 'failed');
});

test('staged fixture passes the same manifest check used by deployment', async (t) => {
  const repository = await temp(t);
  await withStagedOutput(repository, async (output) => { await fixture(output); await writeArtifactManifest(output); });
  assert.equal((await verifyArtifactManifest(path.join(repository, 'dist-original'))).kind, 'legacy-static');
});
test('artifact validation failure leaves previous validated build intact', async (t) => {
  const repository = await temp(t);
  await withStagedOutput(repository, async (output) => { await fixture(output); await writeArtifactManifest(output); });
  const before = await verifyArtifactManifest(path.join(repository, 'dist-original'));
  await assert.rejects(withStagedOutput(repository, async (output) => {
    await fixture(output); await put(output, 'local/.env', 'test-secret'); await writeArtifactManifest(output);
  }), /Non-public file/);
  assert.equal((await verifyArtifactManifest(path.join(repository, 'dist-original'))).digest, before.digest);
});
