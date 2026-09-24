'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SemanticStatusBadge } from './SemanticStatusBadge';

export interface WorkspaceContextNavProps {
  /** Parent route path (e.g. '/dashboard/leads', '/dashboard/business/billing/manage') */
  backHref?: string;
  /** Parent label for the back button (e.g. 'Leads', 'Invoices', 'Contracts') */
  backLabel?: string;
  /** Custom onBack handler (if not standard router back or Link) */
  onBack?: () => void;
  /** Optional intermediate crumbs (e.g. ['CRM', 'Leads']) */
  breadcrumbs?: { label: string; href?: string }[];
  /** Current object title / name (e.g. 'Acme Ltd', 'Invoice #1045') */
  currentTitle: string;
  /** Current object subtitle or identifier (e.g. 'INV-2026-0042' or 'Client since Jan 2025') */
  subtitle?: string;
  /** Optional status of the current object */
  status?: string;
  /** Optional execution status */
  executionStatus?: string;
  /** Primary action for this object (e.g. "Send Invoice", "Convert Lead") */
  primaryAction?: React.ReactNode;
  /** Secondary actions (e.g. "Edit", "Download PDF", "More ▼") */
  secondaryActions?: React.ReactNode;
  className?: string;
}

/**
 * Universal Context Navigation Header for Object Detail views.
 * Replaces heavy breadcrumb bars with subtle, intentional context:
 * [← Leads]  Acme Ltd  [Qualified]  |  [Convert Lead] [More ▼]
 */
export function WorkspaceContextNav({
  backHref,
  backLabel = 'Back',
  onBack,
  breadcrumbs,
  currentTitle,
  subtitle,
  status,
  executionStatus,
  primaryAction,
  secondaryActions,
  className,
}: WorkspaceContextNavProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <div
      className={cn(
        'w-full flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-2.5 px-4 sm:px-6 bg-[var(--ws-toolbar)] border-b border-[var(--ws-border)]',
        className
      )}
    >
      {/* Left: Back button + Context Hierarchy + Current Item + Status */}
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 min-w-0">
        {/* Back Link Button */}
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ws-text-secondary)] hover:text-[var(--ws-text-primary)] transition-colors py-1 px-2 rounded-lg hover:bg-[var(--ws-hover)]"
          aria-label={`Return to ${backLabel}`}
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{backLabel}</span>
        </button>

        <span className="text-[var(--ws-border)] select-none">/</span>

        {/* Optional intermediate breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <div className="hidden md:flex items-center gap-1 text-xs text-[var(--ws-text-muted)]">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.label}>
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-[var(--ws-text-primary)] transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
                <ChevronRight className="w-3 h-3 text-[var(--ws-text-muted)]" />
              </React.Fragment>
            ))}
          </div>
        ) : null}

        {/* Current Object Title & Subtitle */}
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-[var(--ws-text-primary)] truncate">
            {currentTitle}
          </h2>
          {subtitle ? (
            <span className="text-xs text-[var(--ws-text-muted)] hidden sm:inline truncate">
              ({subtitle})
            </span>
          ) : null}
        </div>

        {/* Status Badge */}
        {status ? (
          <SemanticStatusBadge
            status={status}
            executionStatus={executionStatus}
            size="compact"
          />
        ) : null}
      </div>

      {/* Right: Primary & Secondary Actions */}
      {(primaryAction || secondaryActions) ? (
        <div className="flex items-center gap-2 shrink-0">
          {secondaryActions ? (
            <div className="flex items-center gap-1.5">{secondaryActions}</div>
          ) : null}
          {primaryAction ? (
            <div className="shrink-0">{primaryAction}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default WorkspaceContextNav;
