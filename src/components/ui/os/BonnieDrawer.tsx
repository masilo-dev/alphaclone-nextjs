'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { IconBonnie } from '@/components/icons/alphaclone';
import {
  useBonnieDrawer,
  type BonnieMode,
} from '@/contexts/BonnieDrawerContext';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { resolveBonnieDashboardRoute } from '@/lib/bonnie/bonnieWorkspace';
import { WORKSPACE, ENTERPRISE } from '@/constants/design';
import { cn } from '@/lib/utils';

const MODES: { id: BonnieMode; label: string }[] = [
  { id: 'ask', label: 'Ask' },
  { id: 'create', label: 'Create' },
  { id: 'analyse', label: 'Analyse' },
  { id: 'summarise', label: 'Summarise' },
  { id: 'automate', label: 'Automate' },
  { id: 'find', label: 'Find' },
  { id: 'draft', label: 'Draft' },
  { id: 'explain', label: 'Explain' },
];

const MODE_HINT: Record<BonnieMode, string> = {
  ask: 'Ask Bonnie about this workspace or the active record.',
  create: 'Describe what to create. Bonnie will prepare a draft for confirmation.',
  analyse: 'Ask for patterns, risks, or performance insight.',
  summarise: 'Summarise history, activity, or the current record.',
  automate: 'Propose a workflow. External actions require confirmation.',
  find: 'Locate contacts, deals, invoices, documents, or meetings.',
  draft: 'Draft an email, note, quotation, or social post.',
  explain: 'Explain a metric, status, or next recommended action.',
};

/**
 * Global Bonnie assistant drawer — does not permanently occupy screen space.
 * Full workspace remains available for deep work; destructive actions stay confirmation-gated there.
 */
export function BonnieDrawer() {
  const { open, mode, contexts, closeDrawer, setMode, clearContexts } = useBonnieDrawer();
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { currentTenant } = useTenant();
  const [prompt, setPrompt] = useState('');
  const bonnieRoute = resolveBonnieDashboardRoute(pathname, user?.role);

  if (!open) return null;

  const openFullWorkspace = () => {
    closeDrawer();
    const q = prompt.trim() ? `?q=${encodeURIComponent(prompt.trim())}` : '';
    router.push(`${bonnieRoute}${q}`);
  };

  return (
    <div className="fixed inset-0 z-[1120]" role="dialog" aria-modal="true" aria-label="Bonnie AI">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--dark-overlay,rgba(0,0,0,0.68))] md:bg-[rgba(0,0,0,0.45)]"
        aria-label="Close Bonnie"
        onClick={closeDrawer}
      />
      <aside
        className={cn(
          'absolute inset-x-0 bottom-0 md:inset-y-0 md:right-0 md:left-auto',
          'flex flex-col w-full md:w-[min(100vw,28rem)] max-h-[88vh] md:max-h-none',
          'bg-[var(--ws-surface-primary)] border border-[var(--ws-border)]',
          'rounded-t-[18px] md:rounded-none md:border-y-0 md:border-r-0',
          'shadow-[var(--ws-card-shadow-hover)]',
          ENTERPRISE.drawer.panelZ
        )}
        style={{ transition: `transform ${ENTERPRISE.motion.drawer} ${ENTERPRISE.motion.easing}` }}
      >
        <header className="flex items-start gap-3 px-4 pt-4 pb-3 border-b border-[var(--ws-border)]">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] bg-[color-mix(in_srgb,var(--brand-violet-500)_16%,transparent)] text-[var(--brand-violet-500)]">
            <IconBonnie size={20} variant="duotone" decorative />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-[var(--ws-text-primary)]">Bonnie AI</h2>
            <p className="text-xs text-[var(--ws-text-muted)] mt-0.5">
              {currentTenant?.name ? `Helping across ${currentTenant.name}` : 'Workspace assistant'}
            </p>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            className="p-2 rounded-[8px] text-[var(--ws-text-muted)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-text-primary)]"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {contexts.length > 0 ? (
          <div className="px-4 py-3 border-b border-[var(--ws-border)] bg-[var(--ws-surface-secondary)]">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ws-text-muted)]">
                Working with
              </p>
              <button
                type="button"
                onClick={clearContexts}
                className="text-[11px] font-medium text-[var(--brand-violet-500)]"
              >
                Clear
              </button>
            </div>
            <ul className="space-y-1.5">
              {contexts.map((ctx) => (
                <li key={`${ctx.type}-${ctx.id || ctx.label}`}>
                  {ctx.href ? (
                    <Link
                      href={ctx.href}
                      className="block text-sm font-medium text-[var(--ws-text-primary)] hover:text-[var(--brand-violet-500)]"
                    >
                      {ctx.label}
                      <span className="ml-2 text-xs font-normal text-[var(--ws-text-muted)]">{ctx.type}</span>
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-[var(--ws-text-primary)]">
                      {ctx.label}
                      <span className="ml-2 text-xs font-normal text-[var(--ws-text-muted)]">{ctx.type}</span>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div
          className="px-3 py-3 border-b border-[var(--ws-border)] overflow-x-auto"
          role="tablist"
          aria-label="Bonnie modes"
        >
          <div className="inline-flex gap-1 min-w-min">
            {MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={mode === item.id}
                onClick={() => setMode(item.id)}
                className={cn(
                  'px-2.5 min-h-8 rounded-[8px] text-xs font-semibold whitespace-nowrap transition-colors',
                  mode === item.id
                    ? 'bg-[var(--brand-violet-500)] text-white'
                    : 'text-[var(--ws-text-muted)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-text-secondary)]'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
          <p className="text-sm text-[var(--ws-text-secondary)]">{MODE_HINT[mode]}</p>
          <label className="block">
            <span className="text-xs font-medium text-[var(--ws-text-muted)]">Your request</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              placeholder={
                mode === 'draft'
                  ? 'e.g. Draft a follow-up email for this customer…'
                  : 'Describe what you need Bonnie to do…'
              }
              className="mt-1.5 w-full rounded-[10px] border border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] px-3 py-2.5 text-sm text-[var(--ws-text-primary)] placeholder:text-[var(--ws-text-disabled)] focus:outline-none focus:border-[var(--brand-violet-500)]"
            />
          </label>
          <div className="rounded-[12px] border border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] p-3 text-xs text-[var(--ws-text-muted)] space-y-1.5">
            <p className="font-semibold text-[var(--ws-text-secondary)]">Before Bonnie acts</p>
            <p>Sending, posting, deleting, money moves, permission changes, and bulk updates require confirmation.</p>
            <p>Continue in the full workspace to execute tools with an audit trail.</p>
          </div>
        </div>

        <footer className="p-4 border-t border-[var(--ws-border)] flex flex-wrap gap-2">
          <button type="button" onClick={openFullWorkspace} className={WORKSPACE.action.bonnie}>
            Continue in Bonnie
          </button>
          <button type="button" onClick={closeDrawer} className={WORKSPACE.action.secondary}>
            Close
          </button>
        </footer>
      </aside>
    </div>
  );
}
