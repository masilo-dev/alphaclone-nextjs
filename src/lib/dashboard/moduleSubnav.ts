import type { ModuleId } from '@/constants/brand';
import type { SubNavItem } from '@/components/ui/os/SubNavigation';

/**
 * Structured submodule navigation for each Alphaclone OS module.
 * Paths reuse existing production routes — do not invent broken destinations.
 */
export const MODULE_SUBNAV: Record<ModuleId, SubNavItem[]> = {
  dashboard: [
    { id: 'home', label: 'Overview', href: '/dashboard/business' },
  ],
  crm: [
    { id: 'overview', label: 'Overview', href: '/dashboard/crm' },
    { id: 'contacts', label: 'Contacts', href: '/dashboard/crm/unified-contacts' },
    { id: 'companies', label: 'Companies', href: '/dashboard/crm/accounts' },
    { id: 'workspace', label: 'Workspace', href: '/dashboard/crm/workspace' },
    { id: 'followups', label: 'Activities', href: '/dashboard/crm/follow-ups' },
    { id: 'comms', label: 'Communication', href: '/dashboard/comms' },
    { id: 'reports', label: 'Customer health', href: '/dashboard/crm/reports' },
  ],
  leads: [
    { id: 'overview', label: 'Overview', href: '/dashboard/leads' },
    { id: 'all', label: 'All leads', href: '/dashboard/leads' },
    { id: 'campaigns', label: 'Lead sources', href: '/dashboard/leads/campaigns' },
    { id: 'forms', label: 'Forms', href: '/dashboard/business/forms' },
  ],
  pipeline: [
    { id: 'pipeline', label: 'Pipeline', href: '/dashboard/deals' },
    { id: 'deals', label: 'Deals', href: '/dashboard/deals' },
    { id: 'forecast', label: 'Forecast', href: '/dashboard/forecast' },
    { id: 'followups', label: 'Follow-ups', href: '/dashboard/crm/follow-ups' },
  ],
  email: [
    { id: 'inbox', label: 'Unified inbox', href: '/dashboard/business/unified-inbox' },
    { id: 'mail', label: 'Mail', href: '/dashboard/mail' },
    { id: 'templates', label: 'Templates', href: '/dashboard/business/campaigns' },
    { id: 'sequences', label: 'Sequences', href: '/dashboard/marketing/sequences' },
  ],
  outreach: [
    { id: 'inbox', label: 'Reach inbox', href: '/dashboard/outreach/inbox' },
    { id: 'outreach', label: 'Overview', href: '/dashboard/outreach' },
    { id: 'campaigns', label: 'Campaign outreach', href: '/dashboard/business/campaigns' },
    { id: 'zoho', label: 'Zoho bulk', href: '/dashboard/business/campaigns/zoho' },
    { id: 'tracking', label: 'Deliverability', href: '/dashboard/marketing/deliverability' },
  ],
  invoicing: [
    { id: 'overview', label: 'Overview', href: '/dashboard/business/billing' },
    { id: 'invoices', label: 'Invoices', href: '/dashboard/business/billing/manage' },
    { id: 'invoices-alt', label: 'Invoice list', href: '/dashboard/business/invoices' },
    { id: 'expenses', label: 'Expenses', href: '/dashboard/business/expenses' },
  ],
  quotations: [
    { id: 'overview', label: 'Overview', href: '/dashboard/business/quotes' },
    { id: 'quotes', label: 'Quotations', href: '/dashboard/business/quotes' },
  ],
  money: [
    { id: 'overview', label: 'Overview', href: '/dashboard/accounting' },
    { id: 'transactions', label: 'Transactions', href: '/dashboard/accounting/banking' },
    { id: 'cashflow', label: 'Cash flow', href: '/dashboard/business/cash-flow' },
    { id: 'bills', label: 'Bills', href: '/dashboard/accounting/bills' },
    { id: 'reports', label: 'Financial reports', href: '/dashboard/business/reports' },
  ],
  projects: [
    { id: 'overview', label: 'Overview', href: '/dashboard/business/projects' },
    { id: 'all', label: 'All projects', href: '/dashboard/business/projects/manage' },
    { id: 'tasks', label: 'Tasks', href: '/dashboard/tasks' },
  ],
  tasks: [
    { id: 'my', label: 'My tasks', href: '/dashboard/tasks' },
    { id: 'team', label: 'Team tasks', href: '/dashboard/tasks?scope=team' },
  ],
  calendar: [
    { id: 'calendar', label: 'Calendar', href: '/dashboard/business/calendar' },
    { id: 'meetings', label: 'Meetings', href: '/dashboard/business/meetings' },
    { id: 'booking', label: 'Scheduling', href: '/dashboard/business/booking' },
  ],
  documents: [
    { id: 'all', label: 'All documents', href: '/dashboard/business/documents' },
    { id: 'vault', label: 'Vault', href: '/dashboard/business/vault' },
    { id: 'contracts', label: 'Contracts', href: '/dashboard/business/contracts' },
  ],
  marketing: [
    { id: 'overview', label: 'Overview', href: '/dashboard/marketing' },
    { id: 'campaigns', label: 'Campaigns', href: '/dashboard/business/campaigns' },
    { id: 'outreach', label: 'Outreach', href: '/dashboard/marketing/outreach' },
    { id: 'social', label: 'Social', href: '/dashboard/business/social-command' },
    { id: 'audience', label: 'Audience', href: '/dashboard/crm/unified-contacts' },
    { id: 'results', label: 'Results', href: '/dashboard/marketing/deliverability' },
    { id: 'delivery', label: 'Delivery', href: '/dashboard/marketing/delivery' },
  ],
  social: [
    { id: 'overview', label: 'Overview', href: '/dashboard/business/social' },
    { id: 'compose', label: 'Composer', href: '/dashboard/social/compose' },
    { id: 'command', label: 'Command', href: '/dashboard/business/social-command' },
  ],
  reports: [
    { id: 'overview', label: 'Overview', href: '/dashboard/business/reports' },
    { id: 'analytics', label: 'Analytics', href: '/dashboard/analytics' },
    { id: 'executive', label: 'Executive', href: '/dashboard/executive' },
    { id: 'performance', label: 'Productivity', href: '/dashboard/performance' },
  ],
  goals: [
    { id: 'company', label: 'Company goals', href: '/dashboard/goals' },
    { id: 'planning', label: 'Planning', href: '/dashboard/planning' },
  ],
  nexus: [
    { id: 'overview', label: 'Overview', href: '/dashboard/automations' },
    { id: 'workflows', label: 'Workflows', href: '/dashboard/business/workflows' },
    { id: 'connections', label: 'Connections', href: '/dashboard/marketplace' },
  ],
  bonnie: [
    { id: 'assistant', label: 'Assistant', href: '/dashboard/business/bonnie' },
    { id: 'approvals', label: 'Approvals', href: '/dashboard/business/bonnie/approvals' },
  ],
  settings: [
    { id: 'overview', label: 'Overview', href: '/dashboard/business/settings' },
    { id: 'help', label: 'Help', href: '/dashboard/help' },
  ],
};

export function getModuleSubnav(moduleId: ModuleId): SubNavItem[] {
  return MODULE_SUBNAV[moduleId] ?? [];
}
