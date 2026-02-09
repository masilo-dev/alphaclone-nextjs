import { Redis } from '@upstash/redis';

/**
 * Redis caching layer using Upstash Redis
 * Provides fast caching for frequently accessed data
 */

// Initialize Upstash Redis client
export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

/**
 * Cache TTL presets (in seconds)
 */
export const CacheTTL = {
    VERY_SHORT: 60, // 1 minute
    SHORT: 300, // 5 minutes
    MEDIUM: 900, // 15 minutes
    LONG: 3600, // 1 hour
    VERY_LONG: 86400, // 24 hours
    WEEK: 604800, // 7 days
};

/**
 * Centralized cache keys to avoid collisions
 */
export const CacheKeys = {
    // User data
    user: (userId: string) => `user:${userId}`,
    userProfile: (userId: string) => `user:${userId}:profile`,
    userPermissions: (userId: string) => `user:${userId}:permissions`,

    // Tenant data
    tenant: (tenantId: string) => `tenant:${tenantId}`,
    tenantUsers: (tenantId: string) => `tenant:${tenantId}:users`,
    tenantSubscription: (tenantId: string) => `tenant:${tenantId}:subscription`,
    tenantUsage: (tenantId: string) => `tenant:${tenantId}:usage`,

    // Analytics
    analytics: (tenantId: string, period: string) => `analytics:${tenantId}:${period}`,
    revenueSummary: (tenantId: string) => `revenue:${tenantId}:summary`,

    // Sessions
    session: (sessionId: string) => `session:${sessionId}`,

    // Rate limiting (already used in rate limiter)
    rateLimit: (identifier: string) => `ratelimit:${identifier}`,

    // Feature flags
    featureFlag: (flag: string) => `feature:${flag}`,

    // API responses
    apiResponse: (endpoint: string, params: string) => `api:${endpoint}:${params}`,
};

/**
 * Cache service with common operations
 */
export const cacheService = {
    /**
     * Get cached value
     */
    async get<T>(key: string): Promise<T | null> {
        try {
            const value = await redis.get(key);
            return value as T | null;
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    },

    /**
     * Set cached value with TTL
     */
    async set(key: string, value: any, ttlSeconds: number = CacheTTL.MEDIUM): Promise<void> {
        try {
            await redis.setex(key, ttlSeconds, JSON.stringify(value));
        } catch (error) {
            console.error('Cache set error:', error);
        }
    },

    /**
     * Delete cached value
     */
    async del(key: string): Promise<void> {
        try {
            await redis.del(key);
        } catch (error) {
            console.error('Cache delete error:', error);
        }
    },

    /**
     * Delete multiple keys by pattern
     */
    async delPattern(pattern: string): Promise<void> {
        try {
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } catch (error) {
            console.error('Cache delete pattern error:', error);
        }
    },

    /**
     * Get or fetch pattern
     * If key doesn't exist, fetch from callback and cache
     */
    async getOrFetch<T>(
        key: string,
        fetchFn: () => Promise<T>,
        ttl: number = CacheTTL.MEDIUM
    ): Promise<T> {
        // Try to get from cache
        const cached = await this.get<T>(key);
        if (cached !== null) {
            return cached;
        }

        // Cache miss - fetch fresh data
        const fresh = await fetchFn();

        // Store in cache
        await this.set(key, fresh, ttl);

        return fresh;
    },

    /**
     * Increment a counter
     */
    async incr(key: string): Promise<number> {
        try {
            return await redis.incr(key);
        } catch (error) {
            console.error('Cache incr error:', error);
            return 0;
        }
    },

    /**
     * Decrement a counter
     */
    async decr(key: string): Promise<number> {
        try {
            return await redis.decr(key);
        } catch (error) {
            console.error('Cache decr error:', error);
            return 0;
        }
    },

    /**
     * Check if key exists
     */
    async exists(key: string): Promise<boolean> {
        try {
            const result = await redis.exists(key);
            return result === 1;
        } catch (error) {
            console.error('Cache exists error:', error);
            return false;
        }
    },

    /**
     * Set key expiration
     */
    async expire(key: string, seconds: number): Promise<void> {
        try {
            await redis.expire(key, seconds);
        } catch (error) {
            console.error('Cache expire error:', error);
        }
    },

    /**
     * Get remaining TTL
     */
    async ttl(key: string): Promise<number> {
        try {
            return await redis.ttl(key);
        } catch (error) {
            console.error('Cache ttl error:', error);
            return -1;
        }
    },
};

/**
 * Cache invalidation helpers
 */
export const cacheInvalidation = {
    /**
     * Invalidate all user-related caches
     */
    async invalidateUser(userId: string) {
        await cacheService.delPattern(`user:${userId}:*`);
    },

    /**
     * Invalidate all tenant-related caches
     */
    async invalidateTenant(tenantId: string) {
        await cacheService.delPattern(`tenant:${tenantId}:*`);
    },

    /**
     * Invalidate analytics caches
     */
    async invalidateAnalytics(tenantId: string) {
        await cacheService.delPattern(`analytics:${tenantId}:*`);
        await cacheService.del(CacheKeys.revenueSummary(tenantId));
    },

    /**
     * Invalidate API response caches
     */
    async invalidateApiResponses(endpoint: string) {
        await cacheService.delPattern(`api:${endpoint}:*`);
    },
};

/**
 * Cache decorator for methods
 */
export function Cached(key: string, ttl: number = CacheTTL.MEDIUM) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const cacheKey = key + ':' + JSON.stringify(args);

            return cacheService.getOrFetch(
                cacheKey,
                () => originalMethod.apply(this, args),
                ttl
            );
        };

        return descriptor;
    };
}
