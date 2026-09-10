import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
const tempRoot = await fs.realpath(os.tmpdir());
const workspace = await fs.mkdtemp(path.join(tempRoot, 'dtab-production-check-'));
try {
  for (const file of ['package.json', 'package-lock.json'])
    await fs.copyFile(path.join(root, file), path.join(workspace, file));
  for (const dir of ['scripts', 'src', 'config', 'legacy'])
    await fs.cp(path.join(root, dir), path.join(workspace, dir), { recursive: true });
  // Deliberately do not copy .env files, node_modules, previous builds or credentials.
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--omit=dev'], {
    cwd: workspace,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  execFileSync(process.execPath, ['scripts/build-original.mjs'], {
    cwd: workspace,
    stdio: 'inherit',
  });
  for (const file of ['index.html', 'ddli-local-sw.js', 'local/cloud-panel.js', 'siteConfig.js']) {
    if (!(await fs.stat(path.join(workspace, 'dist-original', file))).size)
      throw new Error('Missing production output: ' + file);
  }
  try {
    await fs.access(path.join(workspace, 'node_modules/typescript'));
    throw new Error('Development dependency leaked into production check');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  console.log(
    `Clean production-only build passed under ${process.version} on ${process.platform}.`,
  );
} finally {
  const resolved = await fs.realpath(workspace);
  if (
    path.dirname(resolved) !== tempRoot ||
    !path.basename(resolved).startsWith('dtab-production-check-')
  )
    throw new Error('Unexpected cleanup path');
  await fs.rm(resolved, { recursive: true, force: true });
}
