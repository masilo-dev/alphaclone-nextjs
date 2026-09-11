import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getCalendlyConfig } from '@/services/calendly/calendlyIntegrationService';
import { upsertCalendlyContact } from '@/lib/calendly/calendlyApiClient';

export interface LinkedInLeadFormData {
  formId?: string;
  leadId?: string;
  campaignId?: string;
  campaignName?: string;
  accountId?: string;
  creativeId?: string;
  submittedAt?: string;
  email?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  jobTitle?: string;
  phoneNumber?: string;
  customAnswers?: Record<string, string>;
  rawResponse?: Record<string, unknown>;
}

/**
 * Parse a LinkedIn Lead Gen Form response payload into normalized contact fields and attribution properties.
 */
export function parseLinkedInLeadResponse(raw: Record<string, unknown>): LinkedInLeadFormData {
  const formId = (raw.formId || raw.leadFormUrn || raw.form_id || raw.formUrn) as string | undefined;
  const leadId = (raw.id || raw.leadFormResponseUrn || raw.response_id || raw.responseUrn || raw.leadResponseUrn) as string | undefined;
  const campaignId = (raw.campaignId || raw.campaign_id || raw.campaign) as string | undefined;
  const campaignName = (raw.campaignName || raw.campaign_name) as string | undefined;
  const accountId = (raw.accountId || raw.account_id || raw.account) as string | undefined;
  const creativeId = (raw.creativeId || raw.creative_id || raw.creative) as string | undefined;

  let submittedAt: string;
  if (typeof raw.submittedAt === 'number' || typeof raw.submittedAt === 'string') {
    const num = Number(raw.submittedAt);
    submittedAt = Number.isFinite(num) && num > 0 ? new Date(num).toISOString() : String(raw.submittedAt);
  } else {
    submittedAt = new Date().toISOString();
  }

  let email: string | undefined;
  let fullName: string | undefined;
  let firstName: string | undefined;
  let lastName: string | undefined;
  let companyName: string | undefined;
  let jobTitle: string | undefined;
  let phoneNumber: string | undefined;
  const customAnswers: Record<string, string> = {};

  const answers = Array.isArray(raw.answers)
    ? raw.answers
    : Array.isArray(raw.formResponse)
    ? raw.formResponse
    : Array.isArray(raw.questionResponses)
    ? raw.questionResponses
    : [];

  for (const item of answers) {
    if (!item || typeof item !== 'object') continue;
    const question = String(item.questionId || item.key || item.question || item.questionName || '').toLowerCase();
    const value = String(
      item.value ||
        item.answer ||
        (Array.isArray(item.values) ? item.values[0] : '') ||
        (Array.isArray(item.answers) ? item.answers[0] : '') ||
        ''
    ).trim();

    if (!value) continue;

    if (question.includes('email')) {
      email = value;
    } else if (question.includes('first') && question.includes('name')) {
      firstName = value;
    } else if (question.includes('last') && question.includes('name')) {
      lastName = value;
    } else if (question.includes('name') || question.includes('full_name')) {
      fullName = value;
    } else if (question.includes('company') || question.includes('organization')) {
      companyName = value;
    } else if (question.includes('title') || question.includes('role') || question.includes('job')) {
      jobTitle = value;
    } else if (question.includes('phone') || question.includes('mobile')) {
      phoneNumber = value;
    } else {
      customAnswers[question] = value;
    }
  }

  if (!fullName) {
    if (firstName || lastName) {
      fullName = [firstName, lastName].filter(Boolean).join(' ');
    }
  }

  return {
    formId,
    leadId,
    campaignId,
    campaignName,
    accountId,
    creativeId,
    submittedAt,
    email,
    fullName,
    firstName,
    lastName,
    companyName,
    jobTitle,
    phoneNumber,
    customAnswers,
    rawResponse: raw,
  };
}

/**
 * Ingest a parsed LinkedIn Lead into AlphaClone CRM leads table.
 * Strictly idempotent: checks stable LinkedIn lead response identifier first, then email deduplication.
 */
