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
    <main className="bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-teal-400">{badge ?? 'Legal'}</p>
                <h1 className="mt-2 text-3xl font-semibold text-white">{title}</h1>
                <p className="mt-3 text-sm leading-6 text-slate-400">{intro}</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">On this page</p>
                <ul className="mt-3 space-y-2">
                  {sections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        className="text-sm text-slate-300 transition-colors hover:text-teal-300"
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
            <div className="border-b border-slate-800 pb-6 lg:hidden">
              <p className="text-xs uppercase tracking-[0.2em] text-teal-400">{badge ?? 'Legal'}</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">{title}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400">{intro}</p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">
                Last updated {lastUpdated}
              </span>
              <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">
                AlphaClone Systems LLC
              </span>
              <Link href="/legal/data-request" className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-slate-300 hover:text-teal-300">
                Data rights
              </Link>
            </div>

            <div className="mt-10 space-y-12">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
