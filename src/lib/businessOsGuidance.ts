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
    mindset:
        'Think in operations, not storage: intake, process, deliver, collect. Records exist to produce cash or capacity.',
    outcome: 'Before you leave this screen, decide the single next step that moves money, delivery, or a decision.',
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
            mindset:
                'Demand to cash: pipeline records should advance toward a signed outcome or a clean exit—not endless filing.',
            outcome:
                'Pair every opportunity with value, stage, and dates. When this is quiet, move to billing or delivery.',
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
            mindset:
                'Operating rhythm beats busywork: be explicit about what you are producing this week—revenue, delivery, or collection.',
            outcome: 'Open the area that moves that outcome one concrete step; defer everything else.',
            actions: [
                { label: 'Tasks', tab: '/dashboard/tasks' },
                { label: 'Deals', tab: '/dashboard/deals' },
                { label: 'Billing', tab: '/dashboard/business/billing' },
            ],
        },
        '/dashboard/business/projects': {
            mindset:
                'Projects are how you ship: scope, dates, and owners turn plans into invoices and renewals.',
            outcome: 'Each active project needs a visible next milestone and a responsible person.',
            actions: [
                { label: 'Tasks', tab: '/dashboard/tasks' },
                { label: 'Contracts', tab: '/dashboard/business/contracts' },
                { label: 'Billing', tab: '/dashboard/business/billing' },
            ],
        },
        '/dashboard/business/team': {
            mindset:
                'Team capacity is inventory; clear roles and access are your distribution network.',
            outcome: 'Remove ambiguity on who can commit spend, talk to clients, or change billing.',
            actions: [
                { label: 'Settings', tab: '/dashboard/business/settings' },
                { label: 'Projects', tab: '/dashboard/business/projects' },
                { label: 'Messages', tab: '/dashboard/business/messages' },
            ],
        },
        '/dashboard/business/messages': {
            mindset:
                'Messages should close a loop or schedule a decision—otherwise they become dead stock.',
            outcome: 'Reply with a proposed next step, owner, and date.',
            actions: [
                { label: 'Calendar', tab: '/dashboard/business/calendar' },
                { label: 'Tasks', tab: '/dashboard/tasks' },
                { label: 'Contacts', tab: '/dashboard/contacts' },
            ],
        },
        '/dashboard/business/calendar': {
            mindset:
                'Time that is blocked but not tied to revenue or delivery is cost without output.',
            outcome: 'Link meetings to deals or projects so follow-up lives in the OS, not memory.',
            actions: [
                { label: 'Booking', tab: '/dashboard/business/booking' },
                { label: 'Tasks', tab: '/dashboard/tasks' },
                { label: 'Deals', tab: '/dashboard/deals' },
            ],
        },
        '/dashboard/business/booking': {
            mindset:
                'Scheduling is the handshake between demand and your capacity.',
            outcome: 'Reduce steps from interest to a live conversation; capture outcomes in CRM or tasks.',
            actions: [
                { label: 'Calendar', tab: '/dashboard/business/calendar' },
                { label: 'Contacts', tab: '/dashboard/contacts' },
                { label: 'Deals', tab: '/dashboard/deals' },
            ],
        },
        '/dashboard/business/billing': {
            mindset:
                'Billing is how finished work becomes cash—treat it as part of delivery, not paperwork.',
            outcome: 'Issue, follow up, and record payment against what was actually delivered.',
            actions: [
                { label: 'Accounting', tab: '/dashboard/accounting' },
                { label: 'Finance', tab: '/dashboard/finance' },
                { label: 'Quotes', tab: '/dashboard/business/quotes' },
            ],
        },
        '/dashboard/business/reports': {
            mindset:
                'Analytics only pay off when they change what you do tomorrow.',
            outcome: 'Take one chart into an action on deals, campaigns, or expenses within this session.',
            actions: [
                { label: 'Deals', tab: '/dashboard/deals' },
                { label: 'Expenses', tab: '/dashboard/business/expenses' },
                { label: 'Campaigns', tab: '/dashboard/business/campaigns' },
            ],
        },
        '/dashboard/business/settings': {
            mindset:
                'Configuration protects margin: billing, integrations, and access control.',
            outcome: 'Confirm payment methods, integrations, and who can bind the company.',
            actions: [
                { label: 'Billing', tab: '/dashboard/business/billing' },
                { label: 'Team', tab: '/dashboard/business/team' },
            ],
        },
        '/dashboard/business/meetings': {
            mindset:
                'Meetings should produce decisions or written next actions—not more meetings.',
            outcome: 'Log outcomes in Tasks or on the Deal before the call memory fades.',
            actions: [
                { label: 'Calendar', tab: '/dashboard/business/calendar' },
                { label: 'Tasks', tab: '/dashboard/tasks' },
            ],
        },
        '/dashboard/tasks': {
            mindset:
                'Tasks are the executable layer between strategy and revenue.',
            outcome: 'Every item needs a due date and, where possible, a link to a deal or project.',
            actions: [
                { label: 'Calendar', tab: '/dashboard/business/calendar' },
                { label: 'Deals', tab: '/dashboard/deals' },
                { label: 'Projects', tab: '/dashboard/business/projects' },
            ],
        },
        '/dashboard/sales-agent': {
            mindset:
                'Outreach fills the top of the funnel; profit still requires qualification and closure in your pipeline.',
            outcome: 'Move serious replies into Contacts and Deals with an owner and next date.',
            actions: [
                { label: 'Leads', tab: '/dashboard/leads' },
                { label: 'Contacts', tab: '/dashboard/contacts' },
                { label: 'Deals', tab: '/dashboard/deals' },
            ],
        },
        '/dashboard/business/contracts': {
            mindset:
                'Contracts lock scope and price before work erodes margin.',
            outcome: 'After signature, trigger billing or project kickoff—do not let deals sit unsigned.',
            actions: [
                { label: 'Documents', tab: '/dashboard/business/documents' },
                { label: 'Billing', tab: '/dashboard/business/billing' },
                { label: 'Projects', tab: '/dashboard/business/projects' },
            ],
        },
        '/dashboard/business/quotes': {
            mindset:
                'Proposals are the bridge between interest and signed revenue.',
            outcome: 'Every open quote needs a follow-up date and a defined customer decision.',
            actions: [
                { label: 'Deals', tab: '/dashboard/deals' },
                { label: 'Contracts', tab: '/dashboard/business/contracts' },
                { label: 'Billing', tab: '/dashboard/business/billing' },
            ],
        },
        '/dashboard/business/tasks': {
            mindset:
                'Scheduled work should show dependencies and capacity—not just dates on a list.',
            outcome: 'Align recurring work with client commitments and delivery milestones.',
            actions: [
                { label: 'Calendar', tab: '/dashboard/business/calendar' },
                { label: 'Tasks', tab: '/dashboard/tasks' },
            ],
        },
        '/dashboard/business/quotas': {
            mindset:
                'Quotas cap cost and noise; tune them against real pipeline and campaign plans.',
            outcome: 'Review limits before large sends, ingestion, or agent runs.',
            actions: [
                { label: 'Settings', tab: '/dashboard/business/settings' },
                { label: 'Campaigns', tab: '/dashboard/business/campaigns' },
            ],
        },
        '/dashboard/business/documents': {
            mindset:
                'Documents are useless if they are not retrievable at invoice, audit, or renewal.',
            outcome: 'File under client, deal, or project—not an unstructured pile.',
            actions: [
                { label: 'Contracts', tab: '/dashboard/business/contracts' },
                { label: 'Contacts', tab: '/dashboard/contacts' },
            ],
        },
        '/dashboard/business/pages': {
            mindset:
                'Public pages are distribution for your offer; they should match what sales can deliver.',
            outcome: 'Point forms to submissions and respond inside CRM the same day.',
            actions: [
                { label: 'Contact submissions', tab: '/dashboard/business/contact-submissions' },
                { label: 'Contacts', tab: '/dashboard/contacts' },
            ],
        },
        '/dashboard/business/contact-submissions': {
            mindset:
                'Inbound leads decay fast—assignment and first response beat perfect filing.',
            outcome: 'Create or link a Contact or Deal while context is fresh.',
            actions: [
                { label: 'Contacts', tab: '/dashboard/contacts' },
                { label: 'Deals', tab: '/dashboard/deals' },
                { label: 'Messages', tab: '/dashboard/business/messages' },
            ],
        },
        '/dashboard/marketplace': {
            mindset:
                'Add-ons should remove friction in a workflow you already run.',
            outcome: 'Install only what maps to a process with an owner.',
            actions: [
                { label: 'Settings', tab: '/dashboard/business/settings' },
                { label: 'Dashboard', tab: '/dashboard' },
            ],
        },
        '/dashboard/business/facebook': {
            mindset:
                'Paid and organic social feed the pipeline; ROI appears in Deals and revenue, not likes.',
            outcome: 'Trace interest from click to qualified opportunity where possible.',
            actions: [
                { label: 'Campaigns', tab: '/dashboard/business/campaigns' },
                { label: 'Deals', tab: '/dashboard/deals' },
                { label: 'Reports', tab: '/dashboard/business/reports' },
            ],
        },
        '/dashboard/business/expenses': {
            mindset:
                'Expense discipline protects net profit on every engagement.',
            outcome: 'Categorize and reconcile so project margins stay honest.',
            actions: [
                { label: 'Accounting', tab: '/dashboard/accounting' },
                { label: 'Reports', tab: '/dashboard/business/reports' },
                { label: 'Billing', tab: '/dashboard/business/billing' },
            ],
        },
        '/dashboard/automations': {
            mindset:
                'Automation replaces repetition, not judgment on exceptions.',
            outcome: 'Watch failures first; fix broken steps before increasing volume.',
            actions: [
                { label: 'Tasks', tab: '/dashboard/tasks' },
                { label: 'Ingestion', tab: '/dashboard/business/ingestion' },
            ],
        },
        '/dashboard/business/workflows': {
            mindset:
                'Automation replaces repetition, not judgment on exceptions.',
            outcome: 'Watch failures first; fix broken steps before increasing volume.',
            actions: [
                { label: 'Tasks', tab: '/dashboard/tasks' },
                { label: 'Ingestion', tab: '/dashboard/business/ingestion' },
            ],
        },
        '/dashboard/business/sms': {
            mindset:
                'SMS is for timely nudges—pair each send with a clear next action.',
            outcome: 'Hand warm replies to Deals with value and follow-up dates.',
            actions: [
                { label: 'Campaigns', tab: '/dashboard/business/campaigns' },
                { label: 'Contacts', tab: '/dashboard/contacts' },
                { label: 'Deals', tab: '/dashboard/deals' },
            ],
        },
        '/dashboard/business/social': {
            mindset:
                'Content distributes your offer into demand; measure downstream submissions and deals.',
            outcome: 'Tie posts to landing paths you can track in submissions or CRM.',
            actions: [
                { label: 'Pages', tab: '/dashboard/business/pages' },
                { label: 'Contact submissions', tab: '/dashboard/business/contact-submissions' },
            ],
        },
        '/dashboard/business/ingestion': {
            mindset:
                'Bulk intake without rules creates warehouse congestion in your CRM.',
            outcome: 'Deduplicate, qualify, and route into Leads or Contacts immediately.',
            actions: [
                { label: 'Leads', tab: '/dashboard/leads' },
                { label: 'Contacts', tab: '/dashboard/contacts' },
                { label: 'Workflows', tab: '/dashboard/business/workflows' },
            ],
        },
        '/dashboard/business/daily-summary': {
            mindset:
                'A daily brief exists to produce one prioritized move, not more noise.',
            outcome: 'Execute the top item before adding new work to the pile.',
            actions: [
                { label: 'Tasks', tab: '/dashboard/tasks' },
                { label: 'Dashboard', tab: '/dashboard' },
            ],
        },
        '/dashboard/mail': {
            mindset:
                'Inbox volume is not progress—commitments belong in Tasks or Deals.',
            outcome: 'End important threads with a dated next step recorded in this OS.',
            actions: [
                { label: 'Tasks', tab: '/dashboard/tasks' },
                { label: 'Deals', tab: '/dashboard/deals' },
                { label: 'Calendar', tab: '/dashboard/business/calendar' },
            ],
        },
        '/dashboard/gmail': {
            mindset:
                'Inbox volume is not progress—commitments belong in Tasks or Deals.',
            outcome: 'End important threads with a dated next step recorded in this OS.',
            actions: [
                { label: 'Tasks', tab: '/dashboard/tasks' },
                { label: 'Deals', tab: '/dashboard/deals' },
                { label: 'Calendar', tab: '/dashboard/business/calendar' },
            ],
        },
        '/dashboard/zoho/mail': {
            mindset:
                'Synced mail should feed execution here—not a second place to hide work.',
            outcome: 'Mirror follow-ups into Tasks or Deals so nothing lives only in email.',
            actions: [
                { label: 'Tasks', tab: '/dashboard/tasks' },
                { label: 'Zoho CRM', tab: '/dashboard/zoho/crm' },
            ],
        },
        '/dashboard/zoho/crm': {
            mindset:
                'Sync aligns systems; AlphaClone should remain where you execute and bill.',
            outcome: 'Resolve conflicts toward pipeline stages and dates you act on daily.',
            actions: [
                { label: 'CRM overview', tab: '/dashboard/crm' },
                { label: 'Deals', tab: '/dashboard/deals' },
                { label: 'Settings', tab: '/dashboard/business/settings' },
            ],
        },
        '/dashboard/accounting': {
            mindset:
                'Books tell you whether operations produced real profit, not hope.',
            outcome: 'Reconcile on a rhythm; tie revenue to closed deals and costs to projects.',
            actions: [
                { label: 'Billing', tab: '/dashboard/business/billing' },
                { label: 'Expenses', tab: '/dashboard/business/expenses' },
                { label: 'Finance', tab: '/dashboard/finance' },
            ],
        },
        '/dashboard/finance': {
            mindset:
                'Cash and obligations determine runway and pricing discipline.',
            outcome: 'Pay and collect from recorded facts; forecast from history, not optimism alone.',
            actions: [
                { label: 'Billing', tab: '/dashboard/business/billing' },
                { label: 'Accounting', tab: '/dashboard/accounting' },
            ],
        },
        '/dashboard/business/campaigns': {
            mindset:
                'Campaigns are spend and attention; profit is downstream conversion and retention.',
            outcome: 'Define success as qualified pipeline or revenue, then inspect weekly.',
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
