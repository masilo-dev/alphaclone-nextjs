import { createSupabaseServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { OPERATION_FAILED_MESSAGE } from '@/lib/api/operationResult';

import { hubspotService } from '@/services/hubspotService';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = user.id;
        const { data: tenantUser } = await supabase
            .from('tenant_users')
            .select('tenant_id')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle();

        const tenantId = tenantUser?.tenant_id;
        if (!tenantId) {
            return NextResponse.json({ success: false, error: 'Tenant not found' });
        }

        const supabaseAdmin = createSupabaseAdminClient();
        const { data: integrations, error } = await supabaseAdmin
            .from('integrations')
            .select('*')
            .eq('user_id', userId)
            .eq('enabled', true);

        if (error || !integrations) {
            return NextResponse.json({ success: false, error: 'Failed to fetch integrations' });
        }

        const results = [];
        let syncedCount = 0;

        // Sync from HubSpot
        const hubspot = integrations.find((i: any) => i.type === 'hubspot');
        if (hubspot) {
            try {
                const contacts = await hubspotService.getContacts(userId, 100);
                for (const contact of contacts) {
                    const { firstname, lastname, email, company } = contact.properties;
                    const name = `${firstname || ''} ${lastname || ''}`.trim() || email || 'Unknown';
                    
                    // Upsert to Deals
                    const { error: upsertError } = await supabaseAdmin
                        .from('deals')
                        .upsert({
                            tenant_id: tenantId,
                            name: name,
                            contact_id: null, // Should link to contact if possible
                            owner_id: userId,
                            stage: 'lead', // Default stage for synced leads
                            source: 'hubspot',
                            value: 0,
                            description: `Imported from HubSpot (Company: ${company || 'N/A'})`
                        }, { onConflict: 'tenant_id, name' }); // Assuming unique name per tenant, ideally use email if unique constraint exists

                    if (!upsertError) syncedCount++;
                }
                results.push({ provider: 'hubspot', status: 'success', count: contacts.length });
            } catch (e: unknown) {
                console.error('HubSpot Pull Error:', e);
                results.push({ provider: 'hubspot', status: 'failed', error: OPERATION_FAILED_MESSAGE });
            }
        }


        return NextResponse.json({ success: true, results, syncedCount });
    } catch (err: unknown) {
        console.error('CRM Pull Error:', err);
        return clientErrorResponse(err, { request: req, scope: 'crm/sync/pull.POST' });
    }
}
