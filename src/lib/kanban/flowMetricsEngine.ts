/**
 * Pure Mathematical Flow Metrics Engine for Kanban Boards.
 * Strictly adheres to Standard 8:
 * - Computes all flow metrics solely from logged transition rows and card timestamps.
 * - Zero fabricated metrics, zero naive snapshot counts.
 */

import {
  BoardCardState,
  BoardDefinition,
  BoardTransitionLog,
  FlowMetricsResult,
} from './boardModel';

export interface MetricsCalculationInput {
  tenantId: string;
  boardDef: BoardDefinition;
  transitions: BoardTransitionLog[];
  activeCards: BoardCardState[];
  windowDays?: number;
  now?: Date;
}

export function computePercentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const rank = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  const weight = rank - lower;
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

export function calculateKanbanFlowMetrics(input: MetricsCalculationInput): FlowMetricsResult {
  const { tenantId, boardDef, transitions, activeCards } = input;
  const now = input.now || new Date();
  const windowDays = input.windowDays || 30;
  const windowStartMs = now.getTime() - windowDays * 24 * 60 * 60 * 1000;

  const terminalSet = new Set(boardDef.terminalStates);

  // Group transitions by card_id
  const transitionsByCard = new Map<string, BoardTransitionLog[]>();
  for (const t of transitions) {
    const list = transitionsByCard.get(t.card_id) || [];
    list.push(t);
    transitionsByCard.set(t.card_id, list);
  }

  // Sort transitions by created_at ascending
  for (const [, list] of transitionsByCard) {
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  // 1. Throughput & Cycle Times for terminal cards in window
  const completedCycleTimes: number[] = [];
  const completedLeadTimes: number[] = [];
  const scatterplot: FlowMetricsResult['cycleTimeScatterplot'] = [];

  let totalActiveDurationMs = 0;
  let totalWaitOrBlockedDurationMs = 0;

  for (const [cardId, cardTransitions] of transitionsByCard) {
    if (cardTransitions.length === 0) continue;

    // Check if card reached a terminal state
    const terminalTransition = cardTransitions.find(t => terminalSet.has(t.to_state));
    if (!terminalTransition) continue;

    const completedAt = new Date(terminalTransition.created_at);
    if (completedAt.getTime() < windowStartMs) continue;

    // Lead time: from very first transition or card created_at to terminal transition
    const firstTransition = cardTransitions[0];
    const createdAtMs = new Date(firstTransition.created_at).getTime();
    const leadTimeMs = Math.max(0, completedAt.getTime() - createdAtMs);
    const leadTimeDays = Number((leadTimeMs / (24 * 60 * 60 * 1000)).toFixed(2));

    // Cycle time: from commitment state (e.g., 'qualified' for deals, 'todo' for tasks) to terminal transition
    const commitmentState = boardDef.commitmentState;
    const startTransition = 
      (commitmentState ? cardTransitions.find(t => t.to_state === commitmentState) : null) ||
      cardTransitions.find(t => !['ideas', 'backlog', 'lead'].includes(t.to_state)) ||
      firstTransition;
    const startTimeMs = new Date(startTransition.created_at).getTime();
    const cycleTimeMs = Math.max(0, completedAt.getTime() - startTimeMs);
    const cycleTimeDays = Number((cycleTimeMs / (24 * 60 * 60 * 1000)).toFixed(2));

    completedCycleTimes.push(cycleTimeDays);
    completedLeadTimes.push(leadTimeDays);

    // Associated card if available
    const card = activeCards.find(c => c.id === cardId);
    const classOfService = card?.class_of_service || (terminalTransition.metadata?.class_of_service as any) || 'standard';

    scatterplot.push({
      cardId,
      completedAt: completedAt.toISOString(),
      cycleTimeDays,
      leadTimeDays,
      classOfService,
    });
  }

  // 2. Flow Efficiency from all transitions in window
  for (const t of transitions) {
    const duration = t.duration_in_previous_state_ms || 0;
    if (duration <= 0) continue;

    const fromState = t.from_state;
    const isWaitState = ['ideas', 'backlog', 'review'].includes(fromState || '') || Boolean(t.metadata?.was_blocked);
    if (isWaitState) {
      totalWaitOrBlockedDurationMs += duration;
    } else {
      totalActiveDurationMs += duration;
    }
  }

  const totalTimeForEfficiency = totalActiveDurationMs + totalWaitOrBlockedDurationMs;
  const flowEfficiencyPercent = totalTimeForEfficiency > 0
    ? Number(((totalActiveDurationMs / totalTimeForEfficiency) * 100).toFixed(1))
    : 100;

  // 3. WIP Count (Active, non-terminal, non-archived cards right now)
  const nonTerminalActiveCards = activeCards.filter(
    c => !c.archived && !terminalSet.has(c.stage)
  );
  const wipCount = nonTerminalActiveCards.length;

  // 4. Work item age for in-flight cards
  let totalAgeDays = 0;
  for (const card of nonTerminalActiveCards) {
    const enteredAt = card.entered_column_at ? new Date(card.entered_column_at).getTime() : new Date(card.created_at).getTime();
    const ageMs = Math.max(0, now.getTime() - enteredAt);
    totalAgeDays += ageMs / (24 * 60 * 60 * 1000);
  }
  const avgWorkItemAgeDays = nonTerminalActiveCards.length > 0
    ? Number((totalAgeDays / nonTerminalActiveCards.length).toFixed(2))
    : 0;

  // 5. Total Blocked Time
  let totalBlockedTimeHours = 0;
  for (const card of activeCards) {
    if (card.is_blocked && card.blocked_since) {
      const blockedMs = Math.max(0, now.getTime() - new Date(card.blocked_since).getTime());
      totalBlockedTimeHours += blockedMs / (60 * 60 * 1000);
    }
  }
  for (const t of transitions) {
    if (t.metadata?.blocked_duration_ms) {
      totalBlockedTimeHours += Number(t.metadata.blocked_duration_ms) / (60 * 60 * 1000);
    }
  }
  totalBlockedTimeHours = Number(totalBlockedTimeHours.toFixed(1));

  // 6. Percentiles
  completedCycleTimes.sort((a, b) => a - b);
  const p50CycleTimeDays = Number(computePercentile(completedCycleTimes, 50).toFixed(2));
  const p85CycleTimeDays = Number(computePercentile(completedCycleTimes, 85).toFixed(2));
  const p95CycleTimeDays = Number(computePercentile(completedCycleTimes, 95).toFixed(2));
  const avgCycleTimeDays = completedCycleTimes.length > 0
    ? Number((completedCycleTimes.reduce((a, b) => a + b, 0) / completedCycleTimes.length).toFixed(2))
    : 0;
  const avgLeadTimeDays = completedLeadTimes.length > 0
    ? Number((completedLeadTimes.reduce((a, b) => a + b, 0) / completedLeadTimes.length).toFixed(2))
    : 0;

  // 7. Aging Alerts: cards exceeding column threshold (or 85th percentile if threshold unset)
  const agingAlerts: FlowMetricsResult['agingAlerts'] = [];
  const columnThresholds = new Map<string, number>();
  for (const col of boardDef.columns) {
    columnThresholds.set(col.id, col.agingThresholdHours || Math.max(24, Math.round(p85CycleTimeDays * 24)));
  }

  for (const card of nonTerminalActiveCards) {
    const enteredAt = card.entered_column_at ? new Date(card.entered_column_at).getTime() : new Date(card.created_at).getTime();
    const ageHours = Math.max(0, Math.round((now.getTime() - enteredAt) / (60 * 60 * 1000)));
    const thresholdHours = columnThresholds.get(card.stage) || 72;

    if (ageHours >= thresholdHours || card.is_blocked) {
      agingAlerts.push({
        cardId: card.id,
        title: card.title,
        columnId: card.stage,
        ageHours,
        thresholdHours,
        isBlocked: card.is_blocked,
        blockedReason: card.blocked_reason || undefined,
      });
    }
  }

  // 8. Cumulative Flow Diagram (CFD) by day from transition logs
  const cfdMap = new Map<string, Record<string, number>>();
  const dayMs = 24 * 60 * 60 * 1000;
  const daysToTrack = Math.min(windowDays, 30);

  // Generate bucket dates
  for (let i = daysToTrack; i >= 0; i--) {
    const d = new Date(now.getTime() - i * dayMs);
    const dateStr = d.toISOString().split('T')[0];
    const initialCounts: Record<string, number> = {};
    for (const col of boardDef.columns) {
      initialCounts[col.id] = 0;
    }
    cfdMap.set(dateStr, initialCounts);
  }

  // Replay transitions to calculate state at each day cutoff
  for (const [dateStr, counts] of cfdMap) {
    const cutoffMs = new Date(`${dateStr}T23:59:59.999Z`).getTime();

    for (const [, cardTransitions] of transitionsByCard) {
      // Find latest transition for this card before or on cutoffMs
      const priorTransitions = cardTransitions.filter(t => new Date(t.created_at).getTime() <= cutoffMs);
      if (priorTransitions.length > 0) {
        const latest = priorTransitions[priorTransitions.length - 1];
        if (counts[latest.to_state] !== undefined) {
          counts[latest.to_state]++;
        }
      }
    }
  }

  const cumulativeFlowDiagram: FlowMetricsResult['cumulativeFlowDiagram'] = [];
  for (const [date, countsByColumn] of cfdMap) {
    cumulativeFlowDiagram.push({ date, countsByColumn });
  }

  return {
    tenantId,
    boardType: boardDef.boardType,
    calculatedAt: now.toISOString(),
    summary: {
      wipCount,
      throughputCount: completedCycleTimes.length,
      avgCycleTimeDays,
      p50CycleTimeDays,
      p85CycleTimeDays,
      p95CycleTimeDays,
      avgLeadTimeDays,
      avgWorkItemAgeDays,
      totalBlockedTimeHours,
      flowEfficiencyPercent,
    },
    agingAlerts,
    cumulativeFlowDiagram,
    cycleTimeScatterplot: scatterplot,
  };
}
