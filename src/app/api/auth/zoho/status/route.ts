import { NextRequest, NextResponse } from 'next/server';
import { ZohoService } from '../../../../../services/zoho/ZohoService';
import { ZohoMailService } from '../../../../../services/zoho/ZohoMailService';
import { ZohoCampaignsService } from '../../../../../services/zoho/ZohoCampaignsService';
import { createSupabaseServerClient } from '@/lib/supabase-server';

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
    const authClient = await createSupabaseServerClient();
    const {
        data: { user },
    } = await authClient.auth.getUser();
    const userId = user?.id || null;
    if (!userId) {
        return NextResponse.json({ isConnected: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const zohoService = new ZohoService(userId);
        const config = await zohoService.getConfig();
        const configuredRegion = inferZohoRegionFromAccountsServer(config?.accountsServer);
        const baseConnected = await zohoService.checkIntegration();
        if (!baseConnected) {
            return NextResponse.json({ isConnected: false, mailReady: false, configuredRegion });
        }

        let mailReady = false;
        let campaignsReady = false;
        try {
            const zohoMailService = new ZohoMailService(userId);
            const senderAddresses = await zohoMailService.getSenderAddresses();
            mailReady = senderAddresses.length > 0;
        } catch {
            mailReady = false;
        }

        try {
            const zohoCampaignsService = new ZohoCampaignsService(userId);
            campaignsReady = await zohoCampaignsService.checkCampaignsReady();
        } catch {
            campaignsReady = false;
        }

        return NextResponse.json({
            isConnected: mailReady || campaignsReady,
            mailReady,
            campaignsReady,
            baseConnected,
            configuredRegion,
        });
    } catch (err: unknown) {
        console.error('Zoho Status Check Error:', err);
        return NextResponse.json(
            { isConnected: false, error: 'Status check failed', code: 'ZOHO_STATUS_ERROR' },
            { status: 500 }
        );
    }
}
