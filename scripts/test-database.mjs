import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const cwd = path.resolve(import.meta.dirname, '..');
const name = `dtab-sync-test-${process.pid}`;
const docker = (args, options = {}) =>
  execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options });
let created = false;
try {
  docker([
    'run',
    '--detach',
    '--rm',
    '--name',
    name,
    '--network',
    'none',
    '--env',
    'POSTGRES_HOST_AUTH_METHOD=trust',
    'postgres:17-alpine',
  ]);
  created = true;
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      docker(['exec', name, 'pg_isready', '-U', 'postgres']);
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!ready) throw new Error('Isolated PostgreSQL did not become ready');
  for (const file of [
    'supabase/tests/local-auth-harness.sql',
    'supabase/migrations/202609100001_personal_sync.sql',
    'supabase/tests/personal-sync.sql',
  ]) {
    const output = docker(['exec', '-i', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
      input: fs.readFileSync(path.join(cwd, file), 'utf8'),
    });
    console.log(file + '\n' + output);
  }
} finally {
  if (created) docker(['rm', '--force', name]);
}
