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
    mobileSupported: true,
    breadcrumb: ['Sales', 'Deals'],
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
    mobileSupported: false,
    breadcrumb: ['Money', 'Accounting'],
  },
  {
    path: '/dashboard/business/cash-flow',
    title: 'Cash flow',
    section: 'money',
    roles: ['admin', 'tenant_admin'],
    permissions: ['billing:read'],
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
