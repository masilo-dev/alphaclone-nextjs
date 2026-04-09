import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/middleware';

export async function proxy(request: NextRequest) {
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
        return NextResponse.rewrite(url);
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
