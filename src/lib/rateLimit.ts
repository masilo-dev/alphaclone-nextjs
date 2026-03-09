import { Ratelimit, Duration } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Initialize Redis client from environment variables
// Add these to your .env:
// UPSTASH_REDIS_REST_URL=your_url
// UPSTASH_REDIS_REST_TOKEN=your_token
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
    : null;

// Fallback to in-memory rate limiting if Redis is not configured
// WARNING: This will not work across multiple server instances
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Rate Limiting Configuration
 */
export const rateLimitConfigs: {
    auth: {
        login: { limit: number; window: Duration };
        signup: { limit: number; window: Duration };
        passwordReset: { limit: number; window: Duration };
        verifyEmail: { limit: number; window: Duration };
    };
    api: {
        standard: { limit: number; window: Duration };
        heavy: { limit: number; window: Duration };
    };
    public: {
        contact: { limit: number; window: Duration };
        general: { limit: number; window: Duration };
    };
} = {
    // Authentication endpoints - tightened for Phase 1 hardening
    auth: {
        login: { limit: 5, window: '15m' }, // 5 login attempts per 15 minutes
        signup: { limit: 3, window: '1h' }, // 3 signups per hour per IP
        passwordReset: { limit: 3, window: '1h' }, // 3 resets per hour
        verifyEmail: { limit: 10, window: '1h' },
    },

    // API endpoints - moderate limits
    api: {
        standard: { limit: 100, window: '1m' }, // 100 requests per minute
        heavy: { limit: 20, window: '1m' }, // 20 requests per minute (AI, exports)
    },

    // Public endpoints - lenient limits
    public: {
        contact: { limit: 5, window: '1h' }, // 5 contact form submissions per hour
        general: { limit: 300, window: '1m' }, // 300 requests per minute
    },
};

/**
 * Create a rate limiter with specific configuration
 */
function createRateLimiter(limit: number, window: Duration) {
    if (redis) {
        return new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(limit, window),
            analytics: true,
            prefix: 'alphaclone',
        });
    }
    return null;
}

/**
 * In-memory fallback rate limiter
 */
function checkInMemoryRateLimit(identifier: string, limit: number, windowMs: number): {
    success: boolean;
    remaining: number;
    reset: number;
} {
    const now = Date.now();
    const record = inMemoryStore.get(identifier);

    if (!record || record.resetAt < now) {
        // Create new record
        inMemoryStore.set(identifier, { count: 1, resetAt: now + windowMs });
        return {
            success: true,
            remaining: limit - 1,
            reset: now + windowMs,
        };
    }

    if (record.count >= limit) {
        return {
            success: false,
            remaining: 0,
            reset: record.resetAt,
        };
    }

    record.count++;
    return {
        success: true,
        remaining: limit - record.count,
        reset: record.resetAt,
    };
}

/**
 * Parse window string to milliseconds
 */
function parseWindow(window: string): number {
    const match = window.match(/^(\d+)\s*([mhd])$/);
    if (!match) return 60000; // Default 1 minute

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
        case 'm':
            return value * 60 * 1000;
        case 'h':
            return value * 60 * 60 * 1000;
        case 'd':
            return value * 24 * 60 * 60 * 1000;
        default:
            return 60000;
    }
}

/**
 * Apply rate limiting to a request
 */
export async function rateLimit(
    request: NextRequest,
    config: { limit: number; window: Duration },
    identifier?: string
): Promise<{
    success: boolean;
    remaining: number;
    reset: number;
    limit: number;
}> {
    // 1. Determine identifier (IP address or provided custom identifier)
    const id = identifier || request.ip || request.headers.get('x-forwarded-for') || '127.0.0.1';

    // 2. Try Redis rate limiter if configured
    if (redis) {
        try {
            const ratelimit = new Ratelimit({
                redis,
                limiter: Ratelimit.slidingWindow(config.limit, config.window),
                analytics: true,
                prefix: 'alphaclone',
            });

            const result = await ratelimit.limit(id);

            if (!result.success) {
                await logRateLimitViolation(id, request.ip || '0.0.0.0', request.nextUrl.pathname);
            }

            return {
                success: result.success,
                remaining: result.remaining,
                reset: result.reset,
                limit: config.limit,
            };
        } catch (error) {
            console.error('Redis Rate Limit Error, falling back to in-memory:', error);
        }
    }

    // 3. Fallback to In-Memory rate limiting
    // Note: window is a string (e.g. '15m'), we need to parse it to ms
    const windowMs = parseWindow(config.window);
    const result = checkInMemoryRateLimit(id, config.limit, windowMs);

    if (!result.success) {
        // Log violation for in-memory as well (non-blocking)
        logRateLimitViolation(id, request.ip || '0.0.0.0', request.nextUrl.pathname).catch(console.error);
    }

    return {
        ...result,
        limit: config.limit,
    };
}

/**
 * Log rate limit violation to Supabase audit logs
 * Uses an isolated client to be safe in Edge/Middleware
 */
async function logRateLimitViolation(identifier: string, ipAddress: string, path: string) {
    try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) return;

        // Use createServerClient which is safe for Edge Runtime
        const client = createServerClient(supabaseUrl, supabaseKey, {
            cookies: {
                get(name: string) { return undefined },
                set(name: string, value: string, options: any) { },
                remove(name: string, options: any) { },
            }
        });

        await client.from('audit_logs').insert({
            user_id: null,
            action: 'rate_limit_exceeded',
            resource_type: 'api',
            resource_id: path,
            metadata: {
                identifier,
                ip_address: ipAddress,
                path,
                timestamp: new Date().toISOString(),
            },
            ip_address: ipAddress,
            created_at: new Date().toISOString(),
        });

        // Also log as security threat
        await client.from('security_threats').insert({
            type: 'rate_limit_exceeded',
            severity: 'medium',
            ip_address: ipAddress,
            user_agent: 'Edge Runtime',
            description: `Rate limit exceeded for ${path}`,
            metadata: { identifier, path },
            status: 'detected',
            created_at: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Failed to log rate limit violation:', error);
    }
}

/**
 * Middleware helper to apply rate limiting and return response
 */
export async function rateLimitMiddleware(
    request: NextRequest,
    config: { limit: number; window: Duration },
    identifier?: string
): Promise<NextResponse | null> {
    const result = await rateLimit(request, config, identifier);

    if (!result.success) {
        // Return 429 Too Many Requests
        return new NextResponse(
            JSON.stringify({
                error: 'Too Many Requests',
                message: 'Rate limit exceeded. Please try again later.',
                retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
            }),
            {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'X-RateLimit-Limit': result.limit.toString(),
                    'X-RateLimit-Remaining': result.remaining.toString(),
                    'X-RateLimit-Reset': result.reset.toString(),
                    'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString(),
                },
            }
        );
    }

    // Return null to indicate "pass through"
    return null;
}

/**
 * Get rate limit status for a key (useful for dashboards)
 */
export async function getRateLimitStatus(identifier: string): Promise<{
    remaining: number;
    reset: number;
    limit: number;
} | null> {
    if (!redis) return null;

    try {
        // This would require additional implementation with Upstash
        // For now, return null (would need custom Redis commands)
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Reset rate limit for a specific identifier (admin function)
 */
export async function resetRateLimit(identifier: string): Promise<boolean> {
    if (!redis) {
        inMemoryStore.delete(identifier);
        return true;
    }

    try {
        await redis.del(`alphaclone:${identifier}`);
        return true;
    } catch (error) {
        console.error('Failed to reset rate limit:', error);
        return false;
    }
}
