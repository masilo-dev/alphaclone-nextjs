/** Normalize dashboard paths so module routing works with query strings and role aliases. */

import { resolveCanonicalPath } from '@/lib/dashboard/canonicalRoutes';

export function stripRouteQueryAndHash(path: string): string {
    if (!path) return '/dashboard';
    const withoutQuery = path.split('?')[0]?.split('#')[0] || path;
    if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) {
        return withoutQuery.slice(0, -1);
    }
    return withoutQuery || '/dashboard';
}

/** Map legacy/shared paths to tenant-admin business routes when needed. */
export function normalizeBusinessRoute(path: string, role?: string): string {
    const base = stripRouteQueryAndHash(path);
    if (role !== 'tenant_admin' && role !== 'business_dashboard') {
        return resolveCanonicalPath(base);
    }

    const tenantAliases: Record<string, string> = {
        // bare /dashboard/business resolves to home
        '/dashboard/business': '/dashboard',
        '/dashboard/messages': '/dashboard/business/messages',
        '/dashboard/settings': '/dashboard/business/settings',
        '/dashboard/contracts': '/dashboard/business/contracts',
        '/dashboard/finance': '/dashboard/business/billing',
        '/dashboard/projects': '/dashboard/business/projects',
        '/dashboard/quotes': '/dashboard/business/quotes',
        '/dashboard/tickets': '/dashboard/business/tickets',
        '/dashboard/billing': '/dashboard/business/billing',
        '/dashboard/bonnie': '/dashboard/business/bonnie',
        '/dashboard/security': '/dashboard/business/settings',
        '/dashboard/projects/manage': '/dashboard/business/projects/manage',
        '/dashboard/contracts/manage': '/dashboard/business/contracts/manage',
        '/dashboard/leads/campaigns': '/dashboard/leads/finder',
        '/dashboard/crm/activities': '/dashboard/crm/follow-ups',
        '/dashboard/crm/activity': '/dashboard/crm/follow-ups',
        '/dashboard/crm/leads': '/dashboard/leads',
        '/dashboard/clients': '/dashboard/crm/unified-contacts',
        '/dashboard/invoices': '/dashboard/business/invoices',
        '/dashboard/operations-command': '/dashboard/operations',
        '/dashboard/marketing/campaigns': '/dashboard/business/campaigns',
        '/dashboard/campaigns': '/dashboard/business/campaigns',
        '/dashboard/crm/contacts': '/dashboard/crm/unified-contacts',
        '/dashboard/crm/companies': '/dashboard/crm/accounts',
        '/dashboard/crm/deals': '/dashboard/deals',
        '/dashboard/growth/social': '/dashboard/business/social',
        '/dashboard/growth/social/compose': '/dashboard/business/social/compose',
        '/dashboard/business/tasks': '/dashboard/tasks',
        '/dashboard/instagram': '/dashboard/business/instagram',
        '/dashboard/marketing/instagram': '/dashboard/business/instagram',
        '/dashboard/business/social/instagram': '/dashboard/business/instagram',
        '/dashboard/business/integrations/instagram': '/dashboard/business/instagram',
        '/dashboard/integrations/instagram': '/dashboard/business/instagram',
    };

    const aliased = tenantAliases[base] ?? base;
    return resolveCanonicalPath(aliased);
}
