/**
 * Canonical revenue lifecycle — single sequence the platform enforces in guidance.
 * Find → Qualify → Conduct → Proposal → Contract → Invoice → Project → Deliver
 */

import type { CrmNextStepItem } from './crmNextSteps';

export const REVENUE_LIFECYCLE_STEPS = [
    'discovered',
    'qualified',
    'engaged',
    'proposal_sent',
    'proposal_accepted',
    'contract_sent',
    'contract_signed',
    'invoice_sent',
    'invoice_paid',
    'project_active',
] as const;

export type RevenueLifecycleStep = (typeof REVENUE_LIFECYCLE_STEPS)[number];

export const REVENUE_LIFECYCLE_LABELS: Record<RevenueLifecycleStep, string> = {
    discovered: 'Find client',
    qualified: 'Qualify lead',
    engaged: 'Conduct opportunity',
    proposal_sent: 'Send proposal',
    proposal_accepted: 'Proposal accepted',
    contract_sent: 'Send contract',
    contract_signed: 'Contract signed',
    invoice_sent: 'Send invoice',
    invoice_paid: 'Invoice paid',
    project_active: 'Project delivery',
};

export const REVENUE_STEP_HREF: Record<RevenueLifecycleStep, string> = {
    discovered: '/dashboard/leads',
    qualified: '/dashboard/deals',
    engaged: '/dashboard/business/messages',
    proposal_sent: '/dashboard/business/quotes',
    proposal_accepted: '/dashboard/business/quotes',
    contract_sent: '/dashboard/business/contracts',
    contract_signed: '/dashboard/business/contracts',
    invoice_sent: '/dashboard/business/billing',
    invoice_paid: '/dashboard/accounting',
    project_active: '/dashboard/business/projects',
};

const MS_DAY = 86_400_000;

export type RevenueLeakageInput = {
    deals: Array<{
        id: string;
        name: string;
        stage: string;
        value?: number;
        updated_at?: string;
        created_at?: string;
    }>;
    quotes: Array<{ id: string; deal_id?: string | null; status?: string }>;
    contracts: Array<{
        id: string;
        status?: string;
        metadata?: { deal_id?: string } | null;
        project_id?: string | null;
    }>;
    projects: Array<{ id: string; deal_id?: string | null; contract_id?: string | null }>;
    invoices: Array<{
        id: string;
        project_id?: string | null;
        status?: string;
        total?: number;
        total_amount?: number;
    }>;
    leads: Array<{ id: string; status?: string; stage?: string; created_at?: string }>;
    recentSocialPostCount: number;
    sentCampaignCount: number;
    decisions?: Array<{ id: string; tool_name?: string; outcome?: string; created_at?: string }>;
    unlinkedMeetingActionsCount?: number;
};

function dealIdsWithQuotes(quotes: RevenueLeakageInput['quotes']): Set<string> {
    return new Set(quotes.map((q) => q.deal_id).filter(Boolean) as string[]);
}

function dealIdsWithContracts(
    contracts: RevenueLeakageInput['contracts'],
    projects: RevenueLeakageInput['projects']
): Set<string> {
    const ids = new Set<string>();
    for (const c of contracts) {
        const metaDeal = c.metadata?.deal_id;
        if (metaDeal) ids.add(metaDeal);
        if (c.project_id) {
            const proj = projects.find((p) => p.id === c.project_id);
            if (proj?.deal_id) ids.add(proj.deal_id);
        }
    }
    for (const p of projects) {
        if (p.deal_id && p.contract_id) ids.add(p.deal_id);
    }
    return ids;
}

function dealIdsWithProjects(projects: RevenueLeakageInput['projects']): Set<string> {
    return new Set(projects.map((p) => p.deal_id).filter(Boolean) as string[]);
}

function dealIdsWithInvoices(
    invoices: RevenueLeakageInput['invoices'],
    projects: RevenueLeakageInput['projects']
): Set<string> {
    const ids = new Set<string>();
    for (const inv of invoices) {
        if (!inv.project_id) continue;
        const proj = projects.find((p) => p.id === inv.project_id);
        if (proj?.deal_id) ids.add(proj.deal_id);
    }
    return ids;
}

function signedContractIds(contracts: RevenueLeakageInput['contracts']): Set<string> {
    return new Set(
        contracts
            .filter((c) => c.status === 'fully_signed' || c.status === 'client_signed' || c.status === 'signed')
            .map((c) => c.id)
    );
}

