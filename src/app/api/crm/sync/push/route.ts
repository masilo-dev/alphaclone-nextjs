import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { zohoServerService } from '@/services/server/zohoServerService';
import { hubspotService } from '@/services/hubspotService';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { deal } = await req.json();
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

        // Sync to Zoho (CRM)
        const zoho = integrations.find(i => i.type === 'zoho');
        if (zoho) {
            try {
                const res = await zohoServerService.createCRMLead(userId, deal);
                results.push({ provider: 'zoho', status: 'success', data: res });
            } catch (e: any) {
                console.error('Zoho Sync Error:', e);
                results.push({ provider: 'zoho', status: 'failed', error: e.message });
            }
        }

        // Sync to HubSpot
        const hubspot = integrations.find(i => i.type === 'hubspot');
        if (hubspot) {
            try {
                const res = await hubspotService.syncLeadToHubSpot(userId, deal);
                results.push({ provider: 'hubspot', status: 'success', data: res });
            } catch (e: any) {
                console.error('HubSpot Sync Error:', e);
                results.push({ provider: 'hubspot', status: 'failed', error: e.message });
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (err: any) {
        console.error('CRM Sync Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
