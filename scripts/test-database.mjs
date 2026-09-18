import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const cwd = path.resolve(import.meta.dirname, '..');
const docker = (args, options = {}) =>
  execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options });
const SQL_FILES = [
  'supabase/tests/local-auth-harness.sql',
  'supabase/migrations/202609100001_personal_sync.sql',
  // Check the historical contract before applying the fail-closed upgrade.
  'supabase/tests/personal-sync.sql',
  'supabase/migrations/202609180001_sync_owner_guard.sql',
  'supabase/tests/sync-owner-guard.sql',
];

// 官方 postgres 镜像初始化期会短暂运行一个临时服务器（init 脚本窗口），
// 单次 pg_isready 成功可能是假阳性（随后临时服务器关闭、正式服务器未起，
// psql 会撞上 socket 空窗——2026-09-17 GitHub CI 首跑复现）。
// 因此要求连续 5 次成功（每 500ms 一次，跨约 2s+）才认定就绪。
async function waitForReady(name) {
  let consecutive = 0;
  for (let i = 0; i < 120; i++) {
    try {
      docker(['exec', name, 'pg_isready', '-U', 'postgres']);
      consecutive += 1;
      if (consecutive >= 5) return;
    } catch {
      consecutive = 0;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Isolated PostgreSQL did not become ready');
}

async function runOnce(name) {
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
  try {
    await waitForReady(name);
    for (const file of SQL_FILES) {
      const output = docker(['exec', '-i', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
        input: fs.readFileSync(path.join(cwd, file), 'utf8'),
      });
      console.log(file + '\n' + output);
    }
  } finally {
    try {
      docker(['rm', '--force', name]);
    } catch {
      // 容器可能已被 --rm 回收，忽略
    }
  }
}

const base = `dtab-sync-test-${process.pid}`;
for (let attempt = 1; attempt <= 3; attempt++) {
  const name = attempt === 1 ? base : `${base}-retry${attempt}`;
  try {
    await runOnce(name);
    process.exit(0);
  } catch (error) {
    const text = `${error?.stderr ?? ''}\n${error?.message ?? ''}`;
    const transient = text.includes('connection to server') || text.includes('No such file or directory');
    if (attempt === 3 || !transient) {
      console.error(error);
      process.exit(1);
    }
    console.error(`test-database: transient failure (attempt ${attempt}), retrying with a fresh container`);
  }
}
