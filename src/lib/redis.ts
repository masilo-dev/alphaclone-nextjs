/**
 * Shared Redis facade — re-exports centralized adapter.
 * Prefer getRedisAsync() for coordination paths (locks, required ops).
 */

export {
  closeRedis,
  getActiveRedisBackend,
  getRedis,
  getRedisAsync,
  getRedisBackend,
  getRedisConnectionState,
  isRedisConfigured,
  redisBackend,
  redisEnabled,
  type RedisBackend,
  type RedisCommands,
} from '@/lib/redis/client';

import { getRedis, isRedisConfigured, type RedisCommands } from '@/lib/redis/client';

/**
 * Backward-compatible lazy proxy for list/cache operations (memorySystem, etc.).
 */
export const redis: RedisCommands = new Proxy({} as RedisCommands, {
  get(_target, prop) {
    const client = getRedis();
    if (!client) {
      if (prop === 'then') return undefined;
      throw new Error(
        'Redis is not configured. Set REDIS_URL or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.'
      );
    }
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export { isRedisConfigured as defaultIsRedisConfigured };
