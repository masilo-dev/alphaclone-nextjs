import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { ENV } from '@/config/env'

/**
 * Creates a Supabase client for server-side use with session cookies.
 * This should be used in Server Components, API routes, and Server Actions.
 */
export async function createSupabaseServerClient() {
    // Safety check for missing environment variables during build time
    if (!ENV.VITE_SUPABASE_URL || !ENV.VITE_SUPABASE_ANON_KEY) {
        console.warn('[SupabaseServer] Missing credentials, returning mock client for build time');
        return new Proxy({} as any, {
            get: () => () => ({ data: null, error: { message: 'Supabase credentials missing' } })
        });
    }

    const cookieStore = await cookies()

    return createServerClient(
        ENV.VITE_SUPABASE_URL,
        ENV.VITE_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )
}

/**
 * Creates a Supabase client with the service role key for administrative tasks.
 * This bypasses RLS and should ONLY be used in server-side code (API routes, Server Actions).
 */
export function createSupabaseAdminClient() {
    // Safety check for missing environment variables during build time
    if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn('[SupabaseAdmin] Missing credentials, returning mock client for build time');
        return new Proxy({} as any, {
            get: () => () => ({ data: null, error: { message: 'Supabase admin credentials missing' } })
        });
    }

    return createServerClient(
        ENV.VITE_SUPABASE_URL,
        ENV.SUPABASE_SERVICE_ROLE_KEY,
        {
            cookies: {
                getAll() { return [] },
                setAll() { },
            },
        }
    )
}