function contractIdsWithInvoices(
    invoices: RevenueLeakageInput['invoices'],
    projects: RevenueLeakageInput['projects']
): Set<string> {
    const ids = new Set<string>();
    for (const inv of invoices) {
        if (!inv.project_id) continue;
        const proj = projects.find((p) => p.id === inv.project_id);
        if (proj?.contract_id) ids.add(proj.contract_id);
    }
    return ids;
}

/** Detect revenue leaks — opportunities stuck or skipping required steps. */
export function computeRevenueLeakage(input: RevenueLeakageInput): CrmNextStepItem[] {
    const items: CrmNextStepItem[] = [];
    const now = Date.now();

    const withQuotes = dealIdsWithQuotes(input.quotes);
    const withContracts = dealIdsWithContracts(input.contracts, input.projects);
    const withProjects = dealIdsWithProjects(input.projects);
    const withInvoices = dealIdsWithInvoices(input.invoices, input.projects);
    const signedIds = signedContractIds(input.contracts);
    const contractsInvoiced = contractIdsWithInvoices(input.invoices, input.projects);

    const openDeals = input.deals.filter((d) => d.stage !== 'closed_won' && d.stage !== 'closed_lost');
    const wonDeals = input.deals.filter((d) => d.stage === 'closed_won');

    // Stale discovered leads
    const staleLeads = input.leads.filter((l) => {
        const stage = (l.stage || l.status || 'lead').toLowerCase();
        if (stage !== 'lead' && stage !== 'new' && stage !== 'discovered') return false;
        const t = l.created_at ? new Date(l.created_at).getTime() : 0;
        return t > 0 && now - t > 14 * MS_DAY;
    });
    if (staleLeads.length > 0) {
        items.push({
            id: 'leak-stale-leads',
            tone: 'urgent',
            title: `${staleLeads.length} lead(s) never qualified`,
            detail: 'Found clients sitting in Discovered for 14+ days. Qualify or mark lost — unqualified demand is not pipeline.',
            actionLabel: 'Work leads',
            href: '/dashboard/leads',
        });
    }

    // Proposal stage without quote/proposal artifact
    const proposalNoQuote = openDeals.filter(
        (d) => (d.stage === 'proposal' || d.stage === 'negotiation') && !withQuotes.has(d.id)
    );
    if (proposalNoQuote.length > 0) {
        items.push({
            id: 'leak-no-proposal',
            tone: 'urgent',
            title: `${proposalNoQuote.length} deal(s) in proposal with no quote sent`,
            detail: 'Stage says proposal but nothing was sent. Create a quote or proposal doc before negotiating.',
            actionLabel: 'Open quotes',
            href: '/dashboard/business/quotes',
        });
    }

    // Closed won without contract
    const wonNoContract = wonDeals.filter((d) => !withContracts.has(d.id));
    if (wonNoContract.length > 0) {
        const atRisk = wonNoContract.reduce((s, d) => s + (d.value || 0), 0);
        items.push({
            id: 'leak-won-no-contract',
            tone: 'urgent',
            title: `${wonNoContract.length} won deal(s) with no contract (~$${atRisk.toLocaleString()})`,
            detail: 'You marked wins but have no signed agreement. Revenue at risk until contract is sent and signed.',
            actionLabel: 'Contracts',
            href: '/dashboard/business/contracts',
        });
    }

    // Signed contracts without invoice
    const signedNoInvoice = input.contracts.filter(
        (c) => signedIds.has(c.id) && !contractsInvoiced.has(c.id)
    );
    if (signedNoInvoice.length > 0) {
        items.push({
            id: 'leak-contract-no-invoice',
            tone: 'urgent',
            title: `${signedNoInvoice.length} signed contract(s) not invoiced`,
            detail: 'Agreement is done — bill now. Unsent invoices are revenue you have not asked for yet.',
            actionLabel: 'Billing',
            href: '/dashboard/business/billing',
        });
    }

    // Won deals with contract+invoice but no project
    const wonNoProject = wonDeals.filter(
        (d) => withContracts.has(d.id) && withInvoices.has(d.id) && !withProjects.has(d.id)
    );
    if (wonNoProject.length > 0) {
        items.push({
            id: 'leak-no-project',
            tone: 'normal',
            title: `${wonNoProject.length} paid path deal(s) without a project`,
            detail: 'Contract and invoice exist but delivery was never kicked off. Create the project and assign tasks.',
            actionLabel: 'Projects',
            href: '/dashboard/business/projects',
        });
    }

    // Stale open deals
    const staleDeals = openDeals.filter((d) => {
        const t = d.updated_at ? new Date(d.updated_at).getTime() : 0;
        return t > 0 && now - t > 14 * MS_DAY;
    });
    if (staleDeals.length > 0) {
        items.push({
            id: 'leak-stale-deals',
            tone: 'normal',
            title: `${staleDeals.length} deal(s) idle 14+ days`,
            detail: 'Pipeline rot hides forecast risk. Advance, reschedule close date, or mark lost with a reason.',
            actionLabel: 'Deals board',
            href: '/dashboard/deals',
        });
    }

    // Overdue unpaid invoices
    const unpaid = input.invoices.filter((i) =>
        ['sent', 'overdue', 'viewed', 'partially_paid'].includes(String(i.status || ''))
    );
    if (unpaid.length >= 3) {
        const total = unpaid.reduce((s, i) => s + Number(i.total ?? i.total_amount ?? 0), 0);
        items.push({
            id: 'leak-unpaid-invoices',
            tone: 'urgent',
            title: `${unpaid.length} outstanding invoices (~$${Math.round(total).toLocaleString()})`,
            detail: 'Cash is stuck in AR. Chase payment, log sends, and record cash when it lands.',
            actionLabel: 'Accounting',
            href: '/dashboard/accounting',
        });
    }

    // Social inactivity
    if (input.recentSocialPostCount === 0) {
        items.push({
            id: 'leak-social-inactive',
            tone: 'normal',
            title: 'No social posts in 3+ days',
            detail: 'Authority and inbound dry up when you go quiet. Schedule one post this week and tie it to a CTA.',
            actionLabel: 'Social Hub',
            href: '/dashboard/business/social',
        });
    }

    // Campaigns sent but pipeline empty
    if (input.sentCampaignCount > 0 && input.leads.length === 0 && openDeals.length === 0) {
        items.push({
            id: 'leak-campaign-no-pipeline',
            tone: 'normal',
            title: 'Campaigns running but pipeline is empty',
            detail: 'Outreach without a place to land replies wastes spend. Capture submissions and convert to deals within 48 hours.',
            actionLabel: 'Submissions',
            href: '/dashboard/business/contact-submissions',
        });
    }

    // Unlinked meeting decisions / actions
    if (input.unlinkedMeetingActionsCount && input.unlinkedMeetingActionsCount > 0) {
        items.push({
            id: 'leak-unlinked-meeting-actions',
            tone: 'urgent',
            title: `${input.unlinkedMeetingActionsCount} meeting decision(s) unassigned to projects`,
            detail: 'Meeting commitments must produce structured, traceable tasks with assigned owners.',
            actionLabel: 'Calendar & Meetings',
            href: '/dashboard/calendar',
        });
    }

    if (items.length === 0) {
        items.push({
            id: 'leak-all-clear',
            tone: 'success',
            title: 'Revenue chain looks healthy',
            detail: 'Keep executing: find → qualify → propose → contract → invoice → project. Review weekly for stale steps.',
            actionLabel: 'Sales console',
            href: '/dashboard/crm/console',
        });
    }

    return items.slice(0, 6);
}

