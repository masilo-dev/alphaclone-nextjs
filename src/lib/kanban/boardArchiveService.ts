/**
 * Soft-Archival and Restoration Engine for Kanban Boards.
 * Strictly adheres to Non-Negotiable Rule #3:
 * "Never delete: archive instead. Every move must be undoable."
 */

import { BoardType } from './boardModel';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export class BoardArchiveService {
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
   * Soft-archive a card. Never deletes rows from the database.
   */
  public static async archiveCard(params: {
    tenantId: string;
    boardType: BoardType;
    cardId: string;
    actorId?: string | null;
    reason?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { tenantId, boardType, cardId, actorId, reason } = params;
    const admin = createSupabaseAdminClient();
    const tableName = this.getTableName(boardType);
    const now = new Date().toISOString();

    // 1. Fetch current card
    const { data: card, error: fetchError } = await admin
      .from(tableName)
      .select('id, stage, status, tenant_id')
      .eq('id', cardId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (fetchError || !card) {
      return { success: false, error: fetchError?.message || 'Card not found' };
    }

    const currentStage = card.stage || card.status || 'unknown';

    // 2. Perform soft-delete (archival)
    const { error: updateError } = await admin
      .from(tableName)
      .update({
        archived: true,
        archived_at: now,
        archived_by: actorId || null,
        updated_at: now,
      })
      .eq('id', cardId)
      .eq('tenant_id', tenantId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // 3. Write append-only transition log
    const { error: logError } = await admin
      .from('board_transition_logs')
      .insert({
        tenant_id: tenantId,
        board_type: boardType,
        card_id: cardId,
        from_state: currentStage,
        to_state: 'archived',
        actor_id: actorId || null,
        reason: reason || 'Card archived',
        is_override: false,
        metadata: {
          previous_state: currentStage,
          archived_at: now,
        },
      });

    if (logError) {
      console.error('[BoardArchiveService] Failed to insert archive log:', logError);
    }

    return { success: true };
  }

  /**
   * Restore an archived card back to its previous active stage. 100% undoable.
   */
  public static async restoreCard(params: {
    tenantId: string;
    boardType: BoardType;
    cardId: string;
    actorId?: string | null;
  }): Promise<{ success: boolean; error?: string; restoredStage?: string }> {
    const { tenantId, boardType, cardId, actorId } = params;
    const admin = createSupabaseAdminClient();
    const tableName = this.getTableName(boardType);
    const now = new Date().toISOString();

    // 1. Find the last transition log before archival to get previous stage
    const { data: logs } = await admin
      .from('board_transition_logs')
      .select('from_state, to_state, metadata')
      .eq('tenant_id', tenantId)
      .eq('card_id', cardId)
      .order('created_at', { ascending: false })
      .limit(5);

    let restoreToStage = 'todo';
    if (logs && logs.length > 0) {
      const archiveLog = logs.find(l => l.to_state === 'archived');
      if (archiveLog?.metadata?.previous_state) {
        restoreToStage = archiveLog.metadata.previous_state;
      } else if (archiveLog?.from_state && archiveLog.from_state !== 'archived') {
        restoreToStage = archiveLog.from_state;
      }
    }

    // 2. Clear archival flags and set restored stage
    const updates: Record<string, any> = {
      archived: false,
      archived_at: null,
      archived_by: null,
      entered_column_at: now,
      updated_at: now,
    };
    if (tableName === 'deals' || tableName === 'leads') {
      updates.stage = restoreToStage;
    } else if (tableName === 'tasks') {
      updates.status = restoreToStage;
    }

    const { error: restoreError } = await admin
      .from(tableName)
      .update(updates)
      .eq('id', cardId)
      .eq('tenant_id', tenantId);

    if (restoreError) {
      return { success: false, error: restoreError.message };
    }

    // 3. Write restore transition log
    await admin
      .from('board_transition_logs')
      .insert({
        tenant_id: tenantId,
        board_type: boardType,
        card_id: cardId,
        from_state: 'archived',
        to_state: restoreToStage,
        actor_id: actorId || null,
        reason: 'Restored from archive (Undo)',
        is_override: false,
        metadata: {
          restored_at: now,
        },
      });

    return { success: true, restoredStage: restoreToStage };
  }
}
