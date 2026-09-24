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
    if (!path) return '/dashboard';

    // Check for query param ?tab=xxx or ?tab=xxx&... on the base dashboard
    const tabMatch = path.match(/[?&]tab=([^&#]+)/i);
    const tabParam = tabMatch ? decodeURIComponent(tabMatch[1]).toLowerCase() : null;

    let base = stripRouteQueryAndHash(path);

    // If on base dashboard route but a ?tab= parameter was specified, resolve it to the dedicated destination
    if ((base === '/dashboard' || base === '/dashboard/business') && tabParam) {
        const tabParamMap: Record<string, string> = {
            contracts: '/dashboard/business/contracts',
            projects: '/dashboard/business/projects',
            finance: '/dashboard/business/billing',
            billing: '/dashboard/business/billing',
            invoices: '/dashboard/business/billing/manage',
            expenses: '/dashboard/business/expenses',
            accounting: '/dashboard/accounting',
            cashflow: '/dashboard/business/cash-flow',
            'cash-flow': '/dashboard/business/cash-flow',
            crm: '/dashboard/crm',
            leads: '/dashboard/leads',
            deals: '/dashboard/deals',
            clients: '/dashboard/crm/unified-contacts',
            contacts: '/dashboard/crm/unified-contacts',
            prospects: '/dashboard/crm/unified-contacts',
            social: '/dashboard/business/social',
            facebook: '/dashboard/business/facebook',
            linkedin: '/dashboard/business/linkedin',
            instagram: '/dashboard/business/instagram',
            x: '/dashboard/business/x',
            twitter: '/dashboard/business/x',
            mail: '/dashboard/comms',
            email: '/dashboard/comms',
            comms: '/dashboard/comms',
            tasks: '/dashboard/tasks',
            calendar: '/dashboard/business/calendar',
            meetings: '/dashboard/business/meetings',
            booking: '/dashboard/business/booking',
            documents: '/dashboard/business/documents',
            vault: '/dashboard/business/vault',
            settings: '/dashboard/business/settings',
            reports: '/dashboard/business/reports',
            analytics: '/dashboard/analytics',
            bonnie: '/dashboard/business/bonnie',
            approvals: '/dashboard/bonnie/approvals',
            chases: '/dashboard/bonnie/chases',
            marketplace: '/dashboard/marketplace',
            workflows: '/dashboard/business/workflows',
            automations: '/dashboard/business/workflows',
            tickets: '/dashboard/business/tickets',
            whatsapp: '/dashboard/business/whatsapp',
        };
        if (tabParamMap[tabParam]) {
            base = tabParamMap[tabParam];
        }
    }

    if (role !== 'tenant_admin' && role !== 'business_dashboard') {
        return resolveCanonicalPath(base);
    }

    const tenantAliases: Record<string, string> = {
        // bare /dashboard/business resolves to home
        '/dashboard/business': '/dashboard',
        '/dashboard/messages': '/dashboard/business/messages',
        '/dashboard/settings': '/dashboard/business/settings',
        '/dashboard/contracts': '/dashboard/business/contracts',
        '/dashboard/contracts/manage': '/dashboard/business/contracts/manage',
        '/dashboard/finance': '/dashboard/business/billing',
        '/dashboard/projects': '/dashboard/business/projects',
        '/dashboard/projects/manage': '/dashboard/business/projects/manage',
        '/dashboard/quotes': '/dashboard/business/quotes',
        '/dashboard/proposals': '/dashboard/business/quotes',
        '/dashboard/tickets': '/dashboard/business/tickets',
        '/dashboard/billing': '/dashboard/business/billing',
        '/dashboard/bonnie': '/dashboard/business/bonnie',
        '/dashboard/bonnie/chases': '/dashboard/business/bonnie/chases',
        '/dashboard/security': '/dashboard/business/settings',
        '/dashboard/leads/campaigns': '/dashboard/leads/finder',
        '/dashboard/crm/activities': '/dashboard/crm/follow-ups',
        '/dashboard/crm/activity': '/dashboard/crm/follow-ups',
        '/dashboard/crm/leads': '/dashboard/leads',
        '/dashboard/clients': '/dashboard/crm/unified-contacts',
        '/dashboard/prospects': '/dashboard/crm/unified-contacts',
        '/dashboard/invoices': '/dashboard/business/billing/manage',
        '/dashboard/cash-flow': '/dashboard/business/cash-flow',
        '/dashboard/cashflow': '/dashboard/business/cash-flow',
        '/dashboard/operations-command': '/dashboard/operations',
        '/dashboard/marketing/campaigns': '/dashboard/business/campaigns',
        '/dashboard/campaigns': '/dashboard/business/campaigns',
        '/dashboard/email-campaigns': '/dashboard/business/campaigns',
        '/dashboard/crm/contacts': '/dashboard/crm/unified-contacts',
        '/dashboard/crm/companies': '/dashboard/crm/accounts',
        '/dashboard/crm/deals': '/dashboard/deals',
        '/dashboard/growth/social': '/dashboard/business/social',
        '/dashboard/growth/social/compose': '/dashboard/business/social/compose',
        '/dashboard/social': '/dashboard/business/social',
        '/dashboard/social/compose': '/dashboard/business/social/compose',
        '/dashboard/social-command': '/dashboard/business/social-command',
        '/dashboard/facebook': '/dashboard/business/facebook',
        '/dashboard/linkedin': '/dashboard/business/linkedin',
        '/dashboard/business/tasks': '/dashboard/tasks',
        '/dashboard/instagram': '/dashboard/business/instagram',
        '/dashboard/marketing/instagram': '/dashboard/business/instagram',
        '/dashboard/business/social/instagram': '/dashboard/business/instagram',
        '/dashboard/business/integrations/instagram': '/dashboard/business/instagram',
        '/dashboard/integrations/instagram': '/dashboard/business/instagram',
        '/dashboard/x': '/dashboard/business/x',
        '/dashboard/twitter': '/dashboard/business/x',
        '/dashboard/forms': '/dashboard/business/forms',
        '/dashboard/sms': '/dashboard/business/sms',
        '/dashboard/whatsapp': '/dashboard/business/whatsapp',
        '/dashboard/vault': '/dashboard/business/vault',
        '/dashboard/onboarding': '/dashboard/business/onboarding',
        '/dashboard/tax-estimator': '/dashboard/business/tax-estimator',
        '/dashboard/mail': '/dashboard/comms',
        '/dashboard/business/unified-inbox': '/dashboard/comms',
    };

    const aliased = tenantAliases[base] ?? base;
    return resolveCanonicalPath(aliased);
}
