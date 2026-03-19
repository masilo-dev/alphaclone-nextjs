import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { hubspotService } from '@/services/hubspotService';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        const limit = Number(searchParams.get('limit') || '100');

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const contacts = await hubspotService.getContacts(userId, limit);
        return NextResponse.json({ success: true, contacts });
    } catch (err: any) {
        console.error('HubSpot Fetch Contacts API Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { userId, leads } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const results = [];
        if (leads && Array.isArray(leads)) {
            // Sync specific leads
            for (const lead of leads) {
                try {
                    const result = await hubspotService.syncLeadToHubSpot(userId, lead);
                    results.push({ leadId: lead.id, ...result });
                } catch (err: any) {
                    results.push({ leadId: lead.id, success: false, error: err.message });
                }
            }
        } else {
            const contacts = await hubspotService.getContacts(userId, 100);
            return NextResponse.json({ success: true, message: 'HubSpot contacts refreshed', contacts });
        }

        return NextResponse.json({ success: true, results });
    } catch (err: any) {
        console.error('HubSpot Sync API Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
