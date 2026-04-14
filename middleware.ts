import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/middleware';

function applyRequiredOwaspHeaders(response: NextResponse) {
    if (!response.headers.has('Strict-Transport-Security')) {
        response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }
    if (!response.headers.has('X-Content-Type-Options')) {
        response.headers.set('X-Content-Type-Options', 'nosniff');
    }
    if (!response.headers.has('Referrer-Policy')) {
        response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    }
    if (!response.headers.has('Content-Security-Policy')) {
        response.headers.set(
            'Content-Security-Policy',
            "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self' https://*.zoom.us https://zoom.us;"
        );
    }
    return response;
}

export async function middleware(request: NextRequest) {
    const { pathname, searchParams } = request.nextUrl;

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
