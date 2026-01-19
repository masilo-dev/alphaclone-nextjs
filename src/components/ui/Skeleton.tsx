import React from 'react';

// Base Skeleton Component
export const Skeleton: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => (
    <div className={`animate-pulse bg-slate-800 rounded ${className}`} style={style} />
);

// Table Skeleton (already exists, enhancing it)
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
    rows = 5,
    columns = 4
}) => (
    <div className="space-y-3">
        {/* Header */}
        <div className="flex gap-4 pb-3 border-b border-slate-800">
            {[...Array(columns)].map((_, i) => (
                <Skeleton key={i} className="h-4 flex-1" />
            ))}
        </div>
        {/* Rows */}
        {[...Array(rows)].map((_, rowIdx) => (
            <div key={rowIdx} className="flex gap-4 items-center">
                {[...Array(columns)].map((_, colIdx) => (
                    <Skeleton key={colIdx} className="h-6 flex-1" />
                ))}
            </div>
        ))}
    </div>
);

// Card Skeleton
export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 1 }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(count)].map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex items-start justify-between">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex gap-2 pt-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                </div>
            </div>
        ))}
    </div>
);

// Stats Card Skeleton
export const StatsCardSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(count)].map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-3 w-16" />
            </div>
        ))}
    </div>
);

// Chart Skeleton
export const ChartSkeleton: React.FC<{ height?: string }> = ({ height = 'h-64' }) => {
    // Fixed heights to prevent hydration mismatch (no Math.random())
    const barHeights = ['65%', '85%', '55%', '95%', '75%', '60%', '80%'];

    return (
        <div className={`bg-slate-900 border border-slate-800 rounded-xl p-6 ${height}`}>
            <div className="space-y-4 h-full">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-8 w-24 rounded-lg" />
                </div>
                <div className="flex items-end justify-between gap-2 h-full pb-4">
                    {barHeights.map((barHeight, i) => (
                        <Skeleton
                            key={i}
                            className="flex-1"
                            style={{ height: barHeight }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

// List Item Skeleton
export const ListItemSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
    <div className="space-y-3">
        {[...Array(count)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
        ))}
    </div>
);

// Form Skeleton
export const FormSkeleton: React.FC = () => (
    <div className="space-y-6">
        {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full rounded-lg" />
            </div>
        ))}
        <div className="flex gap-3 pt-4">
            <Skeleton className="h-10 w-32 rounded-lg" />
            <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
    </div>
);

// Profile Skeleton
export const ProfileSkeleton: React.FC = () => (
    <div className="flex items-center gap-4">
        <Skeleton className="w-16 h-16 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
        </div>
    </div>
);

// Message Skeleton
export const MessageSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
    <div className="space-y-4">
        {[...Array(count)].map((_, i) => (
            <div key={i} className={`flex gap-3 ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}>
                <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                <div className="flex-1 max-w-md space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-16 w-full rounded-xl" />
                    <Skeleton className="h-3 w-16" />
                </div>
            </div>
        ))}
    </div>
);

// Page Skeleton (Full page loading)
export const PageSkeleton: React.FC = () => (
    <div className="space-y-8 p-8">
        <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
        <StatsCardSkeleton count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartSkeleton />
            <ChartSkeleton />
        </div>
        <TableSkeleton rows={8} columns={5} />
    </div>
);

export default {
    Skeleton,
    TableSkeleton,
    CardSkeleton,
    StatsCardSkeleton,
    ChartSkeleton,
    ListItemSkeleton,
    FormSkeleton,
    ProfileSkeleton,
    MessageSkeleton,
    PageSkeleton,
};
