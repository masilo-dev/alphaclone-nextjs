import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { assertLeadStageTransition } from '@/lib/stageProgression';
import { normalizeLeadPipelineStage } from '@/lib/crmPipelineStages';
import { findReceiptByIdempotency, persistActionReceipt } from '@/lib/mcp/actionReceipts';
import { isUuid } from '@/lib/tenant/platformTenant';

export type RecordType = 'lead' | 'client' | 'contact' | 'invoice' | 'project' | 'task';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ExecutionStatus = 'QUEUED' | 'EXECUTING' | 'VERIFYING' | 'SUCCEEDED' | 'FAILED' | 'PARTIAL_SUCCESS';

export interface PreMutationSnapshot {
  id: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  will_update: boolean;
}

export interface BulkUpdateConfig {
  table: string;
  fields: string[];
  stateFields: string[];
}

export const CRM_UNIFIED_ALLOWLISTS: Record<RecordType, BulkUpdateConfig> = {
  lead: {
    table: 'leads',
    fields: ['status', 'stage', 'notes', 'priority', 'owner_id', 'industry', 'value'],
    stateFields: ['status', 'stage', 'priority', 'notes', 'value'],
  },
  client: {
    table: 'business_clients',
    fields: ['sales_stage', 'status', 'is_active', 'notes', 'industry', 'tier', 'assigned_to', 'owner_id'],
    stateFields: ['sales_stage', 'status', 'is_active', 'notes', 'tier'],
  },
  contact: {
    table: 'contacts',
    fields: ['status', 'role', 'department', 'is_primary', 'notes', 'title'],
    stateFields: ['status', 'role', 'department', 'is_primary', 'notes', 'title'],
  },
  invoice: {
    table: 'business_invoices',
    fields: ['status', 'lifecycle_status', 'payment_terms', 'notes', 'due_date'],
    stateFields: ['status', 'lifecycle_status', 'payment_terms', 'notes', 'due_date'],
  },
  project: {
    table: 'business_projects',
    fields: ['status', 'priority', 'health', 'notes', 'due_date', 'end_date'],
    stateFields: ['status', 'priority', 'health', 'notes', 'due_date', 'end_date'],
  },
  task: {
    table: 'tasks',
    fields: ['status', 'priority', 'assigned_to', 'due_date', 'category', 'notes'],
    stateFields: ['status', 'priority', 'assigned_to', 'due_date', 'category', 'notes'],
  },
};

export interface BulkUpdatePlanParams {
  tenantId: string;
  userId?: string | null;
  recordType: RecordType;
  recordIds: string[];
  patch: Record<string, unknown>;
  dryRun?: boolean;
  confirmExecute?: boolean;
  approved?: boolean;
  approvedBy?: string | null;
  reason?: string;
  idempotencyKey?: string | null;
}

export interface BulkUpdateResult {
  action_id: string;
  dry_run: boolean;
  record_type: RecordType;
  approval_status: ApprovalStatus;
  execution_status: ExecutionStatus;
  approved_by?: string | null;
  approved_at?: string | null;
  requested: number;
  eligible: number;
  processed: number;
  updated_or_sent: number;
  skipped: number;
  failed: number;
  missing_ids: string[];
  invalid_transitions: Array<{ id: string; reason: string }>;
  preview: PreMutationSnapshot[];
  updated_ids?: string[];
  reason: string | null;
  idempotent_replay?: boolean;
}

const CRM_BATCH_SIZE = 50;
const MAX_RECORDS = 250;

function getState(row: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  return Object.fromEntries(fields.map((field) => [field, row[field] ?? null]));
}

export class CrmBulkUpdateService {
  /**
   * Validate that all fields in the patch belong to the unified allowlist for this record type.
   */
  static validatePatch(recordType: RecordType, patch: Record<string, unknown>): void {
    const config = CRM_UNIFIED_ALLOWLISTS[recordType];
    if (!config) {
      throw new Error(`Unsupported record_type '${recordType}'. Must be one of: ${Object.keys(CRM_UNIFIED_ALLOWLISTS).join(', ')}`);
    }
    const keys = Object.keys(patch);
    if (keys.length === 0) {
      throw new Error('Patch must contain at least one field');
    }
    const unsupported = keys.filter((k) => !config.fields.includes(k));
    if (unsupported.length > 0) {
      throw new Error(`Unsupported patch fields for ${recordType}: ${unsupported.join(', ')}. Allowed: ${config.fields.join(', ')}`);
    }
  }

