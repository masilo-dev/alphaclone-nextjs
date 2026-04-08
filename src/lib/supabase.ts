import { ENV } from '@/config/env'
import { createBrowserClient } from '@supabase/ssr'

const isPlaceholder = (val?: string) => !val || val === 'undefined' || val.includes('placeholder');

const createUnavailableClient = () => {
    const configError = { message: 'Supabase client is not configured' };
    const queryResult = Promise.resolve({ data: null, error: configError, count: 0 });

    const queryChain: any = new Proxy(() => { }, {
        get: (_, prop) => {
            if (prop === 'then') return queryResult.then.bind(queryResult);
            if (prop === 'catch') return queryResult.catch.bind(queryResult);
            if (prop === 'finally') return queryResult.finally.bind(queryResult);
            if (prop === 'data') return null;
            if (prop === 'error') return configError;
            if (prop === 'count') return 0;
            if (typeof prop === 'symbol') return undefined;
            return (..._args: any[]) => queryChain;
        },
        apply: () => queryChain,
    });

    return new Proxy({} as any, {
        get: (_target, prop) => {
            if (prop === 'auth') {
                return {
                    getSession: async () => ({ data: { session: null }, error: configError }),
                    getUser: async () => ({ data: { user: null }, error: configError }),
                    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
                    signOut: async () => ({ error: configError }),
                };
            }

            if (prop === 'from' || prop === 'rpc') {
                return (..._args: any[]) => queryChain;
            }

            if (typeof prop === 'symbol') return undefined;
            return queryChain;
        },
    });
};

export const createClient = () => {
    if (isPlaceholder(ENV.VITE_SUPABASE_URL) || isPlaceholder(ENV.VITE_SUPABASE_ANON_KEY)) {
        console.warn('[Supabase] Missing credentials, returning unavailable client');
        return createUnavailableClient();
    }

    const supabaseUrl = ENV.VITE_SUPABASE_URL;

    return createBrowserClient(
        supabaseUrl,
        ENV.VITE_SUPABASE_ANON_KEY,
        {
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
                // Increased timeout for connection attempts to be more resilient
                timeout: 30000,
            }
        }
    );
};

// Legacy compatibility
export const supabase = createClient();
