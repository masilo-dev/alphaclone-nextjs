import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import { createUnavailableSupabaseClient } from './supabase-shared';

/**
 * Creates a Supabase client with the service role key to bypass RLS.
 * This is safe to use in BOTH App Router and Pages Router as it does not 
 * depend on 'next/headers'.
 */
export function createSupabaseAdminClient() {
    const supabaseUrl = ENV.VITE_SUPABASE_URL || ENV.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = ENV.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        return createUnavailableSupabaseClient('SupabaseAdmin');
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}
