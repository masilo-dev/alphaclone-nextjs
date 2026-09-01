/**
 * Unified MCP execution gateway for high-risk external writes.
 * Resolves target, assigns action IDs, enforces idempotency, persists receipts.
 */

import { randomUUID } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { persistActionReceipt, findReceiptByIdempotency } from '@/lib/mcp/actionReceipts';
import type { ActionReceipt } from '@/lib/mcp/standardResponse';
import { processNormalizedTrigger } from '@/lib/bonnie/runtime/triggerGateway';

export type ExecutionTarget = {
  workspace_id: string;
  integration?: string | null;
  identity_type?: string | null;
  identity_id?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
};

export type ExecutionMode = 'draft' | 'execute_now' | 'schedule' | 'dry_run';

export type McpExecutionError = {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  remediation?: string;
};

export type ExecuteMcpWriteParams<TResult> = {
  tenantId: string;
  userId: string;
  tool: string;
  action: string;
  mode: ExecutionMode;
  target: ExecutionTarget;
  payload: Record<string, unknown>;
  idempotencyKey?: string | null;
  execute: (ctx: { actionId: string; correlationId: string }) => Promise<TResult>;
  buildReceipt: (result: TResult) => ActionReceipt | null;
  isSuccess?: (result: TResult) => boolean;
  mapError?: (result: TResult) => McpExecutionError | null;
};

export type ExecuteMcpWriteResult<TResult> = {
  ok: boolean;
  actionId: string;
  auditLogId: string | null;
  idempotencyKey: string;
  result?: TResult;
  receipt?: ActionReceipt | null;
  error?: McpExecutionError;
};

const ERROR_REMEDIATION: Record<string, string> = {
  TARGET_AMBIGUOUS:
    'Call get_social_identities and pass target.identity_id or identity_id for the intended destination.',
  MISSING_IDENTITY:
    'Call get_social_identities and pass identity_id for the publish destination.',
  AUTH_EXPIRED: 'Reconnect the integration under Dashboard → Integrations, then retry.',
  RATE_LIMITED: 'Wait and retry with the same idempotency_key.',
  PROVIDER_REJECTED: 'Review caption, media, and identity permissions; fix validation errors and retry.',
  VALIDATION_FAILED: 'Fix input fields reported in details and retry.',
  RETRYABLE_NETWORK_ERROR: 'Retry with the same idempotency_key after a short delay.',
  PUBLISH_IN_PROGRESS: 'Poll verify_social_post_published or retry after the in-flight publish completes.',
};

function enrichError(error: McpExecutionError): McpExecutionError {
  return {
    ...error,
    remediation: error.remediation || ERROR_REMEDIATION[error.code] || undefined,
  };
}

async function recordExternalAction(params: {
  tenantId: string;
  userId: string;
  actionId: string;
  tool: string;
  action: string;
  mode: ExecutionMode;
  target: ExecutionTarget;
  idempotencyKey: string;
  status: string;
  payload: Record<string, unknown>;
}): Promise<string | null> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('external_actions')
      .insert({
        tenant_id: params.tenantId,
        user_id: params.userId,
        action_id: params.actionId,
        tool_name: params.tool,
        action_type: params.action,
        execution_mode: params.mode,
        target: params.target,
        idempotency_key: params.idempotencyKey,
        status: params.status,
        payload: params.payload,
      })
      .select('id')
      .maybeSingle();
    if (error) {
      if (/relation.*does not exist|external_actions/i.test(error.message)) return null;
      console.warn('[executionGateway] external_actions insert failed:', error.message);
      return null;
    }
    return data?.id || null;
  } catch {
    return null;
  }
}

export async function executeMcpWrite<TResult>(
  params: ExecuteMcpWriteParams<TResult>
): Promise<ExecuteMcpWriteResult<TResult>> {
  const actionId = randomUUID();
  const correlationId = actionId;
  const idempotencyKey =
    params.idempotencyKey?.trim() || `mcp-${params.tool}-${randomUUID()}`;

  if (params.idempotencyKey) {
    const existing = await findReceiptByIdempotency({
      tenantId: params.tenantId,
      tool: params.tool,
      idempotencyKey,
    });
    if (existing?.success && existing.sanitized_output) {
      return {
        ok: true,
        actionId: String(existing.action_id || actionId),
        auditLogId: String(existing.id || ''),
        idempotencyKey,
        result: existing.sanitized_output as TResult,
        receipt: {
          action_id: String(existing.action_id || actionId),
          status: String(existing.final_status || 'completed'),
          provider: (existing.provider as string) || undefined,
          provider_reference: (existing.provider_reference as string) || undefined,
          timestamp: String(existing.completed_at || existing.created_at || new Date().toISOString()),
          live_url: (existing.live_url as string) || undefined,
          entity_id: (existing.entity_id as string) || undefined,
          entity_type: (existing.entity_type as string) || undefined,
        },
      };
    }
  }

  await processNormalizedTrigger({
    tenant_id: params.tenantId,
    user_id: params.userId,
    trigger_type: 'api_request',
    event_type: `mcp.${params.action}`,
    source: params.tool,
    correlation_id: correlationId,
    deduplication_key: idempotencyKey,
    payload: {
      tool: params.tool,
      action: params.action,
      mode: params.mode,
      target: params.target,
    },
  }).catch(() => undefined);

  const auditLogId = await recordExternalAction({
    tenantId: params.tenantId,
    userId: params.userId,
    actionId,
    tool: params.tool,
    action: params.action,
    mode: params.mode,
    target: params.target,
    idempotencyKey,
    status: 'running',
    payload: params.payload,
  });

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
      await persistActionReceipt({
        tenantId: params.tenantId,
        userId: params.userId,
        tool: params.tool,
        idempotencyKey,
        receipt: {
          action_id: actionId,
          status: 'failed',
          timestamp: new Date().toISOString(),
          entity_type: params.target.resource_type || undefined,
        },
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
        result,
        error,
      };
    }

    const receipt = params.buildReceipt(result);
    if (receipt) {
      receipt.action_id = receipt.action_id || actionId;
      await persistActionReceipt({
        tenantId: params.tenantId,
        userId: params.userId,
        tool: params.tool,
        idempotencyKey,
        receipt,
        success: true,
        sanitizedInput: { target: params.target, mode: params.mode },
        sanitizedOutput: result,
      }).catch(() => undefined);
    }

    return {
      ok: true,
      actionId,
      auditLogId,
      idempotencyKey,
      result,
      receipt,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Execution failed';
    const code =
      err instanceof Error && 'code' in err
        ? String((err as Error & { code: string }).code)
        : 'EXECUTION_FAILED';
    const error = enrichError({ code, message, retryable: /network|timeout|ECONN/i.test(message) });
    await persistActionReceipt({
      tenantId: params.tenantId,
      userId: params.userId,
      tool: params.tool,
      idempotencyKey,
      receipt: { action_id: actionId, status: 'failed', timestamp: new Date().toISOString() },
      success: false,
      errorCode: error.code,
      errorMessage: error.message,
    }).catch(() => undefined);
    return { ok: false, actionId, auditLogId, idempotencyKey, error };
  }
}

export function mapServiceErrorCode(code: string | undefined, message: string): McpExecutionError {
  const normalized = String(code || 'EXECUTION_FAILED').toUpperCase();
  const retryable = ['PUBLISH_IN_PROGRESS', 'RETRYABLE_NETWORK_ERROR', 'RATE_LIMITED'].includes(
    normalized
  );
  return enrichError({ code: normalized, message, retryable });
}
