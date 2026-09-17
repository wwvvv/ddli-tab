import fs from 'node:fs/promises';
import path from 'node:path';
import { inspectEdgeOneConfig, verifyArtifactManifest } from './lib/deployment-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const json = process.argv.includes('--json');
try {
  const config = JSON.parse(await fs.readFile(path.join(root, 'edgeone.json'), 'utf8'));
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const warnings = inspectEdgeOneConfig(config, pkg);
  const artifact = await verifyArtifactManifest(path.join(root, 'dist-original'));
  const result = { status: 'passed', scope: 'legacy-static-artifact', files: artifact.files.length,
    bytes: artifact.files.reduce((sum, file) => sum + file.bytes, 0),
    digest: artifact.digest, cacheVersion: artifact.cacheVersion,
    cloudRuntime: 'not-run', browser: 'not-run', warnings };
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Static deployment preflight passed: ${result.files} files, ${result.bytes} bytes.`);
    console.log(`Artifact SHA-256: ${result.digest}`);
    for (const warning of warnings) console.warn(warning);
  }
} catch (error) {
  const result = { status: 'failed', scope: 'legacy-static-artifact',
    message: error instanceof SyntaxError ? 'Invalid deployment JSON' : error.message };
  if (json) console.log(JSON.stringify(result, null, 2));
  else console.error(`Static deployment preflight failed: ${result.message}`);
  process.exitCode = 1;
}
