/**
 * Source-neutral domain external write primitive.
 * MCP, UI, cron, workers, and API adapters call this — not the reverse.
 */

import { randomUUID } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { persistActionReceipt, findReceiptByIdempotency } from '@/lib/mcp/actionReceipts';
import type { ActionReceipt } from '@/lib/mcp/connector/types';
import { stripHeavyPayloadFields } from '@/lib/media/stripHeavyPayload';
import type { PolicySource } from '@/lib/ai/ToolPolicyGate';
import { normalizeExecutionErrorCode } from '@/lib/execution/executionErrorTaxonomy';
import {
  type CanonicalExecutionState,
  normalizeCanonicalExecutionState,
  isAmbiguousTransportError,
} from '@/lib/execution/executionStates';

export type ExecutionTarget = {
  workspace_id: string;
  integration?: string | null;
  identity_type?: string | null;
  identity_id?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
};

export type ExecutionMode = 'draft' | 'execute_now' | 'schedule' | 'dry_run';

export type DomainExecutionError = {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  remediation?: string;
};

export type ExecuteDomainExternalWriteParams<TResult> = {
  tenantId: string;
  userId: string;
  /** Logical capability name (usually MCP tool name, e.g. send_email). */
  capability: string;
  action: string;
  mode: ExecutionMode;
  target: ExecutionTarget;
  payload: Record<string, unknown>;
  idempotencyKey?: string | null;
  executionSource: PolicySource | string;
  mirrorToDurableRuntime?: boolean;
  execute: (ctx: { actionId: string; correlationId: string }) => Promise<TResult>;
  buildReceipt: (result: TResult) => ActionReceipt | null;
  isSuccess?: (result: TResult) => boolean;
  mapError?: (result: TResult) => DomainExecutionError | null;
};

export type ExecuteDomainExternalWriteResult<TResult> = {
  ok: boolean;
  actionId: string;
  auditLogId: string | null;
  idempotencyKey: string;
  status: CanonicalExecutionState;
  result?: TResult;
  receipt?: ActionReceipt | null;
  error?: DomainExecutionError;
};

const ERROR_REMEDIATION: Record<string, string> = {
  TARGET_AMBIGUOUS:
    'Choose Personal, Organization, or Page. If more than one matching identity exists, call connected_accounts or get_social_identities and pass identity_id.',
  MISSING_IDENTITY:
    'Call connected_accounts or get_social_identities and choose the publish destination.',
  IDENTITY_NOT_FOUND:
    'Use identity_id from connected_accounts or get_social_identities — not the raw Facebook page id or LinkedIn org id.',
  IDENTITY_NOT_PUBLISHABLE:
    'Choose an identity with can_publish=true or reconnect the integration with publish permissions.',
  AUTH_EXPIRED: 'Reconnect the integration under Dashboard → Integrations, then retry.',
  OAUTH_EXPIRED: 'Reconnect the integration under Dashboard → Integrations, then retry.',
  PERMISSION_MISSING: 'Reconnect the integration and grant the required publish scopes.',
  RATE_LIMITED: 'Wait and retry with the same idempotency_key.',
  PROVIDER_REJECTED: 'Review caption, media, and identity permissions; fix validation errors and retry.',
  PROVIDER_TIMEOUT: 'Retry with the same idempotency_key after a short delay.',
  VALIDATION_FAILED: 'Fix input fields reported in details and retry.',
  RETRYABLE_NETWORK_ERROR: 'Retry with the same idempotency_key after a short delay.',
  PUBLISH_IN_PROGRESS: 'Poll verify_social_post_published or retry after the in-flight publish completes.',
  OUTCOME_UNKNOWN: 'Reconcile the original provider write. Do not retry until absence is positively established.',
};

async function updateExternalAction(actionId: string, patch: Record<string, unknown>): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from('external_actions').update(patch).eq('action_id', actionId);
}

function enrichError(error: DomainExecutionError): DomainExecutionError {
  const code = normalizeExecutionErrorCode(error.code);
  return {
    ...error,
    code,
    remediation: error.remediation || ERROR_REMEDIATION[error.code] || ERROR_REMEDIATION[code] || undefined,
  };
}

