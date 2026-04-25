import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/middleware';

type PlatformPolicy = {
    maintenanceMode: boolean;
    openRegistration: boolean;
};

let cachedPolicy: PlatformPolicy | null = null;
let cachedPolicyAt = 0;
const POLICY_TTL_MS = 30_000;

async function fetchPlatformPolicy(): Promise<PlatformPolicy> {
    const now = Date.now();
    if (cachedPolicy && now - cachedPolicyAt < POLICY_TTL_MS) {
        return cachedPolicy;
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
        return { maintenanceMode: false, openRegistration: true };
    }

    try {
        const baseUrl = supabaseUrl.replace(/\/+$/, '');
        const response = await fetch(
            `${baseUrl}/rest/v1/platform_global_settings?singleton_key=eq.default&select=settings&limit=1`,
            {
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`,
                },
                cache: 'no-store',
            }
        );
        const rows = response.ok ? await response.json() : [];
        const settings = Array.isArray(rows) && rows.length > 0 ? rows[0]?.settings || {} : {};
        const policy: PlatformPolicy = {
            maintenanceMode: Boolean(settings?.security?.maintenanceMode),
            openRegistration: settings?.security?.openRegistration !== false,
        };
        cachedPolicy = policy;
        cachedPolicyAt = now;
        return policy;
    } catch {
        return { maintenanceMode: false, openRegistration: true };
    }
}

function applyRequiredOwaspHeaders(response: NextResponse) {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data: https: http:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' blob: https: wss:; frame-src 'self' blob: data: https:; object-src 'none'; base-uri 'self'; frame-ancestors 'self' https://*.zoom.us https://zoom.us;"
    );
    return response;
}

export async function middleware(request: NextRequest) {
    const { pathname, searchParams } = request.nextUrl;
    const hostname = request.nextUrl.hostname.toLowerCase();

    // Keep production host canonical to avoid third-party origin mismatches
    // (notably Cloudflare Turnstile sitekey/domain validation and postMessage target checks).
    if (hostname === 'www.alphaclonesystems.com') {
        const url = request.nextUrl.clone();
        url.hostname = 'alphaclonesystems.com';
        return applyRequiredOwaspHeaders(NextResponse.redirect(url, 308));
    }

    const policy = await fetchPlatformPolicy();

    // Canonical route consolidation to close legacy entry points.
    if (pathname === '/dashboard/gmail') {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard/mail';
        return applyRequiredOwaspHeaders(NextResponse.redirect(url));
    }
    if (pathname === '/dashboard/business/referrals') {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard/business/clients';
        return applyRequiredOwaspHeaders(NextResponse.redirect(url));
    }

    const maintenanceAllowedPaths = [
        '/maintenance',
        '/api/admin/platform-settings',
        '/auth/login',
    ];

    if (policy.maintenanceMode) {
        const isAllowed =
            maintenanceAllowedPaths.some((path) => pathname.startsWith(path)) ||
            pathname.startsWith('/_next/') ||
            pathname === '/favicon.ico';
        if (!isAllowed) {
            const url = request.nextUrl.clone();
            url.pathname = '/maintenance';
            return applyRequiredOwaspHeaders(NextResponse.redirect(url));
        }
    }

    if (!policy.openRegistration) {
        if (pathname === '/register') {
            const url = request.nextUrl.clone();
            url.pathname = '/auth/login';
            url.searchParams.delete('register');
            return applyRequiredOwaspHeaders(NextResponse.redirect(url));
        }
        if (pathname === '/auth/login' && searchParams.get('register') === 'true') {
            const url = request.nextUrl.clone();
            url.searchParams.delete('register');
            return applyRequiredOwaspHeaders(NextResponse.redirect(url));
        }
    }

    /**
     * Facebook/WhatsApp Webhook Verification Rewrite
     */
    if (
        pathname === '/dashboard/business/facebook' &&
        searchParams.has('hub.mode') &&
        searchParams.has('hub.verify_token') &&
        searchParams.has('hub.challenge')
    ) {
        const url = request.nextUrl.clone();
        url.pathname = '/api/webhooks/facebook/whatsapp';
        return applyRequiredOwaspHeaders(NextResponse.rewrite(url));
    }

    /**
     * Facebook/WhatsApp Webhook POST Rewrite
     */
    if (
        pathname === '/dashboard/business/facebook' &&
        request.method === 'POST'
    ) {
        const url = request.nextUrl.clone();
        url.pathname = '/api/webhooks/facebook/whatsapp';
        return applyRequiredOwaspHeaders(NextResponse.rewrite(url));
    }

    const response = await updateSession(request);
    return applyRequiredOwaspHeaders(response);
}

export const config = {
    matcher: [
        /*
         * Root must be listed explicitly; the catch-all below can omit pathname "/".
         */
        '/',
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
