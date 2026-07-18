import { NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { refreshCalendlyTokenIfNeeded } from '@/services/calendly/calendlyIntegrationService';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const tenantId = searchParams.get('tenantId');

        if (!tenantId) {
            return NextResponse.json({ error: 'Missing tenant ID' }, { status: 400 });
        }

        await requireTenantAccess(tenantId, req);

        const supabase = createSupabaseAdminClient();
        const config = await refreshCalendlyTokenIfNeeded(supabase, tenantId);
        if (!config?.accessToken || !config.calendlyUserUri) {
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
            
            if (response.status === 401) {
                return NextResponse.json({ 
                    error: 'Unauthorized', 
                    code: 'CALENDLY_AUTH_INVALID',
                    message: 'Calendly token is invalid or expired. Please re-connect.' 
                }, { status: 401 });
            }

            if (response.status === 403) {
                return NextResponse.json({ 
                    error: 'Forbidden', 
                    code: 'CALENDLY_ACCESS_DENIED',
                    message: 'Your Calendly account does not have permission to access event types.' 
                }, { status: 403 });
            }

            console.error('Calendly event-types error body:', errorText);
            return NextResponse.json(
                { error: 'Calendly request failed', code: 'CALENDLY_API_ERROR', status: response.status },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json({ eventTypes: data.collection || [] });

    } catch (err) {
        console.error('API /calendly/event-types Error:', err);
        return routeErrorResponse(err, undefined, req);
    }
}
