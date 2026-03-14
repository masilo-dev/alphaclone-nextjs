import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { hubspotService } from '@/services/hubspotService';

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
                    results.push({ leadId: lead.id, success: true, ...result });
                } catch (err: any) {
                    results.push({ leadId: lead.id, success: false, error: err.message });
                }
            }
        } else {
            // Generic sync (e.g., fetch from HubSpot to AlphaClone or vice versa)
            // For now, we'll just return success
            return NextResponse.json({ success: true, message: 'General sync initiated' });
        }

        return NextResponse.json({ success: true, results });
    } catch (err: any) {
        console.error('HubSpot Sync API Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
