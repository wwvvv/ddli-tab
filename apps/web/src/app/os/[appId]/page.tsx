import { notFound } from 'next/navigation';
import { findOsApp, osApps } from '@/os/registry';
import { OS_BASE_PATH } from '@/os/routes';

// 未知 appId 一律 404（M1 退出标准：404 不返回旧 HTML）。
export const dynamicParams = false;

export function generateStaticParams() {
  return osApps.map((app) => ({ appId: app.id }));
}

export default async function OsAppPage({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  const { appId } = await params;
  const app = findOsApp(appId);
  if (!app) notFound();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[var(--dt-bg)] px-6 text-[var(--dt-text)]">
      <div className="w-full max-w-xl rounded-3xl border border-[var(--dt-border)] bg-[var(--dt-surface)] p-10 text-center">
        <h1 className="text-2xl font-semibold">{app.name}</h1>
        <p className="mt-3 text-sm text-[var(--dt-text-muted)]">{app.description}</p>
        <p className="mt-6 text-xs text-[var(--dt-text-muted)]">
          {app.system ? '系统应用' : '应用'} · M1 占位页，功能按里程碑逐步交付
        </p>
        <a
          href={OS_BASE_PATH}
          className="mt-8 inline-flex rounded-full bg-[var(--dt-accent)] px-5 py-2 text-sm font-medium text-white"
        >
          返回桌面
        </a>
      </div>
    </main>
  );
}
