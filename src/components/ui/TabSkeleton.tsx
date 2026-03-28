'use client';

import React from 'react';

/**
 * Generic animated skeleton for lazy-loaded dashboard tabs.
 * Renders instantly as a Suspense fallback so users never see a blank screen.
 */
export const TabSkeleton: React.FC<{ rows?: number; showStats?: boolean }> = ({
    rows = 6,
    showStats = true,
}) => {
    const safeRows = Math.max(1, Number(rows) || 6);
    return (
    <div className="space-y-6 animate-pulse p-1">
        {/* Header row */}
        <div className="flex items-center justify-between">
            <div className="h-7 w-48 bg-slate-800 rounded-lg" />
            <div className="h-9 w-28 bg-slate-800 rounded-lg" />
        </div>

        {/* Stat cards */}
        {showStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                        <div className="h-4 w-20 bg-slate-800 rounded" />
                        <div className="h-7 w-16 bg-slate-700 rounded" />
                    </div>
                ))}
            </div>
        )}

        {/* Table / list rows */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="flex gap-4 px-4 py-3 border-b border-slate-800">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-3 bg-slate-800 rounded flex-1" />
                ))}
            </div>
            {/* Table rows */}
            {Array.from({ length: safeRows }).map((_, i) => (
                <div
                    key={i}
                    className="flex gap-4 px-4 py-3 border-b border-slate-800/50 last:border-0"
                >
                    <div className="h-4 w-8 bg-slate-800 rounded" />
                    <div className="h-4 flex-1 bg-slate-800 rounded" />
                    <div className="h-4 w-24 bg-slate-800 rounded" />
                    <div className="h-4 w-20 bg-slate-800 rounded" />
                    <div className="h-4 w-16 bg-slate-700 rounded" />
                </div>
            ))}
        </div>
    </div>
);
};

/**
 * Full-page skeleton shell shown while auth is resolving.
 * Mimics the dashboard layout (sidebar + content area).
 */
export const DashboardShellSkeleton: React.FC = () => (
    <div className="flex h-screen bg-slate-950 overflow-hidden animate-pulse">
        {/* Sidebar skeleton */}
        <div className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 p-4 space-y-3 shrink-0">
            {/* Logo */}
            <div className="h-10 w-36 bg-slate-800 rounded-lg mb-4" />
            {/* Nav items */}
            {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-2">
                    <div className="h-5 w-5 bg-slate-800 rounded" />
                    <div className="h-4 flex-1 bg-slate-800 rounded" />
                </div>
            ))}
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top bar */}
            <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center px-6 gap-4 shrink-0">
                <div className="h-5 w-5 bg-slate-800 rounded md:hidden" />
                <div className="flex-1 h-8 max-w-xs bg-slate-800 rounded-lg" />
                <div className="h-8 w-8 bg-slate-800 rounded-full ml-auto" />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="h-7 w-40 bg-slate-800 rounded-lg" />
                    <div className="h-9 w-28 bg-slate-800 rounded-lg" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                            <div className="h-4 w-20 bg-slate-800 rounded" />
                            <div className="h-7 w-16 bg-slate-700 rounded" />
                        </div>
                    ))}
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-4 bg-slate-800 rounded w-full" style={{ width: `${85 - i * 5}%` }} />
                    ))}
                </div>
            </div>
        </div>
    </div>
);

export default TabSkeleton;
