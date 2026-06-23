'use client';

import React from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp } from 'lucide-react';

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

const ACCENTS: Record<StatAccent, { card: string; glow: string; tile: string; icon: string }> = {
  teal: { card: 'from-teal-500/12 via-slate-900/70 to-slate-900/50 hover:border-teal-500/40', glow: 'bg-teal-500/10 group-hover:bg-teal-500/20', tile: 'from-teal-500/25 to-teal-500/5 border-teal-500/30', icon: 'text-teal-300' },
  blue: { card: 'from-blue-500/12 via-slate-900/70 to-slate-900/50 hover:border-blue-500/40', glow: 'bg-blue-500/10 group-hover:bg-blue-500/20', tile: 'from-blue-500/25 to-blue-500/5 border-blue-500/30', icon: 'text-blue-300' },
  purple: { card: 'from-purple-500/12 via-slate-900/70 to-slate-900/50 hover:border-purple-500/40', glow: 'bg-purple-500/10 group-hover:bg-purple-500/20', tile: 'from-purple-500/25 to-purple-500/5 border-purple-500/30', icon: 'text-purple-300' },
  emerald: { card: 'from-emerald-500/12 via-slate-900/70 to-slate-900/50 hover:border-emerald-500/40', glow: 'bg-emerald-500/10 group-hover:bg-emerald-500/20', tile: 'from-emerald-500/25 to-emerald-500/5 border-emerald-500/30', icon: 'text-emerald-300' },
  orange: { card: 'from-orange-500/12 via-slate-900/70 to-slate-900/50 hover:border-orange-500/40', glow: 'bg-orange-500/10 group-hover:bg-orange-500/20', tile: 'from-orange-500/25 to-orange-500/5 border-orange-500/30', icon: 'text-orange-300' },
  rose: { card: 'from-rose-500/12 via-slate-900/70 to-slate-900/50 hover:border-rose-500/40', glow: 'bg-rose-500/10 group-hover:bg-rose-500/20', tile: 'from-rose-500/25 to-rose-500/5 border-rose-500/30', icon: 'text-rose-300' },
  amber: { card: 'from-amber-500/12 via-slate-900/70 to-slate-900/50 hover:border-amber-500/40', glow: 'bg-amber-500/10 group-hover:bg-amber-500/20', tile: 'from-amber-500/25 to-amber-500/5 border-amber-500/30', icon: 'text-amber-300' },
  sky: { card: 'from-sky-500/12 via-slate-900/70 to-slate-900/50 hover:border-sky-500/40', glow: 'bg-sky-500/10 group-hover:bg-sky-500/20', tile: 'from-sky-500/25 to-sky-500/5 border-sky-500/30', icon: 'text-sky-300' },
};

/**
 * Reusable, on-brand KPI stat-card row. Mirrors the gradient KPI cards used on
 * the home dashboard and CRM so every module shares the same rich look instead
 * of plain text headers.
 */
export function ModuleStatCards({ stats, className = '' }: { stats: ModuleStat[]; className?: string }) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 ${className}`}>
      {stats.map((s, i) => {
        const a = ACCENTS[s.accent || 'teal'];
        const Icon = s.Icon;
        const hasTrend = typeof s.trend === 'number' && Number.isFinite(s.trend) && s.trend !== 0;
        const up = (s.trend || 0) > 0;
        return (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.04 * i, type: 'spring', stiffness: 240, damping: 22 }}
            className={`group relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br ${a.card} p-3 sm:p-4 shadow-lg shadow-black/20 transition-all duration-300`}
          >
            <div className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl transition-colors ${a.glow}`} />
            <div className="relative z-10 flex items-start justify-between gap-2">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br ${a.tile}`}>
                <Icon className={`h-4 w-4 ${a.icon}`} />
              </div>
              {hasTrend && (
                <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums ${up ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                  <TrendingUp className={`h-2.5 w-2.5 ${up ? '' : 'rotate-180'}`} />
                  {Math.abs(s.trend as number).toFixed(0)}%
                </span>
              )}
            </div>
            <div className="relative z-10 mt-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">{s.label}</p>
              <h3 className="mt-0.5 text-lg sm:text-2xl font-black tracking-tight text-white tabular-nums leading-tight truncate">{s.value}</h3>
              {s.sub && <p className="mt-0.5 text-[10px] text-slate-500 truncate">{s.sub}</p>}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
