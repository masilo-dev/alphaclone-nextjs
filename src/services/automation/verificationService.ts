import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type VerificationStatus = 'verified' | 'pending' | 'failed' | 'unknown';

export type VerificationResult = {
  status: VerificationStatus;
  retryable: boolean;
  message: string;
  evidence: Record<string, unknown>;
};

export async function verifyLeadCreated(tenantId: string, leadId: string): Promise<VerificationResult> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('leads')
    .select('id, created_at, source')
    .eq('tenant_id', tenantId)
    .eq('id', leadId)
    .maybeSingle();
  if (error) {
    return { status: 'unknown', retryable: true, message: error.message, evidence: { lead_id: leadId } };
  }
  if (!data) {
    return { status: 'pending', retryable: true, message: 'Lead not found yet.', evidence: { lead_id: leadId } };
  }
  return {
    status: 'verified',
    retryable: false,
    message: 'Lead exists in CRM.',
    evidence: { lead_id: data.id, created_at: data.created_at, source: data.source },
  };
}

export async function verifyOutreachDelivery(
  tenantId: string,
  trackingId?: string,
  logId?: string
): Promise<VerificationResult> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('lead_outreach_log')
    .select('id, tracking_id, provider, status, sent_at, opened_at, clicked_at, error_message, updated_at')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (trackingId) query = query.eq('tracking_id', trackingId);
  if (logId) query = query.eq('id', logId);
  const { data, error } = await query.maybeSingle();
  if (error) return { status: 'unknown', retryable: true, message: error.message, evidence: { tracking_id: trackingId, log_id: logId } };
  if (!data) return { status: 'pending', retryable: true, message: 'Outreach log not found yet.', evidence: { tracking_id: trackingId, log_id: logId } };
  const status = String(data.status || '').toLowerCase();
  if (['sent', 'delivered', 'opened', 'clicked'].includes(status)) {
    return {
      status: 'verified',
      retryable: false,
      message: `Outreach status is ${status}.`,
      evidence: data as Record<string, unknown>,
    };
  }
  if (status === 'failed') {
    return {
      status: 'failed',
      retryable: true,
      message: 'Outreach failed.',
      evidence: data as Record<string, unknown>,
    };
  }
  return {
    status: 'pending',
    retryable: true,
    message: `Outreach status is ${status || 'unknown'}.`,
    evidence: data as Record<string, unknown>,
  };
}

export async function verifySocialPostPublished(
  tenantId: string,
  socialPostId: string
): Promise<VerificationResult> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('social_posts')
    .select('id, status, published_at, facebook_post_id, linkedin_post_urn')
    .eq('tenant_id', tenantId)
    .eq('id', socialPostId)
    .maybeSingle();
  if (error) return { status: 'unknown', retryable: true, message: error.message, evidence: { social_post_id: socialPostId } };
  if (!data) return { status: 'pending', retryable: true, message: 'Social post not found.', evidence: { social_post_id: socialPostId } };
  const status = String(data.status || '').toLowerCase();
  if (status === 'published' || data.published_at) {
    return { status: 'verified', retryable: false, message: 'Social post published.', evidence: data as Record<string, unknown> };
  }
  if (status === 'failed') return { status: 'failed', retryable: true, message: 'Social post failed.', evidence: data as Record<string, unknown> };
  return { status: 'pending', retryable: true, message: `Social post status is ${status || 'unknown'}.`, evidence: data as Record<string, unknown> };
}

export async function verifyInvoiceSent(tenantId: string, invoiceId: string): Promise<VerificationResult> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('invoices')
    .select('id, status, sent_at, updated_at')
    .eq('tenant_id', tenantId)
    .eq('id', invoiceId)
    .maybeSingle();
  if (error) return { status: 'unknown', retryable: true, message: error.message, evidence: { invoice_id: invoiceId } };
  if (!data) return { status: 'pending', retryable: true, message: 'Invoice not found.', evidence: { invoice_id: invoiceId } };
  const status = String(data.status || '').toLowerCase();
  if (status === 'sent' || status === 'paid' || data.sent_at) {
    return { status: 'verified', retryable: false, message: `Invoice status is ${status}.`, evidence: data as Record<string, unknown> };
  }
  return { status: 'pending', retryable: true, message: `Invoice status is ${status || 'unknown'}.`, evidence: data as Record<string, unknown> };
}

