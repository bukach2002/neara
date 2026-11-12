import { ReactNode } from 'react';
import { AppBar, AppShell } from './app-shell';

/**
 * Shared layout for the public policy pages the mobile app links to
 * (/privacy, /terms, /support). Keep those URLs stable — app builds point at them.
 */
export function LegalPage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <AppShell>
      <AppBar />
      <main className="n-main">
        <article className="n-legal n-stack-lg">
          <header className="n-stack">
            <p className="n-eyebrow">{eyebrow}</p>
            <h1 className="n-display">{title}</h1>
            {updated ? <p className="n-meta">Last updated {updated}</p> : null}
          </header>

          <div className="n-card n-card-pad n-stack-lg">{children}</div>
        </article>
      </main>
    </AppShell>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="n-stack">
      <h2 className="n-title">{title}</h2>
      {children}
    </section>
  );
}
