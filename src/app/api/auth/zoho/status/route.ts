import { NextRequest, NextResponse } from 'next/server';
import { ZohoService } from '../../../../../services/zoho/ZohoService';
import { ZohoMailService } from '../../../../../services/zoho/ZohoMailService';
import { ZohoCampaignsService } from '../../../../../services/zoho/ZohoCampaignsService';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

function inferZohoRegionFromAccountsServer(value: string | undefined): string | null {
    const server = String(value || '').toLowerCase();
    if (!server) return null;
    if (server.includes('.zoho.eu')) return 'EU';
    if (server.includes('.zoho.in')) return 'IN';
    if (server.includes('.zoho.com.au')) return 'AU';
    if (server.includes('.zoho.jp')) return 'JP';
    if (server.includes('.zoho.ca')) return 'CA';
    if (server.includes('.zoho.com')) return 'US';
    return null;
}

export async function GET(req: NextRequest) {
    const tenantId = req.nextUrl.searchParams.get('tenantId')?.trim() || '';

    try {
        const { user } = await requireTenantAccess(tenantId, req);
        const zohoService = new ZohoService(user.id, tenantId);
        const config = await zohoService.getConfig();
        const configuredRegion = inferZohoRegionFromAccountsServer(config?.accountsServer);
        const health = await zohoService.getDetailedHealthStatus();

        let mailReady = false;
        let campaignsReady = false;
        if (health.tokenValid) {
            try {
                const zohoMailService = new ZohoMailService(user.id, tenantId);
                const senderAddresses = await zohoMailService.getSenderAddresses();
                mailReady = senderAddresses.length > 0;
            } catch {
                mailReady = false;
            }

            try {
                const zohoCampaignsService = new ZohoCampaignsService(user.id, tenantId);
                campaignsReady = await zohoCampaignsService.checkCampaignsReady();
            } catch {
                campaignsReady = false;
            }
        }

        return NextResponse.json({
            isConnected: health.status === 'connected_and_ready' || health.status === 'connected_sender_setup_required',
            healthStatus: health.status,
            healthDetails: health.details,
            mailReady,
            campaignsReady,
            baseConnected: health.tokenValid,
            configuredRegion,
        });
    } catch (err: unknown) {
        console.error('Zoho Status Check Error:', err);
        return routeErrorResponse(err, 'Zoho status could not be checked', req);
    }
}
