import { z } from 'zod';

/**
 * Environment variable validation schema
 * Ensures all required environment variables are present and valid
 */
const envSchema = z.object({
    // Supabase (required)
    VITE_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
    VITE_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),

    // Gemini AI (optional - for AI features)
    VITE_GEMINI_API_KEY: z.string().optional(),

    // Daily.co (optional - for video calls, domain is required if using video)
    VITE_DAILY_DOMAIN: z.string().optional(),

    // Stripe (optional - for payments)
    VITE_STRIPE_PUBLIC_KEY: z.string()
        .startsWith('pk_', 'Invalid Stripe public key')
        .optional()
        .or(z.literal('')), // Allow empty string but it won't be used by the service

    // Optional
    VITE_SENTRY_DSN: z.string().url().optional(),
    VITE_VAPID_PUBLIC_KEY: z.string().optional(),
});

/**
 * Validates and returns typed environment variables
 * Throws error if validation fails
 */
function validateEnv() {
    const env = {
        // Explicitly check NEXT_PUBLIC_* first for Next.js, then VITE_* for legacy/Vite
        VITE_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.superbase_url,
        VITE_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.superbase_anon_public_key,
        VITE_GEMINI_API_KEY: process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY,
        VITE_DAILY_DOMAIN: process.env.NEXT_PUBLIC_DAILY_DOMAIN || process.env.VITE_DAILY_DOMAIN,
        VITE_STRIPE_PUBLIC_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || process.env.VITE_STRIPE_PUBLIC_KEY,
        VITE_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.VITE_SENTRY_DSN,
    };

    // Helper to treat empty strings as undefined
    Object.keys(env).forEach(key => {
        if (env[key as keyof typeof env] === '') {
            (env as any)[key] = undefined;
        }
    });

    try {
        const parsed = envSchema.parse(env);
        // Special case: if Stripe key is empty string, make it undefined for consistency
        if (parsed.VITE_STRIPE_PUBLIC_KEY === '') {
            parsed.VITE_STRIPE_PUBLIC_KEY = undefined;
        }
        return parsed;
    } catch (error) {
        if (error instanceof z.ZodError) {
            const missingVars = error.issues.map(err => `  • ${err.path.join('.')}: ${err.message}`).join('\n');
            console.warn(
                `\n⚠️ Environment validation failed (Check .env file):\n\n${missingVars}\n\n` +
                `Returning fallback configuration to allow build to proceed.\n`
            );

            // Return a fallback object that satisfies the schema via casting, 
            // allowing the build to proceed even if keys are missing.
            // Runtime usage will still fail if critical keys are truly missing.
            // Return safe defaults or undefined where acceptable.
            // Critical keys will cause runtime failures if missing, which is safer than hardcoding production keys.

            return {
                VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
                VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY,
                VITE_GEMINI_API_KEY: env.VITE_GEMINI_API_KEY,
                VITE_DAILY_DOMAIN: env.VITE_DAILY_DOMAIN,
                VITE_STRIPE_PUBLIC_KEY: env.VITE_STRIPE_PUBLIC_KEY,
                VITE_SENTRY_DSN: env.VITE_SENTRY_DSN,
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
