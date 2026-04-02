import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/middleware';

export async function middleware(request: NextRequest) {
    const { pathname, searchParams } = request.nextUrl;

    /**
     * Facebook/WhatsApp Webhook Verification Rewrite
     *
     * Meta's webhook verification sends a GET request to the callback URL
     * configured in the Meta App Dashboard. If the callback URL is set to
     * /dashboard/business/facebook, this middleware intercepts the request
     * and rewrites it to the API webhook handler.
     *
     * Meta sends: GET /dashboard/business/facebook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
     * We rewrite to: GET /api/webhooks/facebook/whatsapp?hub.mode=...&hub.verify_token=...&hub.challenge=...
     */
    if (
        pathname === '/dashboard/business/facebook' &&
        searchParams.has('hub.mode') &&
        searchParams.has('hub.verify_token') &&
        searchParams.has('hub.challenge')
    ) {
        const url = request.nextUrl.clone();
        url.pathname = '/api/webhooks/facebook/whatsapp';
        return NextResponse.rewrite(url);
    }

    /**
     * Facebook/WhatsApp Webhook POST Rewrite
     *
     * Meta sends POST requests to the callback URL when events occur.
     * Rewrite these to the API webhook handler.
     */
    if (
        pathname === '/dashboard/business/facebook' &&
        request.method === 'POST'
    ) {
        const url = request.nextUrl.clone();
        url.pathname = '/api/webhooks/facebook/whatsapp';
        return NextResponse.rewrite(url);
    }

    return await updateSession(request);
}

export const config = {
    matcher: [
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
