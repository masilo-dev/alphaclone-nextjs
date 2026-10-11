/**
 * Authoritative Unified Board Transition Service.
 * Central pipeline for all card state changes across CRM Deals, Leads, Tasks, Projects, and Onboarding.
 * Guarantees:
 * 1. Strict Tenant Isolation.
 * 2. State Machine & Required Field Verification.
 * 3. Backend WIP Limit Enforcement & Override Auditing.
 * 4. Append-Only Transition Logging with accurate duration calculation.
 * 5. Atomic state update + entered_column_at timestamp refresh.
 */

import {
  BoardCardState,
  BoardTransitionLog,
  BoardType,
  TransitionRequest,
  TransitionResult,
} from './boardModel';
import { getBoardDefinition } from './boardDefinitions';
import { BoardPolicyService } from './boardPolicyService';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export class BoardTransitionService {
  private static getTableName(boardType: BoardType): string {
    switch (boardType) {
      case 'crm_deals':
        return 'deals';
      case 'crm_leads':
        return 'leads';
      case 'workspace_tasks':
      case 'project_tasks':
        return 'tasks';
      case 'onboarding':
        return 'leads';
      default:
        throw new Error(`Unknown board type: ${boardType}`);
    }
  }

  /**
   * Execute card transition with full validation and append-only logging.
   */
  public static async executeTransition(
    request: TransitionRequest
  ): Promise<TransitionResult> {
    const { tenantId, boardType, cardId, targetState, actorId, reason, overrideWip, overrideReason } = request;
    const boardDef = getBoardDefinition(boardType);
    const admin = createSupabaseAdminClient();
    const tableName = this.getTableName(boardType);
    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Fetch current card
    const { data: rawCard, error: fetchError } = await admin
      .from(tableName)
      .select('*')
      .eq('id', cardId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (fetchError || !rawCard) {
      return {
        success: false,
        errorCode: 'NOT_FOUND',
        error: `Card not found in organization: ${fetchError?.message || cardId}`,
      };
    }

    const stageField = tableName === 'tasks' ? 'status' : 'stage';
    const currentStage = rawCard[stageField] || 'lead';

    const cardState: BoardCardState = {
      id: rawCard.id,
      tenant_id: rawCard.tenant_id,
      title: rawCard.name || rawCard.title || rawCard.business_name || 'Untitled',
      stage: currentStage,
      owner_id: rawCard.owner_id || rawCard.assigned_to || null,
      entered_column_at: rawCard.entered_column_at || rawCard.updated_at || rawCard.created_at,
      is_blocked: Boolean(rawCard.is_blocked),
      blocked_reason: rawCard.blocked_reason || null,
      blocked_since: rawCard.blocked_since || null,
      unblock_owner_id: rawCard.unblock_owner_id || null,
      class_of_service: rawCard.class_of_service || 'standard',
      next_action: rawCard.next_action || rawCard.next_step || null,
      next_action_date: rawCard.next_action_date || null,
      archived: Boolean(rawCard.archived),
      archived_at: rawCard.archived_at || null,
      archived_by: rawCard.archived_by || null,
      value: rawCard.value !== undefined ? Number(rawCard.value) : null,
      metadata: rawCard.metadata || {},
      created_at: rawCard.created_at,
      updated_at: rawCard.updated_at,
    };

    // 2. Fetch current count of cards in target column (for WIP limit)
    let countQuery = admin
      .from(tableName)
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq(stageField, targetState)
      .eq('archived', false);

    if (boardType === 'project_tasks' && rawCard.related_to_project) {
      countQuery = countQuery.eq('related_to_project', rawCard.related_to_project);
    }
    const { count: targetCount } = await countQuery;
    const currentColumnCardCount = targetCount || 0;

    // 3. Fetch custom tenant board policies (if any)
    const { data: customPolicy } = await admin
      .from('board_policies')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('board_type', boardType)
      .eq('column_id', targetState)
      .maybeSingle();

    const policyOverride = customPolicy
      ? { wipLimit: customPolicy.wip_limit, requiredFields: customPolicy.required_fields }
      : undefined;

    // 4. Validate transition through BoardPolicyService
    const validation = BoardPolicyService.validateTransition(
      boardDef,
      cardState,
      request,
      currentColumnCardCount,
      policyOverride
    );

    if (!validation.valid) {
      return {
        success: false,
        errorCode: validation.errorCode,
        error: validation.message,
      };
    }

    // 5. Calculate dwell duration in previous state
    const enteredPrevMs = new Date(cardState.entered_column_at).getTime();
    const durationInPrevMs = Math.max(0, now.getTime() - enteredPrevMs);

    // 6. Build Card Updates Payload
    const updates: Record<string, any> = {
      [stageField]: targetState,
      entered_column_at: nowIso,
      updated_at: nowIso,
    };

    if (request.cardUpdates) {
      const cu = request.cardUpdates;
      if (cu.nextAction !== undefined) updates.next_action = cu.nextAction;
      if (cu.nextActionDate !== undefined) updates.next_action_date = cu.nextActionDate;
      if (cu.value !== undefined) updates.value = cu.value;
      if (cu.isBlocked !== undefined) {
        updates.is_blocked = cu.isBlocked;
        if (cu.isBlocked) {
          updates.blocked_since = nowIso;
          updates.blocked_reason = cu.blockedReason || 'Blocked';
          updates.unblock_owner_id = cu.unblockOwnerId || null;
        } else {
          updates.blocked_since = null;
          updates.blocked_reason = null;
          updates.unblock_owner_id = null;
        }
      }
      if (cu.classOfService !== undefined) updates.class_of_service = cu.classOfService;
      if (cu.notes !== undefined) updates.notes = cu.notes;
    }

    if (boardType === 'crm_deals') {
      if (targetState === 'closed_won') {
        updates.actual_close_date = nowIso.slice(0, 10);
        updates.probability = 100;
      } else if (targetState === 'closed_lost') {
        updates.probability = 0;
        if (reason) updates.lost_reason = reason;
      }
    }

    // 7. Update Card Table
    const { data: updatedCard, error: updateError } = await admin
      .from(tableName)
      .update(updates)
      .eq('id', cardId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    if (updateError) {
      return {
        success: false,
        error: `Failed to update ${boardDef.cardUnitName}: ${updateError.message}`,
      };
    }

    // 8. Append-Only Transition Log Insert
    const isOverride = Boolean(overrideWip && currentColumnCardCount >= (boardDef.columns.find(c => c.id === targetState)?.wipLimit || Infinity));
    const logEntry = {
      tenant_id: tenantId,
      board_type: boardType,
      card_id: cardId,
      from_state: currentStage,
      to_state: targetState,
      actor_id: actorId || null,
      reason: reason || null,
      duration_in_previous_state_ms: durationInPrevMs,
      is_override: isOverride,
      override_reason: isOverride ? (overrideReason || 'WIP limit override') : null,
      metadata: {
        previous_entered_at: cardState.entered_column_at,
        class_of_service: updates.class_of_service || cardState.class_of_service,
        ...(request.cardUpdates || {}),
      },
    };

    const { data: insertedLog, error: logError } = await admin
      .from('board_transition_logs')
      .insert(logEntry)
      .select('*')
      .single();

    if (logError) {
      console.error('[BoardTransitionService] Invariant breach: Transition log insert failed:', logError);
    }

    // 9. Emit business event for automation pipelines
    try {
      const { emitBusinessEvent } = await import('@/lib/automation/emit-event');
      await emitBusinessEvent(tenantId, `${boardType}_transitioned`, {
        cardId,
        fromState: currentStage,
        toState: targetState,
        actorId,
        durationInPrevMs,
      });
    } catch {
      // Event failure does not roll back verified database transition
    }

    return {
      success: true,
      transitionLog: insertedLog as BoardTransitionLog,
      card: {
        ...cardState,
        stage: targetState,
        entered_column_at: nowIso,
        updated_at: nowIso,
      },
    };
  }
}
