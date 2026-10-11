'use client';

/**
 * DashboardNoSSR
 *
 * This is a thin 'use client' wrapper that uses next/dynamic with ssr: false.
 * It guarantees that DashboardClientPage and ALL its imports (Dashboard.tsx, etc.)
 * are NEVER executed during server-side rendering or the Next.js build prerender phase.
 *
 * This is the definitive fix for "TypeError: undefined is not a function at Array.filter"
 * during static page generation on /dashboard.
 */

import dynamic from 'next/dynamic';

const DashboardClientPage = dynamic(
    () => import('./DashboardClientPage'),
    {
        ssr: false,
        loading: () => (
            <div className="flex h-screen bg-[var(--ws-canvas)] overflow-hidden" role="status" aria-label="Loading workspace">
                <div className="hidden md:flex w-52 flex-col border-r border-[var(--ws-border)] bg-[var(--ws-sidebar)] p-2.5 shrink-0">
                    <div className="h-8 w-32 rounded-md bg-white/6 mb-4" />
                    <div className="space-y-1">
                        {Array.from({ length: 9 }).map((_, i) => (
                            <div key={i} className="h-8 rounded-md bg-[var(--ws-hover)]" />
                        ))}
                    </div>
                    <div className="mt-auto space-y-2 pt-2 border-t border-[var(--ws-border)]">
                        <div className="h-8 rounded-md bg-[var(--ws-hover)]" />
                        <div className="h-8 rounded-md bg-[var(--ws-hover)]" />
                    </div>
                </div>

                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <div className="flex h-10 md:h-11 items-center gap-3 border-b border-[var(--ws-border)] bg-[var(--ws-toolbar)] px-3 md:px-4 shrink-0">
                        <div className="h-7 w-full max-w-sm rounded-md bg-[var(--ws-hover)]" />
                        <div className="hidden sm:flex h-7 w-7 rounded-md bg-[var(--ws-hover)] ml-auto" />
                        <div className="h-7 w-24 rounded-md bg-[var(--ws-hover)]" />
                    </div>

                    <div className="flex-1 overflow-hidden p-2.5 md:p-3.5 custom-scrollbar">
                        <div className="mx-auto flex max-w-[1440px] flex-col gap-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="space-y-1">
                                    <div className="h-5 w-44 rounded-md bg-[var(--ws-hover)]" />
                                    <div className="h-3.5 w-64 max-w-full rounded bg-[var(--ws-hover)]" />
                                </div>
                                <div className="flex gap-2">
                                    <div className="h-7 w-24 rounded-md bg-[var(--ws-hover)]" />
                                    <div className="h-7 w-7 rounded-md bg-[var(--ws-hover)]" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="rounded-lg border border-[var(--ws-border)] bg-[var(--ws-panel)] p-2.5">
                                        <div className="h-3 w-16 rounded bg-[var(--ws-hover)]" />
                                        <div className="mt-2 h-6 w-20 rounded bg-white/6" />
                                        <div className="mt-2 h-1.5 rounded bg-[var(--ws-hover)]" />
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)]">
                                <div className="rounded-lg border border-[var(--ws-border)] bg-[var(--ws-panel)] p-3">
                                    <div className="h-4 w-32 rounded bg-white/6" />
                                    <div className="mt-3 h-48 rounded-md bg-[var(--ws-hover)]" />
                                </div>

                                <div className="rounded-lg border border-[var(--ws-border)] bg-[var(--ws-panel)] p-3">
                                    <div className="flex items-center justify-between">
                                        <div className="h-4 w-36 rounded bg-white/6" />
                                        <div className="h-6 w-20 rounded bg-[var(--ws-hover)]" />
                                    </div>
                                    <div className="mt-3 space-y-2">
                                        {Array.from({ length: 4 }).map((_, i) => (
                                            <div key={i} className="flex items-center gap-2.5 rounded-md border border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] p-2">
                                                <div className="h-6 w-6 rounded-full bg-[var(--ws-hover)]" />
                                                <div className="flex-1 space-y-1">
                                                    <div className="h-3 w-2/5 rounded bg-white/6" />
                                                    <div className="h-2.5 w-1/3 rounded bg-[var(--ws-hover)]" />
                                                </div>
                                                <div className="h-4 w-12 rounded bg-[var(--ws-hover)]" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        ),
    }
);

export default function DashboardNoSSR() {
    return <DashboardClientPage />;
}
