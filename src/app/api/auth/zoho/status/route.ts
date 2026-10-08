import { NextRequest, NextResponse } from 'next/server';
import { ZohoService, ZohoAuthExpiredError } from '../../../../../services/zoho/ZohoService';
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

type StatusResult = {
    isConnected: boolean;
    healthStatus: string;
    healthDetails?: unknown;
    mailReady: boolean;
    campaignsReady: boolean;
    baseConnected: boolean;
    configuredRegion: string | null;
    needsReconnect: boolean;
};

const statusCache = new Map<string, { data: StatusResult; expiresAt: number }>();
const inFlightStatus = new Map<string, Promise<StatusResult>>();
const STATUS_CACHE_TTL_MS = 30_000;

export async function GET(req: NextRequest) {
    const tenantId = req.nextUrl.searchParams.get('tenantId')?.trim() || '';
    const force = req.nextUrl.searchParams.get('force') === 'true' || req.nextUrl.searchParams.get('refresh') === 'true';

    try {
        const { user } = await requireTenantAccess(tenantId, req);
        const cacheKey = `${user.id}:${tenantId}`;

        if (!force) {
            const cached = statusCache.get(cacheKey);
            if (cached && Date.now() < cached.expiresAt) {
                return NextResponse.json(cached.data);
            }
        }

        const existingFlight = inFlightStatus.get(cacheKey);
        if (existingFlight) {
            const result = await existingFlight;
            return NextResponse.json(result);
        }

        const flightPromise = (async (): Promise<StatusResult> => {
            const zohoService = new ZohoService(user.id, tenantId);
            // Proactively ensure access token is fresh before health checks.
            try {
                await zohoService.getValidAccessToken();
            } catch (refreshErr) {
                if (!(refreshErr instanceof ZohoAuthExpiredError)) {
                    console.warn('[zoho/status] token refresh skipped:', refreshErr);
                }
            }
            const config = await zohoService.getConfig();
            const configuredRegion = inferZohoRegionFromAccountsServer(config?.accountsServer);
            const health = await zohoService.getDetailedHealthStatus();

            let mailReady = false;
            let campaignsReady = false;
            if (health.tokenValid) {
                // Independent Zoho round-trips; run them together so the inbox's
                // connection gate is not waiting on serial network hops.
                const zohoMailService = new ZohoMailService(user.id, tenantId);
                const zohoCampaignsService = new ZohoCampaignsService(user.id, tenantId);
                const [senderRes, campaignsRes] = await Promise.allSettled([
                    zohoMailService.getSenderAddresses(),
                    zohoCampaignsService.checkCampaignsReady(),
                ]);
                mailReady = senderRes.status === 'fulfilled' && senderRes.value.length > 0;
                campaignsReady = campaignsRes.status === 'fulfilled' && campaignsRes.value === true;
            }

            const data: StatusResult = {
                isConnected: health.status === 'connected_and_ready' || health.status === 'connected_sender_setup_required',
                healthStatus: health.status,
                healthDetails: health.details,
                mailReady,
                campaignsReady,
                baseConnected: health.tokenValid,
                configuredRegion,
                needsReconnect: health.status === 'auth_expired',
            };

            statusCache.set(cacheKey, { data, expiresAt: Date.now() + STATUS_CACHE_TTL_MS });
            return data;
        })();

        inFlightStatus.set(cacheKey, flightPromise);
        try {
            const data = await flightPromise;
            return NextResponse.json(data);
        } finally {
            inFlightStatus.delete(cacheKey);
        }
    } catch (err: unknown) {
        console.error('Zoho Status Check Error:', err);
        return routeErrorResponse(err, 'Zoho status could not be checked', req);
    }
}
