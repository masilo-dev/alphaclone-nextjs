import { NextResponse } from 'next/server';
import { calendlyService } from '@/services/calendlyService';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Programmatic Scheduling API
 * Allows Alpha agents to book meetings directly via Calendly API v2
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { eventTypeUri, inviteeDetails, userId } = body;

        if (!eventTypeUri || !inviteeDetails || !userId) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // 1. Verify user exists and has a tenant
        const supabase = createSupabaseAdminClient();
        const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', userId)
            .single();

        if (!profile) {
            return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
        }

        // 2. Execute scheduling via service
        // Note: The service gets config from tenant settings in the DB or local context
        // Since this is a server route, we might need to pass the config explicitly 
        // if calendlyService.getConfig relies on localStorage.
        // Let's check calendlyService.ts again.
        
        const booking = await calendlyService.scheduleMeeting(eventTypeUri, inviteeDetails, profile.tenant_id);

        return NextResponse.json({ success: true, booking });
    } catch (error: any) {
        console.error('[API] Calendly Schedule Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
