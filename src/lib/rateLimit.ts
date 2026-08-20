import { Ratelimit, Duration } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { securityLogService } from '../services/securityLogService';
import { redis as sharedRedis, redisBackend } from './cache/redis';


// Initialize Redis client from environment variables
// Add these to your .env:
// UPSTASH_REDIS_REST_URL=your_url
// UPSTASH_REDIS_REST_TOKEN=your_token
const redis = process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!.trim(),
        token: process.env.UPSTASH_REDIS_REST_TOKEN!.trim(),
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
        /** MCP JSON-RPC + OAuth — Anthropic/OpenAI share egress IPs */
        mcp: { limit: number; window: Duration };
    };
    public: {
        contact: { limit: number; window: Duration };
        general: { limit: number; window: Duration };
    };
    supabase: {
        standard: { limit: number; window: Duration };
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
        // Claude/ChatGPT connectors share egress IPs; 20/min caused McpAuthorizationError
        // ("integration rejected the credentials it just issued") on post-token initialize.
        mcp: { limit: 300, window: '1m' },
    },

    // Public endpoints - lenient limits
    public: {
        contact: { limit: 5, window: '1h' }, // 5 contact form submissions per hour
        general: { limit: 300, window: '1m' }, // 300 requests per minute
    },

    // Supabase endpoint rate limits
    supabase: {
        standard: { limit: 120, window: '1m' },
    },
};

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
    request: NextRequest | null,
    config: { limit: number; window: Duration },
    identifier?: string
): Promise<{
    success: boolean;
    remaining: number;
    reset: number;
    limit: number;
}> {
    // 1. Determine identifier (IP address or provided custom identifier)
    const id = identifier || (request as any)?.ip || request?.headers.get('x-forwarded-for') || '127.0.0.1';

    // 2. Railway Redis uses a shared fixed-window counter. This keeps limits
    // consistent across every Railway app instance without requiring REST.
    if (redisBackend === 'railway' && sharedRedis) {
        try {
            const windowMs = parseWindow(config.window);
            const key = `alphaclone:rl:${id}`;
            const count = await sharedRedis.incr(key);
            if (count === 1) await sharedRedis.pexpire(key, windowMs);
            const ttl = await sharedRedis.pttl(key);
            const result = {
                success: count <= config.limit,
                remaining: Math.max(config.limit - count, 0),
                reset: Date.now() + (ttl > 0 ? ttl : windowMs),
                limit: config.limit,
            };
            if (!result.success && request) {
                await logRateLimitViolation(id, (request as any).ip || '0.0.0.0', request.nextUrl.pathname);
            }
            return result;
        } catch (error) {
            console.error('Railway Redis rate limit error, falling back:', error);
        }
    }

    // 3. Try Upstash REST rate limiter if configured
    if (redis) {
        try {
            const ratelimit = new Ratelimit({
                redis,
                limiter: Ratelimit.slidingWindow(config.limit, config.window),
                analytics: true,
                prefix: 'alphaclone',
            });

            // Add a 1s timeout to prevent Redis issues from hanging the middleware
            const result = await Promise.race([
                ratelimit.limit(id),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Rate limit timeout')), 1000))
            ]);

            if (!result.success && request) {
                await logRateLimitViolation(id, (request as any).ip || '0.0.0.0', request.nextUrl.pathname);
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

    // 4. Fallback to In-Memory rate limiting
    // Note: window is a string (e.g. '15m'), we need to parse it to ms
    const windowMs = parseWindow(config.window);
    const result = checkInMemoryRateLimit(id, config.limit, windowMs);

    if (!result.success && request) {
        // Log violation for in-memory as well (non-blocking)
        logRateLimitViolation(id, (request as any).ip || '0.0.0.0', request.nextUrl.pathname).catch(console.error);
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
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) return;

        // Use createServerClient which is safe for Edge Runtime
        const client = createServerClient(supabaseUrl, supabaseKey, {
            cookies: {
                get(name: string) { return undefined },
                set(name: string, value: string, options: any) { },
                remove(name: string, options: any) { },
            }
        });

        // Add a 2s timeout for audit logging to prevent it from blocking the request
        await Promise.race([
            Promise.all([
                client.from('audit_logs').insert({
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
                }),
                client.from('security_threats').insert({
                    type: 'rate_limit_exceeded',
                    severity: 'medium',
                    ip_address: ipAddress,
                    user_agent: 'Edge Runtime',
                    description: `Rate limit exceeded for ${path}`,
                    metadata: { identifier, path },
                    status: 'detected',
                    created_at: new Date().toISOString(),
                })
            ]),
            new Promise((resolve) => setTimeout(resolve, 2000))
        ]);
    } catch (error) {
        console.error('Failed to log rate limit violation:', error);
    }
}

/**
 * Middleware helper to apply rate limiting and return response
 */
export async function rateLimitMiddleware(
    request: NextRequest | null,
    config: { limit: number; window: Duration },
    identifier?: string
): Promise<NextResponse | null> {
    const result = await rateLimit(request, config, identifier);

    if (!result.success) {
        // SECURITY SHIELD: Log the rate limit violation as a security event
        const ip = request ? (request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1') : '127.0.0.1';
        const pathname = request && 'nextUrl' in request && (request as any).nextUrl?.pathname
            ? (request as any).nextUrl.pathname
            : '/unknown';
        
        // Fire and forget (don't block the 429 response)
        securityLogService.logEvent({
            eventType: 'SECURITY_VIOLATION: RATE_LIMIT_EXCEEDED',
            ipAddress: ip,
            severity: pathname.includes('/auth') ? 'critical' : 'warning',
            eventDetails: {
                pathname,
                limit: config.limit,
                window: config.window,
                remaining: result.remaining
            },
            useAdminClient: true
        }).catch(err => console.error('[RateLimit Log Error]', err));

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
                    'X-RateLimit-Reset': Math.ceil(result.reset / 1000).toString(),
                },
            }
        );
    }

    // Return null to indicate "pass through"
    return null;
}
