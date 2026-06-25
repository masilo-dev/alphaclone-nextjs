import type { Deal } from '../services/dealService';
import type { Lead } from '../services/leadService';
import { computeRevenueLeakage, type RevenueLeakageInput } from './revenueLifecycle';

export type CrmNextStepItem = {
    id: string;
    tone: 'urgent' | 'normal' | 'success';
    title: string;
    detail: string;
    actionLabel?: string;
    href?: string;
};

const MS_DAY = 86_400_000;

export function buildCrmOverviewNextSteps(deals: Deal[]): CrmNextStepItem[] {
    const items: CrmNextStepItem[] = [];
    const now = Date.now();
    const open = deals.filter((d) => d.stage !== 'closed_won' && d.stage !== 'closed_lost');

    if (deals.length === 0) {
        items.push({
            id: 'start-contacts',
            tone: 'normal',
            title: 'Start a revenue pipeline you can execute',
            detail: 'Add people and organizations as contacts, then attach value and stages. Lists alone do not close business.',
            actionLabel: 'Open Contacts',
            href: '/dashboard/contacts',
        });
        items.push({
            id: 'start-deals',
            tone: 'normal',
            title: 'Create or import opportunities',
            detail: 'Define deal value, probability, and expected close so you know what to work this week.',
            actionLabel: 'Deals workspace',
            href: '/dashboard/deals',
        });
        return items;
    }

    const overdue = open.filter(
        (d) => d.expectedCloseDate && new Date(d.expectedCloseDate).getTime() < now
    );
    if (overdue.length > 0) {
        items.push({
            id: 'overdue-close',
            tone: 'urgent',
            title: `${overdue.length} open deal(s) past expected close`,
            detail: 'Close won, push the date with a reason, or mark lost. Stale forecasts hide real risk.',
            actionLabel: 'Fix on Deals',
            href: '/dashboard/deals',
        });
    }

    const lateStageNoDate = open.filter(
        (d) =>
            (d.stage === 'proposal' || d.stage === 'negotiation') && !d.expectedCloseDate
    );
    if (lateStageNoDate.length > 0) {
        items.push({
            id: 'missing-close-date',
            tone: 'urgent',
            title: `${lateStageNoDate.length} late-stage deal(s) without a close date`,
            detail: 'Set a target date so follow-ups and revenue timing are explicit.',
            actionLabel: 'Set dates',
            href: '/dashboard/deals',
        });
    }

    const staleLeadStage = open.filter((d) => {
        if (d.stage !== 'lead') return false;
        const t = d.updatedAt ? new Date(d.updatedAt).getTime() : 0;
        return t > 0 && now - t > 14 * MS_DAY;
    });
    if (staleLeadStage.length > 0) {
        items.push({
            id: 'stale-lead-deals',
            tone: 'normal',
            title: `${staleLeadStage.length} deal(s) stuck in Lead`,
            detail: 'Qualify or disqualify: move to Qualified with criteria, or exit to Closed Lost with a reason.',
            actionLabel: 'Work pipeline',
            href: '/dashboard/deals',
        });
    }

    const inMotion = open.filter((d) => d.stage === 'negotiation' || d.stage === 'proposal').length;
    if (items.length === 0) {
        items.push({
            id: 'default-motion',
            tone: 'success',
            title: inMotion > 0 ? `${inMotion} deal(s) in Proposal or Negotiation` : 'Keep the funnel moving',
            detail:
                inMotion > 0
                    ? 'Next execution: decision timeline, proposal sent, and explicit next meeting or sign-off.'
                    : 'Advance qualified opportunities into proposal with owners and dates.',
            actionLabel: 'Leads board',
            href: '/dashboard/leads',
        });
    }

    return items.slice(0, 4);
}

/** Merge deal pipeline nudges with cross-module revenue leakage detection. */
export function buildCombinedCrmNextSteps(
    deals: Deal[],
    leakageInput?: RevenueLeakageInput | null
): CrmNextStepItem[] {
    const pipeline = buildCrmOverviewNextSteps(deals);
    if (!leakageInput) return pipeline.slice(0, 5);

    const leaks = computeRevenueLeakage(leakageInput);
    const seen = new Set<string>();
    const merged: CrmNextStepItem[] = [];

    for (const item of [...leaks, ...pipeline]) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        merged.push(item);
    }

    return merged.slice(0, 6);
}

export function buildLeadKanbanNextSteps(leads: Lead[]): CrmNextStepItem[] {
    const items: CrmNextStepItem[] = [];

    const automationLeads = leads.filter((l) => {
        const s = (l.source || '').toLowerCase();
        return s.includes('mcp') || s.includes('ai agent') || s.includes('claude');
    });
    if (automationLeads.length > 0) {
        items.push({
            id: 'automation-source-leads',
            tone: 'normal',
            title: `${automationLeads.length} lead(s) from automation — check Source on each card`,
            detail:
                'MCP/AI added demand, not revenue. Qualify within a day: move the card forward or mark lost, then create a deal with value and close date so profit is trackable.',
            actionLabel: 'Deals workspace',
            href: '/dashboard/deals',
        });
    }

    if (leads.length === 0) {
        items.push({
            id: 'kanban-empty-capture',
            tone: 'normal',
            title: 'Capture demand before you optimize columns',
            detail: 'Add leads from inbound, outreach, or imports. An empty board has nothing to convert to revenue.',
            actionLabel: 'Contacts',
            href: '/dashboard/contacts',
        });
        items.push({
            id: 'kanban-empty-deal',
            tone: 'normal',
            title: 'Convert qualified interest into a deal',
            detail: 'When fit and budget are real, create a deal with amount and close date.',
            actionLabel: 'Deals',
            href: '/dashboard/deals',
        });
        return items;
    }

    const discovered = leads.filter((l) => l.stage === 'lead').length;
    const qualified = leads.filter((l) => l.stage === 'qualified').length;
    const won = leads.filter((l) => l.stage === 'won').length;

    if (discovered >= 4) {
        items.push({
            id: 'backlog-discovered',
            tone: 'normal',
            title: `${discovered} leads in Discovered`,
            detail: 'Pick the next batch to qualify: BANT or your criteria, owner, and a scheduled next step.',
            actionLabel: 'CRM overview',
            href: '/dashboard/crm',
        });
    }

    if (qualified >= 3 && won === 0) {
        items.push({
            id: 'convert-qualified',
            tone: 'urgent',
            title: `${qualified} qualified—drive to a decision`,
            detail: 'Move cards toward Negotiation or create deals. Execution ends in signed work or a clear no.',
            actionLabel: 'Create deal',
            href: '/dashboard/deals',
        });
    }

    if (won > 0) {
        items.push({
            id: 'won-handoff',
            tone: 'success',
            title: `${won} Closed Won on the board`,
            detail: 'Align delivery, billing, and retention. Mirror major wins as deals for forecasting if needed.',
            actionLabel: 'Deals',
            href: '/dashboard/deals',
        });
    }

    if (items.length === 0) {
        items.push({
            id: 'kanban-default',
            tone: 'normal',
            title: 'Execute the next right movement',
            detail: 'Drag right only when criteria are met. Every card should end in Closed Won or a documented exit.',
            actionLabel: 'Deal workspace',
            href: '/dashboard/deals',
        });
    }

    return items.slice(0, 4);
}
