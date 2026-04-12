import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { rateLimitMiddleware, rateLimitConfigs } from './rateLimit'

export async function updateSession(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const requestId = request.headers.get('x-request-id')?.trim() || crypto.randomUUID();
    const forwardHeaders = new Headers(request.headers);
    forwardHeaders.set('x-request-id', requestId);

    const withRequestIdHeader = (res: NextResponse) => {
        res.headers.set('x-request-id', requestId);
        return res;
    };

    // DIRECT BYPASS: Ensure direct Supabase Auth and Storage calls are never intercepted by application middleware logic
    // This is a safety layer for the "Unexpected end of JSON input" error and prevents binary corruption
    if (pathname.includes('/auth/v1/') || pathname.includes('/storage/v1/')) {
        return withRequestIdHeader(
            NextResponse.next({ request: { headers: forwardHeaders } })
        );
    }

    // Authentication routes - enabled for Phase 1 hardening
    if (pathname.includes('/api/auth/login') || pathname.includes('/auth/login')) {
        const rateLimitResponse = await rateLimitMiddleware(request, rateLimitConfigs.auth.login);
        if (rateLimitResponse) return withRequestIdHeader(rateLimitResponse);
    }

    if (pathname.includes('/api/auth/signup') || pathname.includes('/auth/signup') || pathname.includes('/auth/register')) {
        const rateLimitResponse = await rateLimitMiddleware(request, rateLimitConfigs.auth.signup);
        if (rateLimitResponse) return withRequestIdHeader(rateLimitResponse);
    }

    if (pathname.includes('password-reset') || pathname.includes('reset-password') || pathname.includes('/api/auth/reset')) {
        const rateLimitResponse = await rateLimitMiddleware(request, rateLimitConfigs.auth.passwordReset);
        if (rateLimitResponse) return withRequestIdHeader(rateLimitResponse);
    }

    // AI Agent and Scraper routes - Protection against resource/cost exhaustion
    if (pathname.includes('/api/alpha/')) {
        const rateLimitResponse = await rateLimitMiddleware(request, rateLimitConfigs.api.heavy);
        if (rateLimitResponse) return withRequestIdHeader(rateLimitResponse);
    }

    if (pathname.includes('/api/scraper/')) {
        const rateLimitResponse = await rateLimitMiddleware(request, rateLimitConfigs.api.standard);
        if (rateLimitResponse) return withRequestIdHeader(rateLimitResponse);
    }


    // API routes - moderate rate limiting
    if (pathname.startsWith('/api/')) {
        const isHeavyEndpoint = pathname.includes('/ai/') || pathname.includes('/export') || pathname.includes('/generate');
        const config = isHeavyEndpoint ? rateLimitConfigs.api.heavy : rateLimitConfigs.api.standard;
        const rateLimitResponse = await rateLimitMiddleware(request, config);
        if (rateLimitResponse) return withRequestIdHeader(rateLimitResponse);
    }

    // Contact form - prevent spam
    if (pathname.includes('/contact') && request.method === 'POST') {
        const rateLimitResponse = await rateLimitMiddleware(request, rateLimitConfigs.public.contact);
        if (rateLimitResponse) return withRequestIdHeader(rateLimitResponse);
    }

    let response = withRequestIdHeader(
        NextResponse.next({
            request: {
                headers: forwardHeaders,
            },
        })
    );

    try {
        // Direct access to environment variables to avoid importing 'zod' or heavy config modules in Edge Runtime
        // We check all possible variations to be safe
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            // Log error but allow request to proceed (as unauthenticated) to prevent 500 crash
            console.error('Middleware Warning: Missing Supabase Environment Variables');
            return response;
        }

        const supabase = createServerClient(
            supabaseUrl,
            supabaseKey,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll()
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                        response = NextResponse.next({
                            request: {
                                headers: forwardHeaders,
                            },
                        })
                        response.headers.set('x-request-id', requestId);
                        cookiesToSet.forEach(({ name, value, options }) =>
                            response.cookies.set(name, value, options)
                        )
                    },
                },
            }
        )

        // OPTIMIZATION: Only fetch user if we strictly need it for server-side redirection.
        // Currently, redirection is handled client-side or commented out, so we skip this to save ~500ms-2s of TTFB.
        /*
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
            return NextResponse.redirect(new URL('/', request.url))
        }
        */
    } catch (e) {
        // Catch any other errors (e.g. Supabase connection issues) to prevent 500s
        console.error('Middleware Logic Error:', e);
        // On error, we just return the response as-is, defaulting to "not logged in" behavior implicitly
        // or letting the page handle the unauth state.
        return response;
    }

    return response
}
