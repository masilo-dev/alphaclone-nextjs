<<<<<<< HEAD
'use client';

import React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Bot } from 'lucide-react';
import { WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';
import {
  getEmptyStatePreset,
  type EmptyStateModuleId,
  type EmptyStateQuickAction,
} from '@/config/emptyStatePresets';
=======
import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';
>>>>>>> origin/main

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: React.ReactNode;
  className?: string;
  /** Quick action buttons below the main CTA */
  quickActions?: EmptyStateQuickAction[];
  /** Bonnie suggestion text */
  bonnieSuggestion?: string;
  /** Template links for getting started */
  templateLinks?: { label: string; href: string }[];
  /** Import options */
  importOptions?: { label: string; description: string; href?: string }[];
}

<<<<<<< HEAD
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  action,
  className,
  quickActions,
  bonnieSuggestion,
  templateLinks,
  importOptions,
}: EmptyStateProps) {
  const hasExtras =
    (quickActions && quickActions.length > 0) ||
    bonnieSuggestion ||
    (templateLinks && templateLinks.length > 0) ||
    (importOptions && importOptions.length > 0);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center mx-auto max-w-[480px]',
        className
      )}
    >
      <div className="w-11 h-11 rounded-[var(--ws-radius-lg)] border border-[var(--ws-border)] bg-[var(--ws-hover)] flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-teal-400/90" strokeWidth={1.5} />
      </div>
      <h3 className={cn(WORKSPACE.typography.pageTitle, 'mb-2 text-[1rem]')}>{title}</h3>
      <p className="text-[13px] text-[var(--ws-text-secondary)] leading-relaxed mb-6 max-w-sm">{description}</p>
      {action}
      {!action && actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="ac-workspace-action-btn ac-workspace-action-btn--primary min-h-9 px-4"
        >
          {actionLabel}
        </button>
      )}

      {hasExtras ? (
        <div className="mt-8 w-full space-y-4 text-left">
          {bonnieSuggestion ? (
            <div className="ac-workspace-panel p-3 flex items-start gap-2 border border-teal-500/20">
              <Bot className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-[12px] text-[var(--ws-text-secondary)]">{bonnieSuggestion}</p>
=======
/**
 * Empty state component for when there's no data to display
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    title,
    description,
    action,
    className = '',
}) => {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex flex-col items-center justify-center py-24 px-6 rounded-[2.5rem] bg-slate-900/40 border border-dashed border-white/5 backdrop-blur-xl ${className}`}
        >
            <div className="w-24 h-24 bg-slate-800 rounded-3xl flex items-center justify-center mb-8 relative overflow-hidden shadow-2xl group transition-all duration-500 hover:scale-110 hover:rotate-3">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/20 to-violet-500/20 group-hover:opacity-100 transition-opacity" />
                <Icon className="w-12 h-12 text-teal-400 relative z-10 transition-transform duration-500 group-hover:scale-110" />
                
                {/* Decorative particles */}
                <div className="absolute top-2 right-2 w-1 h-1 bg-teal-400 rounded-full animate-pulse" />
                <div className="absolute bottom-4 left-3 w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse delay-75" />
>>>>>>> origin/main
            </div>
          ) : null}

<<<<<<< HEAD
          {quickActions && quickActions.length > 0 ? (
            <div className="flex flex-wrap gap-2 justify-center">
              {quickActions.map((qa) =>
                qa.href ? (
                  <Link
                    key={qa.label}
                    href={qa.href}
                    className="ac-workspace-action-btn ac-workspace-action-btn--secondary text-[12px] min-h-8 px-3"
                  >
                    {qa.label}
                  </Link>
                ) : (
                  <button
                    key={qa.label}
                    type="button"
                    onClick={qa.onAction}
                    className="ac-workspace-action-btn ac-workspace-action-btn--secondary text-[12px] min-h-8 px-3"
                  >
                    {qa.label}
                  </button>
                )
              )}
            </div>
          ) : null}

          {templateLinks && templateLinks.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ws-text-tertiary)]">
                Templates
              </p>
              {templateLinks.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="block text-[12px] text-teal-400 hover:text-teal-300"
                >
                  {t.label}
                </Link>
              ))}
            </div>
          ) : null}

          {importOptions && importOptions.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ws-text-tertiary)]">
                Import
              </p>
              {importOptions.map((opt) =>
                opt.href ? (
                  <Link key={opt.label} href={opt.href} className="block ac-workspace-panel p-2.5 hover:border-teal-500/30">
                    <p className="text-[12px] font-medium text-[var(--ws-text-primary)]">{opt.label}</p>
                    <p className="text-[11px] text-[var(--ws-text-tertiary)]">{opt.description}</p>
                  </Link>
                ) : (
                  <div key={opt.label} className="ac-workspace-panel p-2.5">
                    <p className="text-[12px] font-medium text-[var(--ws-text-primary)]">{opt.label}</p>
                    <p className="text-[11px] text-[var(--ws-text-tertiary)]">{opt.description}</p>
                  </div>
                )
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default EmptyState;

/** Convenience wrapper — guided empty states from shared presets. */
export function EmptyStateFromPreset({
  moduleId,
  onAction,
  actionLabel,
  className,
  action,
}: {
  moduleId: EmptyStateModuleId;
  onAction?: () => void;
  actionLabel?: string;
  className?: string;
  action?: React.ReactNode;
}) {
  const preset = getEmptyStatePreset(moduleId);
  return (
    <EmptyState
      icon={preset.icon}
      title={preset.title}
      description={preset.description}
      actionLabel={actionLabel ?? preset.actionLabel}
      onAction={onAction}
      action={action}
      className={className}
      quickActions={preset.quickActions}
      bonnieSuggestion={preset.bonnieSuggestion}
      templateLinks={preset.templateLinks}
      importOptions={preset.importOptions}
    />
  );
}
=======
            <h3 className="text-3xl font-black text-white mb-3 text-center tracking-tighter uppercase">
                {title}
            </h3>

            <p className="text-slate-400 text-center mb-10 max-w-sm text-lg font-medium leading-relaxed">
                {description}
            </p>

            {action && (
                <motion.div 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex gap-3"
                >
                    {action}
                </motion.div>
            )}
        </motion.div>
    );
};
>>>>>>> origin/main