async function recordExternalAction(params: {
  tenantId: string;
  userId: string;
  actionId: string;
  capability: string;
  action: string;
  mode: ExecutionMode;
  target: ExecutionTarget;
  idempotencyKey: string;
  status: string;
  payload: Record<string, unknown>;
  executionSource: string;
}): Promise<string | null> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('external_actions')
      .insert({
        tenant_id: params.tenantId,
        user_id: params.userId,
        action_id: params.actionId,
        tool_name: params.capability,
        action_type: params.action,
        execution_mode: params.mode,
        target: params.target,
        idempotency_key: params.idempotencyKey,
        status: params.status,
        payload: stripHeavyPayloadFields({
          ...params.payload,
          execution_source: params.executionSource,
        }),
      })
      .select('id')
      .maybeSingle();
    if (error) {
      if (/relation.*does not exist|external_actions/i.test(error.message)) return null;
      console.warn('[domainExternalWrite] external_actions insert failed:', error.message);
      return null;
    }
    return data?.id || null;
  } catch {
    return null;
  }
}

async function mirrorWriteToDurableRuntime(params: {
  tenantId: string;
  userId: string;
  capability: string;
  action: string;
  mode: ExecutionMode;
  target: ExecutionTarget;
  correlationId: string;
  idempotencyKey: string;
}) {
  try {
    const { processNormalizedTrigger } = await import('@/lib/bonnie/runtime/triggerGateway');
    await processNormalizedTrigger({
      tenant_id: params.tenantId,
      user_id: params.userId,
      trigger_type: 'api_request',
      event_type: `domain.${params.action}`,
      source: params.capability,
      correlation_id: params.correlationId,
      deduplication_key: params.idempotencyKey,
      payload: {
        tool: params.capability,
        action: params.action,
        mode: params.mode,
        target: params.target,
      },
    });
  } catch (error) {
    console.warn('[domainExternalWrite] durable mirror failed:', error);
  }
}

function toDbExternalActionStatus(state: CanonicalExecutionState): string {
  switch (state) {
    case 'queued':
      return 'queued';
    case 'executing':
      return 'running';
    case 'pending_verification':
      return 'outcome_unknown';
    case 'succeeded':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'outcome_unknown';
  }
}

