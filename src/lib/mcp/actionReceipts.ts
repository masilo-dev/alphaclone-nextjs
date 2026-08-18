import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { ActionReceipt } from '@/lib/mcp/standardResponse';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'api_key',
  'apikey',
  'secret',
  'body_html',
  'body_text',
  'body',
  'email_body',
  'oauth',
  'client_secret',
]);

export function sanitizeForAudit(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[truncated]';
  if (value == null) return value;
  if (typeof value === 'string') {
    if (value.length > 500) return `${value.slice(0, 200)}…[redacted ${value.length} chars]`;
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitizeForAudit(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase()) || /token|secret|password|authorization/i.test(k)) {
        out[k] = '[redacted]';
      } else {
        out[k] = sanitizeForAudit(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export async function persistActionReceipt(params: {
  tenantId: string;
  userId?: string | null;
  tool: string;
  correlationId?: string | null;
  idempotencyKey?: string | null;
  receipt: ActionReceipt;
  success: boolean;
  sanitizedInput?: unknown;
  sanitizedOutput?: unknown;
  errorCode?: string | null;
  errorMessage?: string | null;
}): Promise<string | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('mcp_action_receipts')
      .insert({
        tenant_id: params.tenantId,
        user_id: params.userId || null,
        correlation_id: params.correlationId || null,
        idempotency_key: params.idempotencyKey || null,
        tool: params.tool,
        action_id: params.receipt.action_id,
        entity_id: params.receipt.entity_id || null,
        entity_type: params.receipt.entity_type || null,
        success: params.success,
        final_status: params.receipt.status,
        provider: params.receipt.provider || null,
        provider_reference: params.receipt.provider_reference || null,
        live_url: params.receipt.live_url || null,
        verification: params.receipt.verification || {},
        rollback_available: params.receipt.rollback_available ?? false,
        retry_available: params.receipt.retry_available ?? false,
        error_code: params.errorCode || null,
        error_message: params.errorMessage || null,
        sanitized_input: sanitizeForAudit(params.sanitizedInput || {}),
        sanitized_output: sanitizeForAudit(params.sanitizedOutput || {}),
      })
      .select('id')
      .maybeSingle();
    if (error) {
      // Idempotent replay
      if (params.idempotencyKey && /duplicate|unique/i.test(error.message)) {
        const { data: existing } = await supabase
          .from('mcp_action_receipts')
          .select('id, action_id')
          .eq('tenant_id', params.tenantId)
          .eq('tool', params.tool)
          .eq('idempotency_key', params.idempotencyKey)
          .maybeSingle();
        return existing?.id || null;
      }
      // Schema fallback if optional columns (like correlation_id) are not present in DB
      if (error.code === 'PGRST204' || /column.*schema cache|could not find.*column/i.test(error.message)) {
        const { data: fallbackData } = await supabase
          .from('mcp_action_receipts')
          .insert({
            tenant_id: params.tenantId,
            user_id: params.userId || null,
            tool: params.tool,
            action_id: params.receipt.action_id,
            entity_id: params.receipt.entity_id || null,
            entity_type: params.receipt.entity_type || null,
            success: params.success,
            final_status: params.receipt.status,
            sanitized_input: sanitizeForAudit(params.sanitizedInput || {}),
            sanitized_output: sanitizeForAudit(params.sanitizedOutput || {}),
          })
          .select('id')
          .maybeSingle();
        return fallbackData?.id || null;
      }
      console.warn('[actionReceipts] persist failed:', error.message);
      return null;
    }
    return data?.id || null;
  } catch (err) {
    console.warn('[actionReceipts] persist error:', err);
    return null;
  }
}

export async function findReceiptByIdempotency(params: {
  tenantId: string;
  tool: string;
  idempotencyKey: string;
}): Promise<Record<string, unknown> | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('mcp_action_receipts')
    .select('*')
    .eq('tenant_id', params.tenantId)
    .eq('tool', params.tool)
    .eq('idempotency_key', params.idempotencyKey)
    .maybeSingle();
  return data || null;
}
