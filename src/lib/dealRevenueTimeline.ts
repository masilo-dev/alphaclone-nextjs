import {
    REVENUE_LIFECYCLE_LABELS,
    REVENUE_LIFECYCLE_STEPS,
    type RevenueLifecycleStep,
} from './revenueLifecycle';

export type TimelineStepState = 'complete' | 'current' | 'upcoming' | 'skipped';

export type DealRevenueContext = {
    dealStage: string;
    quotes: Array<{ id: string; status?: string | null }>;
    contracts: Array<{ id: string; status?: string | null }>;
    invoices: Array<{ id: string; status?: string | null }>;
    projects: Array<{ id: string; status?: string | null }>;
    hasActivity?: boolean;
};

export type DealTimelineStep = {
    step: RevenueLifecycleStep;
    label: string;
    index: number;
    state: TimelineStepState;
    detail: string;
    href: string;
};

const STAGE_RANK: Record<string, number> = {
    lead: 1,
    qualified: 2,
    proposal: 3,
    negotiation: 4,
    closed_won: 5,
    closed_lost: 0,
};

const STEP_HREF: Record<RevenueLifecycleStep, string> = {
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

const STEP_NEXT_HINT: Record<RevenueLifecycleStep, string> = {
    discovered: 'Find and add this opportunity to your pipeline.',
    qualified: 'Confirm fit, budget, and decision maker.',
    engaged: 'Run calls, meetings, and follow-ups toward a decision.',
    proposal_sent: 'Send a quote or proposal and log when it went out.',
    proposal_accepted: 'Get explicit acceptance before contracting.',
    contract_sent: 'Send the agreement for signature.',
    contract_signed: 'Both parties signed — bill next.',
    invoice_sent: 'Send the invoice and track until paid.',
    invoice_paid: 'Payment received — kick off delivery.',
    project_active: 'Project live — assign tasks and deliver.',
};

function stepComplete(step: RevenueLifecycleStep, ctx: DealRevenueContext): boolean {
    const rank = STAGE_RANK[ctx.dealStage] ?? 1;
    const quotes = ctx.quotes || [];
    const contracts = ctx.contracts || [];
    const invoices = ctx.invoices || [];
    const projects = ctx.projects || [];

    switch (step) {
        case 'discovered':
            return true;
        case 'qualified':
            return rank >= 2 || ctx.dealStage === 'closed_won';
        case 'engaged':
            return rank >= 4 || ctx.dealStage === 'closed_won' || !!ctx.hasActivity;
        case 'proposal_sent':
            return (
                quotes.some((q) =>
                    ['sent', 'viewed', 'accepted', 'converted'].includes(String(q.status || ''))
                ) ||
                rank >= 3 ||
                ctx.dealStage === 'closed_won'
            );
        case 'proposal_accepted':
            return (
                quotes.some((q) => ['accepted', 'converted'].includes(String(q.status || ''))) ||
                rank >= 4 ||
                ctx.dealStage === 'closed_won'
            );
        case 'contract_sent':
            return contracts.some((c) =>
                ['sent', 'client_signed', 'fully_signed', 'signed'].includes(String(c.status || ''))
            );
        case 'contract_signed':
            return contracts.some((c) =>
                ['client_signed', 'fully_signed', 'signed'].includes(String(c.status || ''))
            );
        case 'invoice_sent':
            return invoices.some((i) =>
                ['sent', 'viewed', 'partially_paid', 'paid', 'overdue'].includes(String(i.status || ''))
            );
        case 'invoice_paid':
            return invoices.some((i) => String(i.status || '') === 'paid');
        case 'project_active':
            return projects.some(
                (p) => !p.status || ['active', 'in_progress', 'Active'].includes(String(p.status))
            );
        default:
            return false;
    }
}

export function buildDealRevenueTimeline(ctx: DealRevenueContext): {
    steps: DealTimelineStep[];
    currentStep: RevenueLifecycleStep | null;
    percent: number;
    completedCount: number;
    nextAction: { label: string; href: string; detail: string } | null;
} {
    const isLost = ctx.dealStage === 'closed_lost';
    const completion = REVENUE_LIFECYCLE_STEPS.map((step) => stepComplete(step, ctx));
    const completedCount = completion.filter(Boolean).length;
    const percent = Math.round((completedCount / REVENUE_LIFECYCLE_STEPS.length) * 100);

    let currentIndex = completion.findIndex((done) => !done);
    if (currentIndex === -1) currentIndex = REVENUE_LIFECYCLE_STEPS.length - 1;
    if (isLost) currentIndex = -1;

    const steps: DealTimelineStep[] = REVENUE_LIFECYCLE_STEPS.map((step, index) => {
        let state: TimelineStepState;
        if (completion[index]) {
            state = 'complete';
        } else if (isLost) {
            state = 'skipped';
        } else if (index === currentIndex) {
            state = 'current';
        } else {
            state = 'upcoming';
        }

        let detail = STEP_NEXT_HINT[step];
        if (state === 'complete') detail = 'Done for this deal.';
        if (state === 'skipped') detail = 'Deal closed lost — chain stopped here.';

        return {
            step,
            label: REVENUE_LIFECYCLE_LABELS[step],
            index: index + 1,
            state,
            detail,
            href: STEP_HREF[step],
        };
    });

    const currentStep =
        isLost || currentIndex < 0 ? null : REVENUE_LIFECYCLE_STEPS[currentIndex];

    const nextAction =
        isLost || !currentStep
            ? null
            : {
                  label: REVENUE_LIFECYCLE_LABELS[currentStep],
                  href: STEP_HREF[currentStep],
                  detail: STEP_NEXT_HINT[currentStep],
              };

    return {
        steps,
        currentStep,
        percent: isLost ? 0 : percent,
        completedCount: isLost ? 0 : completedCount,
        nextAction,
    };
}
