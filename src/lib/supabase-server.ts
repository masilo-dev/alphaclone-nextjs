import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { ENV } from '@/config/env'

// Helper to create a chainable mock Supabase client for build time
const createMockSupabaseClient = (serviceName: string) => {
    console.warn(`[${serviceName}] Missing credentials, returning mock client for build time`);
    
    // The Super Ultimate Proxy: handles destructuring, chaining, and function calls
    const mock: any = new Proxy(() => {}, {
        get: (target, prop) => {
            if (prop === 'then') return undefined;
            if (prop === 'error') return null; // Error should be null to avoid triggering error checks
            if (typeof prop === 'symbol') return undefined;
            if (prop === 'toString' || prop === 'valueOf') return () => '[Mock Supabase Object]';
            if (prop === 'id') return 'mock-uuid-for-build';

            // For any other property (including 'data'), return the mock again to support nested destructuring
            // e.g. { data: { user } } works because mock.data is mock, and mock.user is mock
            return mock;
        },
        apply: (target, thisArg, argList) => {
            return mock;
        }
    });
    
    return mock;
};

/**
 * Creates a Supabase client for server-side use with session cookies.
 * This should be used in Server Components, API routes, and Server Actions.
 */
export async function createSupabaseServerClient() {
    // Safety check for missing environment variables during build time
    if (!ENV.VITE_SUPABASE_URL || !ENV.VITE_SUPABASE_ANON_KEY) {
        return createMockSupabaseClient('SupabaseServer');
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
        return createMockSupabaseClient('SupabaseAdmin');
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
