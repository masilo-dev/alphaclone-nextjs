'use client';

import React, { useState } from 'react';
import { AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ErrorRecoveryBannerProps {
  /** What happened? (Human-understandable title) */
  title: string;
  /** Optional explanation or cause */
  description?: string;
  /** What was preserved? (e.g. "Your post draft has been preserved.") */
  preservedNotice?: string;
  /** Primary recovery action (e.g. "Retry", "Reconnect LinkedIn") */
  onPrimaryAction?: () => void;
  primaryActionLabel?: string;
  /** Secondary recovery action (e.g. "Edit Draft", "Review Invoice") */
  onSecondaryAction?: () => void;
  secondaryActionLabel?: string;
  /** Technical provider details or error object (kept behind disclosure) */
  technicalDetails?: string | Error | null;
  className?: string;
}

export function ErrorRecoveryBanner({
  title,
  description,
  preservedNotice,
  onPrimaryAction,
  primaryActionLabel = 'Retry',
  onSecondaryAction,
  secondaryActionLabel,
  technicalDetails,
  className,
}: ErrorRecoveryBannerProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const rawDetails =
    technicalDetails instanceof Error
      ? technicalDetails.message + (technicalDetails.stack ? `\n${technicalDetails.stack}` : '')
      : typeof technicalDetails === 'string'
      ? technicalDetails
      : null;

  return (
    <div
      role="alert"
      className={cn(
        'w-full p-4 rounded-xl border border-rose-500/25 bg-rose-500/10 text-[var(--ws-text-primary)] space-y-3 animate-fade-in',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-rose-200">
            {title}
          </h3>

          {description ? (
            <p className="text-xs text-[var(--ws-text-secondary)] mt-1">
              {description}
            </p>
          ) : null}

          {preservedNotice ? (
            <p className="text-xs font-medium text-emerald-400/90 mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span>{preservedNotice}</span>
            </p>
          ) : null}
        </div>
      </div>

      {/* Recovery Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-1 pl-8">
        {onPrimaryAction ? (
          <button
            type="button"
            onClick={onPrimaryAction}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{primaryActionLabel}</span>
          </button>
        ) : null}

        {onSecondaryAction && secondaryActionLabel ? (
          <button
            type="button"
            onClick={onSecondaryAction}
            className="inline-flex items-center h-8 px-3 rounded-lg border border-[var(--ws-border)] bg-[var(--ws-panel)] hover:bg-[var(--ws-hover)] text-xs font-medium text-[var(--ws-text-primary)] transition-colors"
          >
            {secondaryActionLabel}
          </button>
        ) : null}

        {rawDetails ? (
          <button
            type="button"
            onClick={() => setShowTechnicalDetails((prev) => !prev)}
            className="inline-flex items-center gap-1 text-[11px] text-[var(--ws-text-muted)] hover:text-[var(--ws-text-secondary)] ml-auto"
            aria-expanded={showTechnicalDetails}
          >
            <span>{showTechnicalDetails ? 'Hide technical details' : 'View technical details'}</span>
            {showTechnicalDetails ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        ) : null}
      </div>

      {/* Collapsible Technical Details */}
      {showTechnicalDetails && rawDetails ? (
        <div className="mt-2 pl-8">
          <pre className="p-2.5 rounded-lg bg-[var(--ws-panel)] border border-[var(--ws-border)] text-[11px] font-mono text-[var(--ws-text-muted)] overflow-x-auto whitespace-pre-wrap max-h-40">
            {rawDetails}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

export default ErrorRecoveryBanner;
