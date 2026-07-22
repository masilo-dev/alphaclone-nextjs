import { ENV } from '@/config/env';
import { createBrowserClient } from '@supabase/ssr';
import { createUnavailableSupabaseClient, isSupabaseConfigured } from './supabase-shared';

export { isSupabaseConfigured, SUPABASE_NOT_CONFIGURED_MESSAGE } from './supabase-shared';

export const createClient = () => {
    if (!isSupabaseConfigured()) {
        return createUnavailableSupabaseClient('Supabase');
    }

    const supabaseUrl = ENV.VITE_SUPABASE_URL!;

    return createBrowserClient(supabaseUrl, ENV.VITE_SUPABASE_ANON_KEY!, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
        global: {
            fetch: (...args) => fetch(...args),
        },
        realtime: {
            params: {
                eventsPerSecond: 10,
            },
            timeout: 30000,
        },
    });
};

// Legacy compatibility
export const supabase = createClient();
