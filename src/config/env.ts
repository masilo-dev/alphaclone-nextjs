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
    XAI_API_KEY: z.string().optional(),
    GROK_API_KEY: z.string().optional(),
    XAI_IMAGE_MODEL: z.string().optional(),
    OPENROUTER_API_KEY: z.string().optional(),
    APOLLO_API_KEY: z.string().optional(),
    VITE_GEMINI_API_KEY: z.string().optional(),
    GOOGLE_API_KEY: z.string().optional(),
    DEEPSEEK_API_KEY: z.string().optional(),
    /** Browser Maps SDK only; use NEXT_PUBLIC_GOOGLE_MAPS_API_KEY with referrer restrictions */
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional(),
    MANUS_API_KEY: z.string().optional(),

    // Scraper microservice (Railway)
    SCRAPER_SERVICE_URL: z.string().url().optional(),

    CRON_SECRET: z.string().optional(),
    INTERNAL_API_KEY: z.string().optional(),

    // Daily.co
    VITE_DAILY_DOMAIN: z.string().optional(),
    DAILY_API_KEY: z.string().optional(),

    // LiveKit (server-side token broker)
    LIVEKIT_URL: z.string().url().optional(),
    LIVEKIT_API_KEY: z.string().optional(),
    LIVEKIT_API_SECRET: z.string().optional(),

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
    WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
    WHATSAPP_ACCESS_TOKEN: z.string().optional(),

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

    // Microsoft OAuth
    VITE_AZURE_CLIENT_ID: z.string().optional(),
    AZURE_CLIENT_ID: z.string().optional(),
    AZURE_CLIENT_SECRET: z.string().optional(),

    // X (Twitter) OAuth 2.0
    X_CLIENT_ID: z.string().optional(),
    X_CLIENT_SECRET: z.string().optional(),
    // OAuth 1.0a consumer keys (for media upload v1.1)
    X_API_KEY: z.string().optional(),
    X_API_SECRET: z.string().optional(),

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
    ZOHO_CLIENT_ID_US: z.string().optional(),
    ZOHO_CLIENT_SECRET_US: z.string().optional(),
    ZOHO_CLIENT_ID_EU: z.string().optional(),
    ZOHO_CLIENT_SECRET_EU: z.string().optional(),
    ZOHO_CLIENT_ID_IN: z.string().optional(),
    ZOHO_CLIENT_SECRET_IN: z.string().optional(),
    ZOHO_CLIENT_ID_AU: z.string().optional(),
    ZOHO_CLIENT_SECRET_AU: z.string().optional(),
    ZOHO_CLIENT_ID_JP: z.string().optional(),
    ZOHO_CLIENT_SECRET_JP: z.string().optional(),
    ZOHO_CLIENT_ID_CA: z.string().optional(),
    ZOHO_CLIENT_SECRET_CA: z.string().optional(),
    ZOHO_REDIRECT_URI: z.string().url().optional(),
    ZOHO_REGION: z.enum(['US', 'EU', 'IN', 'AU', 'JP', 'CA']).optional(),
    ZOHO_ENCRYPTION_SECRET: z.string().length(32, 'Zoho encryption secret must be exactly 32 characters').optional(),

    // LinkedIn OAuth (integration connector)
    LINKEDIN_CLIENT_ID: z.string().optional(),
    LINKEDIN_CLIENT_SECRET: z.string().optional(),
    LINKEDIN_REDIRECT_URI: z.string().url().optional(),

    // QStash (for auto-responder delays)
    QSTASH_TOKEN: z.string().optional(),
    QSTASH_URL: z.string().url().optional(),

    // Redis Infrastructure (Upstash)
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

    // Browserless / remote CDP
    BROWSER_WS_ENDPOINT: z.string().url().optional(),

    // Browserbase (managed Playwright CDP sessions)
    BROWSERBASE_API_KEY: z.string().optional(),
    BROWSERBASE_PROJECT_ID: z.string().optional(),

    // App URL for OAuth redirects
    NEXT_PUBLIC_APP_URL: z.string().url().optional().default('https://alphaclonesystems.com'),

    // Zoom OAuth (user-managed app)
    ZOOM_CLIENT_ID: z.string().optional(),
    ZOOM_CLIENT_SECRET: z.string().optional(),
    ZOOM_OAUTH_SCOPES: z.string().optional(),
    /** Secret token from Zoom app Features (webhooks) — required to verify deauthorization / event notifications */
    ZOOM_WEBHOOK_SECRET_TOKEN: z.string().optional(),
});

