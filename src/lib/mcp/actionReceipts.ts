import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { ActionReceipt } from '@/lib/mcp/standardResponse';
import { recordTenantEvent, type SourceModule } from '@/lib/events/tenantEventLogger';

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
  'content_base64',
  'file_base64',
  'image_base64',
  'media_base64',
  'base64',
  'data_url',
  'file_content',
  'binary',
]);

export function sanitizeForAudit(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[truncated]';
  if (value == null) return value;
  if (typeof value === 'string') {
    if (value.startsWith('data:') && value.includes('base64,')) {
      return `[data-url ~${Math.round((value.length * 3) / 4)} bytes]`;
    }
    if (value.length > 500) return `[redacted ${value.length} chars]`;
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

function inferSourceModule(toolName: string): SourceModule {
  const t = toolName.toLowerCase();
  if (t.includes('crm') || t.includes('lead') || t.includes('contact') || t.includes('customer')) return 'CRM';
  if (t.includes('social') || t.includes('linkedin') || t.includes('facebook') || t.includes('x_')) return 'SOCIAL';
  if (t.includes('email') || t.includes('outreach') || t.includes('mail')) return 'EMAIL';
  if (t.includes('invoice') || t.includes('payment') || t.includes('billing') || t.includes('accounting')) return 'INVOICES';
  if (t.includes('project') || t.includes('task')) return 'PROJECTS';
  if (t.includes('contract') || t.includes('proposal') || t.includes('quote')) return 'CONTRACTS';
  if (t.includes('meeting') || t.includes('calendar')) return 'MEETINGS';
  return 'MCP';
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

    // Mirror to tenant_operational_events for universal event timeline
    recordTenantEvent({
      tenantId: params.tenantId,
      actorId: params.userId || null,
      actorType: 'MCP',
      sourceModule: inferSourceModule(params.tool),
      action: params.tool,
      title: `MCP Executed: ${params.tool}`,
      description: params.success
        ? `Executed successfully. Entity: ${params.receipt.entity_type || 'N/A'} (${params.receipt.entity_id || 'N/A'})`
        : `Execution failed: ${params.errorMessage || 'Unknown error'}`,
      status: params.success ? 'SUCCESS' : 'FAILED',
      notificationLevel: params.success ? 'LEVEL_1_RECORD' : 'LEVEL_3_IMMEDIATE',
      evidence: {
        actionId: params.receipt.action_id,
        provider: params.receipt.provider,
        providerReference: params.receipt.provider_reference,
        liveUrl: params.receipt.live_url,
        verification: params.receipt.verification,
      },
      nextAction: {
        recommendedAction: params.success ? 'Action verified' : 'Review failed tool execution details',
      },
    }).catch((evtErr) => console.warn('[actionReceipts] Failed to record tenant operational event:', evtErr));

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
      // Schema fallback for compatibility stub tables missing MCP columns
      if (error.code === 'PGRST204' || /column.*schema cache|could not find.*column/i.test(error.message)) {
        const legacyPayload = {
          tool: params.tool,
          correlation_id: params.correlationId || null,
          idempotency_key: params.idempotencyKey || null,
          entity_id: params.receipt.entity_id || null,
          entity_type: params.receipt.entity_type || null,
          final_status: params.receipt.status,
          sanitized_input: sanitizeForAudit(params.sanitizedInput || {}),
          sanitized_output: sanitizeForAudit(params.sanitizedOutput || {}),
          verification: params.receipt.verification || {},
        };
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('mcp_action_receipts')
          .insert({
            tenant_id: params.tenantId,
            user_id: params.userId || null,
            action_id: params.receipt.action_id,
            provider: params.receipt.provider || null,
            type: params.tool,
            name: params.tool,
            success: params.success,
            payload: legacyPayload,
            metadata: {
              ...legacyPayload,
              provider_reference: params.receipt.provider_reference || null,
              live_url: params.receipt.live_url || null,
            },
          })
          .select('id')
          .maybeSingle();
        if (fallbackError) {
          console.warn('[actionReceipts] legacy persist failed:', fallbackError.message);
          return null;
        }
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
