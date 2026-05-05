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
    const csp = `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' 'unsafe-inline' blob: https://*.supabase.co https://*.stripe.com https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://va.vercel-scripts.com https://*.daily.co https://*.sentry.io https://challenges.cloudflare.com https://alphaclone.tech https://*.claude.ai;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      img-src 'self' blob: data: https: http:;
      media-src 'self' blob: data: https:;
      font-src 'self' data: https://fonts.gstatic.com;
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'self' https://*.zoom.us https://zoom.us https://vercel.com https://*.vercel.app;
      frame-src 'self' blob: data: https://*.stripe.com https://js.stripe.com https://*.daily.co https://challenges.cloudflare.com https://www.loom.com https://*.loom.com https://*.claude.ai https://*.segment.com;
      connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co *.upstash.io *.stripe.com https://*.dicebear.com https://*.daily.co wss://*.daily.co https://*.sentry.io https://cdn.jsdelivr.net https://challenges.cloudflare.com https://*.hubspot.com https://images.unsplash.com https://alphaclone.tech wss://alphaclone.tech https://api.anthropic.com https://api.openai.com https://openrouter.ai https://*.claude.ai https://nominatim.openstreetmap.org https://*.facebook.com https://*.instagram.com https://*.basemaps.cartocdn.com https://raw.githubusercontent.com https://unpkg.com;
      worker-src 'self' blob: https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net;
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();

    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Content-Security-Policy', csp);
    return response;
}

export async function middleware(request: NextRequest) {
    const { pathname, searchParams } = request.nextUrl;
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

    /**
     * MCP OAuth2 Token Rewrite
     */
    if (pathname === '/token') {
        const url = request.nextUrl.clone();
        url.pathname = '/api/mcp/token';
        return NextResponse.rewrite(url);
    }

    /**
     * OAuth 2.0 Discovery Rewrites (RFC 9728 / RFC 8414)
     * Claude.ai fetches these before attempting any MCP connection.
     */
    if (pathname === '/.well-known/oauth-protected-resource') {
        const url = request.nextUrl.clone();
        url.pathname = '/api/mcp/well-known/oauth-protected-resource';
        return NextResponse.rewrite(url);
    }

    if (pathname === '/.well-known/oauth-authorization-server') {
        const url = request.nextUrl.clone();
        url.pathname = '/api/mcp/well-known/oauth-authorization-server';
        return NextResponse.rewrite(url);
    }

    // Bypass ALL middleware logic for MCP API routes to ensure no interference with SSE/JSON-RPC
    if (pathname.startsWith('/api/mcp/')) {
        return NextResponse.next();
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
        '/((?!_next/static|_next/image|favicon.ico|manifest.json|robots.txt|sitemap.xml|sw.js|workbox-.*\\.js|.well-known/workflow/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|json|map|txt|xml|webmanifest)$).*)',
    ],
};
