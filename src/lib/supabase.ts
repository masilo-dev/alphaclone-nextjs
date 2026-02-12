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

    return createBrowserClient(
        ENV.VITE_SUPABASE_URL,
        ENV.VITE_SUPABASE_ANON_KEY
    );
};

// Legacy compatibility
export const supabase = createClient();
