import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { pullAndSyncCalendlyEvents, type CalendlyTenantConfig } from '@/lib/calendly/syncToNative';

export async function POST(req: Request) {
    const authClient = await createSupabaseServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { tenantId } = await req.json();
        if (!tenantId) {
            return NextResponse.json({ error: 'Missing tenant ID' }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();
        const { data: tenant, error } = await supabase
            .from('tenants')
            .select('settings')
            .eq('id', tenantId)
            .single();

        if (error || !tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        const config = tenant.settings?.calendly as CalendlyTenantConfig | undefined;
        if (!config?.accessToken || !config.calendlyUserUri) {
            return NextResponse.json({ error: 'Calendly OAuth is not configured for this tenant' }, { status: 400 });
        }

        const result = await pullAndSyncCalendlyEvents(tenantId, user.id, config);
        return NextResponse.json({ success: true, ...result });
    } catch (err: unknown) {
        console.error('API /calendly/sync Error:', err);
        return clientErrorResponse(err, { request: req, scope: 'calendly/sync' });
    }
}
