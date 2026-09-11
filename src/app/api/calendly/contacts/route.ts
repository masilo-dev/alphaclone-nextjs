import { NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
    getCalendlyContacts,
    syncCRMClientsToCalendlyContacts,
} from '@/lib/calendly/syncToNative';

// GET /api/calendly/contacts?tenantId=xxx
// Returns all Calendly contacts for the tenant
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const tenantId = searchParams.get('tenantId');

        if (!tenantId) {
            return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
        }

        await requireTenantAccess(tenantId);

        const supabase = createSupabaseAdminClient();
        const { data: tenant, error } = await supabase
            .from('tenants')
            .select('settings')
            .eq('id', tenantId)
            .single();

        if (error || !tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        const config = (tenant.settings as any)?.calendly;
        if (!config?.enabled || !config?.accessToken) {
            return NextResponse.json({ error: 'Calendly not connected' }, { status: 401 });
        }

        const contacts = await getCalendlyContacts(tenantId, config);
        return NextResponse.json({ contacts, count: contacts.length });
    } catch (err) {
        console.error('[Calendly Contacts GET]', err);
        return routeErrorResponse(err, undefined, req);
    }
}

// POST /api/calendly/contacts/sync
// Pushes CRM clients into Calendly as contacts (bidirectional bridge)
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { tenantId } = body;

        if (!tenantId) {
            return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
        }

        await requireTenantAccess(tenantId);

        const supabase = createSupabaseAdminClient();
        const { data: tenant, error } = await supabase
            .from('tenants')
            .select('settings')
            .eq('id', tenantId)
            .single();

        if (error || !tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        const config = (tenant.settings as any)?.calendly;
        if (!config?.enabled || !config?.accessToken) {
            return NextResponse.json({ error: 'Calendly not connected' }, { status: 401 });
        }

        const result = await syncCRMClientsToCalendlyContacts(tenantId, config);
        return NextResponse.json({ success: true, ...result });
    } catch (err) {
        console.error('[Calendly Contacts POST]', err);
        return routeErrorResponse(err, undefined, req);
    }
}
