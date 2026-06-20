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
            <div className="flex h-screen bg-slate-950 overflow-hidden animate-pulse">
                {/* Sidebar skeleton */}
                <div className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 p-4 space-y-3 shrink-0">
                    <div className="h-10 w-36 bg-slate-800 rounded-lg mb-4" />
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-2 py-2">
                            <div className="h-5 w-5 bg-slate-800 rounded" />
                            <div className="h-4 flex-1 bg-slate-800 rounded" />
                        </div>
                    ))}
                </div>
                {/* Main content area */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center px-6 gap-4 shrink-0">
                        <div className="flex-1 h-8 max-w-xs bg-slate-800 rounded-lg" />
                        <div className="h-8 w-8 bg-slate-800 rounded-full ml-auto" />
                    </div>
                    <div className="flex-1 overflow-auto p-6 space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                                    <div className="h-4 w-20 bg-slate-800 rounded" />
                                    <div className="h-7 w-16 bg-slate-700 rounded" />
                                </div>
                            ))}
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
