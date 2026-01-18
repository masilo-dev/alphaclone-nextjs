import React from 'react';

/**
 * Loading Skeleton - Improves perceived performance
 * Better than spinners for INP optimization
 */

export const PageSkeleton: React.FC = () => (
    <div className="min-h-screen bg-slate-950 p-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="h-16 bg-slate-800 rounded-lg mb-6 w-full"></div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-48 bg-slate-800 rounded-lg"></div>
            ))}
        </div>
    </div>
);

export const DashboardSkeleton: React.FC = () => (
    <div className="flex h-screen bg-slate-950">
        {/* Sidebar Skeleton */}
        <div className="w-64 bg-slate-900 p-4 animate-pulse">
            <div className="h-12 bg-slate-800 rounded mb-6"></div>
            {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-slate-800 rounded mb-2"></div>
            ))}
        </div>

        {/* Main Content Skeleton */}
        <div className="flex-1 p-6 animate-pulse">
            <div className="h-16 bg-slate-800 rounded mb-6"></div>
            <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-32 bg-slate-800 rounded"></div>
                ))}
            </div>
        </div>
    </div>
);

export const ListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
    <div className="space-y-3 animate-pulse">
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-800 rounded-lg"></div>
        ))}
    </div>
);

export const CardSkeleton: React.FC = () => (
    <div className="bg-slate-800 rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-slate-700 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-slate-700 rounded w-full mb-2"></div>
        <div className="h-4 bg-slate-700 rounded w-5/6"></div>
    </div>
);

export default PageSkeleton;
