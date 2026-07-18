import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { ZohoService } from '../../../../../services/zoho/ZohoService';
import { requireTenantRole } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const tenantId = String(body?.tenantId || '').trim();
        const { user } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);
        const zohoService = new ZohoService(user.id, tenantId);
        await zohoService.disconnect();
        const admin = createSupabaseAdminClient();
        await admin.from('tenant_integrations').update({
            status: 'disconnected',
            metadata: {},
        }).eq('tenant_id', tenantId).eq('integration_id', 'zoho-mail');
        
        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('Zoho Disconnect Error:', err);
        return clientErrorResponse(err, { request: req, scope: 'auth/zoho/disconnect' });
    }
}
