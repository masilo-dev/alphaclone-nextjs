'use client';

import React from 'react';
import { MetricCardSkeleton } from '@/components/dashboard/MetricCard';

interface DashboardSkeletonProps {
  row?: 1 | 2 | 3 | 'all';
}

function Pulse({ className }: { className?: string }) {
  return <div className={`bg-slate-800/60 rounded-lg ac-skeleton-pulse ${className ?? ''}`} />;
}

export function DashboardSkeleton({ row = 'all' }: DashboardSkeletonProps) {
  if (row === 1) {
    return (
      <>
        {Array.from({ length: 4 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </>
    );
  }

  if (row === 2) {
    return (
      <>
        <Pulse className="h-[280px] min-h-[240px]" />
        <Pulse className="h-[280px] min-h-[240px]" />
      </>
    );
  }

  if (row === 3) {
    return (
      <>
        <Pulse className="h-[200px]" />
        <Pulse className="h-[200px]" />
        <Pulse className="h-[200px]" />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardSkeleton row={1} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
        <DashboardSkeleton row={2} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <DashboardSkeleton row={3} />
      </div>
    </div>
  );
}
