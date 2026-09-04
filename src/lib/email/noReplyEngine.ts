import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { recordTenantEvent } from '@/lib/events/tenantEventLogger';

export interface ExpectedReplyTrackParams {
  tenantId: string;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  sourceId?: string;
  clientId?: string;
  leadId?: string;
  projectId?: string;
  opportunityId?: string;
  expectedResponseWindowHours?: number; // default 72h
  maxFollowUpsAllowed?: number; // default 3
}

export interface NoReplySummary {
  scanned: number;
  unanswered: number;
  eventsEmitted: number;
  items: Array<{
    id: string;
    recipientEmail: string;
    subject: string;
    daysWaiting: number;
    clientId?: string;
    leadId?: string;
    projectId?: string;
    suggestedAction: string;
  }>;
}

/**
 * Registers outbound email/communication as expecting a reply.
 */
export async function trackOutboundForReply(params: ExpectedReplyTrackParams): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const windowHours = params.expectedResponseWindowHours || 72;
  const deadline = new Date(Date.now() + windowHours * 3600 * 1000).toISOString();

  const { error } = await supabase.from('communication_slas').insert({
    tenant_id: params.tenantId,
    source_type: 'email',
    source_id: params.sourceId || null,
    client_id: params.clientId || null,
    contact_email: params.recipientEmail,
    subject: params.subject,
    received_at: new Date().toISOString(),
    response_deadline_at: deadline,
    status: 'WAITING_ON_CLIENT',
    sla_breached: false,
  });

  if (error) {
    console.warn('[noReplyEngine] Failed to track expected reply SLA:', error.message);
    return false;
  }

  return true;
}

/**
 * Scans tenant outbound communications to identify no-reply items requiring follow-up.
 */
export async function scanNoReplyEmails(tenantId: string): Promise<NoReplySummary> {
  const supabase = createSupabaseAdminClient();

  const { data: waitingItems } = await supabase
    .from('communication_slas')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'WAITING_ON_CLIENT')
    .lt('response_deadline_at', new Date().toISOString())
    .order('response_deadline_at', { ascending: true });

  const items = waitingItems || [];
  let eventsEmitted = 0;

  const resultItems: NoReplySummary['items'] = [];

  for (const item of items) {
    const receivedTime = new Date(item.received_at).getTime();
    const daysWaiting = Math.max(1, Math.round((Date.now() - receivedTime) / (1000 * 3600 * 24)));

    const { data: marked } = await supabase
      .from('communication_slas')
      .update({
        status: 'ESCALATED',
        sla_breached: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)
      .eq('tenant_id', tenantId)
      .eq('status', 'WAITING_ON_CLIENT')
      .eq('sla_breached', false)
      .select('id')
      .maybeSingle();

    if (!marked?.id) continue;

    const summaryItem = {
      id: item.id,
      recipientEmail: item.contact_email || 'Unknown',
      subject: item.subject || 'Follow-up expected',
      daysWaiting,
      clientId: item.client_id,
      suggestedAction: `Send follow-up email regarding "${item.subject || 'outreach'}"`,
    };

    resultItems.push(summaryItem);

    // Record operational event for no-reply detection
    const { success } = await recordTenantEvent({
      tenantId,
      sourceModule: 'EMAIL',
      action: 'NO_REPLY_DETECTED',
      title: `No response for ${daysWaiting} days from ${item.contact_email || 'recipient'}`,
      description: `Subject: ${item.subject}. Expected response window exceeded.`,
      clientId: item.client_id,
      contactId: item.contact_id,
      status: 'BLOCKED',
      notificationLevel: 'LEVEL_2_DIGEST',
      nextAction: {
        action: 'SEND_FOLLOW_UP',
        recommendedAction: summaryItem.suggestedAction,
      },
      evidence: {
        daysWaiting,
        originalSentAt: item.received_at,
        deadline: item.response_deadline_at,
      },
    });

    if (success) eventsEmitted++;
  }

  return {
    scanned: items.length,
    unanswered: items.length,
    eventsEmitted,
    items: resultItems,
  };
}
