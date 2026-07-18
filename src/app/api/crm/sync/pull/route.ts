import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { OPERATION_FAILED_MESSAGE } from '@/lib/api/operationResult';
import { hubspotService } from '@/services/hubspotService';
import { ZohoCRMService } from '@/services/zoho/ZohoCRMService';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { requireTenantAccess } from '@/lib/apiAuth';

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userId = user.id;
    const { tenantId } = await req.json();
    await requireTenantAccess(String(tenantId || ''), req);

    const supabaseAdmin = createSupabaseAdminClient();
    const { data: integrations, error } = await supabaseAdmin
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('enabled', true);

    if (error || !integrations) {
      return NextResponse.json({ success: false, error: 'Failed to fetch integrations' });
    }

    const results: Array<Record<string, unknown>> = [];
    let syncedCount = 0;

    const hubspot = integrations.find((i: { type: string }) => i.type === 'hubspot');
    if (hubspot) {
      try {
        const contacts = await hubspotService.getContacts(userId, tenantId, 100);
        for (const contact of contacts) {
          const { firstname, lastname, email, phone, company } = contact.properties;
          const emailNorm = String(email || '').trim().toLowerCase();
          if (!emailNorm) continue;

          const businessName =
            String(company || '').trim() ||
            `${firstname || ''} ${lastname || ''}`.trim() ||
            emailNorm;

          const { data: existingLead } = await supabaseAdmin
            .from('leads')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('email', emailNorm)
            .limit(1)
            .maybeSingle();

          let leadId = existingLead?.id;
          if (!leadId) {
            const { data: inserted } = await supabaseAdmin
              .from('leads')
              .insert({
                tenant_id: tenantId,
                owner_id: userId,
                business_name: businessName,
                email: emailNorm,
                phone: phone || null,
                source: 'hubspot',
                stage: 'lead',
              })
              .select('id')
              .single();
            leadId = inserted?.id;
          }

          if (leadId) {
            await supabaseAdmin.from('business_clients').insert({
              tenant_id: tenantId,
              name: `${firstname || ''} ${lastname || ''}`.trim() || businessName,
              email: emailNorm,
              phone: phone || null,
              company: company || businessName,
              sales_stage: 'lead',
              is_active: true,
            }).then(null, () => undefined);
            syncedCount += 1;
          }
        }
        results.push({ provider: 'hubspot', status: 'success', count: contacts.length });
      } catch (e: unknown) {
        console.error('HubSpot Pull Error:', e);
        results.push({ provider: 'hubspot', status: 'failed', error: OPERATION_FAILED_MESSAGE });
      }
    }

    const zoho = integrations.find((i: { type: string }) => i.type === 'zoho');
    if (zoho) {
      try {
        const zohoCRM = new ZohoCRMService(userId, tenantId);
        const zohoLeads = await zohoCRM.getRecords('Leads');
        for (const lead of zohoLeads || []) {
          const emailNorm = String(lead.Email || (lead as { email?: string }).email || '').trim().toLowerCase();
          if (!emailNorm) continue;

          const { data: existingLead } = await supabaseAdmin
            .from('leads')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('email', emailNorm)
            .limit(1)
            .maybeSingle();

          if (!existingLead?.id) {
            const { error: insertErr } = await supabaseAdmin.from('leads').insert({
              tenant_id: tenantId,
              owner_id: userId,
              business_name: String(lead.Company || lead.Full_Name || lead.Last_Name || emailNorm),
              email: emailNorm,
              phone: lead.Phone || lead.Mobile || null,
              source: 'zoho',
              stage: 'lead',
            });
            if (!insertErr) syncedCount += 1;
          }
        }
        results.push({ provider: 'zoho', status: 'success', count: (zohoLeads || []).length });
      } catch (e: unknown) {
        console.error('Zoho Pull Error:', e);
        results.push({ provider: 'zoho', status: 'failed', error: OPERATION_FAILED_MESSAGE });
      }
    }

    // Bridge into unified companies/contacts/opportunities (best-effort, scoped sync)
    try {
      const { data: recentLeads } = await supabaseAdmin
        .from('leads')
        .select('id')
        .eq('tenant_id', tenantId)
        .in('source', ['hubspot', 'zoho'])
        .order('created_at', { ascending: false })
        .limit(50);
      const { syncCrmEntity } = await import('@/lib/crm/crmBridgeServer');
      for (const lead of recentLeads || []) {
        await syncCrmEntity(supabaseAdmin, 'lead', lead.id, tenantId).catch(() => undefined);
      }
    } catch (migrateErr) {
      console.warn('[crm/sync/pull] bridge sync skipped:', migrateErr);
    }

    return NextResponse.json({ success: true, results, syncedCount });
  } catch (err: unknown) {
    console.error('CRM Pull Error:', err);
    return clientErrorResponse(err, { request: req, scope: 'crm/sync/pull.POST' });
  }
}
