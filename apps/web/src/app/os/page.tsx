import { osApps } from '@/os/registry';
import { osAppHref } from '@/os/routes';

export default function OsDesktopPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-[var(--dt-bg)] text-[var(--dt-text)]">
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">DTab</h1>
        <p className="mt-2 text-sm text-[var(--dt-text-muted)]">
          个人 Web OS 源码壳 · M1 最小导航
        </p>
        <ul className="mt-10 grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
          {osApps.map((app) => (
            <li key={app.id}>
              <a
                href={osAppHref(app.id)}
                className="flex h-full flex-col items-center gap-3 rounded-2xl border border-[var(--dt-border)] bg-[var(--dt-surface)] p-6 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span
                  aria-hidden
                  className="grid size-12 place-items-center rounded-xl bg-[var(--dt-accent)] text-xl font-semibold text-white"
                >
                  {app.name.slice(0, 1)}
                </span>
                <span className="font-medium">{app.name}</span>
                <span className="text-center text-xs text-[var(--dt-text-muted)]">
                  {app.description}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
      <nav
        aria-label="Dock"
        className="sticky bottom-4 mx-auto mb-6 flex gap-4 rounded-3xl border border-[var(--dt-border)] bg-[var(--dt-surface)] px-5 py-3 shadow-lg"
      >
        {osApps.map((app) => (
          <a
            key={app.id}
            href={osAppHref(app.id)}
            title={app.name}
            className="grid size-12 place-items-center rounded-xl bg-[var(--dt-accent)] text-lg font-semibold text-white"
          >
            {app.name.slice(0, 1)}
          </a>
        ))}
      </nav>
    </main>
  );
}
