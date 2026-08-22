import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export interface ClientIdentityResolutionResult {
  primaryClientId?: string;
  matchedClientIds: string[];
  confidence: number;
  reasons: string[];
  requiresConfirmation: boolean;
}

export class ClientIdentityResolver {
  /**
   * Resolve client identity across email, domain, company, contact ID, CRM ID, and phone
   */
  async resolveClientIdentity(
    tenantId: string,
    payload: {
      email?: string;
      company?: string;
      domain?: string;
      contactId?: string;
      crmId?: string;
      phone?: string;
    }
  ): Promise<ClientIdentityResolutionResult> {
    const admin = createSupabaseAdminClient();
    const matchedClientIds: string[] = [];
    const reasons: string[] = [];
    let maxConfidence = 0;

    if (!payload.email && !payload.company && !payload.phone && !payload.contactId) {
      return { matchedClientIds: [], confidence: 0, reasons: ['No search criteria provided'], requiresConfirmation: false };
    }

    // 1. Email exact match
    if (payload.email) {
      const emailDomain = payload.email.split('@')[1];
      const { data: clientData } = await admin
        .from('business_clients')
        .select('id, name, email, company, phone')
        .eq('tenant_id', tenantId)
        .ilike('email', payload.email.trim());

      if (clientData && clientData.length > 0) {
        clientData.forEach(c => matchedClientIds.push(c.id));
        reasons.push(`Exact email match: ${payload.email}`);
        maxConfidence = Math.max(maxConfidence, 1.0);
      }

      // Also check contacts table
      const { data: contactData } = await admin
        .from('contacts')
        .select('id, email, full_name, company_id')
        .eq('tenant_id', tenantId)
        .ilike('email', payload.email.trim());

      if (contactData && contactData.length > 0) {
        contactData.forEach(c => matchedClientIds.push(c.id));
        reasons.push(`Contact email match: ${payload.email}`);
        maxConfidence = Math.max(maxConfidence, 0.95);
      }
    }

    // 2. Company / Domain match
    if (payload.company || payload.domain) {
      const targetCompany = payload.company || payload.domain;
      const { data: companyClients } = await admin
        .from('business_clients')
        .select('id, company')
        .eq('tenant_id', tenantId)
        .ilike('company', `%${targetCompany}%`);

      if (companyClients && companyClients.length > 0) {
        companyClients.forEach(c => matchedClientIds.push(c.id));
        reasons.push(`Company match: ${targetCompany}`);
        maxConfidence = Math.max(maxConfidence, 0.75);
      }
    }

    // 3. Phone match
    if (payload.phone) {
      const normalizedPhone = payload.phone.replace(/[^0-9+]/g, '');
      if (normalizedPhone.length >= 7) {
        const { data: phoneClients } = await admin
          .from('business_clients')
          .select('id, phone')
          .eq('tenant_id', tenantId)
          .ilike('phone', `%${normalizedPhone}%`);

        if (phoneClients && phoneClients.length > 0) {
          phoneClients.forEach(c => matchedClientIds.push(c.id));
          reasons.push(`Phone match: ${payload.phone}`);
          maxConfidence = Math.max(maxConfidence, 0.85);
        }
      }
    }

    const uniqueClientIds = [...new Set(matchedClientIds)];

    // If multiple candidates detected with confidence between 0.50 and 0.85, record merge prompt
    const requiresConfirmation = uniqueClientIds.length > 1 && maxConfidence < 0.90;

    if (requiresConfirmation && uniqueClientIds.length >= 2) {
      await admin.from('client_identity_merges').insert({
        tenant_id: tenantId,
        primary_client_id: uniqueClientIds[0],
        candidate_client_id: uniqueClientIds[1],
        confidence_score: maxConfidence,
        match_reasons: reasons,
        status: 'pending_confirmation',
      });
    }

    return {
      primaryClientId: uniqueClientIds[0],
      matchedClientIds: uniqueClientIds,
      confidence: maxConfidence,
      reasons,
      requiresConfirmation,
    };
  }

  /**
   * Get pending merge prompts for tenant admin review
   */
  async getPendingMergePrompts(tenantId: string) {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from('client_identity_merges')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending_confirmation');

    return data || [];
  }
}

export const clientIdentityResolver = new ClientIdentityResolver();
