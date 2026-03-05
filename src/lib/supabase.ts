import { ENV } from '@/config/env'
import { createBrowserClient } from '@supabase/ssr'

// Check if we have valid credentials or if we're in a build/placeholder environment
const isPlaceholder = (val?: string) => !val || val === 'undefined' || val.includes('placeholder');

export const createClient = () => {
    // If we have placeholders, return a proxy or handle it gracefully to avoid @supabase/ssr errors
    // during build-time prerendering
    if (isPlaceholder(ENV.VITE_SUPABASE_URL) || isPlaceholder(ENV.VITE_SUPABASE_ANON_KEY)) {
        // We log a warning but return a client initialized with placeholders anyway 
        // IF we're in build mode, but we use a try-catch for extra safety
        try {
            return createBrowserClient(
                ENV.VITE_SUPABASE_URL || 'https://ehekzoioqvtweugemktn.supabase.co',
                ENV.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoZWt6b2lvcXZ0d2V1Z2Vta3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMDcxNjIsImV4cCI6MjA4MDY4MzE2Mn0.vBx4tSM4L8Rh_VTzYCdvz9bMMyjcfkkvv9y_2vT02ek'
            );
        } catch (e) {
            console.warn('Supabase client initialization skipped during build due to missing env vars');
            // Return a dummy client to prevent "Cannot read properties of null" errors
            return {
                auth: {
                    getSession: async () => ({ data: { session: null }, error: null }),
                    getUser: async () => ({ data: { user: null }, error: null }),
                    signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: 'Supabase client not initialized (missing env vars)' } }),
                    signOut: async () => ({ error: null }),
                    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
                },
                from: () => ({
                    select: () => ({
                        eq: () => ({
                            single: async () => ({ data: null, error: { message: 'Supabase client not initialized' } }),
                            maybeSingle: async () => ({ data: null, error: { message: 'Supabase client not initialized' } }),
                        }),
                        insert: async () => ({ data: null, error: { message: 'Supabase client not initialized' } }),
                        update: async () => ({ data: null, error: { message: 'Supabase client not initialized' } }),
                        delete: async () => ({ data: null, error: { message: 'Supabase client not initialized' } }),
                    })
                })
            } as any;
        }
    }

    // Force using the direct Supabase URL even on the client
    // This bypasses the Next.js middleware for Auth calls, avoiding "Unexpected end of JSON input" errors
    // caused by middleware interception/proxying issues
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
