import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import { createUnavailableSupabaseClient } from './supabase-shared';
import { resolveSupabaseServiceRoleKey } from './supabase-service-role';

export { isSupabaseServiceRoleKey, resolveSupabaseServiceRoleKey } from './supabase-service-role';

let devFallbackWarned = false;

function getSupabaseUrl(): string | undefined {
    return (
        ENV.VITE_SUPABASE_URL ||
        ENV.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.SUPABASE_URL
    );
}

function getServiceRoleKey(): string | undefined {
    return resolveSupabaseServiceRoleKey(
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        ENV.SUPABASE_SERVICE_ROLE_KEY,
        process.env.SUPABASE_KEY
    );
}

export function hasSupabaseServiceRole(): boolean {
    return Boolean(getServiceRoleKey());
}

function createServiceRoleClient(supabaseUrl: string, serviceRoleKey: string): SupabaseClient {
    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

function createUserScopedClient(supabaseUrl: string, accessToken: string): SupabaseClient {
    const anonKey =
        ENV.VITE_SUPABASE_ANON_KEY ||
        ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!anonKey) {
        return createUnavailableSupabaseClient('SupabaseAdmin');
    }

    if (!devFallbackWarned) {
        devFallbackWarned = true;
        console.warn(
            '[SupabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is missing. Using the signed-in user session for server API routes (RLS applies). Add the service role key to .env.local for full admin access.'
        );
    }

    return createClient(supabaseUrl, anonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        },
    });
}

/**
 * Creates a Supabase client with the service role key to bypass RLS.
 * In local development, falls back to the signed-in user's JWT when the service role key is missing.
 */
export function createSupabaseAdminClient(accessToken?: string): SupabaseClient {
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getServiceRoleKey();

    if (supabaseUrl && serviceRoleKey) {
        return createServiceRoleClient(supabaseUrl, serviceRoleKey);
    }

    if (supabaseUrl && accessToken) {
        return createUserScopedClient(supabaseUrl, accessToken);
    }

    return createUnavailableSupabaseClient('SupabaseAdmin');
}

/**
 * Resolves an admin/service client, reading the current session from cookies when needed.
 */
export async function resolveSupabaseAdminClient(): Promise<SupabaseClient> {
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getServiceRoleKey();

    if (supabaseUrl && serviceRoleKey) {
        return createServiceRoleClient(supabaseUrl, serviceRoleKey);
    }

    if (supabaseUrl) {
        try {
            const { createSupabaseServerClient } = await import('./supabase-server');
            const server = await createSupabaseServerClient();
            const { data: { session } } = await server.auth.getSession();
            if (session?.access_token) {
                return createUserScopedClient(supabaseUrl, session.access_token);
            }
            // Cookie-bound SSR client already carries auth for RLS queries.
            const { data: { user } } = await server.auth.getUser();
            if (user?.id) {
                return server;
            }
        } catch (error) {
            console.warn('[SupabaseAdmin] Failed to resolve dev session fallback:', error);
        }
    }

    return createUnavailableSupabaseClient('SupabaseAdmin');
}
