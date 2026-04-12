import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { OPERATION_FAILED_MESSAGE } from '@/lib/api/operationResult';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { hubspotService } from '@/services/hubspotService';

export async function GET(req: NextRequest) {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const limit = Number(searchParams.get('limit') || '100');

        const contacts = await hubspotService.getContacts(user.id, limit);
        return NextResponse.json({ success: true, contacts });
    } catch (err: unknown) {
        console.error('HubSpot Fetch Contacts API Error:', err);
        return clientErrorResponse(err, { request: req, scope: 'hubspot/sync' });
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const leads: any[] | undefined = body.leads;

        const results = [];
        if (leads && Array.isArray(leads)) {
            for (const lead of leads) {
                try {
                    const result = await hubspotService.syncLeadToHubSpot(user.id, lead);
                    results.push({ leadId: lead.id, ...result });
                } catch (err: unknown) {
                    console.error('[hubspot/sync] lead', lead.id, err);
                    results.push({ leadId: lead.id, success: false, error: OPERATION_FAILED_MESSAGE });
                }
            }
            return NextResponse.json({ success: true, results });
        } else {
            const contacts = await hubspotService.getContacts(user.id, 100);
            return NextResponse.json({ success: true, message: 'HubSpot contacts refreshed', contacts });
        }
    } catch (err: unknown) {
        console.error('HubSpot Sync API Error:', err);
        return clientErrorResponse(err, { request: req, scope: 'hubspot/sync' });
    }
}
