'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, AlertTriangle, Zap, ChevronRight, Lightbulb, Target, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  prioritizeMaterialChanges,
  formatMaterialChangeLabel,
  type MaterialChange,
  getSemanticStyles,
  analyzeFunnel,
  rankAndPrioritizeDeals,
  type DealWithExpectedValue,
  type ExpectedValueDeal,
} from '@/lib/analytics/funnelAndPriority';
import { WORKSPACE } from '@/constants/design';
import { formatCurrency } from '@/lib/format/currency';

export function MaterialChangesStrip({
  changes,
  className,
}: {
  changes: MaterialChange[];
  className?: string;
}) {
  const prioritized = prioritizeMaterialChanges(changes);
  if (prioritized.length === 0) return null;

  return (
    <section className={cn(WORKSPACE.panel.base, 'p-3 md:p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-[var(--brand-amber-400)]" />
          <h2 className={WORKSPACE.typography.sectionTitle}>Material changes</h2>
        </div>
        <span className="text-[11px] text-[var(--ws-text-muted)]">
          {prioritized.length} meaningful change{prioritized.length !== 1 ? 's' : ''}
        </span>
      </div>
      <ul className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
        {prioritized.map((c) => {
          const severity: 'success' | 'critical' | 'warning' | 'info' =
            c.direction === 'positive' ? 'success' : c.magnitude >= 20 ? 'critical' : 'warning';
          const sem = getSemanticStyles(severity);
          const Icon = c.direction === 'positive' ? TrendingUp : TrendingDown;
          return (
            <li key={c.id} className="flex-1 min-w-[180px]">
              {c.href ? (
                <Link
                  href={c.href}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors',
                    sem.bg, sem.border, 'hover:bg-white/[0.04]',
                  )}
                >
                  <span className={cn('inline-flex w-6 h-6 items-center justify-center rounded shrink-0', sem.iconBg, sem.text)}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[11.5px] font-bold leading-tight truncate', sem.text)}>
                      {formatMaterialChangeLabel(c)}
                    </p>
                    <p className="text-[10.5px] text-[var(--ws-text-muted)] truncate mt-0.5">{c.summary}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--ws-text-disabled)] shrink-0" />
                </Link>
              ) : (
                <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', sem.bg, sem.border)}>
                  <span className={cn('inline-flex w-6 h-6 items-center justify-center rounded shrink-0', sem.iconBg, sem.text)}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[11.5px] font-bold leading-tight truncate', sem.text)}>
                      {formatMaterialChangeLabel(c)}
                    </p>
                    <p className="text-[10.5px] text-[var(--ws-text-muted)] truncate mt-0.5">{c.summary}</p>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function BottleneckDetector({
  funnelStages,
  multiplierName,
  onDrillDown,
}: {
  funnelStages: Parameters<typeof analyzeFunnel>[0];
  multiplierName?: string;
  onDrillDown?: (stageKey: string) => void;
}) {
  const analysis = analyzeFunnel(funnelStages, { multiplierName });
  const bottleneck = analysis.bottleneck;

  if (!bottleneck) {
    return null;
  }

  const severity = bottleneck.severity === 'critical' ? 'critical' : 'warning';
  const sem = getSemanticStyles(severity);

  return (
    <section className={cn(WORKSPACE.panel.base, 'p-4 md:p-5', sem.border, 'border')}>
      <div className="flex items-start gap-3">
        <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', sem.iconBg, sem.text)}>
          <AlertTriangle className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn('text-[11px] font-bold uppercase tracking-wider', sem.text)}>
              Primary bottleneck
            </p>
            <span className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border',
              sem.bg, sem.text, sem.border,
            )}>
              {bottleneck.dropOffPct}% loss
            </span>
          </div>
          <h3 className="mt-1.5 text-[14.5px] font-bold text-[var(--ws-text-primary)]">
            {bottleneck.stageLabel} → {bottleneck.nextStageLabel}
          </h3>
          <p className="mt-1 text-[12.5px] text-[var(--ws-text-secondary)] leading-relaxed">
            {bottleneck.impactDescription}
          </p>
          <div className="mt-3 pt-3 border-t border-white/[0.04]">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--brand-amber-400)]" />
              <p className="text-[12px] text-[var(--ws-text-primary)] leading-relaxed">
                {bottleneck.recommendation}
              </p>
            </div>
          </div>
          {onDrillDown ? (
            <div className="mt-3 flex items-center justify-end">
              <button
                type="button"
                onClick={() => onDrillDown(bottleneck.stageKey)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-bold transition-colors',
                  sem.bg, sem.text, 'hover:bg-white/[0.06]',
                )}
              >
                Drill into {bottleneck.stageLabel}
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function OpportunityHighlight({
  deals,
  limit = 3,
  onAction,
}: {
  deals: ExpectedValueDeal[];
  limit?: number;
  onAction?: (dealId: string) => void;
}) {
  const ranked = rankAndPrioritizeDeals(deals);
  const top = ranked.slice(0, limit);

  if (top.length === 0) return null;

  return (
    <section className={cn(WORKSPACE.panel.base, 'p-4 md:p-5')}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-[var(--success-500)]/10 text-[var(--success-text)]">
            <Target className="w-3.5 h-3.5" />
          </span>
          <div>
            <h2 className={WORKSPACE.typography.sectionTitle}>Highest expected-value actions</h2>
            <p className="text-[11.5px] text-[var(--ws-text-muted)] mt-0.5">
              Sorted by value × probability — what moves the needle most today.
            </p>
          </div>
        </div>
      </div>
      <ul className="space-y-2">
        {top.map((deal) => (
          <OpportunityRow key={deal.id} deal={deal} onAction={onAction} />
        ))}
      </ul>
    </section>
  );
}

function OpportunityRow({
  deal,
  onAction,
}: {
  deal: DealWithExpectedValue;
  onAction?: (id: string) => void;
}) {
  const priorityStyles = {
    high: getSemanticStyles('critical'),
    medium: getSemanticStyles('warning'),
    low: getSemanticStyles('neutral'),
  }[deal.priority];

  const label = { high: 'High', medium: 'Medium', low: 'Standard' }[deal.priority];

  return (
    <li className={cn(
      'flex items-center gap-3 rounded-lg border px-3 py-3 transition-colors',
      deal.priority === 'high' ? priorityStyles.border : 'border-[var(--ws-border)]',
      deal.priority === 'high' ? priorityStyles.bg : 'hover:bg-white/[0.03]',
      onAction ? 'cursor-pointer' : '',
    )}
      onClick={onAction ? () => onAction(deal.id) : undefined}
      role={onAction ? 'button' : undefined}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13px] font-semibold text-[var(--ws-text-primary)] truncate">
            {deal.label}
          </p>
          <span className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase border',
            priorityStyles.bg, priorityStyles.text, priorityStyles.border,
          )}>
            {label} priority
          </span>
          {deal.stage ? (
            <span className="text-[10px] text-[var(--ws-text-muted)]">
              · {deal.stage}
            </span>
          ) : null}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--ws-text-muted)]">
          <span className="inline-flex items-center gap-1 text-[var(--ws-text-primary)] font-bold tabular-nums">
            <DollarSign className="w-3 h-3 text-[var(--success-text)]" />
            {formatCurrency(deal.value)} value
          </span>
          <span className="tabular-nums">
            EV <span className="text-[var(--ws-text-primary)] font-bold">{formatCurrency(deal.expectedValue)}</span>
          </span>
          <span className="tabular-nums">
            Prob <span className="text-[var(--ws-text-primary)] font-bold">{Math.round(deal.probability * 100)}%</span>
          </span>
          {deal.valueRank !== deal.evRank ? (
            <span className="text-[var(--brand-amber-400)]">
              EV rank #{deal.evRank} vs value #{deal.valueRank}
            </span>
          ) : null}
        </div>
        {deal.attention.flags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {deal.attention.flags.map((f) => (
              <span
                key={f}
                className="inline-flex items-center rounded bg-[var(--warning-500)]/8 text-[var(--warning-text)] px-1.5 py-0.5 text-[9.5px] font-bold"
              >
                {f}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {onAction ? (
        <ChevronRight className="w-4 h-4 text-[var(--ws-text-disabled)] shrink-0" />
      ) : null}
    </li>
  );
}

export function BonnieBrief({
  whatChanged,
  whyItMatters,
  whatToDo,
  expanded,
  onToggle,
}: {
  whatChanged: string[];
  whyItMatters: string[];
  whatToDo: string[];
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = expanded ?? internalOpen;
  const toggle = onToggle ?? (() => setInternalOpen((v) => !v));

  const aiSem = getSemanticStyles('ai');

  return (
    <section className={cn(WORKSPACE.panel.base, aiSem.border, 'border p-4 md:p-5')}>
      <button
        type="button"
        onClick={toggle}
        className="flex items-start gap-3 w-full text-left"
        aria-expanded={open}
      >
        <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', aiSem.iconBg, aiSem.text)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M8 8.5c0-2.4 1.8-4.3 4-4.3s4 1.9 4 4.3v5.2c0 2.4-1.8 4.3-4 4.3s-4-1.9-4-4.3V8.5Z" />
            <circle cx="10.2" cy="10.2" r="0.9" fill="currentColor" stroke="none" />
            <circle cx="13.8" cy="10.2" r="0.9" fill="currentColor" stroke="none" />
            <path d="M10.4 13.2c.5.6 1.2.9 1.6.9s1.1-.3 1.6-.9" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn('text-[11px] font-bold uppercase tracking-wider', aiSem.text)}>Bonnie brief</p>
            <span className="text-[10.5px] text-[var(--ws-text-muted)] whitespace-nowrap">
              {whatChanged.length + whyItMatters.length + whatToDo.length} point{whatChanged.length + whyItMatters.length + whatToDo.length !== 1 ? 's' : ''}
            </span>
          </div>
          <h3 className="mt-1 text-[14px] font-bold text-[var(--ws-text-primary)]">
            3-sentence executive read
          </h3>
        </div>
        <ChevronRight
          className={cn(
            'w-4 h-4 text-[var(--ws-text-muted)] shrink-0 transition-transform duration-200',
            open && 'rotate-90',
          )}
        />
      </button>

      <div className={cn(
        'grid transition-all duration-200 overflow-hidden',
        open ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0',
      )}>
        <div className="min-h-0">
          <div className="space-y-3 rounded-lg bg-white/[0.02] p-3.5 border border-white/[0.03]">
            <BriefRow
              label="What changed"
              rows={whatChanged}
              labelColor="text-[var(--brand-blue-400)]"
            />
            <BriefRow
              label="Why it matters"
              rows={whyItMatters}
              labelColor="text-[var(--brand-amber-400)]"
            />
            <BriefRow
              label="What to do"
              rows={whatToDo}
              labelColor="text-[var(--success-text)]"
              bullet="•"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function BriefRow({
  label,
  rows,
  labelColor,
  bullet = '→',
}: {
  label: string;
  rows: string[];
  labelColor: string;
  bullet?: string;
}) {
  if (!rows.length) return null;
  return (
    <div>
      <p className={cn('text-[10.5px] font-black uppercase tracking-wider mb-1.5', labelColor)}>{label}</p>
      <ul className="space-y-1">
        {rows.map((r, i) => (
          <li key={i} className="text-[12.5px] text-[var(--ws-text-primary)] leading-relaxed flex gap-2">
            <span className={cn('font-black shrink-0 mt-0.5', labelColor)}>{bullet}</span>
            <span className="min-w-0">{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
