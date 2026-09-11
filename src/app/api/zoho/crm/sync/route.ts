import { NextRequest, NextResponse } from 'next/server';
import { ZohoCRMService } from '../../../../../services/zoho/ZohoCRMService';
import { ZohoAuthExpiredError } from '../../../../../services/zoho/ZohoService';
import { requireTenantAccess } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
    try {
        const { module, tenantId } = await req.json();
        const { user } = await requireTenantAccess(String(tenantId || ''), req);
        const zohoCRM = new ZohoCRMService(user.id, tenantId);

        let syncedCount = 0;
        if (module === 'Contacts' || !module) {
            syncedCount += await zohoCRM.syncContacts();
        }
        if (module === 'Deals' || !module) {
            syncedCount += await zohoCRM.syncDeals();
        }

        return NextResponse.json({
            success: true,
            syncedCount,
            message: `Successfully synced ${syncedCount} records from Zoho CRM`,
        });
    } catch (err: unknown) {
        if (err instanceof ZohoAuthExpiredError) {
            console.error('[Zoho CRM Sync] auth expired:', err);
            return NextResponse.json(
                { error: 'Zoho CRM session expired. Reconnect Zoho.', code: 'ZOHO_CRM_RECONNECT', reconnect: true },
                { status: 401 }
            );
        }
        console.error('[Zoho CRM Sync]', err);
        return NextResponse.json(
            { error: 'Zoho CRM sync failed. Please try again.', code: 'ZOHO_CRM_SYNC_FAILED' },
            { status: 500 }
        );
    }
}
