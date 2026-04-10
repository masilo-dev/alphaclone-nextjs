import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { ENV } from '@/config/env'
import { createSupabaseAdminClient as createAdmin } from './supabase-admin';

const allowUnsafeMockClients = process.env.ALLOW_UNSAFE_INFRASTRUCTURE_MOCKS === 'true';

// Helper to create a chainable unavailable Supabase client for non-production fallback scenarios
const createUnavailableSupabaseClient = (serviceName: string) => {
    console.warn(`[${serviceName}] Supabase credentials are missing. Returning an unavailable client.`);

    const mockError = { message: `[${serviceName}] Supabase is not configured` };
    const mockResult = { data: null, error: mockError, count: 0 };

    const queryChain: any = new Proxy(() => { }, {
        get: (_, prop) => {
            if (prop === 'then') return Promise.resolve(mockResult).then.bind(Promise.resolve(mockResult));
            if (prop === 'catch') return Promise.resolve(mockResult).catch.bind(Promise.resolve(mockResult));
            if (prop === 'finally') return Promise.resolve(mockResult).finally.bind(Promise.resolve(mockResult));
            if (prop === 'data') return null;
            if (prop === 'error') return mockError;
            if (prop === 'count') return 0;
            if (typeof prop === 'symbol') return undefined;
            if (prop === 'toString' || prop === 'valueOf') return () => '[Mock Supabase Query]';
            return (..._args: any[]) => queryChain;
        },
        apply: () => queryChain,
    });

    const auth = {
        getUser: async () => ({ data: { user: null }, error: mockError }),
        getSession: async () => ({ data: { session: null }, error: mockError }),
        signOut: async () => ({ error: mockError }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
    };

    return new Proxy({}, {
        get: (_, prop) => {
            if (prop === 'then') return undefined;
            if (prop === 'auth') return auth;
            if (prop === 'from' || prop === 'rpc') return (..._args: any[]) => queryChain;
            if (prop === 'storage') {
                return {
                    from: (..._args: any[]) => queryChain,
                };
            }
            if (prop === 'toString' || prop === 'valueOf') return () => '[Mock Supabase Client]';
            if (typeof prop === 'symbol') return undefined;
            return queryChain;
        },
    }) as any;
};

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
