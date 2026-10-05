import Link from 'next/link';
import type { ReactNode } from 'react';

export type LegalSection = {
  id: string;
  title: string;
};

export function LegalPageShell({
  title,
  lastUpdated,
  intro,
  sections,
  children,
  badge,
}: {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
  children: ReactNode;
  badge?: string;
}) {
  return (
    <div className="legal-page-shell bg-[var(--marketing-bg-primary)] text-[var(--marketing-text-primary)]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              <div>
                <p className="type-caption uppercase tracking-caps text-teal-400">{badge ?? 'Legal'}</p>
                <h1 className="mt-2 text-3xl font-semibold text-white">{title}</h1>
                <p className="mt-3 type-card-description leading-6 text-[var(--ws-text-muted)]">{intro}</p>
              </div>

              <div className="rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-panel)]/60 p-4">
                <p className="type-caption font-semibold uppercase tracking-caps text-[var(--ws-text-muted)]">On this page</p>
                <ul className="mt-3 space-y-2">
                  {sections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        className="type-ui text-[var(--ws-text-secondary)] transition-colors hover:text-[var(--brand-blue-300)]"
                      >
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>

          <div>
            <div className="border-b border-[var(--ws-border)] pb-6 lg:hidden">
              <p className="type-caption uppercase tracking-caps text-teal-400">{badge ?? 'Legal'}</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">{title}</h1>
              <p className="mt-3 type-card-description leading-6 text-[var(--ws-text-muted)]">{intro}</p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 type-caption text-[var(--ws-text-muted)]">
              <span className="rounded-full border border-[var(--ws-border)] bg-[var(--ws-panel)] px-3 py-1">
                Last updated {lastUpdated}
              </span>
              <span className="rounded-full border border-[var(--ws-border)] bg-[var(--ws-panel)] px-3 py-1">
                Alphaclone Systems, LLC
              </span>
              <Link href="/legal/data-request" className="rounded-full border border-[var(--ws-border)] bg-[var(--ws-panel)] px-3 py-1 text-[var(--ws-text-secondary)] hover:text-[var(--brand-blue-300)]">
                Data rights
              </Link>
            </div>

            <div className="mt-10 space-y-12">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
