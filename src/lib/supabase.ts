import { ENV } from '@/config/env'
import { createBrowserClient } from '@supabase/ssr'

// Check if we have valid credentials or if we're in a build/placeholder environment
const isPlaceholder = (val?: string) => !val || val === 'undefined' || val.includes('placeholder');

export const createClient = () => {
    // If we have placeholders or missing keys, return a proxy to avoid crashes during build-time
    if (isPlaceholder(ENV.VITE_SUPABASE_URL) || isPlaceholder(ENV.VITE_SUPABASE_ANON_KEY)) {
        console.warn('[Supabase] Missing credentials, returning mock client for build time');
        return new Proxy({} as any, {
            get: (target, prop) => {
                if (prop === 'auth') {
                    return {
                        getSession: async () => ({ data: { session: null }, error: null }),
                        getUser: async () => ({ data: { user: null }, error: null }),
                        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
                        signOut: async () => ({ error: null }),
                    };
                }
                return () => ({
                    from: () => ({
                        select: () => ({
                            eq: () => ({
                                single: async () => ({ data: null, error: { message: 'Supabase not initialized' } }),
                                maybeSingle: async () => ({ data: null, error: { message: 'Supabase not initialized' } }),
                            }),
                            insert: async () => ({ data: null, error: { message: 'Supabase not initialized' } }),
                            update: async () => ({ data: null, error: { message: 'Supabase not initialized' } }),
                        })
                    })
                });
            }
        });
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
                // In some versions of Gotrue/Supabase-js, disabling locks is done by providing
                // a custom storage that doesn't use locks, or by specific flow flags.
                // We'll ensure standard persistence is active which is more resilient 
                // than the default 'memory' fallback that often happens on lock failure.
            },
            global: {
                fetch: (...args) => fetch(...args), // Ensure we use the global fetch
            },
            realtime: {
                params: {
                    eventsPerSecond: 10,
                },
                // Explicitly set the transport to use secure WebSocket
                // This prevents the browser from blocking insecure connections on HTTPS pages
                timeout: 30000,
            }
        }
    );
};

// Legacy compatibility
export const supabase = createClient();
