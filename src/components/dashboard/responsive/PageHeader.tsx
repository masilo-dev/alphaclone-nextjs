'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MoreHorizontal, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WORKSPACE, ENTERPRISE } from '@/constants/design';
import { SHELL } from '@/constants/responsive';

export interface PageHeaderCrumb {
  label: string;
  href?: string;
}

export interface PageHeaderAction {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}

interface PageHeaderProps {
  moduleLabel?: string;
  title: string;
  description?: string;
  status?: React.ReactNode;
  breadcrumbs?: PageHeaderCrumb[];
  backHref?: string;
  onBack?: () => void;
  primaryAction?: PageHeaderAction;
  secondaryActions?: PageHeaderAction[];
  helpHref?: string;
  helpLabel?: string;
  className?: string;
  children?: React.ReactNode;
}

function ActionButton({
  action,
  className,
}: {
  action: PageHeaderAction;
  className?: string;
}) {
  const variant =
    action.variant === 'primary'
      ? WORKSPACE.action.primary
      : action.variant === 'danger'
        ? 'ac-workspace-action-btn border border-red-500/40 text-red-300 hover:bg-red-500/10'
        : WORKSPACE.action.secondary;

  const content = (
    <>
      {action.loading ? 'Working…' : action.label}
    </>
  );

  if (action.href) {
    return (
      <Link
        href={action.href}
        className={cn(variant, ENTERPRISE.touchTarget, 'inline-flex items-center justify-center px-3', className)}
        aria-disabled={action.disabled}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled || action.loading}
      className={cn(variant, ENTERPRISE.touchTarget, 'inline-flex items-center justify-center px-3 disabled:opacity-50', className)}
    >
      {content}
    </button>
  );
}

/**
 * Shared dashboard page header — reflows by viewport instead of shrinking.
 * Desktop: breadcrumb + title row with actions.
 * Phone: back + title + primary; secondary in labelled sheet.
 */
export function PageHeader({
  moduleLabel,
  title,
  description,
  status,
  breadcrumbs,
  backHref,
  onBack,
  primaryAction,
  secondaryActions = [],
  helpHref,
  helpLabel = 'Help',
  className,
  children,
}: PageHeaderProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const showBack = Boolean(backHref || onBack);

  return (
    <header
      className={cn(
        'flex-shrink-0 border-b border-[var(--app-border,var(--ws-border))] bg-[var(--app-surface,var(--ws-toolbar))]',
        SHELL.gutter,
        'py-3 md:py-4',
        className,
      )}
    >
      {/* Breadcrumbs — desktop / tablet */}
      {(breadcrumbs?.length || moduleLabel) && (
        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--app-text-muted,var(--ws-text-tertiary))] mb-1.5">
          {moduleLabel ? <span className="font-medium text-teal-400/90">{moduleLabel}</span> : null}
          {moduleLabel && breadcrumbs?.length ? <span aria-hidden>/</span> : null}
          {breadcrumbs?.map((crumb, i) => {
            const last = i === breadcrumbs.length - 1;
            return (
              <React.Fragment key={`${crumb.label}-${i}`}>
                {i > 0 ? <span aria-hidden>/</span> : null}
                {crumb.href && !last ? (
                  <Link href={crumb.href} className="hover:text-teal-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 rounded">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={last ? 'text-[var(--app-text-secondary,var(--ws-text-secondary))]' : undefined} aria-current={last ? 'page' : undefined}>
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            {showBack ? (
              backHref ? (
                <Link
                  href={backHref}
                  aria-label="Go back"
                  className={cn(ENTERPRISE.touchTarget, 'rounded-lg text-slate-400 hover:text-white hover:bg-white/5 -ml-1 shrink-0')}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={onBack}
                  aria-label="Go back"
                  className={cn(ENTERPRISE.touchTarget, 'rounded-lg text-slate-400 hover:text-white hover:bg-white/5 -ml-1 shrink-0')}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )
            ) : null}

            <div className="min-w-0">
              {moduleLabel ? (
                <p className="sm:hidden text-[11px] font-semibold uppercase tracking-wide text-teal-400/90 mb-0.5">
                  {moduleLabel}
                </p>
              ) : null}
              <h1 className={cn(WORKSPACE.typography.pageTitle, 'text-[var(--app-text,#fff)] truncate')}>
                {title}
              </h1>
              {description ? (
                <p className="mt-0.5 text-sm text-[var(--app-text-secondary,var(--ws-text-secondary))] line-clamp-2 md:line-clamp-none">
                  {description}
                </p>
              ) : null}
              {status ? <div className="mt-2 flex flex-wrap items-center gap-2">{status}</div> : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end lg:shrink-0">
          {helpHref ? (
            <Link
              href={helpHref}
              className={cn(WORKSPACE.action.secondary, ENTERPRISE.touchTarget, 'hidden sm:inline-flex items-center gap-1.5 px-3')}
            >
              <HelpCircle className="w-4 h-4" aria-hidden />
              {helpLabel}
            </Link>
          ) : null}

          {/* Secondary: visible from tablet up; phone uses More sheet */}
          {secondaryActions.length > 0 ? (
            <div className="hidden md:flex flex-wrap items-center gap-2">
              {secondaryActions.map((a) => (
                <ActionButton key={a.label} action={a} />
              ))}
            </div>
          ) : null}

          {primaryAction ? <ActionButton action={{ ...primaryAction, variant: primaryAction.variant || 'primary' }} /> : null}

          {(secondaryActions.length > 0 || helpHref) && (
            <div className="relative md:hidden">
              <button
                type="button"
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                aria-label="More actions"
                onClick={() => setMoreOpen((v) => !v)}
                className={cn(WORKSPACE.action.secondary, ENTERPRISE.touchTarget, 'inline-flex items-center gap-1 px-3')}
              >
                <MoreHorizontal className="w-4 h-4" />
                More
              </button>
              {moreOpen ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-[60]"
                    aria-label="Close actions menu"
                    onClick={() => setMoreOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 bottom-full mb-2 z-[70] w-56 rounded-xl border border-[var(--ws-border)] bg-slate-900 shadow-xl p-1"
                  >
                    {helpHref ? (
                      <Link
                        role="menuitem"
                        href={helpHref}
                        className="flex min-h-11 items-center px-3 text-sm text-slate-200 hover:bg-white/5 rounded-lg"
                        onClick={() => setMoreOpen(false)}
                      >
                        {helpLabel}
                      </Link>
                    ) : null}
                    {secondaryActions.map((a) =>
                      a.href ? (
                        <Link
                          key={a.label}
                          role="menuitem"
                          href={a.href}
                          className="flex min-h-11 items-center px-3 text-sm text-slate-200 hover:bg-white/5 rounded-lg"
                          onClick={() => setMoreOpen(false)}
                        >
                          {a.label}
                        </Link>
                      ) : (
                        <button
                          key={a.label}
                          type="button"
                          role="menuitem"
                          disabled={a.disabled}
                          className="w-full flex min-h-11 items-center px-3 text-sm text-slate-200 hover:bg-white/5 rounded-lg text-left disabled:opacity-50"
                          onClick={() => {
                            a.onClick?.();
                            setMoreOpen(false);
                          }}
                        >
                          {a.label}
                        </button>
                      ),
                    )}
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {children ? <div className="mt-3">{children}</div> : null}
    </header>
  );
}

export default PageHeader;
