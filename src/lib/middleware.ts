import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { rateLimitMiddleware, rateLimitConfigs } from './rateLimit'

export async function updateSession(request: NextRequest) {
    // Apply rate limiting based on route
    const pathname = request.nextUrl.pathname;

    // Authentication routes - strict rate limiting
    if (pathname.startsWith('/api/auth/login') || pathname.startsWith('/auth/login')) {
        const rateLimitResponse = await rateLimitMiddleware(request, rateLimitConfigs.auth.login);
        if (rateLimitResponse && rateLimitResponse.status === 429) {
            return rateLimitResponse;
        }
    }

    if (pathname.startsWith('/api/auth/signup') || pathname.startsWith('/auth/signup')) {
        const rateLimitResponse = await rateLimitMiddleware(request, rateLimitConfigs.auth.signup);
        if (rateLimitResponse && rateLimitResponse.status === 429) {
            return rateLimitResponse;
        }
    }

    if (pathname.includes('password-reset') || pathname.includes('reset-password')) {
        const rateLimitResponse = await rateLimitMiddleware(request, rateLimitConfigs.auth.passwordReset);
        if (rateLimitResponse && rateLimitResponse.status === 429) {
            return rateLimitResponse;
        }
    }

    // API routes - moderate rate limiting
    if (pathname.startsWith('/api/')) {
        const isHeavyEndpoint = pathname.includes('/ai/') || pathname.includes('/export') || pathname.includes('/generate');
        const config = isHeavyEndpoint ? rateLimitConfigs.api.heavy : rateLimitConfigs.api.standard;
        const rateLimitResponse = await rateLimitMiddleware(request, config);
        if (rateLimitResponse && rateLimitResponse.status === 429) {
            return rateLimitResponse;
        }
    }

    // Contact form - prevent spam
    if (pathname.includes('/contact') && request.method === 'POST') {
        const rateLimitResponse = await rateLimitMiddleware(request, rateLimitConfigs.public.contact);
        if (rateLimitResponse && rateLimitResponse.status === 429) {
            return rateLimitResponse;
        }
    }

    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

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
                                headers: request.headers,
                            },
                        })
                        cookiesToSet.forEach(({ name, value, options }) =>
                            response.cookies.set(name, value, options)
                        )
                    },
                },
            }
        )

        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
            return NextResponse.redirect(new URL('/', request.url))
        }
    } catch (e) {
        // Catch any other errors (e.g. Supabase connection issues) to prevent 500s
        console.error('Middleware Logic Error:', e);
        // On error, we just return the response as-is, defaulting to "not logged in" behavior implicitly
        // or letting the page handle the unauth state.
        return response;
    }

    return response
}
