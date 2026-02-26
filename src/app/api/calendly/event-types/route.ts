import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const tenantId = searchParams.get('tenantId');

        if (!tenantId) {
            return NextResponse.json({ error: 'Missing tenant ID' }, { status: 400 });
        }

        const { data: tenant, error } = await supabase
            .from('tenants')
            .select('settings')
            .eq('id', tenantId)
            .single();

        if (error || !tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        const config = tenant.settings?.calendly;
        if (!config || !config.accessToken || !config.calendlyUserUri) {
            return NextResponse.json({ error: 'Calendly OAuth is not configured for this tenant' }, { status: 400 });
        }

        // Fetch Event Types (booking links)
        const response = await fetch(`https://api.calendly.com/event_types?user=${encodeURIComponent(config.calendlyUserUri)}`, {
            headers: {
                'Authorization': `Bearer ${config.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json({ error: `Calendly API error: ${response.status}`, details: errorText }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json({ eventTypes: data.collection || [] });

    } catch (err: any) {
        console.error('API /calendly/event-types Error:', err);
        return NextResponse.json({ error: 'Internal Server Error', details: err.message }, { status: 500 });
    }
}
