import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * M1 健康检查：与 M0 探针一致的 envelope（data + requestId）。
 * EdgeOne Node Functions 运行时同样返回 runtime: 'node'。
 */
export function GET() {
  return NextResponse.json({
    data: { ok: true, runtime: 'node' },
    requestId: crypto.randomUUID(),
  });
}
