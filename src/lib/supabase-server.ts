import { createServerClient } from '@supabase/ssr'

import { ENV } from '@/config/env'
import { createSupabaseAdminClient as createAdmin } from './supabase-admin';
import { createUnavailableSupabaseClient } from './supabase-shared';

const allowUnsafeMockClients = process.env.ALLOW_UNSAFE_INFRASTRUCTURE_MOCKS === 'true';

/**
 * Creates a Supabase client for server-side use with session cookies.
 * This should be used in Server Components, API routes, and Server Actions.
 */
export async function createSupabaseServerClient() {
    if (!ENV.VITE_SUPABASE_URL || !ENV.VITE_SUPABASE_ANON_KEY) {
        if (process.env.NODE_ENV === 'production' && !allowUnsafeMockClients) {
            throw new Error('[SupabaseServer] Required Supabase environment variables are missing');
        }

        return createUnavailableSupabaseClient('SupabaseServer');
    }

    const { cookies } = await import('next/headers');
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
 * Re-export admin client from the isomorphized helper.
 * This is kept here for backward compatibility with App Router code.
 */
export function createSupabaseAdminClient() {
    return createAdmin();
}
