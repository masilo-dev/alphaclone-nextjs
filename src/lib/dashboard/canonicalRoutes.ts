/**
 * Canonical dashboard route registry.
 * Aliases must resolve to exactly one canonical path.
 */

export type CanonicalRouteDefinition = {
  path: string;
  title: string;
  description?: string;
  section: string;
  roles: Array<'admin' | 'tenant_admin' | 'client' | 'staff' | '*'>;
  permissions: string[];
  aliases?: string[];
  mobileSupported: boolean;
  breadcrumb: string[];
  featureFlag?: string;
  canonicalComponent?: string;
};

export const CANONICAL_ROUTES: CanonicalRouteDefinition[] = [
  {
    path: '/dashboard',
    title: 'Home',
    description: 'Attention-first workspace home',
    section: 'home',
    roles: ['*'],
    permissions: [],
    aliases: ['/dashboard/business'],
    mobileSupported: true,
    breadcrumb: ['Home'],
    canonicalComponent: 'AttentionFirstDashboard',
  },
  {
    path: '/dashboard/operations',
    title: 'Operations Command',
    section: 'operations',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: [],
    aliases: [
      '/dashboard/operations-command',
      '/dashboard/business/operations',
      '/dashboard/admin/operations',
    ],
    mobileSupported: true,
    breadcrumb: ['Operations Command'],
    canonicalComponent: 'OperationsCommandCenter',
  },
  {
    path: '/dashboard/crm',
    title: 'Sales overview',
    section: 'sales',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: ['crm:read'],
    mobileSupported: true,
    breadcrumb: ['Sales', 'Overview'],
  },
  {
    path: '/dashboard/leads',
    title: 'Leads',
    section: 'sales',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: ['crm:read'],
    aliases: ['/dashboard/crm/leads'],
    mobileSupported: true,
    breadcrumb: ['Sales', 'Leads'],
  },
  {
    path: '/dashboard/crm/unified-contacts',
    title: 'Contacts',
    section: 'sales',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: ['crm:read'],
    aliases: [
      '/dashboard/contacts',
      '/dashboard/clients',
      '/dashboard/business/clients',
      '/dashboard/prospects',
    ],
    mobileSupported: true,
    breadcrumb: ['Sales', 'Contacts'],
  },
  {
    path: '/dashboard/crm/accounts',
    title: 'Companies',
    section: 'sales',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: ['crm:read'],
    mobileSupported: true,
    breadcrumb: ['Sales', 'Companies'],
  },
  {
    path: '/dashboard/deals',
    title: 'Deals',
    section: 'sales',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: ['crm:read'],
    aliases: ['/dashboard/crm/deals'],
    mobileSupported: true,
    breadcrumb: ['Sales', 'Deals'],
  },
  {
    path: '/dashboard/crm/workspace',
    title: 'CRM workspace',
    section: 'sales',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: ['crm:read'],
    aliases: ['/dashboard/workspace'],
    mobileSupported: true,
    breadcrumb: ['Sales', 'Workspace'],
  },
  {
    path: '/dashboard/crm/follow-ups',
    title: 'Activities',
    section: 'sales',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: ['crm:read'],
    aliases: ['/dashboard/crm/activities', '/dashboard/crm/activity'],
    mobileSupported: true,
    breadcrumb: ['Sales', 'Activities'],
  },
  {
    path: '/dashboard/leads/finder',
    title: 'Lead Finder',
    section: 'sales',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: ['crm:read'],
    aliases: ['/dashboard/leads/campaigns', '/dashboard/scraper-leads', '/dashboard/sales-agent'],
    mobileSupported: true,
    breadcrumb: ['Sales', 'Lead Finder'],
  },
  {
    path: '/dashboard/business/quotes',
    title: 'Quotes',
    section: 'sales',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: ['crm:read'],
    aliases: ['/dashboard/quotes', '/dashboard/proposals', '/dashboard/business/proposals'],
    mobileSupported: true,
    breadcrumb: ['Sales', 'Quotes'],
  },
  {
    path: '/dashboard/business/billing/manage',
    title: 'Invoices',
    description: 'Canonical invoice management',
    section: 'money',
    roles: ['admin', 'tenant_admin', 'staff', 'client'],
    permissions: ['billing:read'],
    aliases: [
      '/dashboard/finance/manage',
      '/dashboard/business/invoices',
      '/dashboard/billing/manage',
      '/dashboard/invoices',
    ],
    mobileSupported: true,
    breadcrumb: ['Money', 'Invoices'],
    canonicalComponent: 'EnhancedBillingPage',
  },
  {
    path: '/dashboard/business/expenses',
    title: 'Expenses',
    section: 'money',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: ['billing:read'],
    aliases: ['/dashboard/finance/expenses'],
    mobileSupported: true,
    breadcrumb: ['Money', 'Expenses'],
    canonicalComponent: 'ExpenseTrackerTab',
  },
  {
    path: '/dashboard/business/billing',
    title: 'Money overview',
    section: 'money',
    roles: ['admin', 'tenant_admin', 'staff', 'client'],
    permissions: ['billing:read'],
    aliases: ['/dashboard/finance', '/dashboard/billing'],
    mobileSupported: true,
    breadcrumb: ['Money', 'Overview'],
  },
  {
    path: '/dashboard/accounting',
    title: 'Accounting',
    section: 'money',
    roles: ['admin', 'tenant_admin'],
    permissions: ['accounting:read'],
    aliases: ['/dashboard/business/accounting'],
    mobileSupported: false,
    breadcrumb: ['Money', 'Accounting'],
  },
  {
    path: '/dashboard/business/cash-flow',
    title: 'Cash flow',
    section: 'money',
    roles: ['admin', 'tenant_admin'],
    permissions: ['billing:read'],
    aliases: ['/dashboard/cash-flow', '/dashboard/cashflow', '/dashboard/finance/cash-flow'],
    mobileSupported: true,
    breadcrumb: ['Money', 'Cash flow'],
  },
  {
    path: '/dashboard/comms',
    title: 'Communication',
    section: 'communication',
    roles: ['*'],
    permissions: [],
    aliases: ['/dashboard/mail', '/dashboard/business/unified-inbox'],
    mobileSupported: true,
    breadcrumb: ['Communication'],
  },
  {
    path: '/dashboard/business/messages',
    title: 'Team messages',
    section: 'communication',
    roles: ['*'],
    permissions: [],
    aliases: ['/dashboard/messages'],
    mobileSupported: true,
    breadcrumb: ['Communication', 'Team messages'],
  },
  {
    path: '/dashboard/business/bonnie',
    title: 'Bonnie',
    section: 'bonnie',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: [],
    aliases: ['/dashboard/bonnie'],
    mobileSupported: true,
    breadcrumb: ['Bonnie'],
  },
  {
    path: '/dashboard/bonnie/approvals',
    title: 'Approvals',
    section: 'bonnie',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: [],
    aliases: ['/dashboard/business/bonnie/approvals'],
    mobileSupported: true,
    breadcrumb: ['Bonnie', 'Approvals'],
  },
  {
    path: '/dashboard/bonnie/chases',
    title: 'Chase inbox',
    section: 'bonnie',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: [],
    aliases: ['/dashboard/business/bonnie/chases'],
    mobileSupported: true,
    breadcrumb: ['Bonnie', 'Chase inbox'],
    canonicalComponent: 'ChaseExecutionInbox',
  },
  {
    path: '/dashboard/business/calendar',
    title: 'Calendar',
    section: 'schedule',
    roles: ['*'],
    permissions: [],
    aliases: ['/dashboard/calendar'],
    mobileSupported: true,
    breadcrumb: ['Schedule', 'Calendar'],
  },
  {
    path: '/dashboard/business/booking',
    title: 'Booking links',
    section: 'schedule',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: [],
    mobileSupported: true,
    breadcrumb: ['Schedule', 'Booking'],
  },
  {
    path: '/dashboard/business/projects',
    title: 'Projects',
    section: 'work',
    roles: ['*'],
    permissions: [],
    aliases: ['/dashboard/projects'],
    mobileSupported: true,
    breadcrumb: ['Work', 'Projects'],
  },
  {
    path: '/dashboard/business/projects/manage',
    title: 'All projects',
    section: 'work',
    roles: ['*'],
    permissions: [],
    aliases: ['/dashboard/projects/manage'],
    mobileSupported: true,
    breadcrumb: ['Work', 'Projects', 'Manage'],
  },
  {
    path: '/dashboard/tasks',
    title: 'Tasks',
    section: 'work',
    roles: ['*'],
    permissions: [],
    aliases: ['/dashboard/business/tasks'],
    mobileSupported: true,
    breadcrumb: ['Work', 'Tasks'],
  },
  {
    path: '/dashboard/business/documents',
    title: 'Documents',
    section: 'files',
    roles: ['*'],
    permissions: [],
    aliases: ['/dashboard/submit'],
    mobileSupported: true,
    breadcrumb: ['Files', 'Documents'],
  },
  {
    path: '/dashboard/business/contracts',
    title: 'Contracts',
    section: 'files',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: [],
    aliases: ['/dashboard/contracts'],
    mobileSupported: true,
    breadcrumb: ['Files', 'Contracts'],
  },
  {
    path: '/dashboard/business/contracts/manage',
    title: 'Contract details',
    section: 'files',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: [],
    aliases: ['/dashboard/contracts/manage'],
    mobileSupported: true,
    breadcrumb: ['Files', 'Contracts', 'Manage'],
  },
  {
    path: '/dashboard/business/vault',
    title: 'Vault',
    section: 'files',
    roles: ['admin', 'tenant_admin'],
    permissions: [],
    aliases: ['/dashboard/vault', '/dashboard/client-vault'],
    mobileSupported: true,
    breadcrumb: ['Files', 'Vault'],
  },
  {
    path: '/dashboard/business/onboarding',
    title: 'Onboarding',
    section: 'files',
    roles: ['admin', 'tenant_admin'],
    permissions: [],
    aliases: ['/dashboard/onboarding'],
    mobileSupported: true,
    breadcrumb: ['Files', 'Onboarding'],
  },
  {
    path: '/dashboard/business/campaigns',
    title: 'Campaigns',
    section: 'marketing',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: [],
    aliases: ['/dashboard/campaigns', '/dashboard/email-campaigns', '/dashboard/marketing/campaigns'],
    mobileSupported: true,
    breadcrumb: ['Marketing', 'Campaigns'],
  },
  {
    path: '/dashboard/business/social',
    title: 'Social',
    section: 'marketing',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: [],
    aliases: ['/dashboard/social', '/dashboard/growth/social'],
    mobileSupported: true,
    breadcrumb: ['Marketing', 'Social'],
  },
  {
    path: '/dashboard/business/social/compose',
    title: 'Compose post',
    section: 'marketing',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: [],
    aliases: ['/dashboard/social/compose', '/dashboard/growth/social/compose'],
    mobileSupported: true,
    breadcrumb: ['Marketing', 'Compose post'],
  },
  {
    path: '/dashboard/business/social-command',
    title: 'Social calendar',
    section: 'marketing',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: [],
    aliases: ['/dashboard/social-command', '/dashboard/social-calendar', '/dashboard/business/social-calendar'],
    mobileSupported: true,
    breadcrumb: ['Marketing', 'Social calendar'],
  },
  {
    path: '/dashboard/business/facebook',
    title: 'Facebook',
    section: 'marketing',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: [],
    aliases: ['/dashboard/facebook', '/dashboard/marketing/facebook', '/dashboard/social/facebook'],
    mobileSupported: true,
    breadcrumb: ['Marketing', 'Facebook'],
  },
  {
    path: '/dashboard/business/linkedin',
    title: 'LinkedIn',
    section: 'marketing',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: [],
    aliases: ['/dashboard/linkedin', '/dashboard/marketing/linkedin', '/dashboard/social/linkedin'],
    mobileSupported: true,
    breadcrumb: ['Marketing', 'LinkedIn'],
  },
  {
    path: '/dashboard/business/instagram',
    title: 'Instagram',
    section: 'marketing',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: [],
    aliases: [
      '/dashboard/instagram',
      '/dashboard/marketing/instagram',
      '/dashboard/social/instagram',
      '/dashboard/business/social/instagram',
      '/dashboard/business/integrations/instagram',
      '/dashboard/integrations/instagram',
    ],
    mobileSupported: true,
    breadcrumb: ['Marketing', 'Instagram'],
  },
  {
    path: '/dashboard/business/x',
    title: 'X',
    section: 'marketing',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: [],
    aliases: ['/dashboard/x', '/dashboard/twitter', '/dashboard/marketing/x', '/dashboard/social/x', '/dashboard/business/twitter'],
    mobileSupported: true,
    breadcrumb: ['Marketing', 'X'],
  },
  {
    path: '/dashboard/business/forms',
    title: 'Forms',
    section: 'marketing',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: [],
    aliases: ['/dashboard/forms', '/dashboard/marketing/forms'],
    mobileSupported: true,
    breadcrumb: ['Marketing', 'Forms'],
  },
  {
    path: '/dashboard/business/sms',
    title: 'SMS',
    section: 'marketing',
    roles: ['admin', 'tenant_admin', 'staff'],
    permissions: [],
    aliases: ['/dashboard/sms', '/dashboard/marketing/sms'],
    mobileSupported: true,
    breadcrumb: ['Marketing', 'SMS'],
  },
  {
    path: '/dashboard/business/tickets',
    title: 'Tickets',
    section: 'communication',
    roles: ['*'],
    permissions: [],
    aliases: ['/dashboard/tickets'],
    mobileSupported: true,
    breadcrumb: ['Communication', 'Tickets'],
  },
  {
    path: '/dashboard/business/whatsapp',
    title: 'WhatsApp',
    section: 'communication',
    roles: ['*'],
    permissions: [],
    aliases: ['/dashboard/whatsapp'],
    mobileSupported: true,
    breadcrumb: ['Communication', 'WhatsApp'],
  },
  {
    path: '/dashboard/business/tax-estimator',
    title: 'Tax estimator',
    section: 'money',
    roles: ['admin', 'tenant_admin'],
    permissions: [],
    aliases: ['/dashboard/tax-estimator'],
    mobileSupported: true,
    breadcrumb: ['Money', 'Tax estimator'],
  },
  {
    path: '/dashboard/business/workflows',
    title: 'Workflows',
    section: 'settings',
    roles: ['admin', 'tenant_admin'],
    permissions: [],
    aliases: ['/dashboard/automations'],
    mobileSupported: true,
    breadcrumb: ['Settings', 'Workflows'],
  },
  {
    path: '/dashboard/business/settings',
    title: 'Settings',
    section: 'settings',
    roles: ['*'],
    permissions: [],
    aliases: ['/dashboard/settings'],
    mobileSupported: true,
    breadcrumb: ['Settings'],
  },
  {
    path: '/dashboard/marketplace',
    title: 'Integrations',
    section: 'settings',
    roles: ['admin', 'tenant_admin'],
    permissions: [],
    aliases: ['/dashboard/addons'],
    mobileSupported: true,
    breadcrumb: ['Settings', 'Integrations'],
  },
  {
    path: '/dashboard/analytics',
    title: 'Analytics',
    section: 'insights',
    roles: ['admin', 'tenant_admin'],
    permissions: [],
    mobileSupported: true,
    breadcrumb: ['Work', 'Analytics'],
    canonicalComponent: 'AnalyticsTab',
  },
  {
    path: '/dashboard/executive',
    title: 'Executive view',
    section: 'insights',
    roles: ['admin', 'tenant_admin'],
    permissions: [],
    mobileSupported: true,
    breadcrumb: ['Work', 'Executive'],
  },
];

