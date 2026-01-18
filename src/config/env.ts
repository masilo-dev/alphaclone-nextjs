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
    VITE_STRIPE_PUBLIC_KEY: z.string().startsWith('pk_', 'Invalid Stripe public key').optional(),

    // Optional
    VITE_SENTRY_DSN: z.string().url().optional(),
});

/**
 * Validates and returns typed environment variables
 * Throws error if validation fails
 */
function validateEnv() {
    const env = {
        VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
        VITE_GEMINI_API_KEY: import.meta.env.VITE_GEMINI_API_KEY,
        VITE_DAILY_DOMAIN: import.meta.env.VITE_DAILY_DOMAIN,
        VITE_STRIPE_PUBLIC_KEY: import.meta.env.VITE_STRIPE_PUBLIC_KEY,
        VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
    };

    try {
        return envSchema.parse(env);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const missingVars = error.issues.map(err => `  • ${err.path.join('.')}: ${err.message}`).join('\n');
            console.error(
                `\n❌ Environment validation failed:\n\n${missingVars}\n\n` +
                `📝 Please check your .env file and ensure all required variables are set.\n` +
                `💡 See .env.example for reference.\n`
            );
            throw new Error(`Environment validation failed. Check console for details.`);
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
