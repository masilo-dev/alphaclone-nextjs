/**
 * Forward-only funnel rules across CRM: stages only advance or exit via "lost",
 * never backward. Terminal states cannot be reopened in-place.
 */

export const DEAL_STAGE_SEQUENCE = [
    'lead',
    'qualified',
    'proposal',
    'negotiation',
    'closed_won',
    'closed_lost',
] as const;

export type PipelineDealStage = (typeof DEAL_STAGE_SEQUENCE)[number];

const DEAL_TERMINAL: PipelineDealStage[] = ['closed_won', 'closed_lost'];

export function assertDealStageTransition(
    fromStage: string | null | undefined,
    toStage: string
): { ok: true } | { ok: false; message: string } {
    const current = (fromStage || 'lead') as PipelineDealStage;
    const next = toStage as PipelineDealStage;

    if (!DEAL_STAGE_SEQUENCE.includes(current)) {
        return { ok: false, message: 'Deal has an unrecognized stage. Fix data or contact support.' };
    }
    if (!DEAL_STAGE_SEQUENCE.includes(next)) {
        return { ok: false, message: 'Invalid deal stage.' };
    }

    if (DEAL_TERMINAL.includes(current) && next !== current) {
        return {
            ok: false,
            message:
                'Closed deals cannot change stage. Create a new deal if this opportunity is active again.',
        };
    }

    if (current === next) {
        return { ok: true };
    }

    if (next === 'closed_lost') {
        return { ok: true };
    }

    const i = DEAL_STAGE_SEQUENCE.indexOf(current);
    const j = DEAL_STAGE_SEQUENCE.indexOf(next);
    if (j < i) {
        return {
            ok: false,
            message:
                'Pipeline moves forward only. Use Closed lost to exit when the opportunity is dead.',
        };
    }

    return { ok: true };
}

export function getForwardDealStages(currentStage: string): PipelineDealStage[] {
    const current = currentStage as PipelineDealStage;
    if (!DEAL_STAGE_SEQUENCE.includes(current)) {
        return [...DEAL_STAGE_SEQUENCE];
    }
    if (DEAL_TERMINAL.includes(current)) {
        return [current];
    }
    const i = DEAL_STAGE_SEQUENCE.indexOf(current);
    return DEAL_STAGE_SEQUENCE.filter((_, idx) => idx >= i);
}

/** Next stage when moving forward (never advances into closed_lost). */
export function getForwardStageTarget(currentStage: string): PipelineDealStage | null {
    const current = (currentStage || 'lead') as PipelineDealStage;
    if (!DEAL_STAGE_SEQUENCE.includes(current) || DEAL_TERMINAL.includes(current)) {
        return null;
    }
    const i = DEAL_STAGE_SEQUENCE.indexOf(current);
    const next = DEAL_STAGE_SEQUENCE[i + 1];
    if (!next || next === 'closed_lost') return null;
    return next;
}

/** Deal pipeline progress for UI (1–6 steps ending at closed won). */
export function getDealStageProgress(stage: string): {
    step: number;
    total: number;
    percent: number;
    label: string;
} {
    const current = (stage || 'lead') as PipelineDealStage;
    const total = 6;

    if (current === 'closed_won') {
        return { step: total, total, percent: 100, label: 'Closed won' };
    }
    if (current === 'closed_lost') {
        return { step: 0, total, percent: 0, label: 'Closed lost' };
    }

    const i = DEAL_STAGE_SEQUENCE.indexOf(current);
    if (i === -1) {
        return { step: 1, total, percent: Math.round(100 / total), label: 'Lead' };
    }

    const step = i + 1;
    const percent = Math.round((step / total) * 100);
    return {
        step,
        total,
        percent,
        label: current.replace('_', ' '),
    };
}

export const PIPELINE_FORWARD_ONLY_HINT =
    'Pipeline moves forward only. Swipe or drag right to advance. Swipe left or choose Closed lost to exit — deals do not move backward.';

export const LEAD_STAGE_SEQUENCE = [
    'lead',
    'qualified',
    'proposal',
    'negotiation',
    'won',
    'lost',
] as const;

export type PipelineLeadStage = (typeof LEAD_STAGE_SEQUENCE)[number];

const LEAD_TERMINAL: PipelineLeadStage[] = ['won', 'lost'];

export function assertLeadStageTransition(
    fromStage: string | null | undefined,
    toStage: string
): { ok: true } | { ok: false; message: string } {
    const current = (fromStage || 'lead') as string;
    const next = toStage;

    if (current === 'won' || current === 'lost') {
        if (next === current) return { ok: true };
        return {
            ok: false,
            message:
                'Closed leads cannot move. Add a new lead to track a fresh opportunity.',
        };
    }

    if (current === next) return { ok: true };
    if (next === 'lost') return { ok: true };

    const i = LEAD_STAGE_SEQUENCE.indexOf(current as PipelineLeadStage);
    const j = LEAD_STAGE_SEQUENCE.indexOf(next as PipelineLeadStage);

    if (j === -1) {
        return { ok: false, message: 'Invalid lead stage.' };
    }
    if (i === -1) {
        return { ok: false, message: 'Lead has an unrecognized stage.' };
    }
    if (j < i) {
        return {
            ok: false,
            message: 'Lead pipeline moves forward only. Use Lost to disqualify.',
        };
    }

    return { ok: true };
}

export const CONTACT_SALES_SEQUENCE = ['lead', 'prospect', 'customer'] as const;

export type ContactSalesStage = 'lead' | 'prospect' | 'customer' | 'lost';

export function assertContactSalesStageTransition(
    fromStage: string | null | undefined,
    toStage: string
): { ok: true } | { ok: false; message: string } {
    const current = (fromStage || 'lead') as ContactSalesStage;
    const next = toStage as ContactSalesStage;

    const allowed: ContactSalesStage[] = ['lead', 'prospect', 'customer', 'lost'];
    if (!allowed.includes(current)) {
        return { ok: false, message: 'Contact has an invalid funnel stage.' };
    }
    if (!allowed.includes(next)) {
        return { ok: false, message: 'Invalid contact stage.' };
    }

    if (current === 'lost' && next !== 'lost') {
        return {
            ok: false,
            message:
                'Lost contacts do not move backward. Create a new contact to re-engage formally.',
        };
    }

    if (current === next) return { ok: true };
    if (next === 'lost') return { ok: true };

    const i = CONTACT_SALES_SEQUENCE.indexOf(current as 'lead' | 'prospect' | 'customer');
    const j = CONTACT_SALES_SEQUENCE.indexOf(next as 'lead' | 'prospect' | 'customer');

    if (j === -1) {
        return { ok: false, message: 'Invalid funnel transition.' };
    }
    if (i === -1) {
        return { ok: false, message: 'Invalid current funnel stage.' };
    }
    if (j < i) {
        return {
            ok: false,
            message: 'Contact funnel moves forward only. Mark Lost to exit.',
        };
    }

    return { ok: true };
}
