import type { DealStage } from '@/services/dealService';
import { dealService } from '@/services/dealService';
import { showActionNextSteps, type ActionNextStepKey } from '@/components/common/showActionNextSteps';
import { assertDealStageTransition } from '@/lib/stageProgression';

export type NavigateFn = (path: string) => void;

const STAGE_NEXT_STEP: Partial<Record<DealStage, ActionNextStepKey>> = {
    qualified: 'deal_qualified',
    proposal: 'deal_proposal',
    negotiation: 'deal_proposal',
    closed_won: 'deal_closed_won',
    closed_lost: 'deal_closed_lost',
};

export function showDealStageNextSteps(stage: DealStage, navigate: NavigateFn): void {
    const key = STAGE_NEXT_STEP[stage];
    if (key) showActionNextSteps(key, navigate);
}

export async function transitionDealStage(params: {
    dealId: string;
    fromStage: string;
    toStage: DealStage;
    navigate?: NavigateFn;
}): Promise<{ ok: true; deal: Awaited<ReturnType<typeof dealService.updateDeal>>['deal'] } | { ok: false; message: string }> {
    const check = assertDealStageTransition(params.fromStage, params.toStage);
    if (!check.ok) return { ok: false, message: check.message };

    const { deal, error } = await dealService.updateDeal(params.dealId, { stage: params.toStage });
    if (error || !deal) {
        return { ok: false, message: error || 'Failed to update deal stage' };
    }

    if (params.navigate) {
        showDealStageNextSteps(params.toStage, params.navigate);
    }

    return { ok: true, deal };
}
