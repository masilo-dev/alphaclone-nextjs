import { NextRequest, NextResponse } from 'next/server';
import { ZohoService } from '../../../../../services/zoho/ZohoService';
import { ZohoMailService } from '../../../../../services/zoho/ZohoMailService';
<<<<<<< HEAD
import { ZohoCampaignsService } from '../../../../../services/zoho/ZohoCampaignsService';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
=======
import { createSupabaseServerClient } from '@/lib/supabase-server';
>>>>>>> origin/main

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
<<<<<<< HEAD
    const tenantId = req.nextUrl.searchParams.get('tenantId')?.trim() || '';

    try {
        const { user } = await requireTenantAccess(tenantId, req);
        const zohoService = new ZohoService(user.id, tenantId);
=======
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
>>>>>>> origin/main
        const config = await zohoService.getConfig();
        const configuredRegion = inferZohoRegionFromAccountsServer(config?.accountsServer);
        const baseConnected = await zohoService.checkIntegration();
        if (!baseConnected) {
            return NextResponse.json({ isConnected: false, mailReady: false, configuredRegion });
        }

        let mailReady = false;
<<<<<<< HEAD
        let campaignsReady = false;
        try {
            const zohoMailService = new ZohoMailService(user.id, tenantId);
=======
        try {
            const zohoMailService = new ZohoMailService(userId);
>>>>>>> origin/main
            const senderAddresses = await zohoMailService.getSenderAddresses();
            mailReady = senderAddresses.length > 0;
        } catch {
            mailReady = false;
        }

<<<<<<< HEAD
        try {
            const zohoCampaignsService = new ZohoCampaignsService(user.id, tenantId);
            campaignsReady = await zohoCampaignsService.checkCampaignsReady();
        } catch {
            campaignsReady = false;
        }

        return NextResponse.json({
            isConnected: mailReady || campaignsReady,
            mailReady,
            campaignsReady,
=======
        return NextResponse.json({
            isConnected: mailReady,
            mailReady,
>>>>>>> origin/main
            baseConnected,
            configuredRegion,
        });
    } catch (err: unknown) {
        console.error('Zoho Status Check Error:', err);
        return routeErrorResponse(err, 'Zoho status could not be checked', req);
    }
}