  /**
   * Main entrypoint: Plans, approves, and executes bulk updates with distinct truth states.
   */
  static async processBulkUpdate(params: BulkUpdatePlanParams): Promise<BulkUpdateResult> {
    const {
      tenantId,
      userId,
      recordType,
      recordIds: rawIds,
      patch,
      dryRun = true,
      confirmExecute = false,
      approved = false,
      approvedBy,
      reason,
      idempotencyKey,
    } = params;

    const isApproved = approved || confirmExecute;

    // 1. Validate inputs
    this.validatePatch(recordType, patch);
    const config = CRM_UNIFIED_ALLOWLISTS[recordType];
    const uniqueIds = Array.from(new Set(rawIds.map((id) => String(id || '').trim()).filter(Boolean)));

    if (uniqueIds.length === 0) {
      throw new Error('record_ids must contain at least one ID');
    }
    if (uniqueIds.length > MAX_RECORDS) {
      throw new Error(`record_ids cannot exceed ${MAX_RECORDS} items per batch`);
    }
    if (uniqueIds.some((id) => !isUuid(id))) {
      throw new Error('All record_ids must be valid UUIDs');
    }

    const actionId = crypto.randomUUID();
    const tool = `bulk_update_${recordType}s`;

    if (!dryRun) {
      if (!isApproved) {
        throw new Error('Set confirm_execute: true after reviewing a dry run before applying bulk changes');
      }
      if (!idempotencyKey) {
        throw new Error('idempotency_key is required when dry_run is false');
      }
    }

    // 2. Check Idempotency Replay
    if (idempotencyKey && !dryRun) {
      const prior = await findReceiptByIdempotency({ tenantId, tool, idempotencyKey });
      if (prior?.sanitized_output && typeof prior.sanitized_output === 'object') {
        return {
          ...(prior.sanitized_output as unknown as BulkUpdateResult),
          idempotent_replay: true,
        };
      }
    }

    // 3. Fetch current records to build pre-mutation audit snapshots
    const supabase = createSupabaseAdminClient() as any;
    const selectFields = Array.from(new Set(['id', 'tenant_id', ...config.fields, ...config.stateFields])).join(', ');
    const { data: rows, error: fetchErr } = await supabase
      .from(config.table)
      .select(selectFields)
      .eq('tenant_id', tenantId)
      .in('id', uniqueIds);

    if (fetchErr) {
      throw new Error(`Failed to load ${recordType} records: ${fetchErr.message}`);
    }

    const existingRows = (rows || []) as Array<Record<string, unknown>>;
    const byId = new Map(existingRows.map((r) => [String(r.id), r]));
    const missingIds = uniqueIds.filter((id) => !byId.has(id));
    const invalidTransitions: Array<{ id: string; reason: string }> = [];
    const eligibleIds: string[] = [];

    // 4. Validate domain rules (e.g., stage progression)
    for (const id of uniqueIds) {
      const row = byId.get(id);
      if (!row) continue;

      if (recordType === 'lead' && patch.stage !== undefined) {
        const fromStage = normalizeLeadPipelineStage(String(row.stage || 'lead'));
        const toStage = normalizeLeadPipelineStage(String(patch.stage));
        const transition = assertLeadStageTransition(fromStage, toStage);
        if (!transition.ok) {
          invalidTransitions.push({ id, reason: transition.message });
          continue;
        }
      }

      eligibleIds.push(id);
    }

    // 5. Build pre-mutation snapshots
    const preview: PreMutationSnapshot[] = eligibleIds.map((id) => {
      const row = byId.get(id) || {};
      const before = getState(row, config.stateFields);
      const after = { ...before, ...patch };
      return {
        id,
        before,
        after,
        will_update: true,
      };
    });

    // 6. Determine Approval Truth vs Execution Truth
    const approvalStatus: ApprovalStatus = isApproved ? 'APPROVED' : 'PENDING';
    const isReadyToExecute = !dryRun && isApproved;
    const executionStatus: ExecutionStatus = dryRun
      ? 'QUEUED'
      : isReadyToExecute
      ? 'EXECUTING'
      : 'QUEUED';

    const baseResult: BulkUpdateResult = {
      action_id: actionId,
      dry_run: dryRun,
      record_type: recordType,
      approval_status: approvalStatus,
      execution_status: executionStatus,
      approved_by: isApproved ? approvedBy || userId || 'system' : null,
      approved_at: isApproved ? new Date().toISOString() : null,
      requested: uniqueIds.length,
      eligible: eligibleIds.length,
      processed: dryRun ? 0 : eligibleIds.length,
      updated_or_sent: 0,
      skipped: missingIds.length + invalidTransitions.length,
      failed: 0,
      missing_ids: missingIds,
      invalid_transitions: invalidTransitions,
      preview,
      reason: reason || null,
    };

    // If dry run, or not approved, or no eligible IDs, stop here
    if (dryRun || !isApproved || eligibleIds.length === 0) {
      return baseResult;
    }

    // 7. Live Execution in Batches with Verification
    const updatePayload = {
      ...patch,
      updated_at: new Date().toISOString(),
    };

    let updatedCount = 0;
    const updatedIds: string[] = [];
    let executionError: Error | null = null;

    try {
      for (let offset = 0; offset < eligibleIds.length; offset += CRM_BATCH_SIZE) {
        const batchIds = eligibleIds.slice(offset, offset + CRM_BATCH_SIZE);
        const { data: updatedRows, error: updErr } = await supabase
          .from(config.table)
          .update(updatePayload)
          .eq('tenant_id', tenantId)
          .in('id', batchIds)
          .select('id');

        if (updErr) {
          throw new Error(`Batch update failed at offset ${offset}: ${updErr.message}`);
        }

        const ids = (updatedRows || []).map((r: any) => String(r.id));
        updatedIds.push(...ids);
        updatedCount += ids.length;
      }
    } catch (err: any) {
      executionError = err;
    }

    // 8. Determine final execution status
    let finalExecutionStatus: ExecutionStatus;
    if (executionError) {
      finalExecutionStatus = updatedCount > 0 ? 'PARTIAL_SUCCESS' : 'FAILED';
    } else if (updatedCount === eligibleIds.length) {
      finalExecutionStatus = 'SUCCEEDED';
    } else {
      finalExecutionStatus = 'PARTIAL_SUCCESS';
    }

    const finalResult: BulkUpdateResult = {
      ...baseResult,
      execution_status: finalExecutionStatus,
      updated_or_sent: updatedCount,
      failed: executionError ? eligibleIds.length - updatedCount : 0,
      updated_ids: updatedIds,
    };

    // 9. Persist Action Receipt with Full Audit Trail & Pre-Mutation Snapshots
    if (idempotencyKey) {
      await persistActionReceipt({
        tenantId,
        userId: userId || null,
        tool,
        idempotencyKey,
        receipt: {
          action_id: actionId,
          status: finalExecutionStatus === 'SUCCEEDED' ? 'completed' : finalExecutionStatus === 'PARTIAL_SUCCESS' ? 'completed' : 'failed',
          entity_type: `${recordType}_batch`,
          entity_id: actionId,
          timestamp: new Date().toISOString(),
          verification: {
            requested: finalResult.requested,
            processed: finalResult.processed,
            updated_or_sent: finalResult.updated_or_sent,
            skipped: finalResult.skipped,
            failed: finalResult.failed,
            approval_status: finalResult.approval_status,
            execution_status: finalResult.execution_status,
          },
        },
        success: !executionError,
        sanitizedInput: {
          recordType,
          recordIds: uniqueIds,
          patch,
          reason,
          approval_status: approvalStatus,
        },
        sanitizedOutput: {
          ...finalResult,
          pre_mutation_snapshots_count: preview.length,
        },
        errorMessage: executionError ? executionError.message : null,
      });
    }

    if (executionError && updatedCount === 0) {
      throw executionError;
    }

    return finalResult;
  }
}
