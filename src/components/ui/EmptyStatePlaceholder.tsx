'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface EmptyStatePlaceholderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  /** Use a muted/dashed style for inline empty states (default: false = centered card) */
  compact?: boolean;
}

/**
 * Reusable empty state component — consistent across all AlphaClone dashboard hubs.
 */
export function EmptyStatePlaceholder({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
  compact = false,
}: EmptyStatePlaceholderProps) {
  if (compact) {
    return (
      <div className={`flex flex-col items-center justify-center py-8 text-center gap-2 ${className}`}>
        <div className="w-10 h-10 rounded-xl bg-[var(--ws-surface-secondary)]/60 border border-[var(--ws-border)] flex items-center justify-center">
          <Icon className="w-5 h-5 text-[var(--ws-text-muted)]" />
        </div>
        <p className="type-card-description font-semibold text-[var(--ws-text-muted)]">{title}</p>
        <p className="type-card-description text-[var(--ws-text-muted)] max-w-xs leading-relaxed">{description}</p>
        {action && (
          <button
            onClick={action.onClick}
            className="mt-1 type-ui font-bold text-teal-400 hover:text-[var(--brand-blue-300)] transition-colors"
          >
            {action.label} →
          </button>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col items-center justify-center py-12 px-6 text-center gap-4 ${className}`}
    >
      {/* Icon halo */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-teal-500/10 blur-xl scale-150" />
        <div className="relative w-16 h-16 rounded-2xl bg-[var(--ws-surface-secondary)] border border-[var(--ws-border)] flex items-center justify-center shadow-lg">
          <Icon className="w-7 h-7 text-teal-400/70" />
        </div>
      </div>

      <div className="space-y-1.5 max-w-sm">
        <h3 className="type-ui font-bold text-[var(--ws-text-primary)]">{title}</h3>
        <p className="type-card-description text-[var(--ws-text-muted)] leading-relaxed">{description}</p>
      </div>

      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 mt-1 flex-wrap justify-center">
          {action && (
            <button
              onClick={action.onClick}
              className={`px-4 py-2 rounded-xl type-ui font-bold transition-all ${
                action.variant === 'secondary'
                  ? 'bg-[var(--ws-surface-secondary)] text-[var(--ws-text-secondary)] border border-[var(--ws-border)] hover:bg-[var(--ws-surface-tertiary)]'
                  : 'bg-teal-500 text-[var(--text-inverse)] hover:bg-[var(--brand-blue-400)] shadow-md shadow-teal-500/20'
              }`}
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-4 py-2 rounded-xl type-ui font-bold text-[var(--ws-text-muted)] border border-[var(--ws-border)] hover:bg-[var(--ws-surface-secondary)] transition-all"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
