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
    hoverBorder: 'hover:border-[#adebb3]/30',
    glowBg: 'group-hover:bg-[#adebb3]/[0.04]',
    iconBg: 'bg-[#adebb3]/10',
    iconColor: 'text-[#adebb3]',
    textAccent: 'text-[#adebb3]',
  },
  blue: {
    hoverBorder: 'hover:border-[#00f0ff]/30',
    glowBg: 'group-hover:bg-[#00f0ff]/[0.04]',
    iconBg: 'bg-[#00f0ff]/10',
    iconColor: 'text-[#60a5fa]',
    textAccent: 'text-[#60a5fa]',
  },
  purple: {
    hoverBorder: 'hover:border-[#7f00ff]/30',
    glowBg: 'group-hover:bg-[#7f00ff]/[0.04]',
    iconBg: 'bg-[#7f00ff]/10',
    iconColor: 'text-[#c084fc]',
    textAccent: 'text-[#c084fc]',
  },
  emerald: {
    hoverBorder: 'hover:border-[#3eb489]/30',
    glowBg: 'group-hover:bg-[#3eb489]/[0.04]',
    iconBg: 'bg-[#3eb489]/10',
    iconColor: 'text-[#4ade80]',
    textAccent: 'text-[#4ade80]',
  },
  amber: {
    hoverBorder: 'hover:border-[#ffb347]/30',
    glowBg: 'group-hover:bg-[#ffb347]/[0.04]',
    iconBg: 'bg-[#ffb347]/10',
    iconColor: 'text-[#facc15]',
    textAccent: 'text-[#facc15]',
  },
  rose: {
    hoverBorder: 'hover:border-[#ff00cc]/30',
    glowBg: 'group-hover:bg-[#ff00cc]/[0.04]',
    iconBg: 'bg-[#ff00cc]/10',
    iconColor: 'text-[#f87171]',
    textAccent: 'text-[#f87171]',
  },
  sky: {
    hoverBorder: 'hover:border-[#00f0ff]/30',
    glowBg: 'group-hover:bg-[#00f0ff]/[0.04]',
    iconBg: 'bg-[#00f0ff]/10',
    iconColor: 'text-[#38bdf8]',
    textAccent: 'text-[#38bdf8]',
  },
  orange: {
    hoverBorder: 'hover:border-[#ffb347]/30',
    glowBg: 'group-hover:bg-[#ffb347]/[0.04]',
    iconBg: 'bg-[#ffb347]/10',
    iconColor: 'text-[#fb923c]',
    textAccent: 'text-[#fb923c]',
  },
  indigo: {
    hoverBorder: 'hover:border-[#7f00ff]/30',
    glowBg: 'group-hover:bg-[#7f00ff]/[0.04]',
    iconBg: 'bg-[#7f00ff]/10',
    iconColor: 'text-[#818cf8]',
    textAccent: 'text-[#818cf8]',
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
          <h4 className="text-2xl font-black text-[#f5f5f5] tracking-tight leading-none mt-1">
            {value}
          </h4>
        </div>

        {icon && (
          <div className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center border border-white/5 transition-all duration-300',
            styles.iconBg,
            styles.iconColor
          )}>
            {/* forwardRef components (e.g. Lucide) have typeof === 'object', not 'function'.
                Use React.isValidElement to distinguish pre-rendered JSX from a component type. */}
            {React.isValidElement(icon)
              ? icon
              : React.createElement(icon as React.ElementType, { className: 'w-4 h-4' })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.03]">
        <div className="flex items-center gap-2">
          {delta !== undefined && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums',
                resolvedDeltaDir === 'up' && 'bg-[#adebb3]/10 text-[#adebb3]',
                resolvedDeltaDir === 'down' && 'bg-[#f87171]/10 text-[#f87171]',
                resolvedDeltaDir === 'none' && 'bg-white/5 text-[#c0c0c0]'
              )}
            >
              {resolvedDeltaDir === 'up' && <TrendingUp className="w-3 h-3" />}
              {resolvedDeltaDir === 'down' && <TrendingDown className="w-3 h-3" />}
              {deltaText}
            </span>
          )}
          <span className="text-[10px] text-[#94a3b8] font-medium">{comparisonText}</span>
        </div>

        {isClickable && (
          <ChevronRight className="w-3.5 h-3.5 text-[#64748b] group-hover:text-[#f5f5f5] transition-colors duration-300" />
        )}
      </div>
    </div>
  );

  const cardClasses = cn(
    'relative group text-left w-full dashboard-panel rounded-xl p-4 transition-all duration-300 overflow-hidden',
    styles.hoverBorder,
    styles.glowBg,
    isClickable && 'cursor-pointer',
    className
  );

  // Background glow effect element
  const glowElement = (
    <div className={cn(
      'absolute -right-12 -bottom-12 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none',
      themeColor === 'teal' && 'bg-[#adebb3]',
      themeColor === 'blue' && 'bg-[#00f0ff]',
      themeColor === 'purple' && 'bg-[#7f00ff]',
      themeColor === 'emerald' && 'bg-[#3eb489]',
      themeColor === 'amber' && 'bg-[#ffb347]',
      themeColor === 'rose' && 'bg-[#ff00cc]',
      themeColor === 'sky' && 'bg-[#38bdf8]',
      themeColor === 'orange' && 'bg-[#fb923c]',
      themeColor === 'indigo' && 'bg-[#818cf8]'
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
