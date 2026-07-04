'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CardTheme =
  | 'teal'
  | 'blue'
  | 'purple'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'sky'
  | 'orange'
  | 'indigo';

const THEME_STYLES: Record<CardTheme, {
  hoverBorder: string;
  glowBg: string;
  iconBg: string;
  iconColor: string;
  textAccent: string;
}> = {
  teal: {
    hoverBorder: 'hover:border-teal-500/30',
    glowBg: 'group-hover:bg-teal-500/[0.02]',
    iconBg: 'bg-teal-500/10',
    iconColor: 'text-teal-400',
    textAccent: 'text-teal-400',
  },
  blue: {
    hoverBorder: 'hover:border-blue-500/30',
    glowBg: 'group-hover:bg-blue-500/[0.02]',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    textAccent: 'text-blue-400',
  },
  purple: {
    hoverBorder: 'hover:border-purple-500/30',
    glowBg: 'group-hover:bg-purple-500/[0.02]',
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-400',
    textAccent: 'text-purple-400',
  },
  emerald: {
    hoverBorder: 'hover:border-emerald-500/30',
    glowBg: 'group-hover:bg-emerald-500/[0.02]',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    textAccent: 'text-emerald-400',
  },
  amber: {
    hoverBorder: 'hover:border-amber-500/30',
    glowBg: 'group-hover:bg-amber-500/[0.02]',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
    textAccent: 'text-amber-400',
  },
  rose: {
    hoverBorder: 'hover:border-rose-500/30',
    glowBg: 'group-hover:bg-rose-500/[0.02]',
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-400',
    textAccent: 'text-rose-400',
  },
  sky: {
    hoverBorder: 'hover:border-sky-500/30',
    glowBg: 'group-hover:bg-sky-500/[0.02]',
    iconBg: 'bg-sky-500/10',
    iconColor: 'text-sky-400',
    textAccent: 'text-sky-400',
  },
  orange: {
    hoverBorder: 'hover:border-orange-500/30',
    glowBg: 'group-hover:bg-orange-500/[0.02]',
    iconBg: 'bg-orange-500/10',
    iconColor: 'text-orange-400',
    textAccent: 'text-orange-400',
  },
  indigo: {
    hoverBorder: 'hover:border-indigo-500/30',
    glowBg: 'group-hover:bg-indigo-500/[0.02]',
    iconBg: 'bg-indigo-500/10',
    iconColor: 'text-indigo-400',
    textAccent: 'text-indigo-400',
  },
};

interface StandardStatCardProps {
  label: string;
  value: string | number;
  delta?: number | string; // Numeric percentage (e.g. 12.5 or -3.2) or string (e.g. "+15%")
  deltaDir?: 'up' | 'down' | 'none';
  comparisonText?: string;
  icon?: React.ElementType | React.ReactNode;
  themeColor?: CardTheme;
  onClick?: () => void;
  className?: string;
  interactive?: boolean;
}

export function StandardStatCard({
  label,
  value,
  delta,
  deltaDir,
  comparisonText = 'vs last month',
  icon,
  themeColor = 'teal',
  onClick,
  className,
  interactive = true,
}: StandardStatCardProps) {
  const styles = THEME_STYLES[themeColor] || THEME_STYLES.teal;
  const isClickable = !!onClick;
  
  // Resolve Delta values
  let resolvedDeltaDir: 'up' | 'down' | 'none' = 'none';
  let deltaText = '';
  
  if (delta !== undefined) {
    if (typeof delta === 'number') {
      resolvedDeltaDir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'none';
      deltaText = `${delta > 0 ? '+' : ''}${delta}%`;
    } else {
      deltaText = delta;
      if (deltaDir) {
        resolvedDeltaDir = deltaDir;
      } else {
        resolvedDeltaDir = delta.startsWith('+') ? 'up' : delta.startsWith('-') ? 'down' : 'none';
      }
    }
  }

  const content = (
    <div className="flex flex-col h-full justify-between">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
            {label}
          </span>
          <h4 className="text-2xl font-black text-white tracking-tight leading-none mt-1">
            {value}
          </h4>
        </div>

        {icon && (
          <div className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center border border-white/5 transition-all duration-300',
            styles.iconBg,
            styles.iconColor
          )}>
            {typeof icon === 'function' ? React.createElement(icon as React.ElementType, { className: 'w-4 h-4' }) : icon}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.03]">
        <div className="flex items-center gap-2">
          {delta !== undefined && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums',
                resolvedDeltaDir === 'up' && 'bg-emerald-500/10 text-emerald-400',
                resolvedDeltaDir === 'down' && 'bg-rose-500/10 text-rose-400',
                resolvedDeltaDir === 'none' && 'bg-slate-800 text-slate-400'
              )}
            >
              {resolvedDeltaDir === 'up' && <TrendingUp className="w-3 h-3" />}
              {resolvedDeltaDir === 'down' && <TrendingDown className="w-3 h-3" />}
              {deltaText}
            </span>
          )}
          <span className="text-[10px] text-slate-500 font-medium">{comparisonText}</span>
        </div>

        {isClickable && (
          <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-white transition-colors duration-300" />
        )}
      </div>
    </div>
  );

  const cardClasses = cn(
    'relative group text-left w-full bg-slate-950/40 backdrop-blur-md border border-white/5 rounded-xl p-4 transition-all duration-300 overflow-hidden',
    styles.hoverBorder,
    styles.glowBg,
    isClickable && 'cursor-pointer',
    className
  );

  // Background glow effect element
  const glowElement = (
    <div className={cn(
      'absolute -right-12 -bottom-12 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none',
      themeColor === 'teal' && 'bg-teal-500',
      themeColor === 'blue' && 'bg-blue-500',
      themeColor === 'purple' && 'bg-purple-500',
      themeColor === 'emerald' && 'bg-emerald-500',
      themeColor === 'amber' && 'bg-amber-500',
      themeColor === 'rose' && 'bg-rose-500',
      themeColor === 'sky' && 'bg-sky-500',
      themeColor === 'orange' && 'bg-orange-500',
      themeColor === 'indigo' && 'bg-indigo-500'
    )} />
  );

  if (!interactive) {
    return (
      <div className={cardClasses}>
        {glowElement}
        {content}
      </div>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cardClasses}
    >
      {glowElement}
      {content}
    </motion.button>
  );
}
export default StandardStatCard;
