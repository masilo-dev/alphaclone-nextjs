'use client';

import { type KpiStatus } from './kpiMath';

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  description?: string;
  benchmarkConversion?: number;
}

export interface FunnelAnalysis {
  stages: FunnelStage[];
  stageConversions: Array<{
    fromKey: string;
    toKey: string;
    fromLabel: string;
    toLabel: string;
    raw: number;
    conversionPct: number;
    dropOffPct: number;
    benchmarkGap?: number;
  }>;
  overallConversionPct: number;
  bottleneck: {
    stageKey: string;
    stageLabel: string;
    dropOffPct: number;
    nextStageKey: string;
    nextStageLabel: string;
    severity: 'critical' | 'warning' | 'none';
    impactDescription: string;
    recommendation: string;
  } | null;
  insights: string[];
}

export function analyzeFunnel(stages: FunnelStage[], opts: { multiplierName?: string } = {}): FunnelAnalysis {
  const validStages = stages.filter((s) => s.count >= 0);
  const stageConversions: FunnelAnalysis['stageConversions'] = [];

  for (let i = 0; i < validStages.length - 1; i++) {
    const from = validStages[i];
    const to = validStages[i + 1];
    const conversionPct = from.count > 0 ? (to.count / from.count) * 100 : 0;
    const dropOffPct = 100 - conversionPct;
    const benchmarkGap =
      from.benchmarkConversion != null ? conversionPct - from.benchmarkConversion : undefined;

    stageConversions.push({
      fromKey: from.key,
      toKey: to.key,
      fromLabel: from.label,
      toLabel: to.label,
      raw: to.count,
      conversionPct: Math.round(conversionPct * 10) / 10,
      dropOffPct: Math.round(dropOffPct * 10) / 10,
      benchmarkGap: benchmarkGap != null ? Math.round(benchmarkGap * 10) / 10 : undefined,
    });
  }

  const firstCount = validStages[0]?.count ?? 0;
  const lastCount = validStages[validStages.length - 1]?.count ?? 0;
  const overallConversionPct =
    firstCount > 0 ? Math.round((lastCount / firstCount) * 1000) / 10 : 0;

  const sortedDrops = [...stageConversions].sort((a, b) => b.dropOffPct - a.dropOffPct);
  const worst = sortedDrops[0];

  let bottleneck: FunnelAnalysis['bottleneck'] = null;
  if (worst && validStages.length > 2) {
    let severity: 'critical' | 'warning' | 'none' = 'none';
    const benchmarkBelow =
      worst.benchmarkGap != null && worst.benchmarkGap < 0 ? Math.abs(worst.benchmarkGap) : 0;

    if (worst.dropOffPct >= 70 || benchmarkBelow >= 20) {
      severity = 'critical';
    } else if (worst.dropOffPct >= 50 || benchmarkBelow >= 10) {
      severity = 'warning';
    }

    if (severity !== 'none') {
      const stageIndex = validStages.findIndex((s) => s.key === worst.fromKey);
      const multiplier = opts.multiplierName ?? 'output';
      const lostAtStage = validStages[stageIndex]?.count - validStages[stageIndex + 1]?.count;
      bottleneck = {
        stageKey: worst.fromKey,
        stageLabel: worst.fromLabel,
        dropOffPct: worst.dropOffPct,
        nextStageKey: worst.toKey,
        nextStageLabel: worst.toLabel,
        severity,
        impactDescription:
          lostAtStage && lostAtStage > 0
            ? `${lostAtStage.toLocaleString()} potential ${multiplier} stuck between ${worst.fromLabel.toLowerCase()} and ${worst.toLabel.toLowerCase()}.`
            : `${worst.dropOffPct}% loss from ${worst.fromLabel.toLowerCase()} to ${worst.toLabel.toLowerCase()}.`,
        recommendation: buildBottleneckRecommendation(worst.fromLabel, worst.toLabel, severity),
      };
    }
  }

  const insights: string[] = [];
  if (overallConversionPct > 0) {
    insights.push(`Overall funnel: ${overallConversionPct}% from ${validStages[0]?.label ?? 'top'} to ${validStages[validStages.length - 1]?.label ?? 'result'}.`);
  }
  for (const conv of stageConversions) {
    const gapNote =
      conv.benchmarkGap != null
        ? conv.benchmarkGap >= 0
          ? ` (+${conv.benchmarkGap}pp vs benchmark)`
          : ` (${conv.benchmarkGap}pp below benchmark)`
        : '';
    insights.push(`${conv.fromLabel} → ${conv.toLabel}: ${conv.conversionPct}%${gapNote}`);
  }
  if (bottleneck) {
    insights.unshift(`Bottleneck detected at ${bottleneck.stageLabel}: ${bottleneck.impactDescription}`);
  }

  return { stages: validStages, stageConversions, overallConversionPct, bottleneck, insights };
}