export async function executeDomainExternalWrite<TResult>(
  params: ExecuteDomainExternalWriteParams<TResult>
): Promise<ExecuteDomainExternalWriteResult<TResult>> {
  const actionId = randomUUID();
  const correlationId = actionId;
  const idempotencyKey =
    params.idempotencyKey?.trim() || `domain-${params.capability}-${randomUUID()}`;

  if (params.idempotencyKey) {
    const existing = await findReceiptByIdempotency({
      tenantId: params.tenantId,
      tool: params.capability,
      idempotencyKey,
    });
    if (existing) {
      const existingCanonical = normalizeCanonicalExecutionState(
        existing.final_status as string | null | undefined
      );
      if (existingCanonical === 'pending_verification' || existingCanonical === 'executing') {
        return {
          ok: false,
          actionId: String(existing.action_id || actionId),
          auditLogId: String(existing.id),
          idempotencyKey,
          status: existingCanonical,
          error: enrichError({
            code: 'PENDING_VERIFICATION',
            message: 'Previous execution is unresolved or in-flight. Check execution status or reconcile before retrying.',
            retryable: false,
          }),
        };
      }
      if (existingCanonical === 'succeeded' && existing.sanitized_output) {
        return {
          ok: true,
          actionId: String(existing.action_id || actionId),
          auditLogId: String(existing.id || ''),
          idempotencyKey,
          status: 'succeeded',
          result: existing.sanitized_output as TResult,
          receipt: {
            action_id: String(existing.action_id || actionId),
            execution_id: String(existing.action_id || actionId),
            correlation_id: String(existing.correlation_id || existing.action_id || actionId),
            status: 'succeeded',
            operation: params.capability,
            resource_id: (existing.entity_id as string) || undefined,
            provider: (existing.provider as string) || undefined,
            provider_reference: (existing.provider_reference as string) || undefined,
            started_at: String(existing.created_at || new Date().toISOString()),
            completed_at: String(existing.completed_at || existing.created_at || new Date().toISOString()),
            verified_at: String(existing.completed_at || existing.created_at || new Date().toISOString()),
            verification_status: 'verified',
            timestamp: String(existing.completed_at || existing.created_at || new Date().toISOString()),
            live_url: (existing.live_url as string) || undefined,
            entity_id: (existing.entity_id as string) || undefined,
            entity_type: (existing.entity_type as string) || undefined,
          },
        };
      }
    }
  }

  if (params.mirrorToDurableRuntime === true) {
    void mirrorWriteToDurableRuntime({
      tenantId: params.tenantId,
      userId: params.userId,
      capability: params.capability,
      action: params.action,
      mode: params.mode,
      target: params.target,
      correlationId,
      idempotencyKey,
    });
  }

  const auditLogId = await recordExternalAction({
    tenantId: params.tenantId,
    userId: params.userId,
    actionId,
    capability: params.capability,
    action: params.action,
    mode: params.mode,
    target: params.target,
    idempotencyKey,
    status: toDbExternalActionStatus('executing'),
    payload: {
      ...params.payload,
      canonical_state: 'executing',
    },
    executionSource: String(params.executionSource),
  });

  const nowIso = new Date().toISOString();
  await persistActionReceipt({
    tenantId: params.tenantId,
    userId: params.userId,
    tool: params.capability,
    idempotencyKey,
    correlationId,
    receipt: {
      action_id: actionId,
      execution_id: actionId,
      correlation_id: correlationId,
      status: 'executing',
      operation: params.capability,
      resource_id: params.target.resource_id || undefined,
      started_at: nowIso,
      timestamp: nowIso,
      entity_type: params.target.resource_type || undefined,
    },
    success: false,
    sanitizedInput: { target: params.target, mode: params.mode, execution_source: params.executionSource },
    sanitizedOutput: null,
  }).catch(() => undefined);

  try {
    const result = await params.execute({ actionId, correlationId });
    const isSuccess = params.isSuccess ? params.isSuccess(result) : true;
    const mappedError = !isSuccess ? params.mapError?.(result) : null;

    if (!isSuccess || mappedError) {
      const error = enrichError(
        mappedError || {
          code: 'EXECUTION_FAILED',
          message: 'Write action failed',
          details: result,
        }
      );
      const outcomeUnknown =
        isAmbiguousTransportError(error) ||
        error.code === 'OUTCOME_UNKNOWN' ||
        error.code === 'UNKNOWN_EXECUTION_STATE' ||
        normalizeExecutionErrorCode(error.code) === 'UNKNOWN_EXECUTION_STATE';

      const canonicalStatus: CanonicalExecutionState = outcomeUnknown ? 'pending_verification' : 'failed';
      const dbStatus = toDbExternalActionStatus(canonicalStatus);

      await updateExternalAction(actionId, {
        status: dbStatus,
        failure_reason: error.message,
        payload: {
          ...params.payload,
          canonical_state: canonicalStatus,
        },
      }).catch(() => undefined);

      const errorReceipt: ActionReceipt = {
        action_id: actionId,
        execution_id: actionId,
        correlation_id: correlationId,
        status: canonicalStatus,
        operation: params.capability,
        resource_id: params.target.resource_id || undefined,
        started_at: nowIso,
        timestamp: new Date().toISOString(),
        entity_type: params.target.resource_type || undefined,
        error_code: error.code,
        error_message: error.message,
        verification_status: outcomeUnknown ? 'pending' : 'failed',
      };

      await persistActionReceipt({
        tenantId: params.tenantId,
        userId: params.userId,
        tool: params.capability,
        idempotencyKey,
        correlationId,
        receipt: errorReceipt,
        success: false,
        sanitizedInput: { target: params.target, mode: params.mode },
        sanitizedOutput: result,
        errorCode: error.code,
        errorMessage: error.message,
      }).catch(() => undefined);

      return {
        ok: false,
        actionId,
        auditLogId,
        idempotencyKey,
        status: canonicalStatus,
        result,
        receipt: errorReceipt,
        error: outcomeUnknown
          ? enrichError({
              code: 'PENDING_VERIFICATION',
              message: 'Execution submitted but provider confirmation is pending verification. Do not retry without checking status.',
              retryable: false,
            })
          : error,
      };
    }

    const receipt = params.buildReceipt(result);
    const completedIso = new Date().toISOString();
    if (receipt) {
      receipt.action_id = receipt.action_id || actionId;
      receipt.execution_id = receipt.execution_id || receipt.action_id || actionId;
      receipt.correlation_id = receipt.correlation_id || correlationId;
      receipt.status = 'succeeded';
      receipt.operation = receipt.operation || params.capability;
      receipt.started_at = receipt.started_at || nowIso;
      receipt.completed_at = completedIso;
      receipt.verified_at = completedIso;
      receipt.verification_status = 'verified';

      await persistActionReceipt({
        tenantId: params.tenantId,
        userId: params.userId,
        tool: params.capability,
        idempotencyKey,
        correlationId,
        receipt,
        success: true,
        sanitizedInput: { target: params.target, mode: params.mode },
        sanitizedOutput: result,
      }).catch(() => undefined);

      await updateExternalAction(actionId, {
        status: toDbExternalActionStatus('succeeded'),
        provider: receipt.provider || null,
        provider_reference: receipt.provider_reference || null,
        live_url: receipt.live_url || null,
        completed_at: completedIso,
        payload: {
          ...params.payload,
          canonical_state: 'succeeded',
        },
      }).catch(() => undefined);
    }

    return {
      ok: true,
      actionId,
      auditLogId,
      idempotencyKey,
      status: 'succeeded',
      result,
      receipt,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Execution failed';
    const code =
      err instanceof Error && 'code' in err
        ? String((err as Error & { code: string }).code)
        : 'EXECUTION_FAILED';
    const error = enrichError({ code, message, retryable: /network|timeout|ECONN/i.test(message) });
    const outcomeUnknown =
      isAmbiguousTransportError(err) ||
      error.code === 'UNKNOWN_EXECUTION_STATE' ||
      error.code === 'OUTCOME_UNKNOWN' ||
      /network|timeout|abort|socket|ECONN/i.test(message);

    const canonicalStatus: CanonicalExecutionState = outcomeUnknown ? 'pending_verification' : 'failed';
    const dbStatus = toDbExternalActionStatus(canonicalStatus);

    await updateExternalAction(actionId, {
      status: dbStatus,
      failure_reason: message,
      payload: {
        ...params.payload,
        canonical_state: canonicalStatus,
      },
    }).catch(() => undefined);

    const errorReceipt: ActionReceipt = {
      action_id: actionId,
      execution_id: actionId,
      correlation_id: correlationId,
      status: canonicalStatus,
      operation: params.capability,
      resource_id: params.target.resource_id || undefined,
      started_at: nowIso,
      timestamp: new Date().toISOString(),
      error_code: error.code,
      error_message: message,
      verification_status: outcomeUnknown ? 'pending' : 'failed',
    };

    await persistActionReceipt({
      tenantId: params.tenantId,
      userId: params.userId,
      tool: params.capability,
      idempotencyKey,
      correlationId,
      receipt: errorReceipt,
      success: false,
      errorCode: error.code,
      errorMessage: error.message,
    }).catch(() => undefined);

    return {
      ok: false,
      actionId,
      auditLogId,
      idempotencyKey,
      status: canonicalStatus,
      receipt: errorReceipt,
      error: outcomeUnknown
        ? enrichError({
            code: 'PENDING_VERIFICATION',
            message: 'Execution request timed out or network disconnected. The action is pending verification.',
            retryable: false,
          })
        : error,
    };
  }
}

export function mapServiceErrorCode(code: string | undefined, message: string): DomainExecutionError {
  const normalized = normalizeExecutionErrorCode(code);
  const retryable = ['PUBLISH_IN_PROGRESS', 'RETRYABLE_NETWORK_ERROR', 'PROVIDER_RATE_LIMIT'].includes(
    normalized
  );
  return enrichError({ code: normalized, message, retryable });
}
