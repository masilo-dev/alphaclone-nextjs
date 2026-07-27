import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getCalendlyConfig } from '@/services/calendly/calendlyIntegrationService';
import { upsertCalendlyContact } from '@/lib/calendly/calendlyApiClient';

export interface LinkedInLeadFormData {
  formId?: string;
  leadId?: string;
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
  Parse a LinkedIn Lead Gen Form response payload into normalized contact fields.
 */
export function parseLinkedInLeadResponse(raw: Record<string, unknown>): LinkedInLeadFormData {
  const formId = (raw.formId || raw.leadFormUrn || raw.form_id) as string | undefined;
  const leadId = (raw.id || raw.leadFormResponseUrn || raw.response_id) as string | undefined;
  const submittedAt = raw.submittedAt ? new Date(Number(raw.submittedAt)).toISOString() : new Date().toISOString();

  let email: string | undefined;
  let fullName: string | undefined;
  let firstName: string | undefined;
  let lastName: string | undefined;
  let companyName: string | undefined;
  let jobTitle: string | undefined;
  let phoneNumber: string | undefined;
  const customAnswers: Record<string, string> = {};

  const answers = Array.isArray(raw.answers) ? raw.answers : Array.isArray(raw.formResponse) ? raw.formResponse : [];

  for (const item of answers) {
    if (!item || typeof item !== 'object') continue;
    const question = String(item.questionId || item.key || item.question || '').toLowerCase();
    const value = String(item.value || item.answer || item.values?.[0] || '').trim();

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
 */
export async function syncLinkedInLeadToCrm(
  tenantId: string,
  parsedLead: LinkedInLeadFormData
): Promise<{ success: boolean; leadId?: string; error?: string }> {
  try {
    const admin = createSupabaseAdminClient();
    const businessName = parsedLead.companyName || parsedLead.fullName || 'LinkedIn Lead';

    const metadataPayload = {
      linkedin_form_id: parsedLead.formId,
      linkedin_lead_response_id: parsedLead.leadId,
      submitted_at: parsedLead.submittedAt,
      job_title: parsedLead.jobTitle,
      phone_number: parsedLead.phoneNumber,
      custom_answers: parsedLead.customAnswers,
      raw: parsedLead.rawResponse,
    };

    // Deduplicate by email if present for tenant
    if (parsedLead.email) {
      const { data: existing } = await admin
        .from('leads')
        .select('id, metadata')
        .eq('tenant_id', tenantId)
        .eq('contact_email', parsedLead.email)
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error: updateError } = await admin
          .from('leads')
          .update({
            updated_at: new Date().toISOString(),
            notes: `LinkedIn Lead Form submission synced on ${new Date().toLocaleDateString()}`,
            metadata: { ...((existing.metadata as Record<string, unknown>) || {}), ...metadataPayload },
          })
          .eq('id', existing.id);

        if (updateError) throw updateError;
        return { success: true, leadId: existing.id };
      }
    }

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
        notes: `Submitted LinkedIn Lead Gen Form (Form ID: ${parsedLead.formId || 'N/A'})`,
        metadata: metadataPayload,
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    // ── Bridge: push contact to Calendly for instant scheduling access ────────
    if (parsedLead.email && parsedLead.fullName) {
      try {
        const admin2 = createSupabaseAdminClient();
        const calendlyConfig = await getCalendlyConfig(admin2, tenantId);
        if (calendlyConfig?.enabled && calendlyConfig.accessToken) {
          await upsertCalendlyContact(tenantId, calendlyConfig, {
            name: parsedLead.fullName,
            email: parsedLead.email,
          });
        }
      } catch (calendlyErr) {
        // Non-blocking — never fail the CRM save because of Calendly
        console.warn('[LinkedInLeadGenSync] Calendly contact push skipped:', calendlyErr);
      }
    }

    return { success: true, leadId: inserted.id };
  } catch (err: any) {
    console.error('[LinkedInLeadGenSync] Error syncing lead:', err);
    return { success: false, error: err.message || 'Failed to sync lead' };
  }
}
