import type { PipelineLeadStage } from '@/lib/stageProgression';

/** Active lead columns on the CRM Kanban (terminal stages are actions, not holding columns). */
export const ACTIVE_LEAD_KANBAN_STAGES = [
    'lead',
    'qualified',
    'proposal',
    'negotiation',
] as const;

export type ActiveLeadKanbanStage = (typeof ACTIVE_LEAD_KANBAN_STAGES)[number];

export const TERMINAL_LEAD_STAGES = ['won', 'lost'] as const;

/** Active deal columns on the pipeline board. */
export const ACTIVE_DEAL_STAGES = [
    'lead',
    'qualified',
    'proposal',
    'negotiation',
] as const;

export type ActiveDealStage = (typeof ACTIVE_DEAL_STAGES)[number];

export const TERMINAL_DEAL_STAGES = ['closed_won', 'closed_lost'] as const;

const LEGACY_LEAD_STAGE_MAP: Record<string, PipelineLeadStage> = {
    prospect: 'qualified',
    opportunity: 'proposal',
    converted: 'won',
    closed_won: 'won',
    closed_lost: 'lost',
    disqualified: 'lost',
    discovered: 'lead',
};

/** Map DB / legacy values to canonical lead pipeline stages. */
export function normalizeLeadPipelineStage(stage: string | null | undefined): PipelineLeadStage {
    const raw = String(stage || 'lead').trim().toLowerCase();
    if (LEGACY_LEAD_STAGE_MAP[raw]) {
        return LEGACY_LEAD_STAGE_MAP[raw];
    }
    if (
        (ACTIVE_LEAD_KANBAN_STAGES as readonly string[]).includes(raw) ||
        (TERMINAL_LEAD_STAGES as readonly string[]).includes(raw)
    ) {
        return raw as PipelineLeadStage;
    }
    return 'lead';
}

export function isTerminalLeadStage(stage: string): boolean {
    return (TERMINAL_LEAD_STAGES as readonly string[]).includes(stage);
}

export function isActiveLeadKanbanStage(stage: string): boolean {
    return (ACTIVE_LEAD_KANBAN_STAGES as readonly string[]).includes(stage);
}

export function isTerminalDealStage(stage: string): boolean {
    return (TERMINAL_DEAL_STAGES as readonly string[]).includes(stage);
}

export function isActiveDealStage(stage: string): boolean {
    return (ACTIVE_DEAL_STAGES as readonly string[]).includes(stage);
}
