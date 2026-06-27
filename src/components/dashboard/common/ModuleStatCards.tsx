'use client';

import React from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp } from 'lucide-react';
import { ENTERPRISE } from '@/constants/design';
import { cn } from '@/lib/utils';

export type StatAccent = 'teal' | 'blue' | 'purple' | 'emerald' | 'orange' | 'rose' | 'amber' | 'sky';

export interface ModuleStat {
  label: string;
  value: string | number;
  sub?: string;
  Icon: LucideIcon;
  accent?: StatAccent;
  /** Optional percentage trend; positive renders green, negative red. */
  trend?: number;
}

const ACCENT_VALUE: Record<StatAccent, string> = {
  teal: 'text-teal-400',
  blue: 'text-blue-400',
  purple: 'text-purple-400',
  emerald: 'text-emerald-400',
  orange: 'text-orange-400',
  rose: 'text-rose-400',
  amber: 'text-amber-400',
  sky: 'text-sky-400',
};

const ACCENT_TILE: Record<StatAccent, string> = {
  teal: 'bg-teal-500/15 border-teal-500/30 text-teal-300',
  blue: 'bg-blue-500/15 border-blue-500/30 text-blue-300',
  purple: 'bg-purple-500/15 border-purple-500/30 text-purple-300',
  emerald: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
  orange: 'bg-orange-500/15 border-orange-500/30 text-orange-300',
  rose: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
  amber: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
  sky: 'bg-sky-500/15 border-sky-500/30 text-sky-300',
};

/**
 * Enterprise-structured KPI row (AlphaClone brand). Icons + metric card anatomy.
 */
export function ModuleStatCards({ stats, className = '' }: { stats: ModuleStat[]; className?: string }) {
  return (
    <div className={cn(ENTERPRISE.moduleLayout.summaryGrid, className)}>
      {stats.map((s, i) => {
        const accent = s.accent || 'teal';
        const Icon = s.Icon;
        const hasTrend = typeof s.trend === 'number' && Number.isFinite(s.trend) && s.trend !== 0;
        const up = (s.trend || 0) > 0;

        return (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 * i, duration: 0.2 }}
            className={cn(
              'bg-surface-1 rounded-lg p-4 border border-slate-800/40 flex flex-col justify-between',
              ENTERPRISE.metricCard.minHeight
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className={cn(ENTERPRISE.metricCard.labelSize, 'text-slate-400 truncate flex-1')}>
                {s.label}
              </span>
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                  ACCENT_TILE[accent]
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-2">
              <span
                className={cn(
                  ENTERPRISE.metricCard.valueSize,
                  'font-bold leading-none tabular-nums block',
                  ACCENT_VALUE[accent]
                )}
              >
                {s.value}
              </span>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-2">
                {hasTrend && (
                  <span
                    className={cn(
                      ENTERPRISE.metricCard.trendSize,
                      'font-medium tabular-nums',
                      up ? 'text-dashboard-green' : 'text-dashboard-red'
                    )}
                  >
                    {up ? '↑' : '↓'} {Math.abs(s.trend as number).toFixed(0)}%
                  </span>
                )}
                {s.sub ? (
                  <span className={cn(ENTERPRISE.metricCard.comparisonSize, 'text-slate-500')}>{s.sub}</span>
                ) : null}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
