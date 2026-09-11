import {
  getRedisAsync,
  getActiveRedisBackend,
  isRedisConfigured,
  type RedisCommands,
} from '@/lib/redis/client';

/**
 * Redis caching layer — uses centralized adapter (Railway TCP preferred).
 */

export const redisBackend = getActiveRedisBackend();
export const redisEnabled = isRedisConfigured();

let cachedClient: RedisCommands | null = null;

async function resolveClient(): Promise<RedisCommands | null> {
  if (cachedClient) return cachedClient;
  cachedClient = await getRedisAsync();
  return cachedClient;
}

/** Lazy-resolved client for health checks and cache operations. */
export const redis = {
  async get(key: string) {
    const c = await resolveClient();
    return c?.get(key) ?? null;
  },
  async setex(key: string, seconds: number, value: string) {
    const c = await resolveClient();
    return c?.setex(key, seconds, value);
  },
  async del(...keys: string[]) {
    const c = await resolveClient();
    return c?.del(...keys) ?? 0;
  },
  async keys(pattern: string) {
    const c = await resolveClient();
    return c?.keys(pattern) ?? [];
  },
  async incr(key: string) {
    const c = await resolveClient();
    return c?.incr(key) ?? 0;
  },
  async decr(key: string) {
    const c = await resolveClient();
    return c?.decr(key) ?? 0;
  },
  async exists(key: string) {
    const c = await resolveClient();
    return c?.exists(key) ?? 0;
  },
  async expire(key: string, seconds: number) {
    const c = await resolveClient();
    return c?.expire(key, seconds);
  },
  async ttl(key: string) {
    const c = await resolveClient();
    return c?.ttl(key) ?? -1;
  },
  async pexpire(key: string, milliseconds: number) {
    const c = await resolveClient();
    return c?.pexpire(key, milliseconds);
  },
  async pttl(key: string) {
    const c = await resolveClient();
    return c?.pttl(key) ?? -1;
  },
  async ping() {
    const c = await resolveClient();
    return c?.ping();
  },
} satisfies Partial<RedisCommands>;

/**
 * Cache TTL presets (in seconds)
 */
export const CacheTTL = {
  VERY_SHORT: 60,
  SHORT: 300,
  MEDIUM: 900,
  LONG: 3600,
  VERY_LONG: 86400,
  WEEK: 604800,
};

/**
 * Centralized cache keys to avoid collisions
 */
export const CacheKeys = {
  user: (userId: string) => `user:${userId}`,
  userProfile: (userId: string) => `user:${userId}:profile`,
  userPermissions: (userId: string) => `user:${userId}:permissions`,
  tenant: (tenantId: string) => `tenant:${tenantId}`,
  tenantUsers: (tenantId: string) => `tenant:${tenantId}:users`,
  tenantSubscription: (tenantId: string) => `tenant:${tenantId}:subscription`,
  tenantUsage: (tenantId: string) => `tenant:${tenantId}:usage`,
  analytics: (tenantId: string, period: string) => `analytics:${tenantId}:${period}`,
  revenueSummary: (tenantId: string) => `revenue:${tenantId}:summary`,
  session: (sessionId: string) => `session:${sessionId}`,
  rateLimit: (identifier: string) => `ratelimit:${identifier}`,
  featureFlag: (flag: string) => `feature:${flag}`,
  apiResponse: (endpoint: string, params: string) => `api:${endpoint}:${params}`,
  tenantApiResponse: (tenantId: string, endpoint: string, params: string) =>
    `tenant:${tenantId}:api:${endpoint}:${params}`,
  tenantUserPermissions: (tenantId: string, userId: string) =>
    `tenant:${tenantId}:user:${userId}:permissions`,
  tenantScoped: (tenantId: string, ...parts: string[]) =>
    `tenant:${tenantId}:${parts.map((p) => String(p).replace(/:/g, '_')).join(':')}`,
};

export const cacheService = {
  async get<T>(key: string): Promise<T | null> {
    if (!redisEnabled) return null;
    try {
      const client = await resolveClient();
      if (!client) return null;
      const value = await client.get(key);
      const backend = getActiveRedisBackend();
      if (backend === 'railway' && typeof value === 'string') {
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      }
      return value as T | null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds: number = CacheTTL.MEDIUM): Promise<void> {
    if (!redisEnabled) return;
    try {
      const client = await resolveClient();
      if (!client) return;
      await client.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  },

  async del(key: string): Promise<void> {
    if (!redisEnabled) return;
    try {
      const client = await resolveClient();
      if (!client) return;
      await client.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  },

  async delPattern(pattern: string): Promise<void> {
    if (!redisEnabled) return;
    try {
      const client = await resolveClient();
      if (!client) return;
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } catch (error) {
      console.error('Cache delete pattern error:', error);
    }
  },

  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = CacheTTL.MEDIUM
  ): Promise<T> {
    if (!redisEnabled) return fetchFn();
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await fetchFn();
    await this.set(key, fresh, ttl);
    return fresh;
  },

  async incr(key: string): Promise<number> {
    if (!redisEnabled) return 0;
    try {
      const client = await resolveClient();
      return (await client?.incr(key)) ?? 0;
    } catch (error) {
      console.error('Cache incr error:', error);
      return 0;
    }
  },

  async decr(key: string): Promise<number> {
    if (!redisEnabled) return 0;
    try {
      const client = await resolveClient();
      return (await client?.decr(key)) ?? 0;
    } catch (error) {
      console.error('Cache decr error:', error);
      return 0;
    }
  },

  async exists(key: string): Promise<boolean> {
    if (!redisEnabled) return false;
    try {
      const client = await resolveClient();
      const result = await client?.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  },

  async expire(key: string, seconds: number): Promise<void> {
    if (!redisEnabled) return;
    try {
      const client = await resolveClient();
      await client?.expire(key, seconds);
    } catch (error) {
      console.error('Cache expire error:', error);
    }
  },

  async ttl(key: string): Promise<number> {
    if (!redisEnabled) return -1;
    try {
      const client = await resolveClient();
      return (await client?.ttl(key)) ?? -1;
    } catch (error) {
      console.error('Cache ttl error:', error);
      return -1;
    }
  },
};

export const cacheInvalidation = {
  async invalidateUser(userId: string) {
    await cacheService.delPattern(`user:${userId}:*`);
  },
  async invalidateTenant(tenantId: string) {
    await cacheService.delPattern(`tenant:${tenantId}:*`);
  },
  async invalidateAnalytics(tenantId: string) {
    await cacheService.delPattern(`analytics:${tenantId}:*`);
    await cacheService.del(CacheKeys.revenueSummary(tenantId));
  },
  async invalidateApiResponses(endpoint: string) {
    await cacheService.delPattern(`api:${endpoint}:*`);
  },
};

export function Cached(key: string, ttl: number = CacheTTL.MEDIUM) {
  return function (target: object, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: unknown[]) {
      const cacheKey = `${key}:${JSON.stringify(args)}`;
      return cacheService.getOrFetch(cacheKey, () => originalMethod.apply(this, args), ttl);
    };
    return descriptor;
  };
}
