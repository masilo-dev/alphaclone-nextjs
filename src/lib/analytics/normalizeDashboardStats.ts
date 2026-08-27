/** Map RPC / fallback dashboard stats into fields the home view model expects. */

const QUALIFIED_STAGE_KEYS = [
  'qualified',
  'proposal',
  'negotiation',
  'discovery',
  'contacted',
  'engaged',
  'meeting_scheduled',
  'demo',
];

const WON_STAGE_KEYS = ['won', 'closed_won', 'closed won'];

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sumPipelineStages(pipeline: unknown, keys: string[]): number {
  if (!pipeline || typeof pipeline !== 'object' || Array.isArray(pipeline)) return 0;
  const entries = pipeline as Record<string, unknown>;
  const normalizedKeys = new Set(keys.map((k) => k.toLowerCase()));
  let total = 0;
  for (const [stage, count] of Object.entries(entries)) {
    if (!normalizedKeys.has(stage.toLowerCase())) continue;
    total += safeNumber(count, Number(count) || 0);
  }
  return total;
}

export function normalizeDashboardStats(
  raw: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!raw) return {};

  const pipeline = raw.pipeline;
  const totalLeads = safeNumber(raw.totalLeads);
  const newLeads = safeNumber(raw.newLeads, totalLeads || safeNumber(raw.leads, safeNumber(raw.leadsCount)));
  const qualifiedFromPipeline = sumPipelineStages(pipeline, QUALIFIED_STAGE_KEYS);
  const qualifiedLeads = safeNumber(raw.qualifiedLeads, safeNumber(raw.qualified, qualifiedFromPipeline));
  const dealsWonFromPipeline = sumPipelineStages(pipeline, WON_STAGE_KEYS);
  const dealsWon = safeNumber(
    raw.dealsWon,
    safeNumber(raw.closedWon, safeNumber(raw.wonDeals, dealsWonFromPipeline)),
  );

  return {
    ...raw,
    revenue: safeNumber(raw.revenue, safeNumber(raw.totalRevenue)),
    totalRevenue: safeNumber(raw.totalRevenue, safeNumber(raw.revenue)),
    newLeads,
    totalLeads: totalLeads || newLeads,
    leads: safeNumber(raw.leads, newLeads),
    qualifiedLeads,
    qualified: qualifiedLeads,
    outstanding: safeNumber(
      raw.outstanding,
      safeNumber(raw.pendingRevenue, safeNumber(raw.outstandingAmount)),
    ),
    pendingRevenue: safeNumber(raw.pendingRevenue, safeNumber(raw.outstanding)),
    activeCustomers: safeNumber(
      raw.activeCustomers,
      safeNumber(raw.customers, safeNumber(raw.clientCount)),
    ),
    clientCount: safeNumber(raw.clientCount, safeNumber(raw.activeCustomers)),
    dealsWon,
    tasksCompleted: safeNumber(raw.tasksCompleted, safeNumber(raw.completedTasks)),
    completedTasks: safeNumber(raw.completedTasks, safeNumber(raw.tasksCompleted)),
    openTasks: safeNumber(
      raw.openTasks,
      safeNumber(
        raw.open_tasks,
        Math.max(
          0,
          safeNumber(raw.totalTasks) - safeNumber(raw.completedTasks, safeNumber(raw.tasksCompleted)),
        ),
      ),
    ),
    staleLeads: safeNumber(raw.staleLeads, safeNumber(raw.uncontactedLeads)),
  };
}
