import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { isEmailSuppressed } from '@/lib/email/suppression';
import { normalizeEmail, normalizePhone } from '@/lib/crm/identityNormalize';
import { isTerminalLeadStage, normalizeLeadPipelineStage } from '@/lib/crmPipelineStages';

export type OutreachEligibilityReason =
  | 'duplicate'
  | 'already_contacted'
  | 'already_in_campaign'
  | 'replied'
  | 'converted'
  | 'unsubscribed'
  | 'do_not_contact'
  | 'hard_bounce'
  | 'invalid_contact'
  | 'cooldown_active'
  | 'active_workflow_exists'
  | 'campaign_inactive'
  | 'consent_missing';

export type OutreachEligibilityResult = {
  eligible: boolean;
  reason: OutreachEligibilityReason | null;
  contact_id: string | null;
  lead_id: string | null;
  email: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REPLIED_STATUSES = new Set(['replied', 'positive_reply', 'meeting_booked']);
const CONTACTED_STATUSES = new Set(['sent', 'delivered', 'opened', 'clicked', ...REPLIED_STATUSES]);

export async function checkOutreachEligibility(
  contactId: string | null,
  campaignId: string | null,
  channel: 'email' | 'sms' | 'call' | 'linkedin' | 'whatsapp' | 'task',
  options: {
    tenantId: string;
    leadId?: string | null;
    email?: string | null;
    cooldownDays?: number;
    supabase?: SupabaseClient;
  },
): Promise<OutreachEligibilityResult> {
  const admin = options.supabase ?? createSupabaseAdminClient();
  const tenantId = options.tenantId;
  let email = normalizeEmail(options.email);
  let leadId = options.leadId || null;
  let resolvedContactId = contactId;

  if (leadId) {
    const { data: lead } = await admin
      .from('leads')
      .select('id, email, phone, stage, status, metadata, client_id, last_outreach_at, deleted_at')
      .eq('tenant_id', tenantId)
      .eq('id', leadId)
      .maybeSingle();
    if (lead?.deleted_at) {
      return { eligible: false, reason: 'invalid_contact', contact_id: resolvedContactId, lead_id: leadId, email };
    }
    if (lead) {
      email = email || normalizeEmail(lead.email);
      const stage = normalizeLeadPipelineStage(lead.stage);
      if (isTerminalLeadStage(stage) && stage === 'won') {
        return { eligible: false, reason: 'converted', contact_id: resolvedContactId, lead_id: leadId, email };
      }
      const meta = (lead.metadata || {}) as Record<string, unknown>;
      if (meta.do_not_contact === true || meta.doNotContact === true) {
        return { eligible: false, reason: 'do_not_contact', contact_id: resolvedContactId, lead_id: leadId, email };
      }
      if (options.cooldownDays && lead.last_outreach_at) {
        const last = new Date(String(lead.last_outreach_at)).getTime();
        const cutoff = Date.now() - options.cooldownDays * 24 * 60 * 60 * 1000;
        if (last >= cutoff) {
          return { eligible: false, reason: 'cooldown_active', contact_id: resolvedContactId, lead_id: leadId, email };
        }
      }
    }
  }

  if (resolvedContactId) {
    const { data: contact } = await admin
      .from('contacts')
      .select('id, email, status, metadata')
      .eq('tenant_id', tenantId)
      .eq('id', resolvedContactId)
      .is('deleted_at', null)
      .maybeSingle();
    if (contact) {
      email = email || normalizeEmail(contact.email);
      if (contact.status === 'unsubscribed') {
        return { eligible: false, reason: 'unsubscribed', contact_id: resolvedContactId, lead_id: leadId, email };
      }
      if (contact.status === 'bounced') {
        return { eligible: false, reason: 'hard_bounce', contact_id: resolvedContactId, lead_id: leadId, email };
      }
      const meta = (contact.metadata || {}) as Record<string, unknown>;
      if (meta.do_not_contact === true) {
        return { eligible: false, reason: 'do_not_contact', contact_id: resolvedContactId, lead_id: leadId, email };
      }
    }
  }

  if (channel === 'email') {
    if (!email || !EMAIL_RE.test(email)) {
      return { eligible: false, reason: 'invalid_contact', contact_id: resolvedContactId, lead_id: leadId, email };
    }
    const suppressed = await isEmailSuppressed(tenantId, email);
    if (suppressed) {
      const { data: suppression } = await admin
        .from('email_suppressions')
        .select('reason')
        .eq('tenant_id', tenantId)
        .eq('email', email)
        .maybeSingle();
      if (suppression?.reason === 'unsubscribe') {
        return { eligible: false, reason: 'unsubscribed', contact_id: resolvedContactId, lead_id: leadId, email };
      }
      return { eligible: false, reason: 'hard_bounce', contact_id: resolvedContactId, lead_id: leadId, email };
    }
  } else if (channel === 'sms' || channel === 'call' || channel === 'whatsapp') {
    const phone = normalizePhone(options.email);
    if (!phone && !leadId && !resolvedContactId) {
      return { eligible: false, reason: 'invalid_contact', contact_id: resolvedContactId, lead_id: leadId, email };
    }
  }

  if (campaignId) {
    const { data: campaign } = await admin
      .from('email_campaigns')
      .select('id, status')
      .eq('tenant_id', tenantId)
      .eq('id', campaignId)
      .maybeSingle();
    if (!campaign || ['paused', 'completed', 'cancelled', 'archived'].includes(String(campaign.status || '').toLowerCase())) {
      return { eligible: false, reason: 'campaign_inactive', contact_id: resolvedContactId, lead_id: leadId, email };
    }

    if (email) {
      const { data: inCampaign } = await admin
        .from('campaign_recipients')
        .select('id, status')
        .eq('tenant_id', tenantId)
        .eq('campaign_id', campaignId)
        .ilike('email', email)
        .maybeSingle();
      if (inCampaign) {
        return { eligible: false, reason: 'already_in_campaign', contact_id: resolvedContactId, lead_id: leadId, email };
      }

      const { data: priorSends } = await admin
        .from('campaign_recipients')
        .select('status')
        .eq('tenant_id', tenantId)
        .ilike('email', email)
        .in('status', Array.from(REPLIED_STATUSES));
      if (priorSends?.length) {
        return { eligible: false, reason: 'replied', contact_id: resolvedContactId, lead_id: leadId, email };
      }

      if (options.cooldownDays !== 0) {
        const { data: contacted } = await admin
          .from('campaign_recipients')
          .select('id')
          .eq('tenant_id', tenantId)
          .ilike('email', email)
          .in('status', Array.from(CONTACTED_STATUSES))
          .limit(1);
        if (contacted?.length) {
          return { eligible: false, reason: 'already_contacted', contact_id: resolvedContactId, lead_id: leadId, email };
        }
      }
    }
  }

  if (email || leadId || resolvedContactId) {
    const orParts: string[] = [];
    if (email) orParts.push(`email.eq.${email}`);
    if (leadId) orParts.push(`lead_id.eq.${leadId}`);
    if (resolvedContactId) orParts.push(`contact_id.eq.${resolvedContactId}`);
    if (orParts.length) {
      const { data: activeWorkflow } = await admin
        .from('outreach_sequence_enrollments')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .or(orParts.join(','))
        .limit(1);
      if (activeWorkflow?.length) {
        return { eligible: false, reason: 'active_workflow_exists', contact_id: resolvedContactId, lead_id: leadId, email };
      }
    }
  }

  return { eligible: true, reason: null, contact_id: resolvedContactId, lead_id: leadId, email };
}
