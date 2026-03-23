import { createSupabaseServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { hubspotService } from '@/services/hubspotService';
import { ZohoCRMService } from '@/services/zoho/ZohoCRMService';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { deal, lead, entityType } = await req.json();
        const userId = user.id;

        // Use Admin client to fetch integrations securely
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

        // Sync to HubSpot (only supports deals/leads as generic objects for now)
        const hubspot = integrations.find((i: any) => i.type === 'hubspot');
        if (hubspot) {
            try {
                const res = await hubspotService.syncLeadToHubSpot(userId, deal || lead);
                results.push({ provider: 'hubspot', status: 'success', data: res });
            } catch (e: any) {
                console.error('HubSpot Sync Error:', e);
                results.push({ provider: 'hubspot', status: 'failed', error: e.message });
            }
        }

        // Sync to Zoho
        const zoho = integrations.find((i: any) => i.type === 'zoho');
        if (zoho) {
            try {
                const zohoCRM = new ZohoCRMService(userId);
                let res;
                const entityType = (await req.clone().json()).entityType;

                if (entityType === 'lead' || lead) {
                    res = await zohoCRM.upsertLead(lead || deal);
                } else {
                    res = await zohoCRM.upsertDeal(deal);
                }
                
                results.push({ provider: 'zoho', status: 'success', data: res });
            } catch (e: any) {
                console.error('Zoho CRM Sync Error:', e);
                results.push({ provider: 'zoho', status: 'failed', error: e.message });
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (err: any) {
        console.error('CRM Sync Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
