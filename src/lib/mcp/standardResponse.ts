/**
 * Standard MCP response envelope — model-independent (ChatGPT, Claude, Cursor, Gemini, Bonnie, etc.).
 */

import { sanitizeUserFacingError } from '@/lib/copy/businessFriendlyErrors';

export type ActionReceipt = {
  action_id: string;
  status: string;
  provider?: string | null;
  provider_reference?: string | null;
  timestamp: string;
  entity_id?: string | null;
  entity_type?: string | null;
  live_url?: string | null;
  verification?: Record<string, unknown>;
  rollback_available?: boolean;
  retry_available?: boolean;
};

export type StandardMcpMeta = {
  tenant_id?: string;
  correlation_id?: string;
  idempotency_key?: string | null;
  rate_limit?: Record<string, unknown>;
  client?: string;
  protocol_version?: string;
  [key: string]: unknown;
};

export type StandardMcpSuccess<T = unknown> = {
  ok: true;
  tool: string;
  data: T;
  receipt: ActionReceipt | null;
  error: null;
  meta: StandardMcpMeta;
};

export type StandardMcpError = {
  ok: false;
  tool: string;
  data: null;
  receipt: null;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    approval_id?: string;
    details?: unknown;
  };
  meta: StandardMcpMeta;
};

export type StandardMcpResult<T = unknown> = StandardMcpSuccess<T> | StandardMcpError;

export const MCP_PROTOCOL_VERSION = '2025-06-18';
export const MCP_TOOL_CATALOG_VERSION = 'alphaclone-bos-social-2.0';

export function newActionId(): string {
  return crypto.randomUUID();
}

export function newCorrelationId(): string {
  return crypto.randomUUID();
}

export function standardOk<T>(
  tool: string,
  data: T,
  options?: {
    receipt?: Partial<ActionReceipt> | null;
    meta?: StandardMcpMeta;
  }
): StandardMcpSuccess<T> {
  const actionId = options?.receipt?.action_id || newActionId();
  const receipt: ActionReceipt | null =
    options?.receipt === null
      ? null
      : {
          action_id: actionId,
          status: options?.receipt?.status || 'completed',
          provider: options?.receipt?.provider ?? null,
          provider_reference: options?.receipt?.provider_reference ?? null,
          timestamp: options?.receipt?.timestamp || new Date().toISOString(),
          entity_id: options?.receipt?.entity_id ?? null,
          entity_type: options?.receipt?.entity_type ?? null,
          live_url: options?.receipt?.live_url ?? null,
          verification: options?.receipt?.verification || {},
          rollback_available: options?.receipt?.rollback_available ?? false,
          retry_available: options?.receipt?.retry_available ?? false,
        };

  return {
    ok: true,
    tool,
    data,
    receipt,
    error: null,
    meta: {
      correlation_id: options?.meta?.correlation_id || newCorrelationId(),
      protocol_version: MCP_PROTOCOL_VERSION,
      ...(options?.meta || {}),
    },
  };
}

export function standardError(
  tool: string,
  code: string,
  message: string,
  options?: {
    retryable?: boolean;
    approval_id?: string;
    details?: unknown;
    meta?: StandardMcpMeta;
  }
): StandardMcpError {
  const safeMessage = sanitizeUserFacingError(message, { tool });
  return {
    ok: false,
    tool,
    data: null,
    receipt: null,
    error: {
      code,
      message: safeMessage,
      retryable: options?.retryable ?? false,
      ...(options?.approval_id ? { approval_id: options.approval_id } : {}),
    },
    meta: {
      correlation_id: options?.meta?.correlation_id || newCorrelationId(),
      protocol_version: MCP_PROTOCOL_VERSION,
      ...(options?.meta || {}),
    },
  };
}

export function approvalRequiredError(
  tool: string,
  approvalId: string,
  summary: string,
  details?: Record<string, unknown>
): StandardMcpError {
  return standardError(tool, 'APPROVAL_REQUIRED', summary, {
    retryable: true,
    approval_id: approvalId,
    details: {
      approve_tool: 'approve_workflow_step',
      reject_tool: 'reject_workflow_step',
      risk_level: details?.risk_level || 'high',
      expires_at: details?.expires_at || null,
      action_summary: summary,
      ...(details || {}),
    },
  });
}
