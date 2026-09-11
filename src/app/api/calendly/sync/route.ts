import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { pullAndSyncCalendlyEvents, type CalendlyTenantConfig } from '@/lib/calendly/syncToNative';
import { requireTenantRole } from '@/lib/apiAuth';
import { refreshCalendlyTokenIfNeeded } from '@/services/calendly/calendlyIntegrationService';
import { z } from 'zod';

export async function POST(req: Request) {
    try {
        const { tenantId } = z.object({ tenantId: z.string().uuid() }).parse(await req.json());
        const { user } = await requireTenantRole(tenantId, ['owner','admin','tenant_admin','super_admin'], req);

        const supabase = createSupabaseAdminClient();
        const config = await refreshCalendlyTokenIfNeeded(supabase, tenantId) as CalendlyTenantConfig | null;
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