export async function syncLinkedInLeadToCrm(
  tenantId: string,
  parsedLead: LinkedInLeadFormData
): Promise<{ success: boolean; leadId?: string; deduplicated?: boolean; error?: string }> {
  try {
    const admin = createSupabaseAdminClient();
    const businessName = parsedLead.companyName || parsedLead.fullName || 'LinkedIn Lead';

    const attributionMetadata = {
      source: 'linkedin',
      source_type: 'lead_gen_form',
      linkedin_form_id: parsedLead.formId || 'UNKNOWN',
      linkedin_lead_response_id: parsedLead.leadId || 'UNKNOWN',
      linkedin_campaign_id: parsedLead.campaignId || 'UNKNOWN',
      linkedin_campaign_name: parsedLead.campaignName || 'UNKNOWN',
      linkedin_account_id: parsedLead.accountId || 'UNKNOWN',
      linkedin_creative_id: parsedLead.creativeId || 'UNKNOWN',
      submitted_at: parsedLead.submittedAt,
      job_title: parsedLead.jobTitle || null,
      phone_number: parsedLead.phoneNumber || null,
      custom_answers: parsedLead.customAnswers,
      raw: parsedLead.rawResponse,
    };

    // 1. Idempotency Check: Stable LinkedIn Lead Response Identifier
    if (parsedLead.leadId && parsedLead.leadId !== 'UNKNOWN') {
      const { data: existingByLeadId } = await admin
        .from('leads')
        .select('id, metadata')
        .eq('tenant_id', tenantId)
        .filter('metadata->>linkedin_lead_response_id', 'eq', parsedLead.leadId)
        .limit(1)
        .maybeSingle();

      if (existingByLeadId) {
        const existingMeta = (existingByLeadId.metadata as Record<string, unknown>) || {};
        await admin
          .from('leads')
          .update({
            updated_at: new Date().toISOString(),
            metadata: { ...existingMeta, ...attributionMetadata },
          })
          .eq('id', existingByLeadId.id);

        return { success: true, leadId: existingByLeadId.id, deduplicated: true };
      }
    }

    // 2. Secondary Deduplication Check: Contact Email Matching
    if (parsedLead.email) {
      const { data: existingByEmail } = await admin
        .from('leads')
        .select('id, metadata')
        .eq('tenant_id', tenantId)
        .eq('contact_email', parsedLead.email)
        .limit(1)
        .maybeSingle();

      if (existingByEmail) {
        const existingMeta = (existingByEmail.metadata as Record<string, unknown>) || {};
        await admin
          .from('leads')
          .update({
            updated_at: new Date().toISOString(),
            notes: `LinkedIn Lead Form submission synced on ${new Date().toLocaleDateString()}`,
            metadata: { ...existingMeta, ...attributionMetadata },
          })
          .eq('id', existingByEmail.id);

        return { success: true, leadId: existingByEmail.id, deduplicated: true };
      }
    }

    // 3. New CRM Lead Insertion
    const { data: inserted, error: insertError } = await admin
      .from('leads')
      .insert({
        tenant_id: tenantId,
        business_name: businessName,
        contact_name: parsedLead.fullName || 'LinkedIn User',
        contact_email: parsedLead.email || null,
        phone: parsedLead.phoneNumber || null,
        source: 'linkedin_lead_form',
        status: 'new',
        notes: `Submitted LinkedIn Lead Gen Form (Form ID: ${parsedLead.formId || 'UNKNOWN'})`,
        metadata: attributionMetadata,
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    // Bridge: Push contact to Calendly for scheduling if enabled
    if (parsedLead.email && parsedLead.fullName) {
      try {
        const calendlyConfig = await getCalendlyConfig(admin, tenantId);
        if (calendlyConfig?.enabled && calendlyConfig.accessToken) {
          await upsertCalendlyContact(tenantId, calendlyConfig, {
            name: parsedLead.fullName,
            email: parsedLead.email,
          });
        }
      } catch (calendlyErr) {
        console.warn('[LinkedInLeadGenSync] Calendly contact push skipped:', calendlyErr);
      }
    }

    return { success: true, leadId: inserted.id, deduplicated: false };
  } catch (err: any) {
    console.error('[LinkedInLeadGenSync] Error syncing lead:', err);
    return { success: false, error: err.message || 'Failed to sync lead' };
  }
}