/** 0–100 score: fewer urgent leaks = healthier pipeline. */
export function computePipelineHealthScore(
    leakageInput: RevenueLeakageInput
): { score: number; urgentCount: number } {
    const items = computeRevenueLeakage(leakageInput);
    const urgentCount = items.filter((i) => i.tone === 'urgent').length;
    if (items.length === 1 && items[0]?.id === 'leak-all-clear') {
        return { score: 100, urgentCount: 0 };
    }
    const penalty = urgentCount * 18 + items.filter((i) => i.tone === 'normal').length * 6;
    return { score: Math.max(0, Math.min(100, 100 - penalty)), urgentCount };
}

export type RevenueChainNodeTone = 'ok' | 'warn' | 'urgent' | 'idle';

export type RevenueChainNetworkNode = {
    step: RevenueLifecycleStep;
    label: string;
    shortLabel: string;
    href: string;
    volume: number;
    leakCount: number;
    tone: RevenueChainNodeTone;
    detail?: string;
    actionLabel?: string;
};

const REVENUE_STEP_SHORT: Record<RevenueLifecycleStep, string> = {
    discovered: 'Find',
    qualified: 'Qualify',
    engaged: 'Engage',
    proposal_sent: 'Propose',
    proposal_accepted: 'Accepted',
    contract_sent: 'Contract',
    contract_signed: 'Signed',
    invoice_sent: 'Invoice',
    invoice_paid: 'Paid',
    project_active: 'Deliver',
};

