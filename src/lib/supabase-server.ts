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
    const supabaseUrl = ENV.VITE_SUPABASE_URL || ENV.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = ENV.VITE_SUPABASE_ANON_KEY || ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
        if (process.env.NODE_ENV === 'production' && !allowUnsafeMockClients) {
            throw new Error('[SupabaseServer] Required Supabase environment variables are missing');
        }

        return createUnavailableSupabaseClient('SupabaseServer');
    }

    const { cookies } = await import('next/headers');
    const cookieStore = await cookies()

    return createServerClient(
        supabaseUrl,
        anonKey,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        const allCookies = cookieStore.getAll();
                        const sbCookieNames = allCookies
                            .map(c => c.name)
                            .filter(name => name.startsWith('sb-') && name.includes('-auth-token'));
                        
                        const newCookieNames = new Set(cookiesToSet.map(c => c.name));
                        
                        sbCookieNames.forEach(oldName => {
                            if (!newCookieNames.has(oldName)) {
                                cookieStore.set(oldName, '', { expires: new Date(0), path: '/' });
                            }
                        });

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
