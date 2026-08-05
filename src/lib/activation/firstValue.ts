import type { ModuleLauncherItem } from '@/components/ui/os';

export type WorkspaceStats = Record<string, unknown> | null | undefined;

export const FIRST_VALUE_MODULES: ModuleLauncherItem[] = [
  { id: 'crm', href: '/dashboard/crm/workspace?quickAdd=true', purpose: 'Add the first client record' },
  { id: 'invoicing', href: '/dashboard/business/billing/manage?create=true', purpose: 'Create the first money action' },
  { id: 'pipeline', href: '/dashboard/deals', purpose: 'Track the revenue opportunity' },
  { id: 'tasks', href: '/dashboard/tasks', purpose: 'Set the next follow-up' },
];

const FIRST_VALUE_EXACT_ROUTES = new Set([
  '/dashboard',
  '/dashboard/business',
  '/dashboard/crm',
  '/dashboard/crm/workspace',
  '/dashboard/contacts',
  '/dashboard/deals',
  '/dashboard/business/billing',
  '/dashboard/business/billing/manage',
  '/dashboard/finance',
  '/dashboard/finance/manage',
  '/dashboard/comms',
  '/dashboard/messages',
  '/dashboard/business/messages',
  '/dashboard/tasks',
  '/dashboard/business/projects',
  '/dashboard/projects',
  '/dashboard/business/booking',
  '/dashboard/help',
  '/dashboard/business/settings',
  '/dashboard/settings',
]);

const FIRST_VALUE_ROUTE_PREFIXES = [
  '/dashboard/crm/workspace?',
  '/dashboard/business/billing/manage?',
];

export function numericStat(stats: WorkspaceStats, keys: string[]): number {
  for (const key of keys) {
    const value = Number(stats?.[key] ?? 0);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

export function isNewWorkspaceStats(stats: WorkspaceStats): boolean {
  if (!stats) return false;
  const activitySignals = [
    numericStat(stats, ['totalLeads', 'newLeads', 'leads', 'leadsCount']),
    numericStat(stats, ['clientCount', 'activeCustomers', 'contacts']),
    numericStat(stats, ['activeProjects']),
    numericStat(stats, ['totalTasks', 'openTasks', 'tasksCompleted', 'completedTasks']),
    numericStat(stats, ['unreadMessages']),
    numericStat(stats, ['activeCampaigns']),
    numericStat(stats, ['revenue', 'totalRevenue', 'outstanding', 'pendingAmount']),
  ];
  return activitySignals.every((value) => value === 0);
}

export function hasCustomerSignal(stats: WorkspaceStats): boolean {
  return numericStat(stats, ['clientCount', 'activeCustomers', 'contacts']) > 0;
}

export function hasMoneySignal(stats: WorkspaceStats): boolean {
  return numericStat(stats, [
    'revenue',
    'totalRevenue',
    'outstanding',
    'outstandingInvoices',
    'outstandingAmount',
    'pendingRevenue',
    'pendingAmount',
  ]) > 0;
}

export function isWorkspaceActivatedStats(stats: WorkspaceStats): boolean {
  return hasCustomerSignal(stats) && hasMoneySignal(stats);
}

export function hasCompletedCoreActivationSteps(
  steps: Partial<Record<string, boolean>> | null | undefined,
): boolean {
  return Boolean(
    steps?.first_client_added &&
      steps?.first_invoice_started &&
      steps?.first_revenue_action_sent,
  );
}

export function isFirstValueRoute(path: string): boolean {
  const route = path || '/dashboard';
  const base = route.split('#')[0] || route;
  const withoutQuery = base.split('?')[0] || base;
  return (
    FIRST_VALUE_EXACT_ROUTES.has(withoutQuery) ||
    FIRST_VALUE_ROUTE_PREFIXES.some((prefix) => base.startsWith(prefix))
  );
}
