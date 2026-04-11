import { z } from 'zod';

/**
 * Environment variable validation schema
 * Ensures all required environment variables are present and valid
 */
const envSchema = z.object({
    // Supabase (required)
    NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL').optional(),
    VITE_SUPABASE_URL: z.string().url('Invalid Supabase URL').optional(),

    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required').optional(),
    VITE_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required').optional(),

    // AI Services
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    OPENROUTER_API_KEY: z.string().optional(),
    VITE_GEMINI_API_KEY: z.string().optional(),
    GOOGLE_API_KEY: z.string().optional(),
    MANUS_API_KEY: z.string().optional(),

    // Daily.co
    VITE_DAILY_DOMAIN: z.string().optional(),
    DAILY_API_KEY: z.string().optional(),

    // Stripe
    VITE_STRIPE_PUBLIC_KEY: z.string().optional().or(z.literal('')),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),

    // Resend
    RESEND_API_KEY: z.string().optional(),

    // Facebook
    FACEBOOK_VERIFY_TOKEN: z.string().optional(),
    FACEBOOK_APP_SECRET: z.string().optional(),
    FACEBOOK_PAGE_ACCESS_TOKEN: z.string().optional(),

    // Optional
    VITE_SENTRY_DSN: z.string().url().optional(),
    VITE_VAPID_PUBLIC_KEY: z.string().optional(),

    // Calendly OAuth
    VITE_CALENDLY_CLIENT_ID: z.string().optional(),
    CALENDLY_CLIENT_SECRET: z.string().optional(),
    VITE_CALENDLY_REDIRECT_URI: z.string().url().optional(),
    CALENDLY_WEBHOOK_SIGNING_KEY: z.string().optional(),

    // Google OAuth
    GOOGLE_CLIENT_ID: z.string().min(1, 'Google Client ID is required').optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1, 'Google Client Secret is required').optional(),

    // HubSpot OAuth
    HUBSPOT_CLIENT_ID: z.string().optional(),
    HUBSPOT_CLIENT_SECRET: z.string().optional(),
    HUBSPOT_REDIRECT_URI: z.string().url().optional(),

    // Supabase Admin
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

    // Encryption
    ENCRYPTION_SECRET: z.string().length(32, 'Encryption secret must be exactly 32 characters').optional(),

    // Zoho OAuth
    ZOHO_CLIENT_ID: z.string().optional(),
    ZOHO_CLIENT_SECRET: z.string().optional(),
    ZOHO_REDIRECT_URI: z.string().url().optional(),
    ZOHO_ENCRYPTION_SECRET: z.string().length(32, 'Zoho encryption secret must be exactly 32 characters').optional(),

    // QStash (for auto-responder delays)
    QSTASH_TOKEN: z.string().optional(),
    QSTASH_URL: z.string().url().optional(),

    // Redis Infrastructure (Upstash)
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

    // Browserless Infrastructure
    BROWSER_WS_ENDPOINT: z.string().url().optional(),

    // App URL for OAuth redirects
    NEXT_PUBLIC_APP_URL: z.string().url().optional().default('https://alphaclone.tech'),

    // Zoom OAuth (user-managed app)
    ZOOM_CLIENT_ID: z.string().optional(),
    ZOOM_CLIENT_SECRET: z.string().optional(),
    ZOOM_OAUTH_SCOPES: z.string().optional(),
});

/**
 * Validates and returns typed environment variables
 */