function buildBottleneckRecommendation(fromLabel: string, toLabel: string, severity: 'critical' | 'warning'): string {
  const from = fromLabel.toLowerCase();
  const to = toLabel.toLowerCase();
  if (severity === 'critical') {
    return `Prioritize the ${from} to ${to} transition before increasing volume at earlier stages — current losses outweigh upstream growth. Audit criteria, follow-up timing, and handoff quality.`;
  }
  return `Improve the ${from} to ${to} transition. Review qualification criteria, response time, and handoff quality.`;
}

export interface ExpectedValueDeal {
  id: string;
  label: string;
  value: number;
  probability: number;
  stage?: string;
  ageDays?: number;
  lastFollowUpDaysAgo?: number;
}

export interface DealWithExpectedValue extends ExpectedValueDeal {
  expectedValue: number;
  valueRank: number;
  evRank: number;
  priority: 'high' | 'medium' | 'low';
  attention: {
    staleFollowUp: boolean;
    aging: boolean;
    highValueLowProbability: boolean;
    flags: string[];
  };
}

export function rankAndPrioritizeDeals(deals: ExpectedValueDeal[]): DealWithExpectedValue[] {
  const enriched = deals.map((d) => {
    const probabilitySafe = Math.max(0, Math.min(1, Number.isFinite(d.probability) ? d.probability : 0));
    const expectedValue = Math.round(d.value * probabilitySafe * 100) / 100;
    const flags: string[] = [];
    const staleFollowUp = (d.lastFollowUpDaysAgo ?? 0) >= 5;
    const aging = (d.ageDays ?? 0) >= 45 && probabilitySafe < 0.7;
    const highValueLowProbability = d.value >= 5000 && probabilitySafe <= 0.25;
    if (staleFollowUp) flags.push('No follow-up in 5+ days');
    if (aging) flags.push('Aging deal — 45+ days with low probability');
    if (highValueLowProbability) flags.push('High value, low confidence — may need nurturing');

    let priority: 'high' | 'medium' | 'low' = 'low';
    if (expectedValue >= 3000 || probabilitySafe >= 0.7 || staleFollowUp) {
      priority = 'high';
    } else if (expectedValue >= 1000 || highValueLowProbability) {
      priority = 'medium';
    }

    return {
      ...d,
      expectedValue,
      valueRank: 0,
      evRank: 0,
      priority,
      attention: { staleFollowUp, aging, highValueLowProbability, flags },
    };
  });

  const byValue = [...enriched].sort((a, b) => b.value - a.value);
  const byEv = [...enriched].sort((a, b) => b.expectedValue - a.expectedValue);

  byValue.forEach((d, i) => {
    const found = enriched.find((e) => e.id === d.id);
    if (found) found.valueRank = i + 1;
  });
  byEv.forEach((d, i) => {
    const found = enriched.find((e) => e.id === d.id);
    if (found) found.evRank = i + 1;
  });

  return byEv;
}

export function pipelineTotals(deals: ExpectedValueDeal[]) {
  const totalValue = deals.reduce((s, d) => s + (Number.isFinite(d.value) ? d.value : 0), 0);
  const weightedValue = deals.reduce((s, d) => {
    const p = Math.max(0, Math.min(1, Number.isFinite(d.probability) ? d.probability : 0));
    return s + (d.value || 0) * p;
  }, 0);
  const forecastStages = ['proposal', 'negotiation', 'contract', 'verbal_commitment', 'closed_like'];
  const forecast = deals
    .filter((d) => d.stage && forecastStages.includes(d.stage.toLowerCase()))
    .reduce((s, d) => s + (d.value || 0) * Math.max(0, Math.min(1, d.probability ?? 0.5)), 0);

  return {
    totalDeals: deals.length,
    totalValue: Math.round(totalValue * 100) / 100,
    weightedValue: Math.round(weightedValue * 100) / 100,
    forecastValue: Math.round(forecast * 100) / 100,
    averageDealValue: deals.length > 0 ? Math.round((totalValue / deals.length) * 100) / 100 : 0,
    expectedWinRate:
      totalValue > 0 ? Math.round((weightedValue / totalValue) * 1000) / 10 : null,
  };
}

export type SemanticSeverity = 'success' | 'warning' | 'critical' | 'neutral' | 'info' | 'inactive' | 'ai' | 'forecast';

export interface SemanticStyling {
  bg: string;
  border: string;
  text: string;
  dot: string;
  iconBg: string;
  ring: string;
}

