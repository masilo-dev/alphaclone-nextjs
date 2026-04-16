import { NextResponse } from 'next/server';

export async function GET() {
    const requiredHeaders = {
        strictTransportSecurity: 'max-age=63072000; includeSubDomains; preload',
        xContentTypeOptions: 'nosniff',
        referrerPolicy: 'strict-origin-when-cross-origin',
        contentSecurityPolicy:
            "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data: https: http:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' blob: https: wss:; frame-src 'self' blob: data: https:; object-src 'none'; base-uri 'self'; frame-ancestors 'self' https://*.zoom.us https://zoom.us;",
    };

    const response = NextResponse.json({
        success: true,
        message: 'OWASP recommended security headers are configured.',
        requiredHeaders,
    });

    response.headers.set('Strict-Transport-Security', requiredHeaders.strictTransportSecurity);
    response.headers.set('X-Content-Type-Options', requiredHeaders.xContentTypeOptions);
    response.headers.set('Referrer-Policy', requiredHeaders.referrerPolicy);
    response.headers.set('Content-Security-Policy', requiredHeaders.contentSecurityPolicy);

    return response;
}