/** Map alias → canonical path */
export function buildAliasMap(
  routes: CanonicalRouteDefinition[] = CANONICAL_ROUTES
): Map<string, string> {
  const map = new Map<string, string>();
  for (const route of routes) {
    map.set(route.path, route.path);
    for (const alias of route.aliases || []) {
      map.set(alias, route.path);
    }
  }
  return map;
}

export const ROUTE_ALIAS_MAP = buildAliasMap();

export function resolveCanonicalPath(path: string): string {
  const bare = path.split('?')[0]?.split('#')[0] || path;
  return ROUTE_ALIAS_MAP.get(bare) || bare;
}

export function getCanonicalRoute(path: string): CanonicalRouteDefinition | undefined {
  const canonical = resolveCanonicalPath(path);
  return CANONICAL_ROUTES.find((r) => r.path === canonical);
}

/** Detect duplicate canonical ownership of the same alias. */
export function findDuplicateAliases(
  routes: CanonicalRouteDefinition[] = CANONICAL_ROUTES
): string[] {
  const seen = new Map<string, string>();
  const dupes: string[] = [];
  for (const route of routes) {
    const paths = [route.path, ...(route.aliases || [])];
    for (const p of paths) {
      const existing = seen.get(p);
      if (existing && existing !== route.path) {
        dupes.push(`${p} claimed by ${existing} and ${route.path}`);
      } else {
        seen.set(p, route.path);
      }
    }
  }
  return dupes;
}