const SEMANTIC_MAP: Record<SemanticSeverity, SemanticStyling> = {
  success: {
    bg: 'bg-[var(--success-500)]/10',
    border: 'border-[var(--success-500)]/25',
    text: 'text-[var(--success-text)]',
    dot: 'bg-[var(--success-500)]',
    iconBg: 'bg-[var(--success-500)]/15',
    ring: 'ring-[var(--success-500)]/30',
  },
  warning: {
    bg: 'bg-[var(--warning-500)]/10',
    border: 'border-[var(--warning-500)]/25',
    text: 'text-[var(--warning-text)]',
    dot: 'bg-[var(--warning-500)]',
    iconBg: 'bg-[var(--warning-500)]/15',
    ring: 'ring-[var(--warning-500)]/30',
  },
  critical: {
    bg: 'bg-[var(--error-500)]/10',
    border: 'border-[var(--error-500)]/25',
    text: 'text-[var(--error-text)]',
    dot: 'bg-[var(--error-500)]',
    iconBg: 'bg-[var(--error-500)]/15',
    ring: 'ring-[var(--error-500)]/30',
  },
  neutral: {
    bg: 'bg-white/5',
    border: 'border-white/10',
    text: 'text-[var(--ws-text-secondary)]',
    dot: 'bg-[var(--ws-text-muted)]',
    iconBg: 'bg-white/5',
    ring: 'ring-white/20',
  },
  info: {
    bg: 'bg-[var(--brand-blue-500)]/10',
    border: 'border-[var(--brand-blue-500)]/25',
    text: 'text-[var(--brand-blue-400)]',
    dot: 'bg-[var(--brand-blue-500)]',
    iconBg: 'bg-[var(--brand-blue-500)]/15',
    ring: 'ring-[var(--brand-blue-500)]/30',
  },
  inactive: {
    bg: 'bg-white/[0.02]',
    border: 'border-white/5',
    text: 'text-[var(--ws-text-muted)]',
    dot: 'bg-[var(--ws-text-disabled)]',
    iconBg: 'bg-white/[0.02]',
    ring: 'ring-white/10',
  },
  ai: {
    bg: 'bg-[var(--brand-violet-500)]/10',
    border: 'border-[var(--brand-violet-500)]/25',
    text: 'text-[var(--brand-violet-400)]',
    dot: 'bg-[var(--brand-violet-500)]',
    iconBg: 'bg-[var(--brand-violet-500)]/15',
    ring: 'ring-[var(--brand-violet-500)]/30',
  },
  forecast: {
    bg: 'bg-[var(--brand-amber-500)]/8',
    border: 'border-dashed border-[var(--brand-amber-500)]/25',
    text: 'text-[var(--brand-amber-400)]',
    dot: 'bg-[var(--brand-amber-500)]',
    iconBg: 'bg-[var(--brand-amber-500)]/12',
    ring: 'ring-[var(--brand-amber-500)]/30',
  },
};

export function getSemanticStyles(severity: SemanticSeverity): SemanticStyling {
  return SEMANTIC_MAP[severity] ?? SEMANTIC_MAP.neutral;
}

export function kpiStatusToSeverity(status: KpiStatus): SemanticSeverity {
  switch (status) {
    case 'healthy':
    case 'improving':
      return 'success';
    case 'warning':
      return 'warning';
    case 'critical':
      return 'critical';
    case 'stagnant':
      return 'info';
    case 'insufficient_data':
      return 'inactive';
    default:
      return 'neutral';
  }
}

export interface MaterialChange {
  id: string;
  label: string;
  summary: string;
  direction: 'positive' | 'negative' | 'neutral';
  magnitude: number;
  severity?: SemanticSeverity;
  metric: string;
  href?: string;
  evidence?: string;
}

export function prioritizeMaterialChanges(changes: MaterialChange[]): MaterialChange[] {
  return [...changes]
    .filter((c) => Math.abs(c.magnitude) >= 3)
    .sort((a, b) => {
      const aScore = Math.abs(a.magnitude) * (a.direction === 'negative' ? 1.4 : 1);
      const bScore = Math.abs(b.magnitude) * (b.direction === 'negative' ? 1.4 : 1);
      return bScore - aScore;
    })
    .slice(0, 6);
}

export function formatMaterialChangeLabel(c: MaterialChange): string {
  const sign = c.magnitude > 0 ? '+' : '';
  const arrow = c.direction === 'positive' ? '▲' : c.direction === 'negative' ? '▼' : '■';
  return `${arrow} ${sign}${Math.abs(c.magnitude).toFixed(0)}% ${c.label}`;
}
