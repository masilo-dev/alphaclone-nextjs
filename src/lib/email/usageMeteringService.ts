import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { recordSuccessfulUsage } from '@/lib/entitlements/meteringService';
import { quotaService, type QuotaResourceType } from '@/services/quotaService';
import type { EmailGatewayCategory } from '@/lib/email/emailGateway';

export type UsageOperationCategory =
  | 'email_new_outbound'
  | 'email_reply'
  | 'email_campaign'
  | 'email_transactional'
  | 'mailbox_read'
  | 'mailbox_sync'
  | 'email_failed'
  | 'mcp_business_success'
  | 'mcp_read';

const chargedKeys = new Set<string>();

function chargeKey(tenantId: string, idempotencyKey?: string | null): string {
  return `${tenantId}:${idempotencyKey || 'none'}`;
}

function quotaResourceForSend(category: EmailGatewayCategory, isReply: boolean): QuotaResourceType {
  if (isReply) return 'email_replies';
  if (category === 'marketing' || category === 'outreach') return 'outreach_actions';
  if (
    category === 'transactional' ||
    category === 'invoice_payment' ||
    category === 'contract_document' ||
    category === 'booking_calendar' ||
    category === 'account_security'
  ) {
    return 'email_transactional';
  }
  return 'emails_sent';
}

export async function recordUsageEvent(params: {
  tenantId: string;
  userId?: string;
  operationId?: string;
  initiationSource: string;
  businessAction: UsageOperationCategory;
  provider?: string;
  success: boolean;
  quotaCharged: boolean;
  quotaReason?: string;
  failureFingerprint?: string;
  attemptNumber?: number;
  workflowId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    const operationId = params.operationId?.trim() || null;
    const row = {
      tenant_id: params.tenantId,
      user_id: params.userId || null,
      operation_id: operationId,
      initiation_source: params.initiationSource,
      business_action: params.businessAction,
      provider: params.provider || null,
      success: params.success,
      quota_charged: params.quotaCharged,
      quota_reason: params.quotaReason || null,
      failure_fingerprint: params.failureFingerprint || null,
      attempt_number: params.attemptNumber || 1,
      workflow_id: params.workflowId || null,
      metadata: params.metadata || {},
    };

    const { error } = await supabase.from('tenant_usage_events').insert(row);
    if (error && operationId && /duplicate|unique|23505/i.test(error.message)) {
      return;
    }
    if (error) {
      console.warn('[usageMetering] recordUsageEvent failed:', error.message);
    }
  } catch (err) {
    console.warn('[usageMetering] recordUsageEvent error:', err);
  }
}

export async function recordSuccessfulEmailSend(params: {
  tenantId: string;
  userId?: string;
  category: EmailGatewayCategory;
  isReply?: boolean;
  initiationSource: string;
  idempotencyKey?: string;
  provider?: string;
  operationId?: string;
}): Promise<boolean> {
  const key = chargeKey(params.tenantId, params.idempotencyKey || params.operationId);
  if (chargedKeys.has(key)) return false;

  const resource = quotaResourceForSend(params.category, Boolean(params.isReply));
  const userId = params.userId || params.tenantId;

  const recorded = await recordSuccessfulUsage({
    tenantId: params.tenantId,
    userId,
    resource,
    amount: 1,
    operationId: params.operationId || params.idempotencyKey,
    initiationSource: params.initiationSource,
    metadata: { provider: params.provider, category: params.category },
  });

  if (!recorded.allowed && !recorded.skipped) {
    await recordUsageEvent({
      tenantId: params.tenantId,
      userId: params.userId,
      operationId: params.operationId || params.idempotencyKey,
      initiationSource: params.initiationSource,
      businessAction: params.isReply
        ? 'email_reply'
        : params.category === 'marketing' || params.category === 'outreach'
          ? 'email_campaign'
          : resource === 'email_transactional'
            ? 'email_transactional'
            : 'email_new_outbound',
      provider: params.provider,
      success: false,
      quotaCharged: false,
      quotaReason: recorded.reason || 'Quota limit reached',
    });
    return false;
  }

  const quotaCharged = recorded.charged || recorded.skipped;
  if (quotaCharged) chargedKeys.add(key);

  await recordUsageEvent({
    tenantId: params.tenantId,
    userId: params.userId,
    operationId: params.operationId || params.idempotencyKey,
    initiationSource: params.initiationSource,
    businessAction: params.isReply
      ? 'email_reply'
      : params.category === 'marketing' || params.category === 'outreach'
        ? 'email_campaign'
        : resource === 'email_transactional'
          ? 'email_transactional'
          : 'email_new_outbound',
    provider: params.provider,
    success: true,
    quotaCharged: Boolean(recorded.charged),
    quotaReason: recorded.charged
      ? `Successful ${resource} after provider accepted delivery`
      : recorded.reason || 'Quota not enforced',
  });

  return Boolean(recorded.charged);
}

export async function recordFailedEmailAttempt(params: {
  tenantId: string;
  userId?: string;
  initiationSource: string;
  failureFingerprint: string;
  attemptNumber?: number;
  provider?: string;
}): Promise<void> {
  await recordUsageEvent({
    tenantId: params.tenantId,
    userId: params.userId,
    initiationSource: params.initiationSource,
    businessAction: 'email_failed',
    provider: params.provider,
    success: false,
    quotaCharged: false,
    quotaReason: 'Failed sends are never charged',
    failureFingerprint: params.failureFingerprint,
    attemptNumber: params.attemptNumber,
  });
}

export async function checkEmailSendQuotaAvailable(params: {
  tenantId: string;
  userId?: string;
  category: EmailGatewayCategory;
  isReply?: boolean;
}): Promise<{ allowed: boolean; message?: string; resource: QuotaResourceType }> {
  const resource = quotaResourceForSend(params.category, Boolean(params.isReply));
  const summary = await quotaService.getTenantUsageSummary(params.tenantId, params.userId || params.tenantId);
  const metric = summary.metrics[resource];
  if (!metric) return { allowed: true, resource };
  if (metric.limit < 0) return { allowed: true, resource };
  if (metric.remaining <= 0) {
    return {
      allowed: false,
      resource,
      message: `Daily limit reached for ${resource.replace(/_/g, ' ')} (${metric.current}/${metric.limit}).`,
    };
  }
  return { allowed: true, resource };
}
