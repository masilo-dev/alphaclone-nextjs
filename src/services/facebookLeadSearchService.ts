import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getFacebookIntegrationWithToken } from '@/services/facebook/facebookIntegrationService';

export type FacebookLeadSearchResult = {
  local: Array<Record<string, unknown>>;
  graph: Array<Record<string, unknown>>;
  total: number;
};

export async function searchFacebookLeads(
  tenantId: string,
  query: string
): Promise<FacebookLeadSearchResult> {
  const admin = createSupabaseAdminClient();
  const q = query.trim();

  let dbQuery = admin
    .from('facebook_leads')
    .select('id, lead_id, first_name, last_name, email, phone, company, campaign_name, ad_name, status, crm_lead_id, received_at, field_data')
    .eq('tenant_id', tenantId)
    .order('received_at', { ascending: false })
    .limit(50);

  if (q) {
    const like = `%${q}%`;
    dbQuery = dbQuery.or(
      `first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},phone.ilike.${like},company.ilike.${like},campaign_name.ilike.${like}`
    );
  }

  const { data: localLeads } = await dbQuery;

  const graphLeads: Array<Record<string, unknown>> = [];
  if (q.length >= 2) {
    const integration = await getFacebookIntegrationWithToken(admin, { tenantId });

    if (integration?.pageAccessToken && integration.page_id) {
      try {
        const formsRes = await fetch(
          `https://graph.facebook.com/v21.0/${integration.page_id}/leadgen_forms?fields=id,name&limit=10&access_token=${integration.pageAccessToken}`
        );
        const formsData = await formsRes.json();
        for (const form of (formsData?.data || []).slice(0, 3)) {
          const leadsRes = await fetch(
            `https://graph.facebook.com/v21.0/${form.id}/leads?fields=id,created_time,field_data&limit=25&access_token=${integration.pageAccessToken}`
          );
          const leadsData = await leadsRes.json();
          for (const lead of leadsData?.data || []) {
            const fields: Record<string, string> = {};
            for (const f of lead.field_data || []) {
              fields[f.name] = Array.isArray(f.values) ? f.values[0] : String(f.values || '');
            }
            const fullName = `${fields.full_name || fields.first_name || ''} ${fields.last_name || ''}`.trim();
            const haystack = `${fullName} ${fields.email || ''} ${fields.phone_number || ''} ${fields.company_name || ''}`.toLowerCase();
            if (!haystack.includes(q.toLowerCase())) continue;
            graphLeads.push({
              source: 'facebook_graph',
              lead_id: lead.id,
              name: fullName || 'Facebook Lead',
              email: fields.email || '',
              phone: fields.phone_number || fields.phone || '',
              company: fields.company_name || '',
              form_name: form.name,
              page_name: integration.page_name,
              created_time: lead.created_time,
            });
          }
        }
      } catch (graphErr) {
        console.warn('[searchFacebookLeads] Graph API:', graphErr);
      }
    }
  }

  return {
    local: localLeads || [],
    graph: graphLeads.slice(0, 25),
    total: (localLeads?.length || 0) + graphLeads.length,
  };
}
