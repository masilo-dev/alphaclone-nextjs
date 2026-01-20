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
                ENV.VITE_SUPABASE_URL || 'https://placeholder.supabase.co',
                ENV.VITE_SUPABASE_ANON_KEY || 'placeholder'
            );
        } catch (e) {
            console.warn('Supabase client initialization skipped during build due to missing env vars');
            return null as any;
        }
    }

    return createBrowserClient(
        ENV.VITE_SUPABASE_URL,
        ENV.VITE_SUPABASE_ANON_KEY
    );
};

// Legacy compatibility
export const supabase = createClient();
