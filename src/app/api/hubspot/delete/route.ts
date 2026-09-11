import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { requireTenantRole } from '@/lib/apiAuth';
import { hubspotService } from '@/services/hubspotService';

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const contactId = searchParams.get('contactId');
        const tenantId = searchParams.get('tenantId') || '';
        const { user } = await requireTenantRole(tenantId, ['owner','admin','tenant_admin','super_admin']);

        if (!contactId) {
            return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });
        }

        const result = await hubspotService.deleteContact(user.id, tenantId, contactId);
        return NextResponse.json(result);
    } catch (err: any) {
        console.error('HubSpot Delete API Error:', err);
        return clientErrorResponse(err, { request: req, scope: 'hubspot/delete' });
    }
}
