'use client';

import React from 'react';
import type { DeltaColor, DeltaDir } from '@/types/dashboardStats';
import { StandardStatCard, type CardTheme } from '@/components/ui/design-system';

interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaDir?: DeltaDir;
  deltaColor?: DeltaColor;
  comparisonText?: string;
  className?: string;
}

const COLOR_MAP: Record<DeltaColor, CardTheme> = {
  green: 'emerald',
  amber: 'amber',
  red: 'rose',
  blue: 'blue',
  teal: 'teal',
};

export function MetricCard({
  label,
  value,
  delta,
  deltaDir,
  deltaColor = 'green',
  comparisonText,
  className,
}: MetricCardProps) {
  const themeColor = COLOR_MAP[deltaColor] || 'teal';
  
  return (
    <StandardStatCard
      label={label}
      value={value}
      delta={delta}
      deltaDir={deltaDir}
      comparisonText={comparisonText}
      themeColor={themeColor}
      className={className}
      interactive={false}
    />
  );
}

export function MetricCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className="bg-slate-900/40 rounded-xl p-4 border border-white/5 animate-pulse min-h-[120px] flex flex-col justify-between"
    >
      <div>
        <div className="h-3 w-16 bg-slate-800 rounded mb-2" />
        <div className="h-6 w-24 bg-slate-800 rounded" />
      </div>
      <div className="h-3 w-28 bg-slate-800/65 rounded mt-4" />
    </div>
  );
}

