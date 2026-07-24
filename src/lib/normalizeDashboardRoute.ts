/** Normalize dashboard paths so module routing works with query strings and role aliases. */

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
    if (role !== 'tenant_admin' && role !== 'business_dashboard') return base;

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
    };

    return tenantAliases[base] ?? base;
}