const LEAK_STEP_MAP: Record<string, RevenueLifecycleStep> = {
    'leak-stale-leads': 'discovered',
    'leak-no-proposal': 'proposal_sent',
    'leak-won-no-contract': 'contract_signed',
    'leak-contract-no-invoice': 'invoice_sent',
    'leak-no-project': 'project_active',
    'leak-stale-deals': 'engaged',
    'leak-unpaid-invoices': 'invoice_paid',
    'leak-social-inactive': 'discovered',
    'leak-campaign-no-pipeline': 'discovered',
    'leak-unlinked-meeting-actions': 'engaged',
};

/** Build clickable network nodes with real volumes + leak highlights. */
export function buildRevenueChainNetwork(
    input: RevenueLeakageInput,
    items: CrmNextStepItem[],
): RevenueChainNetworkNode[] {
    const openDeals = input.deals.filter((d) => d.stage !== 'closed_won' && d.stage !== 'closed_lost');
    const wonDeals = input.deals.filter((d) => d.stage === 'closed_won');
    const signedContracts = input.contracts.filter((c) =>
        ['fully_signed', 'client_signed', 'signed'].includes(String(c.status || '')),
    );
    const sentInvoices = input.invoices.filter((i) =>
        ['sent', 'overdue', 'viewed', 'partially_paid'].includes(String(i.status || '')),
    );
    const paidInvoices = input.invoices.filter((i) => String(i.status || '') === 'paid');
    const activeProjects = input.projects.length;
    const qualifiedLeads = input.leads.filter((l) => {
        const stage = (l.stage || l.status || '').toLowerCase();
        return stage === 'qualified' || stage === 'contacted';
    }).length;
    const discoveredLeads = input.leads.filter((l) => {
        const stage = (l.stage || l.status || 'lead').toLowerCase();
        return stage === 'lead' || stage === 'new' || stage === 'discovered';
    }).length;
    const proposalDeals = openDeals.filter((d) => d.stage === 'proposal' || d.stage === 'negotiation').length;
    const acceptedQuotes = input.quotes.filter((q) =>
        ['accepted', 'approved', 'signed'].includes(String(q.status || '').toLowerCase()),
    ).length;
    const sentContracts = input.contracts.filter((c) =>
        ['sent', 'pending', 'client_signed', 'fully_signed', 'signed', 'active'].includes(String(c.status || '')),
    ).length;

    const volumes: Record<RevenueLifecycleStep, number> = {
        discovered: discoveredLeads,
        qualified: qualifiedLeads,
        engaged: openDeals.length,
        proposal_sent: proposalDeals + input.quotes.length,
        proposal_accepted: acceptedQuotes,
        contract_sent: sentContracts,
        contract_signed: signedContracts.length,
        invoice_sent: sentInvoices.length,
        invoice_paid: paidInvoices.length,
        project_active: activeProjects,
    };

    const leakByStep = new Map<RevenueLifecycleStep, CrmNextStepItem>();
    for (const item of items) {
        if (item.id === 'leak-all-clear') continue;
        const step = LEAK_STEP_MAP[item.id];
        if (step) leakByStep.set(step, item);
    }

    return REVENUE_LIFECYCLE_STEPS.map((step) => {
        const leak = leakByStep.get(step);
        const volume = volumes[step];
        let tone: RevenueChainNodeTone = volume > 0 ? 'ok' : 'idle';
        if (leak?.tone === 'urgent') tone = 'urgent';
        else if (leak?.tone === 'normal') tone = 'warn';

        const leakCount = leak
            ? Number((leak.title.match(/^(\d+)/)?.[1] ?? '1'))
            : 0;

        return {
            step,
            label: REVENUE_LIFECYCLE_LABELS[step],
            shortLabel: REVENUE_STEP_SHORT[step],
            href: REVENUE_STEP_HREF[step],
            volume,
            leakCount,
            tone,
            detail: leak?.detail,
            actionLabel: leak?.actionLabel,
        };
    });
}

export function mapDealStageToLifecycleHint(stage: string): RevenueLifecycleStep {
    switch (stage) {
        case 'lead':
            return 'discovered';
        case 'qualified':
            return 'qualified';
        case 'proposal':
            return 'proposal_sent';
        case 'negotiation':
            return 'engaged';
        case 'closed_won':
            return 'contract_sent';
        case 'closed_lost':
            return 'engaged';
        default:
            return 'discovered';
    }
}
