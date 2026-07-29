import { createSupabaseServerClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { OPERATION_FAILED_MESSAGE } from '@/lib/api/operationResult';

import { hubspotService } from '@/services/hubspotService';
import { ZohoCRMService } from '@/services/zoho/ZohoCRMService';
import { ZohoAuthExpiredError } from '@/services/zoho/ZohoService';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { requireTenantRole } from '@/lib/apiAuth';

export async function POST(req: Request) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { deal, lead, entityType, tenantId } = await req.json();
        await requireTenantRole(String(tenantId || ''), ['owner', 'admin', 'tenant_admin', 'super_admin'], req);
        const userId = user.id;

        // Use Admin client to fetch integrations securely
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

        const results = [];

        // Sync to HubSpot using entity-specific behavior to avoid bad writes.
        const hubspot = integrations.find((i: any) => i.type === 'hubspot');
        if (hubspot) {
            try {
                const res =
                    entityType === 'deal' || deal
<<<<<<< HEAD
                        ? await hubspotService.syncDealToHubSpot(userId, tenantId, deal)
                        : await hubspotService.syncLeadToHubSpot(userId, tenantId, lead);
                results.push({
                    provider: 'hubspot',
                    status: res?.success === false && 'skipped' in res && res.skipped ? 'skipped' : 'success',
                    data: res,
                });
=======
                        ? {
                              success: false,
                              skipped: true,
                              message: 'HubSpot deal sync is not implemented for this route yet.'
                          }
                        : await hubspotService.syncLeadToHubSpot(userId, lead);
                results.push({ provider: 'hubspot', status: 'success', data: res });
>>>>>>> origin/main
            } catch (e: unknown) {
                console.error('HubSpot Sync Error:', e);
                results.push({ provider: 'hubspot', status: 'failed', error: OPERATION_FAILED_MESSAGE });
            }
        }

        // Sync to Zoho
        const zoho = integrations.find((i: any) => i.type === 'zoho');
        if (zoho) {
            try {
                const zohoCRM = new ZohoCRMService(userId, tenantId);
                let res;
                // entityType was already destructured from req.json() above
                if (entityType === 'lead' || lead) {
                    res = await zohoCRM.upsertLead(lead || deal);
                } else {
                    res = await zohoCRM.upsertDeal(deal);
                }
                results.push({ provider: 'zoho', status: 'success', data: res });
            } catch (e: unknown) {
                console.error('Zoho CRM Sync Error:', e);
                const isAuthExpired = e instanceof ZohoAuthExpiredError;
                results.push({
                    provider: 'zoho',
                    status: 'failed',
                    error: OPERATION_FAILED_MESSAGE,
                    reconnect: isAuthExpired,
                });
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (err: unknown) {
        console.error('CRM Sync Error:', err);
        return clientErrorResponse(err, { request: req, scope: 'crm/sync/push.POST' });
    }
}
