import { z } from 'zod';

/**
 * Environment variable validation schema
 * Ensures all required environment variables are present and valid
 */
/**
 * Environment variable validation schema
 * Ensures all required environment variables are present and valid
 */
const envSchema = z.object({
    // Supabase (required)
    // Accept either VITE_ or NEXT_PUBLIC_ prefixes, or raw
    NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL').optional(),
    VITE_SUPABASE_URL: z.string().url('Invalid Supabase URL').optional(),

    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required').optional(),
    VITE_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required').optional(),

    // AI Services (priority: Anthropic → OpenAI → Gemini)
    // Anthropic Claude (recommended primary)
    ANTHROPIC_API_KEY: z.string().optional(),
    // OpenAI GPT (recommended secondary)
    OPENAI_API_KEY: z.string().optional(),
    // Google Gemini (fallback)
    VITE_GEMINI_API_KEY: z.string().optional(),

    // Daily.co (optional - for video calls, domain is required if using video)
    VITE_DAILY_DOMAIN: z.string().optional(),
    DAILY_API_KEY: z.string().optional(),

    // Stripe (optional - for payments)
    VITE_STRIPE_PUBLIC_KEY: z.string()
        .startsWith('pk_', 'Invalid Stripe public key')
        .optional()
        .or(z.literal('')), // Allow empty string but it won't be used by the service

    // Optional
    VITE_SENTRY_DSN: z.string().url().optional(),
    VITE_VAPID_PUBLIC_KEY: z.string().optional(),

    // Calendly OAuth (required for bookings)
    VITE_CALENDLY_CLIENT_ID: z.string().optional(),
    CALENDLY_CLIENT_SECRET: z.string().optional(),
    VITE_CALENDLY_REDIRECT_URI: z.string().url().optional(),
    CALENDLY_WEBHOOK_SIGNING_KEY: z.string().optional(),

    // Google OAuth (Gmail)
    GOOGLE_CLIENT_ID: z.string().min(1, 'Google Client ID is required').optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1, 'Google Client Secret is required').optional(),

    // Supabase Admin
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required').optional(),
});

/**
 * Validates and returns typed environment variables
 * Throws error if validation fails
 */
function validateEnv() {
    const rawEnv = {
        // Explicitly check NEXT_PUBLIC_* first for Next.js, then VITE_* for legacy/Vite
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.superbase_url,
        VITE_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.superbase_url,

        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.superbase_anon_public_key,
        VITE_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.superbase_anon_public_key,

        // AI Service API Keys (priority order)
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY,
        VITE_GEMINI_API_KEY: process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,

        VITE_DAILY_DOMAIN: process.env.NEXT_PUBLIC_DAILY_DOMAIN || process.env.VITE_DAILY_DOMAIN,
        DAILY_API_KEY: process.env.DAILY_API_KEY || process.env.NEXT_PUBLIC_DAILY_API_KEY,
        VITE_STRIPE_PUBLIC_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || process.env.VITE_STRIPE_PUBLIC_KEY,
        VITE_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.VITE_SENTRY_DSN,
        VITE_CALENDLY_CLIENT_ID: process.env.NEXT_PUBLIC_CALENDLY_CLIENT_ID || process.env.VITE_CALENDLY_CLIENT_ID || process.env.CALENDLY_CLIENT_ID,
        CALENDLY_CLIENT_SECRET: process.env.CALENDLY_CLIENT_SECRET || process.env.VITE_CALENDLY_CLIENT_SECRET || process.env.NEXT_PUBLIC_CALENDLY_CLIENT_SECRET,
        VITE_CALENDLY_REDIRECT_URI: process.env.NEXT_PUBLIC_CALENDLY_REDIRECT_URI || process.env.VITE_CALENDLY_REDIRECT_URI || process.env.CALENDLY_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclone.tech'}/api/auth/calendly/callback`,
        CALENDLY_WEBHOOK_SIGNING_KEY: process.env.CALENDLY_WEBHOOK_SIGNING_KEY || process.env.VITE_CALENDLY_WEBHOOK_SIGNING_KEY || process.env.NEXT_PUBLIC_CALENDLY_WEBHOOK_SIGNING_KEY,

        // Google OAuth
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET,

        // Supabase Admin
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };

    // Helper to treat empty strings or whitespace-only as undefined, and trim all strings
    Object.keys(rawEnv).forEach(key => {
        let val = (rawEnv as any)[key];
        if (typeof val === 'string') {
            val = val.trim();

            // Clean up common copy-paste errors
            if (key === 'CALENDLY_CLIENT_SECRET' && val.startsWith(':')) {
                val = val.substring(1).trim();
            }
            if (key === 'VITE_CALENDLY_REDIRECT_URI' && val.endsWith('.')) {
                val = val.substring(0, val.length - 1).trim();
            }

            (rawEnv as any)[key] = val === '' ? undefined : val;
        }
    });

    try {
        const parsed = envSchema.parse(rawEnv);
        // Special case: if Stripe key is empty string, make it undefined for consistency
        if (parsed.VITE_STRIPE_PUBLIC_KEY === '') {
            parsed.VITE_STRIPE_PUBLIC_KEY = undefined;
        }

        // Return a Normalized object that prioritizes Next.js but supports legacy
        return {
            ...parsed,
            VITE_SUPABASE_URL: parsed.NEXT_PUBLIC_SUPABASE_URL || parsed.VITE_SUPABASE_URL,
            VITE_SUPABASE_ANON_KEY: parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY || parsed.VITE_SUPABASE_ANON_KEY
        };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const missingVars = error.issues.map(err => `  • ${err.path.join('.')}: ${err.message}`).join('\n');
            console.warn(
                `\n⚠️ Environment validation failed (Check .env file):\n\n${missingVars}\n\n` +
                `Returning fallback configuration to allow build to proceed.\n`
            );

            // Safer fallback: undefined for critical keys so they fail loudly at runtime if missing
            return {
                ...rawEnv,
                VITE_SUPABASE_URL: rawEnv.NEXT_PUBLIC_SUPABASE_URL || rawEnv.VITE_SUPABASE_URL,
                VITE_SUPABASE_ANON_KEY: rawEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || rawEnv.VITE_SUPABASE_ANON_KEY
            } as any;
        }
        throw error;
    }
}

/**
 * Validated environment variables
 * Use this instead of import.meta.env directly
 */
export const ENV = validateEnv();

/**
 * Type-safe environment variable access
 */
export type Environment = z.infer<typeof envSchema>;
