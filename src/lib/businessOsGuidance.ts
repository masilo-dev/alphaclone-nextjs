const TASK_HINT_MINDSET = 'Choose one clear next step before you leave this screen.';
const TASK_HINT_OUTCOME = 'Update dates, value, or owners so others can act without guessing.';

export type BusinessOsGuidance = {
    variant: 'full' | 'compact';
    mindset: string;
    outcome: string;
    actions: { label: string; tab: string }[];
};

const CRM_PATHS = new Set([
    '/dashboard/crm',
    '/dashboard/leads',
    '/dashboard/deals',
    '/dashboard/contacts',
    '/dashboard/business/clients',
]);

const DEFAULT: BusinessOsGuidance = {
    variant: 'full',
    mindset: TASK_HINT_MINDSET,
    outcome: TASK_HINT_OUTCOME,
    actions: [
        { label: 'Workspace home', tab: '/dashboard' },
        { label: 'Tasks', tab: '/dashboard/tasks' },
        { label: 'Deals', tab: '/dashboard/deals' },
    ],
};

export function getBusinessOsGuidance(activeTab: string): BusinessOsGuidance {
    if (CRM_PATHS.has(activeTab)) {
        return {
            variant: 'compact',
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Contacts', tab: '/dashboard/contacts' },
                { label: 'Leads', tab: '/dashboard/leads' },
                { label: 'Deals', tab: '/dashboard/deals' },
                { label: 'Billing', tab: '/dashboard/business/billing' },
            ],
        };
    }

    const map: Record<string, Omit<BusinessOsGuidance, 'variant'> & { variant?: 'full' | 'compact' }> = {
        '/dashboard': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Tasks', tab: '/dashboard/tasks' },
                { label: 'Deals', tab: '/dashboard/deals' },
                { label: 'Billing', tab: '/dashboard/business/billing' },
            ],
        },
        '/dashboard/business/projects': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Tasks', tab: '/dashboard/tasks' },
                { label: 'Contracts', tab: '/dashboard/business/contracts' },
                { label: 'Billing', tab: '/dashboard/business/billing' },
            ],
        },
        '/dashboard/business/team': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Settings', tab: '/dashboard/business/settings' },
                { label: 'Projects', tab: '/dashboard/business/projects' },
                { label: 'Messages', tab: '/dashboard/business/messages' },
            ],
        },
        '/dashboard/business/messages': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Calendar', tab: '/dashboard/business/calendar' },
                { label: 'Tasks', tab: '/dashboard/tasks' },
                { label: 'Contacts', tab: '/dashboard/contacts' },
            ],
        },
        '/dashboard/business/calendar': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Booking', tab: '/dashboard/business/booking' },
                { label: 'Tasks', tab: '/dashboard/tasks' },
                { label: 'Deals', tab: '/dashboard/deals' },
            ],
        },
        '/dashboard/business/booking': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Calendar', tab: '/dashboard/business/calendar' },
                { label: 'Contacts', tab: '/dashboard/contacts' },
                { label: 'Deals', tab: '/dashboard/deals' },
            ],
        },
        '/dashboard/business/billing': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Accounting', tab: '/dashboard/accounting' },
                { label: 'Finance', tab: '/dashboard/finance' },
                { label: 'Quotes', tab: '/dashboard/business/quotes' },
            ],
        },
        '/dashboard/business/reports': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Deals', tab: '/dashboard/deals' },
                { label: 'Expenses', tab: '/dashboard/business/expenses' },
                { label: 'Campaigns', tab: '/dashboard/business/campaigns' },
            ],
        },
        '/dashboard/business/settings': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Billing', tab: '/dashboard/business/billing' },
                { label: 'Team', tab: '/dashboard/business/team' },
            ],
        },
        '/dashboard/business/meetings': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Calendar', tab: '/dashboard/business/calendar' },
                { label: 'Tasks', tab: '/dashboard/tasks' },
            ],
        },
        '/dashboard/tasks': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Calendar', tab: '/dashboard/business/calendar' },
                { label: 'Deals', tab: '/dashboard/deals' },
                { label: 'Projects', tab: '/dashboard/business/projects' },
            ],
        },
        '/dashboard/sales-agent': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Leads', tab: '/dashboard/leads' },
                { label: 'Contacts', tab: '/dashboard/contacts' },
                { label: 'Deals', tab: '/dashboard/deals' },
            ],
        },
        '/dashboard/business/contracts': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Documents', tab: '/dashboard/business/documents' },
                { label: 'Billing', tab: '/dashboard/business/billing' },
                { label: 'Projects', tab: '/dashboard/business/projects' },
            ],
        },
        '/dashboard/business/quotes': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Deals', tab: '/dashboard/deals' },
                { label: 'Contracts', tab: '/dashboard/business/contracts' },
                { label: 'Billing', tab: '/dashboard/business/billing' },
            ],
        },
        '/dashboard/business/tasks': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Calendar', tab: '/dashboard/business/calendar' },
                { label: 'Tasks', tab: '/dashboard/tasks' },
            ],
        },
        '/dashboard/business/quotas': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Settings', tab: '/dashboard/business/settings' },
                { label: 'Campaigns', tab: '/dashboard/business/campaigns' },
            ],
        },
        '/dashboard/business/documents': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Contracts', tab: '/dashboard/business/contracts' },
                { label: 'Contacts', tab: '/dashboard/contacts' },
            ],
        },
        '/dashboard/business/pages': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Contact submissions', tab: '/dashboard/business/contact-submissions' },
                { label: 'Contacts', tab: '/dashboard/contacts' },
            ],
        },
        '/dashboard/business/contact-submissions': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Contacts', tab: '/dashboard/contacts' },
                { label: 'Deals', tab: '/dashboard/deals' },
                { label: 'Messages', tab: '/dashboard/business/messages' },
            ],
        },
        '/dashboard/marketplace': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Settings', tab: '/dashboard/business/settings' },
                { label: 'Dashboard', tab: '/dashboard' },
            ],
        },
        '/dashboard/business/facebook': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Campaigns', tab: '/dashboard/business/campaigns' },
                { label: 'Deals', tab: '/dashboard/deals' },
                { label: 'Reports', tab: '/dashboard/business/reports' },
            ],
        },
        '/dashboard/business/expenses': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Accounting', tab: '/dashboard/accounting' },
                { label: 'Reports', tab: '/dashboard/business/reports' },
                { label: 'Billing', tab: '/dashboard/business/billing' },
            ],
        },
        '/dashboard/automations': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Tasks', tab: '/dashboard/tasks' },
                { label: 'Ingestion', tab: '/dashboard/business/ingestion' },
            ],
        },
        '/dashboard/business/workflows': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Tasks', tab: '/dashboard/tasks' },
                { label: 'Ingestion', tab: '/dashboard/business/ingestion' },
            ],
        },
        '/dashboard/business/sms': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Campaigns', tab: '/dashboard/business/campaigns' },
                { label: 'Contacts', tab: '/dashboard/contacts' },
                { label: 'Deals', tab: '/dashboard/deals' },
            ],
        },
        '/dashboard/business/social': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Pages', tab: '/dashboard/business/pages' },
                { label: 'Contact submissions', tab: '/dashboard/business/contact-submissions' },
            ],
        },
        '/dashboard/business/ingestion': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Leads', tab: '/dashboard/leads' },
                { label: 'Contacts', tab: '/dashboard/contacts' },
                { label: 'Workflows', tab: '/dashboard/business/workflows' },
            ],
        },
        '/dashboard/business/daily-summary': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Tasks', tab: '/dashboard/tasks' },
                { label: 'Dashboard', tab: '/dashboard' },
            ],
        },
        '/dashboard/mail': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Tasks', tab: '/dashboard/tasks' },
                { label: 'Deals', tab: '/dashboard/deals' },
                { label: 'Calendar', tab: '/dashboard/business/calendar' },
            ],
        },
        '/dashboard/gmail': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Tasks', tab: '/dashboard/tasks' },
                { label: 'Deals', tab: '/dashboard/deals' },
                { label: 'Calendar', tab: '/dashboard/business/calendar' },
            ],
        },
        '/dashboard/zoho/mail': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Tasks', tab: '/dashboard/tasks' },
                { label: 'Zoho CRM', tab: '/dashboard/zoho/crm' },
            ],
        },
        '/dashboard/zoho/crm': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'CRM overview', tab: '/dashboard/crm' },
                { label: 'Deals', tab: '/dashboard/deals' },
                { label: 'Settings', tab: '/dashboard/business/settings' },
            ],
        },
        '/dashboard/accounting': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Billing', tab: '/dashboard/business/billing' },
                { label: 'Expenses', tab: '/dashboard/business/expenses' },
                { label: 'Finance', tab: '/dashboard/finance' },
            ],
        },
        '/dashboard/finance': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Billing', tab: '/dashboard/business/billing' },
                { label: 'Accounting', tab: '/dashboard/accounting' },
            ],
        },
        '/dashboard/business/campaigns': {
            mindset: TASK_HINT_MINDSET,
            outcome: TASK_HINT_OUTCOME,
            actions: [
                { label: 'Deals', tab: '/dashboard/deals' },
                { label: 'Reports', tab: '/dashboard/business/reports' },
                { label: 'Contact submissions', tab: '/dashboard/business/contact-submissions' },
            ],
        },
    };

    const row = map[activeTab];
    if (!row) {
        return { ...DEFAULT, variant: 'full' };
    }
    return {
        variant: row.variant ?? 'full',
        mindset: row.mindset,
        outcome: row.outcome,
        actions: row.actions,
    };
}
