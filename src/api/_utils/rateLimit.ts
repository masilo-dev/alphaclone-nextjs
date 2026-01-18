import { VercelRequest } from '@vercel/node';

interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
}

// Store request counts in memory (production should use Redis/Upstash)
const requests = new Map<string, number[]>();

/**
 * Simple in-memory rate limiter
 * For production, use Redis or Upstash Rate Limit
 */
export function rateLimit(
    req: VercelRequest,
    config: RateLimitConfig = { maxRequests: 100, windowMs: 15 * 60 * 1000 }
): { allowed: boolean; remaining: number; resetAt: Date } {
    // Get client identifier (IP address)
    const identifier = 
        (req.headers['x-forwarded-for'] as string) ||
        (req.headers['x-real-ip'] as string) ||
        'unknown';

    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get or create request history for this identifier
    if (!requests.has(identifier)) {
        requests.set(identifier, []);
    }

    const userRequests = requests.get(identifier)!;
    
    // Remove old requests outside the window
    const recentRequests = userRequests.filter(time => time > windowStart);

    // Check if limit exceeded
    if (recentRequests.length >= config.maxRequests) {
        const oldestRequest = Math.min(...recentRequests);
        const resetAt = new Date(oldestRequest + config.windowMs);

        return {
            allowed: false,
            remaining: 0,
            resetAt
        };
    }

    // Add current request
    recentRequests.push(now);
    requests.set(identifier, recentRequests);

    return {
        allowed: true,
        remaining: config.maxRequests - recentRequests.length,
        resetAt: new Date(now + config.windowMs)
    };
}

/**
 * Cleanup old request data periodically
 * Call this in a scheduled job
 */
export function cleanupOldRequests() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [identifier, timestamps] of requests.entries()) {
        const recentRequests = timestamps.filter(time => time > now - maxAge);
        
        if (recentRequests.length === 0) {
            requests.delete(identifier);
        } else {
            requests.set(identifier, recentRequests);
        }
    }
}

