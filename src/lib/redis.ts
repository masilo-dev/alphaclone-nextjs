import { Redis } from '@upstash/redis';
import { ENV } from '@/config/env';
import { isProduction } from '@/lib/security/productionGuard';

/**
 * Shared Upstash Redis client — lazy singleton.
 * Do not instantiate at module load when URL/token are missing (avoids Upstash warnings).
 */

let redisClient: Redis | null = null;
let redisInitAttempted = false;

export const isRedisConfigured = (): boolean => {
  return Boolean(ENV.UPSTASH_REDIS_REST_URL?.trim() && ENV.UPSTASH_REDIS_REST_TOKEN?.trim());
};

/**
 * Returns Redis client when configured; null when optional and missing.
 * In production, throws when Redis is required for security-critical paths
 * and `REDIS_REQUIRED=true` (or when caller passes requireConfigured).
 */
export function getRedis(options?: { requireConfigured?: boolean }): Redis | null {
  const required =
    options?.requireConfigured === true ||
    (isProduction() &&
      (process.env.REDIS_REQUIRED === 'true' || process.env.REDIS_REQUIRED === '1'));

  if (!isRedisConfigured()) {
    if (required) {
      throw new Error(
        'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required for this operation'
      );
    }
    return null;
  }

  if (!redisClient && !redisInitAttempted) {
    redisInitAttempted = true;
    redisClient = new Redis({
      url: ENV.UPSTASH_REDIS_REST_URL!,
      token: ENV.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  return redisClient;
}

/**
 * Backward-compatible export. Prefer `getRedis()` for new code.
 * Lazily creates the client only when configured; otherwise a no-op proxy that throws on use.
 */
export const redis: Redis = new Proxy({} as Redis, {
  get(_target, prop) {
    const client = getRedis();
    if (!client) {
      if (prop === 'then') return undefined;
      throw new Error(
        'Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.'
      );
    }
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
