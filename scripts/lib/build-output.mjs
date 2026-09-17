import fs from 'node:fs/promises';
import path from 'node:path';

async function outputExists(output) {
  try {
    const stat = await fs.lstat(output);
    if (stat.isSymbolicLink() || !stat.isDirectory())
      throw new Error('dist-original must be a real directory, not a symlink or file');
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

/** Build in an empty sibling directory; publish only after build() resolves.
 * A lock rejects concurrent builds. It is deliberately NOT stolen on a timeout.
 * This handles ordinary errors, not a crash-atomic two-directory transaction.
 */
export async function withStagedOutput(repositoryRoot, build) {
  const root = await fs.realpath(repositoryRoot);
  const output = path.join(root, 'dist-original');
  const lock = path.join(root, '.dtab-build.lock');
  try {
    await fs.mkdir(lock);
  } catch (error) {
    if (error.code === 'EEXIST')
      throw new Error('Build lock exists. Stop the other build or inspect the stale .dtab-build.lock before retrying.');
    throw error;
  }

  let workspace;
  let preserveRecovery = false;
  try {
    await fs.writeFile(path.join(lock, 'owner.json'), JSON.stringify({ pid: process.pid }));
    await outputExists(output);
    workspace = await fs.mkdtemp(path.join(root, '.dtab-build-'));
    const staged = path.join(workspace, 'output');
    const backup = path.join(workspace, 'previous-output');
    await fs.mkdir(staged);
    const result = await build(staged);
    // Recheck before renames, in case another non-cooperating process changed it.
    const hadOutput = await outputExists(output);
    if (hadOutput) await fs.rename(output, backup);
    try {
      await fs.rename(staged, output);
    } catch (publishError) {
      if (hadOutput) {
        try {
          await fs.rename(backup, output);
        } catch (restoreError) {
          preserveRecovery = true;
          throw new AggregateError([publishError, restoreError],
            `Publication and restoration failed; previous output is retained in ${path.basename(workspace)}/previous-output. Do not delete the recovery directory.`);
        }
      }
      throw publishError;
    }
    return result;
  } finally {
    // Remove ONLY directories created by this invocation. Never sweep by glob.
    try {
      if (workspace && !preserveRecovery) await fs.rm(workspace, { recursive: true, force: true });
    } finally {
      if (!preserveRecovery) await fs.rm(lock, { recursive: true, force: true });
    }
  }
}
