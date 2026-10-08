import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { ActionReceipt } from '@/lib/mcp/standardResponse';
import { recordTenantEvent, type SourceModule } from '@/lib/events/tenantEventLogger';

import { sanitizeForAudit } from '@/lib/email/sanitizeEmailExecutionEvidence';
export { sanitizeForAudit } from '@/lib/email/sanitizeEmailExecutionEvidence';

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
    const isPending =
      params.receipt.status === 'pending_verification' ||
      params.receipt.status === 'running' ||
      params.receipt.status === 'executing' ||
      params.receipt.status === 'outcome_unknown' ||
      params.receipt.status === 'unknown_execution_state' ||
      params.receipt.verification_status === 'pending';

    const eventStatus = params.success
      ? 'SUCCESS'
      : isPending
      ? 'EXECUTING'
      : 'FAILED';

    const eventTitle = isPending
      ? `MCP In Progress: ${params.tool}`
      : `MCP Executed: ${params.tool}`;

    const eventDescription = params.success
      ? `Executed successfully. Entity: ${params.receipt.entity_type || 'N/A'} (${params.receipt.entity_id || 'N/A'})`
      : isPending
      ? `Execution in-flight or pending provider verification. Entity: ${params.receipt.entity_type || 'N/A'} (${params.receipt.entity_id || 'N/A'})`
      : `Execution failed: ${params.errorMessage || 'Unknown error'}`;

    const notificationLevel = params.success
      ? 'LEVEL_1_RECORD'
      : isPending
      ? 'LEVEL_1_RECORD'
      : 'LEVEL_3_IMMEDIATE';

    recordTenantEvent({
      tenantId: params.tenantId,
      actorId: params.userId || null,
      actorType: 'MCP',
      sourceModule: inferSourceModule(params.tool),
      action: params.tool,
      title: eventTitle,
      description: eventDescription,
      status: eventStatus,
      notificationLevel,
      evidence: {
        actionId: params.receipt.action_id,
        provider: params.receipt.provider,
        providerReference: params.receipt.provider_reference,
        liveUrl: params.receipt.live_url,
        verification: params.receipt.verification,
      },
      nextAction: {
        recommendedAction: params.success
          ? 'Action verified'
          : isPending
          ? 'Awaiting provider receipt'
          : 'Review failed tool execution details',
      },
    }).catch((evtErr) => console.warn('[actionReceipts] Failed to record tenant operational event:', evtErr));

    if (error) {
      // Idempotent replay
      if (params.idempotencyKey && /duplicate|unique/i.test(error.message)) {
        const { data: existing } = await supabase
          .from('mcp_action_receipts')
          .select('id, action_id, provider, provider_reference, live_url, entity_id, entity_type, verification')
          .eq('tenant_id', params.tenantId)
          .eq('tool', params.tool)
          .eq('idempotency_key', params.idempotencyKey)
          .maybeSingle();
        if (existing?.id) {
          await supabase.from('mcp_action_receipts').update({
            success: params.success,
            final_status: params.receipt.status,
            provider: params.receipt.provider || existing.provider || null,
            provider_reference: params.receipt.provider_reference || existing.provider_reference || null,
            live_url: params.receipt.live_url || existing.live_url || null,
            entity_id: params.receipt.entity_id || existing.entity_id || null,
            entity_type: params.receipt.entity_type || existing.entity_type || null,
            verification: { ...(existing.verification || {}), ...(params.receipt.verification || {}) },
            error_code: params.errorCode || null,
            error_message: params.errorMessage || null,
            sanitized_output: sanitizeForAudit(params.sanitizedOutput || {}),
          }).eq('id', existing.id).eq('tenant_id', params.tenantId);
        }
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
  const { data, error } = await supabase
    .from('mcp_action_receipts')
    .select('*')
    .eq('tenant_id', params.tenantId)
    .eq('tool', params.tool)
    .eq('idempotency_key', params.idempotencyKey)
    .order('created_at', { ascending: false }).limit(1)
    .maybeSingle();
  if (error) throw new Error('ACTION_RECEIPT_LOOKUP_FAILED');
  return data || null;
}
