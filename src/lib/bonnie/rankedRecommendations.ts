/**
 * Bonnie contextual recommendations — prioritized actions, not generic prose.
 */

export interface RankedRecommendation {
  id: string;
  priority: number;
  title: string;
  reason: string;
  href: string;
  actionLabel: string;
  module: string;
}

export function buildRankedRecommendations(
  stats: Record<string, unknown> | null | undefined,
  opts?: { pendingApprovals?: number; module?: string }
): RankedRecommendation[] {
  if (!stats) return [];

  const recs: RankedRecommendation[] = [];
  const n = (key: string) => {
    const v = stats[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  };

  const pending = opts?.pendingApprovals ?? n('pendingBonnieApprovals');
  const overdue = n('overdueInvoices');
  const stale = n('staleLeads');
  const openTasks = n('openTasks');
  const qualified = n('qualifiedLeads');
  const newLeads24h = n('newLeads24h');

  if (pending > 0) {
    recs.push({
      id: 'bonnie-approvals',
      priority: 100,
      title: `Review ${pending} Bonnie approval${pending === 1 ? '' : 's'}`,
      reason: 'Automated actions are blocked until you approve.',
      href: '/dashboard/bonnie',
      actionLabel: 'Review now',
      module: 'bonnie',
    });
  }

  if (overdue > 0) {
    recs.push({
      id: 'overdue-invoices',
      priority: 90,
      title: `Chase ${overdue} overdue invoice${overdue === 1 ? '' : 's'}`,
      reason: 'Cash is locked until payment is collected.',
      href: '/dashboard/business/billing',
      actionLabel: 'Open billing',
      module: 'invoicing',
    });
  }

  if (stale > 0) {
    recs.push({
      id: 'stale-leads',
      priority: 70,
      title: `Qualify ${stale} stale lead${stale === 1 ? '' : 's'}`,
      reason: 'No activity in 7+ days — pipeline is cooling.',
      href: '/dashboard/crm',
      actionLabel: 'Open CRM',
      module: 'crm',
    });
  } else if (newLeads24h > 0) {
    recs.push({
      id: 'new-leads',
      priority: 65,
      title: `Review ${newLeads24h} new lead${newLeads24h === 1 ? '' : 's'}`,
      reason: 'Added in the last 24 hours — qualify while context is fresh.',
      href: '/dashboard/leads',
      actionLabel: 'Review leads',
      module: 'leads',
    });
  }

  if (qualified > 0 && opts?.module !== 'campaigns') {
    recs.push({
      id: 'qualified-outreach',
      priority: 60,
      title: `Start outreach to ${qualified} qualified lead${qualified === 1 ? '' : 's'}`,
      reason: 'Qualified demand should not sit idle.',
      href: '/dashboard/business/campaigns',
      actionLabel: 'Create campaign',
      module: 'outreach',
    });
  }

  if (openTasks > 0) {
    recs.push({
      id: 'open-tasks',
      priority: 50,
      title: `Complete ${openTasks} open task${openTasks === 1 ? '' : 's'}`,
      reason: 'Delivery and follow-ups depend on task execution.',
      href: '/dashboard/tasks',
      actionLabel: 'View tasks',
      module: 'tasks',
    });
  }

  return recs.sort((a, b) => b.priority - a.priority).slice(0, 5);
}
