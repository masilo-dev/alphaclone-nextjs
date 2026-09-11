'use client';

import React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  WifiOff,
  ShieldOff,
  FileQuestion,
  ServerCrash,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WORKSPACE, ENTERPRISE } from '@/constants/design';

export type StatePanelKind =
  | 'empty'
  | 'loading'
  | 'error'
  | 'network'
  | 'permission'
  | 'not_found'
  | 'offline'
  | 'integration'
  | 'subscription';

interface StatePanelAction {
  label: string;
  onClick?: () => void;
  href?: string;
  primary?: boolean;
}

interface StatePanelProps {
  kind: StatePanelKind;
  title: string;
  description?: string;
  actions?: StatePanelAction[];
  className?: string;
  compact?: boolean;
}

const ICONS: Record<StatePanelKind, React.ElementType> = {
  empty: FileQuestion,
  loading: RefreshCw,
  error: AlertTriangle,
  network: WifiOff,
  permission: ShieldOff,
  not_found: FileQuestion,
  offline: WifiOff,
  integration: PlugIcon,
  subscription: AlertTriangle,
};

function PlugIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 22v-5" />
      <path d="M9 8V2" />
      <path d="M15 8V2" />
      <path d="M18 8v5a6 6 0 0 1-12 0V8Z" />
    </svg>
  );
}

/**
 * Shared empty / error / permission / offline panel for authenticated modules.
 * Always offers a next action — never raw API text alone.
 */
export function StatePanel({
  kind,
  title,
  description,
  actions = [],
  className,
  compact,
}: StatePanelProps) {
  const Icon = ICONS[kind];

  return (
    <div
      role={kind === 'error' || kind === 'network' || kind === 'permission' ? 'alert' : 'status'}
      className={cn(
        'flex flex-col items-center text-center rounded-2xl border border-[var(--border-default)] bg-[var(--surface-primary)]',
        compact ? 'px-4 py-8' : 'px-6 py-12 md:py-16',
        className,
      )}
    >
      <span
        className={cn(
          'mb-3 rounded-full flex items-center justify-center',
          kind === 'permission' || kind === 'error' || kind === 'subscription'
            ? 'bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)]'
            : kind === 'offline' || kind === 'network'
              ? 'bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-[var(--warning)]'
              : 'bg-[color-mix(in_srgb,var(--info)_12%,transparent)] text-[var(--info)]',
          compact ? 'w-10 h-10' : 'w-12 h-12',
        )}
      >
        <Icon className={cn(compact ? 'w-5 h-5' : 'w-6 h-6', kind === 'loading' && 'animate-spin')} aria-hidden />
      </span>
      <h2 className="text-base md:text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
      ) : null}
      {actions.length > 0 ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {actions.map((a) => {
            const cls = cn(
              a.primary ? WORKSPACE.action.primary : WORKSPACE.action.secondary,
              ENTERPRISE.touchTarget,
              'inline-flex items-center justify-center px-4',
            );
            if (a.href) {
              return (
                <Link key={a.label} href={a.href} className={cls}>
                  {a.label}
                </Link>
              );
            }
            return (
              <button key={a.label} type="button" onClick={a.onClick} className={cls}>
                {a.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default StatePanel;
