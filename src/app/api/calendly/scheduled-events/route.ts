import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const tenantId = searchParams.get('tenantId');

        if (!tenantId) {
            return NextResponse.json({ error: 'Missing tenant ID' }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();

        // Fetch calendar events synced from Calendly
        const { data: events, error } = await supabase
            .from('calendar_events')
            .select('*')
            .eq('tenant_id', tenantId)
            // Filter for events that have calendly metadata
            .not('metadata->>calendly_event_uri', 'is', null)
            .order('start_time', { ascending: true });

        if (error) {
            console.error('Error fetching scheduled events:', error);
            return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
        }

        return NextResponse.json({ events: events || [] });

    } catch (err: any) {
        console.error('API /calendly/scheduled-events Error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