/**
 * Validates and returns typed environment variables
 */
function validateEnv() {
    const rawEnv = {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.supabase_url,
        VITE_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.supabase_url,

        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.supabase_anon_public_key,
        VITE_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.supabase_anon_public_key,

        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        XAI_API_KEY: process.env.XAI_API_KEY || process.env.GROK_API_KEY,
        GROK_API_KEY: process.env.GROK_API_KEY || process.env.XAI_API_KEY,
        XAI_IMAGE_MODEL: process.env.XAI_IMAGE_MODEL || process.env.GROK_IMAGE_MODEL,
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
        APOLLO_API_KEY: process.env.APOLLO_API_KEY,
        VITE_GEMINI_API_KEY:
            process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
            process.env.VITE_GEMINI_API_KEY ||
            process.env.GEMINI_API_KEY ||
            process.env.GOOGLE_AI_KEY ||
            process.env.GOOGLE_AI_API_KEY ||
            process.env.GOOGLE_API_KEY,
        GOOGLE_API_KEY:
            process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_AI_KEY,
        DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
        NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
        MANUS_API_KEY: process.env.MANUS_API_KEY,

        VITE_DAILY_DOMAIN: process.env.NEXT_PUBLIC_DAILY_DOMAIN || process.env.VITE_DAILY_DOMAIN,
        DAILY_API_KEY: process.env.DAILY_API_KEY,
        LIVEKIT_URL: process.env.LIVEKIT_URL,
        LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
        VITE_STRIPE_PUBLIC_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLIC_KEY,
        VITE_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.VITE_SENTRY_DSN,
        VITE_CALENDLY_CLIENT_ID: process.env.NEXT_PUBLIC_CALENDLY_CLIENT_ID || process.env.VITE_CALENDLY_CLIENT_ID || process.env.CALENDLY_CLIENT_ID,
        CALENDLY_CLIENT_SECRET: process.env.CALENDLY_CLIENT_SECRET,
        VITE_CALENDLY_REDIRECT_URI: process.env.NEXT_PUBLIC_CALENDLY_REDIRECT_URI || process.env.VITE_CALENDLY_REDIRECT_URI || process.env.CALENDLY_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com'}/api/auth/calendly/callback`,
        CALENDLY_WEBHOOK_SIGNING_KEY: process.env.CALENDLY_WEBHOOK_SIGNING_KEY || process.env.VITE_CALENDLY_WEBHOOK_SIGNING_KEY || process.env.NEXT_PUBLIC_CALENDLY_WEBHOOK_SIGNING_KEY,

        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
        VITE_AZURE_CLIENT_ID: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || process.env.VITE_AZURE_CLIENT_ID || process.env.AZURE_CLIENT_ID,
        AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID || process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || process.env.VITE_AZURE_CLIENT_ID,
        AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,

        // X (Twitter) — support both X_API_KEY and X_CONSUMER_KEY naming conventions
        X_CLIENT_ID: process.env.X_CLIENT_ID,
        X_CLIENT_SECRET: process.env.X_CLIENT_SECRET,
        X_API_KEY: process.env.X_API_KEY || process.env.X_CONSUMER_KEY || process.env.TWITTER_API_KEY,
        X_API_SECRET: process.env.X_API_SECRET || process.env.X_CONSUMER_SECRET || process.env.TWITTER_API_SECRET,

        HUBSPOT_CLIENT_ID: process.env.HUBSPOT_CLIENT_ID || process.env.NEXT_PUBLIC_HUBSPOT_CLIENT_ID,
        HUBSPOT_CLIENT_SECRET: process.env.HUBSPOT_CLIENT_SECRET,
        HUBSPOT_REDIRECT_URI: process.env.HUBSPOT_REDIRECT_URI || process.env.NEXT_PUBLIC_HUBSPOT_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com'}/api/auth/hubspot/callback`,

        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,

        RESEND_API_KEY: process.env.RESEND_API_KEY,

        FACEBOOK_VERIFY_TOKEN: process.env.FACEBOOK_VERIFY_TOKEN || process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN,
        FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET,
        FACEBOOK_PAGE_ACCESS_TOKEN: process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
        WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
        WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN,

        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

        ENCRYPTION_SECRET: process.env.ENCRYPTION_SECRET,

        ZOHO_CLIENT_ID: process.env.ZOHO_CLIENT_ID || process.env.NEXT_PUBLIC_ZOHO_CLIENT_ID,
        ZOHO_CLIENT_SECRET: process.env.ZOHO_CLIENT_SECRET,
        ZOHO_CLIENT_ID_US: process.env.ZOHO_CLIENT_ID_US,
        ZOHO_CLIENT_SECRET_US: process.env.ZOHO_CLIENT_SECRET_US,
        ZOHO_CLIENT_ID_EU: process.env.ZOHO_CLIENT_ID_EU,
        ZOHO_CLIENT_SECRET_EU: process.env.ZOHO_CLIENT_SECRET_EU,
        ZOHO_CLIENT_ID_IN: process.env.ZOHO_CLIENT_ID_IN,
        ZOHO_CLIENT_SECRET_IN: process.env.ZOHO_CLIENT_SECRET_IN,
        ZOHO_CLIENT_ID_AU: process.env.ZOHO_CLIENT_ID_AU,
        ZOHO_CLIENT_SECRET_AU: process.env.ZOHO_CLIENT_SECRET_AU,
        ZOHO_CLIENT_ID_JP: process.env.ZOHO_CLIENT_ID_JP,
        ZOHO_CLIENT_SECRET_JP: process.env.ZOHO_CLIENT_SECRET_JP,
        ZOHO_CLIENT_ID_CA: process.env.ZOHO_CLIENT_ID_CA,
        ZOHO_CLIENT_SECRET_CA: process.env.ZOHO_CLIENT_SECRET_CA,
        ZOHO_REDIRECT_URI: process.env.ZOHO_REDIRECT_URI || process.env.NEXT_PUBLIC_ZOHO_REDIRECT_URI,
        ZOHO_REGION: process.env.ZOHO_REGION,
        ZOHO_ENCRYPTION_SECRET: process.env.ZOHO_ENCRYPTION_SECRET || process.env.ENCRYPTION_SECRET,

        LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID || process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID,
        LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET,
        LINKEDIN_REDIRECT_URI: process.env.LINKEDIN_REDIRECT_URI || process.env.NEXT_PUBLIC_LINKEDIN_REDIRECT_URI,

        QSTASH_TOKEN: process.env.QSTASH_TOKEN,
        QSTASH_URL: process.env.QSTASH_URL,

        UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
        UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,

        BROWSER_WS_ENDPOINT: process.env.BROWSER_WS_ENDPOINT,

        BROWSERBASE_API_KEY: process.env.BROWSERBASE_API_KEY,
        BROWSERBASE_PROJECT_ID: process.env.BROWSERBASE_PROJECT_ID,

        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || process.env.URL || 'https://alphaclonesystems.com',

        ZOOM_CLIENT_ID: process.env.ZOOM_CLIENT_ID || process.env.NEXT_PUBLIC_ZOOM_CLIENT_ID,
        ZOOM_CLIENT_SECRET: process.env.ZOOM_CLIENT_SECRET,
        ZOOM_OAUTH_SCOPES:
            process.env.ZOOM_OAUTH_SCOPES ||
            'user:read:user meeting:read meeting:write',
        ZOOM_WEBHOOK_SECRET_TOKEN: process.env.ZOOM_WEBHOOK_SECRET_TOKEN,

        CRON_SECRET: process.env.CRON_SECRET,
        INTERNAL_API_KEY: process.env.INTERNAL_API_KEY,
        SCRAPER_SERVICE_URL: process.env.SCRAPER_SERVICE_URL,
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
        const isServer = typeof window === 'undefined';
        const isProd = process.env.NODE_ENV === 'production';
        if (isServer && isProd) {
            console.error('[env] Invalid environment configuration', error);
            throw new Error('Invalid environment configuration');
        }
        return rawEnv as any;
    }
}

export const ENV = validateEnv();
export type Environment = z.infer<typeof envSchema>;
