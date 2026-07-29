import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { rateLimitMiddleware, rateLimitConfigs } from './rateLimit'

export async function updateSession(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const accept = request.headers.get('accept') || '';
    const fetchDest = request.headers.get('sec-fetch-dest') || '';
    const isProtectedPage = pathname.startsWith('/dashboard') || pathname === '/alpha';
    const isDashboardNavigation =
        isProtectedPage &&
        (fetchDest === 'document' || accept.includes('text/html'));
    const requestId = request.headers.get('x-request-id')?.trim() || crypto.randomUUID();
    const forwardHeaders = new Headers(request.headers);
    forwardHeaders.set('x-request-id', requestId);

    const withRequestIdHeader = (res: NextResponse) => {
        res.headers.set('x-request-id', requestId);
        return res;
    };

    // Rate limit direct Supabase endpoints (/auth/v1/, /storage/v1/, /rest/v1/) to prevent resource exhaustion
    if (pathname.includes('/auth/v1/') || pathname.includes('/storage/v1/') || pathname.includes('/rest/v1/')) {
        const rateLimitResponse = await rateLimitMiddleware(request, rateLimitConfigs.supabase.standard);
        if (rateLimitResponse) return withRequestIdHeader(rateLimitResponse);
    }

    // DIRECT BYPASS: Ensure direct Supabase Auth and Storage calls are never intercepted by application middleware logic
    // This is a safety layer for the "Unexpected end of JSON input" error and prevents binary corruption
    if (pathname.includes('/auth/v1/') || pathname.includes('/storage/v1/')) {
        return withRequestIdHeader(
            NextResponse.next({ request: { headers: forwardHeaders } })
        );
    }

    // Authentication routes - enabled for Phase 1 hardening
    // Only rate limit POST requests to prevent Next.js prefetching or standard page loads from triggering 429s.
    if ((pathname.includes('/api/auth/login') || pathname.includes('/auth/login')) && request.method === 'POST') {
        const rateLimitResponse = await rateLimitMiddleware(request, rateLimitConfigs.auth.login);
        if (rateLimitResponse) return withRequestIdHeader(rateLimitResponse);
    }

    if ((pathname.includes('/api/auth/signup') || pathname.includes('/auth/signup') || pathname.includes('/auth/register')) && request.method === 'POST') {
        const rateLimitResponse = await rateLimitMiddleware(request, rateLimitConfigs.auth.signup);
        if (rateLimitResponse) return withRequestIdHeader(rateLimitResponse);
    }

    if ((pathname.includes('password-reset') || pathname.includes('reset-password') || pathname.includes('/api/auth/reset')) && request.method === 'POST') {
        const rateLimitResponse = await rateLimitMiddleware(request, rateLimitConfigs.auth.passwordReset);
        if (rateLimitResponse) return withRequestIdHeader(rateLimitResponse);
    }

    // AI Agent and Scraper routes - Protection against resource/cost exhaustion
    if (pathname === '/api/alpha' || pathname.startsWith('/api/alpha/')) {
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
            if (isDashboardNavigation) {
                const url = request.nextUrl.clone();
                url.pathname = '/maintenance';
                url.search = '';
                url.searchParams.set('reason', 'authentication_unavailable');
                return withRequestIdHeader(NextResponse.redirect(url));
            }
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
                        const allCookies = request.cookies.getAll();
                        const sbCookieNames = allCookies
                            .map(c => c.name)
                            .filter(name => name.startsWith('sb-') && name.includes('-auth-token'));
                        
                        const newCookieNames = new Set(cookiesToSet.map(c => c.name));
                        
                        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                        
                        response = NextResponse.next({
                            request: {
                                headers: forwardHeaders,
                            },
                        })
                        response.headers.set('x-request-id', requestId);

                        sbCookieNames.forEach(oldName => {
                            if (!newCookieNames.has(oldName)) {
                                response.cookies.set(oldName, '', { expires: new Date(0), path: '/' });
                            }
                        });

                        cookiesToSet.forEach(({ name, value, options }) =>
                            response.cookies.set(name, value, options)
                        )
                    },
                },
            }
        )

        // HARD GATE: Enforce trial and subscription status for dashboard routes
<<<<<<< HEAD
        if (isProtectedPage) {
            if (!isDashboardNavigation) {
                return response;
            }

            const { data: { user } } = await supabase.auth.getUser();

=======
        if (pathname.startsWith('/dashboard')) {
            const { data: { user } } = await supabase.auth.getUser();

>>>>>>> origin/main
            if (!user) {
                const url = request.nextUrl.clone();
                url.pathname = '/auth/login';
                url.searchParams.set('next', pathname);
                return NextResponse.redirect(url);
            }

<<<<<<< HEAD
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('account_status')
                .eq('id', user.id)
                .maybeSingle();

            if (profileError) throw profileError;

            if (!profile || profile.account_status === 'deleted' || profile.account_status === 'pending_deletion') {
                const url = request.nextUrl.clone();
                url.pathname = '/auth/login';
                url.searchParams.set('reason', profile?.account_status === 'pending_deletion' ? 'account_deletion_scheduled' : 'account_removed');
                const redirect = NextResponse.redirect(url);
                redirect.cookies.getAll()
                    .filter((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
                    .forEach((c) => redirect.cookies.set(c.name, '', { expires: new Date(0), path: '/' }));
                return redirect;
            }

            if (profile.account_status === 'suspended') {
                const url = request.nextUrl.clone();
                url.pathname = '/auth/login';
                url.searchParams.set('reason', 'account_suspended');
                const redirect = NextResponse.redirect(url);
                redirect.cookies.getAll()
                    .filter((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
                    .forEach((c) => redirect.cookies.set(c.name, '', { expires: new Date(0), path: '/' }));
                return redirect;
            }

            // Tenant membership and subscription authorization are enforced by
            // tenant-scoped server routes. Never trust user_metadata.tenant_id here.
=======
            // Skip gate for the upgrade page itself to avoid redirect loops
            if (pathname.startsWith('/billing/upgrade')) {
                return response;
            }

            const tenantId = user.user_metadata?.tenant_id;
            if (tenantId) {
                // Fetch tenant status directly using service-role-like apikey (anon key works if RLS allows, but we need reliability)
                // In middleware, we use the user's own supabase client which is restricted by RLS.
                // Assuming RLS allows users to see their own tenant record.
                const { data: tenant } = await supabase
                    .from('tenants')
                    .select('subscription_status, trial_ends_at')
                    .eq('id', tenantId)
                    .single();

                if (tenant) {
                    const isTrialExpired = 
                        tenant.subscription_status === 'trial' && 
                        tenant.trial_ends_at && 
                        new Date(tenant.trial_ends_at) < new Date();
                    
                    const isInactive = ['suspended', 'cancelled', 'past_due'].includes(tenant.subscription_status);

                    if (isTrialExpired || isInactive) {
                        console.log(`[Middleware] Hard Gate: Redirecting tenant ${tenantId} (Status: ${tenant.subscription_status}) to upgrade.`);
                        const url = request.nextUrl.clone();
                        url.pathname = '/billing/upgrade';
                        return NextResponse.redirect(url);
                    }
                }
            }
>>>>>>> origin/main
        }
    } catch (e) {
        console.error('Middleware Logic Error:', e);
<<<<<<< HEAD
        if (isDashboardNavigation) {
            const url = request.nextUrl.clone();
            url.pathname = '/maintenance';
            url.search = '';
            url.searchParams.set('reason', 'authentication_unavailable');
            return withRequestIdHeader(NextResponse.redirect(url));
        }
=======
>>>>>>> origin/main
        return response;
    }

    return response
}