function validateEnv() {
    const rawEnv = {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.superbase_url,
        VITE_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.superbase_url,

        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.superbase_anon_public_key,
        VITE_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.superbase_anon_public_key,

        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
        VITE_GEMINI_API_KEY: process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY,
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_AI_KEY,
        MANUS_API_KEY: process.env.MANUS_API_KEY || process.env.NEXT_PUBLIC_MANUS_API_KEY || process.env.VITE_MANUS_API_KEY,

        VITE_DAILY_DOMAIN: process.env.NEXT_PUBLIC_DAILY_DOMAIN || process.env.VITE_DAILY_DOMAIN,
        DAILY_API_KEY: process.env.DAILY_API_KEY,
        VITE_STRIPE_PUBLIC_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLIC_KEY,
        VITE_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.VITE_SENTRY_DSN,
        VITE_CALENDLY_CLIENT_ID: process.env.NEXT_PUBLIC_CALENDLY_CLIENT_ID || process.env.VITE_CALENDLY_CLIENT_ID || process.env.CALENDLY_CLIENT_ID,
        CALENDLY_CLIENT_SECRET: process.env.CALENDLY_CLIENT_SECRET,
        VITE_CALENDLY_REDIRECT_URI: process.env.NEXT_PUBLIC_CALENDLY_REDIRECT_URI || process.env.VITE_CALENDLY_REDIRECT_URI || process.env.CALENDLY_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclone.tech'}/api/auth/calendly/callback`,
        CALENDLY_WEBHOOK_SIGNING_KEY: process.env.CALENDLY_WEBHOOK_SIGNING_KEY || process.env.VITE_CALENDLY_WEBHOOK_SIGNING_KEY || process.env.NEXT_PUBLIC_CALENDLY_WEBHOOK_SIGNING_KEY,

        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,

        HUBSPOT_CLIENT_ID: process.env.HUBSPOT_CLIENT_ID || process.env.NEXT_PUBLIC_HUBSPOT_CLIENT_ID,
        HUBSPOT_CLIENT_SECRET: process.env.HUBSPOT_CLIENT_SECRET,
        HUBSPOT_REDIRECT_URI: process.env.HUBSPOT_REDIRECT_URI || process.env.NEXT_PUBLIC_HUBSPOT_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclone.tech'}/api/auth/hubspot/callback`,

        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,

        RESEND_API_KEY: process.env.RESEND_API_KEY,

        FACEBOOK_VERIFY_TOKEN: process.env.FACEBOOK_VERIFY_TOKEN || process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN,
        FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET,
        FACEBOOK_PAGE_ACCESS_TOKEN: process.env.FACEBOOK_PAGE_ACCESS_TOKEN,

        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

        ENCRYPTION_SECRET: process.env.ENCRYPTION_SECRET,

        ZOHO_CLIENT_ID: process.env.ZOHO_CLIENT_ID || process.env.NEXT_PUBLIC_ZOHO_CLIENT_ID,
        ZOHO_CLIENT_SECRET: process.env.ZOHO_CLIENT_SECRET,
        ZOHO_REDIRECT_URI: process.env.ZOHO_REDIRECT_URI || process.env.NEXT_PUBLIC_ZOHO_REDIRECT_URI,
        ZOHO_ENCRYPTION_SECRET: process.env.ZOHO_ENCRYPTION_SECRET || process.env.ENCRYPTION_SECRET,

        QSTASH_TOKEN: process.env.QSTASH_TOKEN,
        QSTASH_URL: process.env.QSTASH_URL,

        UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
        UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,

        BROWSER_WS_ENDPOINT: process.env.BROWSER_WS_ENDPOINT,

        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || process.env.URL || 'https://alphaclone.tech',

        ZOOM_CLIENT_ID: process.env.ZOOM_CLIENT_ID || process.env.NEXT_PUBLIC_ZOOM_CLIENT_ID,
        ZOOM_CLIENT_SECRET: process.env.ZOOM_CLIENT_SECRET,
        ZOOM_OAUTH_SCOPES:
            process.env.ZOOM_OAUTH_SCOPES ||
            'user:read:user meeting:read meeting:write',
    };

    Object.keys(rawEnv).forEach(key => {
        let val = (rawEnv as any)[key];
        if (typeof val === 'string') {
            val = val.trim();
            (rawEnv as any)[key] = val === '' ? undefined : val;
        }
    });

    try {
        const parsed = envSchema.parse(rawEnv);
        return {
            ...parsed,
            VITE_SUPABASE_URL: parsed.NEXT_PUBLIC_SUPABASE_URL || parsed.VITE_SUPABASE_URL,
            VITE_SUPABASE_ANON_KEY: parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY || parsed.VITE_SUPABASE_ANON_KEY
        };
    } catch (error) {
        return rawEnv as any;
    }
}

export const ENV = validateEnv();
export type Environment = z.infer<typeof envSchema>;
