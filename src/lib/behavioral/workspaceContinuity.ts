/**
 * Ethical workspace continuity — surfaces accumulated business value (Sunk Cost / Investment)
 * without trapping users or hiding export/cancellation.
 */

export interface WorkspaceCounts {
  contacts: number;
  conversations: number;
  leads: number;
  opportunities: number;
  projects: number;
  invoices: number;
  campaigns: number;
}

export interface ContinuityHint {
  id: string;
  message: string;
  href?: string;
  actionLabel?: string;
}

export function extractWorkspaceCounts(stats: Record<string, unknown> | null | undefined): WorkspaceCounts {
  if (!stats) {
    return { contacts: 0, conversations: 0, leads: 0, opportunities: 0, projects: 0, invoices: 0, campaigns: 0 };
  }

  const num = (key: string, alt?: string) => {
    const v = stats[key] ?? (alt ? stats[alt] : undefined);
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  };

  const pendingInv = num('pendingInvoices');
  const overdueInv = num('overdueInvoices');
  const invoiceEstimate = pendingInv + overdueInv + (num('paidInvoiceCount') || 0);

  return {
    contacts: num('clientCount', 'activeCustomers'),
    conversations: num('totalMessages', 'unreadMessages'),
    leads: num('totalLeads', 'newLeads'),
    opportunities: num('totalDeals', 'dealsWon'),
    projects: num('activeProjects'),
    invoices: invoiceEstimate > 0 ? invoiceEstimate : num('invoiceCount'),
    campaigns: num('activeCampaigns'),
  };
}

export function buildContinuityHints(stats: Record<string, unknown> | null | undefined): ContinuityHint[] {
  if (!stats) return [];

  const hints: ContinuityHint[] = [];
  const stale = typeof stats.staleLeads === 'number' ? stats.staleLeads : 0;
  const qualified = typeof stats.qualifiedLeads === 'number' ? stats.qualifiedLeads : 0;
  const overdue = typeof stats.overdueInvoices === 'number' ? stats.overdueInvoices : 0;
  const pending = typeof stats.pendingInvoices === 'number' ? stats.pendingInvoices : 0;
  const openTasks = typeof stats.openTasks === 'number' ? stats.openTasks : 0;
  const newLeads24h = typeof stats.newLeads24h === 'number' ? stats.newLeads24h : 0;

  if (newLeads24h > 0) {
    hints.push({
      id: 'recent-leads',
      message: `You added ${newLeads24h} lead${newLeads24h === 1 ? '' : 's'} in the last 24 hours.`,
      href: '/dashboard/leads',
      actionLabel: 'Review leads',
    });
  }

  if (stale > 0) {
    hints.push({
      id: 'stale-leads',
      message: `${stale} lead${stale === 1 ? '' : 's'} still need qualification or follow-up.`,
      href: '/dashboard/crm',
      actionLabel: 'Qualify leads',
    });
  } else if (qualified > 0) {
    hints.push({
      id: 'qualified-pipeline',
      message: `${qualified} qualified lead${qualified === 1 ? '' : 's'} in your pipeline — keep momentum with outreach.`,
      href: '/dashboard/deals',
      actionLabel: 'View pipeline',
    });
  }

  if (overdue > 0) {
    hints.push({
      id: 'overdue-invoices',
      message: `${overdue} invoice${overdue === 1 ? ' is' : 's are'} overdue.`,
      href: '/dashboard/business/billing',
      actionLabel: 'Collect payment',
    });
  } else if (pending > 0) {
    hints.push({
      id: 'pending-invoices',
      message: `${pending} sent invoice${pending === 1 ? '' : 's'} awaiting payment.`,
      href: '/dashboard/business/billing',
      actionLabel: 'View billing',
    });
  }

  if (openTasks > 0) {
    hints.push({
      id: 'open-tasks',
      message: `${openTasks} open task${openTasks === 1 ? '' : 's'} on your board.`,
      href: '/dashboard/tasks',
      actionLabel: 'Work tasks',
    });
  }

  return hints.slice(0, 3);
}

export function hasWorkspaceInvestment(counts: WorkspaceCounts): boolean {
  return Object.values(counts).some((n) => n > 0);
}
