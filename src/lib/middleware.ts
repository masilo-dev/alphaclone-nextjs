import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
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
