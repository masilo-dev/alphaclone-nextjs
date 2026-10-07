import { ENV } from '@/config/env';
import { createBrowserClient } from '@supabase/ssr';
import { createUnavailableSupabaseClient, isSupabaseConfigured } from './supabase-shared';

export { isSupabaseConfigured, SUPABASE_NOT_CONFIGURED_MESSAGE } from './supabase-shared';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function resilientSupabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const isAuthToken = url.includes('/auth/v1/token');
    const retryableMethod = ['GET', 'HEAD', 'OPTIONS'].includes(method) || isAuthToken;
    const maxAttempts = retryableMethod ? 3 : 1;

    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
            const response = await fetch(input, init);
            if (![408, 429, 502, 503, 504, 520, 522, 524].includes(response.status) || attempt === maxAttempts - 1) {
                return response;
            }
        } catch (error) {
            lastError = error;
            if (attempt === maxAttempts - 1) throw error;
        }
        await sleep(250 * 2 ** attempt + Math.floor(Math.random() * 150));
    }
    throw lastError instanceof Error ? lastError : new Error('Supabase request failed after retries');
}

export const createClient = () => {
    if (!isSupabaseConfigured()) {
        return createUnavailableSupabaseClient('Supabase');
    }

    const supabaseUrl =
        ENV.VITE_SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.SUPABASE_URL!;
    const supabaseAnonKey =
        ENV.VITE_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

    return createBrowserClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
        global: {
            fetch: resilientSupabaseFetch,
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
