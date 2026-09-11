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
            <div className="flex h-screen bg-[#05070b] overflow-hidden">
                <div className="hidden md:flex w-72 flex-col border-r border-white/5 bg-[#05070b] p-4 shrink-0">
                    <div className="h-12 w-40 rounded-2xl bg-white/6 mb-6" />
                    <div className="space-y-2">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="h-12 rounded-2xl bg-white/5" />
                        ))}
                    </div>
                    <div className="mt-auto space-y-4">
                        <div className="h-28 rounded-3xl bg-white/5" />
                        <div className="h-20 rounded-3xl bg-white/5" />
                    </div>
                </div>

                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <div className="flex h-20 items-center gap-4 border-b border-white/5 bg-[#05070b] px-5 md:px-6">
                        <div className="h-11 w-full max-w-xl rounded-2xl bg-white/5" />
                        <div className="hidden sm:flex h-11 w-11 rounded-full bg-white/5 ml-auto" />
                        <div className="h-11 w-32 rounded-2xl bg-white/5" />
                    </div>

                    <div className="flex-1 overflow-hidden p-4 md:p-6">
                        <div className="mx-auto flex max-w-[1600px] flex-col gap-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-3">
                                    <div className="h-12 w-64 rounded-2xl bg-white/5" />
                                    <div className="h-5 w-[28rem] max-w-full rounded-full bg-white/5" />
                                </div>
                                <div className="flex gap-3">
                                    <div className="h-12 w-36 rounded-2xl bg-white/5" />
                                    <div className="h-12 w-12 rounded-2xl bg-white/5" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)]">
                                <div className="rounded-[28px] border border-white/5 bg-white/[0.03] p-6">
                                    <div className="h-5 w-40 rounded-full bg-white/6" />
                                    <div className="mx-auto mt-10 h-64 w-64 rounded-full border-[18px] border-white/8" />
                                    <div className="mx-auto mt-6 h-6 w-28 rounded-full bg-white/6" />
                                    <div className="mx-auto mt-3 h-4 w-44 rounded-full bg-white/5" />
                                </div>

                                <div className="rounded-[28px] border border-white/5 bg-white/[0.03] p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-3">
                                            <div className="h-5 w-44 rounded-full bg-white/6" />
                                            <div className="h-10 w-40 rounded-full bg-white/5" />
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="h-10 w-32 rounded-2xl bg-white/5" />
                                            <div className="h-10 w-10 rounded-2xl bg-white/5" />
                                        </div>
                                    </div>
                                    <div className="mt-8 h-[320px] rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] border border-white/5" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                                        <div className="h-4 w-24 rounded-full bg-white/5" />
                                        <div className="mt-4 h-8 w-20 rounded-full bg-white/6" />
                                        <div className="mt-4 h-2 rounded-full bg-white/5" />
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                                <div className="rounded-[28px] border border-white/5 bg-white/[0.03] p-6">
                                    <div className="h-5 w-48 rounded-full bg-white/6" />
                                    <div className="mt-5 h-72 rounded-[24px] bg-white/[0.03]" />
                                </div>
                                <div className="rounded-[28px] border border-white/5 bg-white/[0.03] p-6">
                                    <div className="h-5 w-40 rounded-full bg-white/6" />
                                    <div className="mt-5 space-y-3">
                                        {Array.from({ length: 4 }).map((_, i) => (
                                            <div key={i} className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                                                <div className="h-10 w-10 rounded-full bg-white/5" />
                                                <div className="flex-1 space-y-2">
                                                    <div className="h-4 w-3/5 rounded-full bg-white/6" />
                                                    <div className="h-3 w-1/2 rounded-full bg-white/5" />
                                                </div>
                                                <div className="h-5 w-14 rounded-full bg-white/5" />
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
