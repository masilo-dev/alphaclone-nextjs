'use client';

import type { DeltaColor, DeltaDir } from '@/types/dashboardStats';

const DELTA_STYLES: Record<DeltaColor, string> = {
  green: 'text-dashboard-green bg-dashboard-greenBg/20',
  amber: 'text-dashboard-amber bg-dashboard-amberBg/20',
  red: 'text-dashboard-red bg-dashboard-redBg/20',
  blue: 'text-dashboard-blue bg-dashboard-blueBg/20',
};

interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaDir?: DeltaDir;
  deltaColor?: DeltaColor;
}

export function MetricCard({ label, value, delta, deltaDir, deltaColor = 'green' }: MetricCardProps) {
  const arrow = deltaDir === 'down' ? '↓' : deltaDir === 'up' ? '↑' : '';

  return (
    <div className="bg-surface-1 rounded-lg p-4 md:p-5 min-h-[96px] flex flex-col justify-between border border-slate-800/40">
      <span className="text-xs md:text-sm text-slate-400 truncate">{label}</span>
      <div className="flex items-end justify-between gap-2 mt-2">
        <span className="text-2xl md:text-3xl font-semibold text-white leading-none tabular-nums">{value}</span>
        {delta ? (
          <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${DELTA_STYLES[deltaColor]}`}>
            {arrow} {delta}
          </span>
        ) : null}
      </div>
    </div>
  );
}
