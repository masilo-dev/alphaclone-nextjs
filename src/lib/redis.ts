import { Redis } from '@upstash/redis';
import { ENV } from '@/config/env';

/**
 * Shared Upstash Redis client for server-side persistence,
 * rate limiting, and cross-session memory for AI Agents.
 */
export const redis = new Redis({
  url: ENV.UPSTASH_REDIS_REST_URL || '',
  token: ENV.UPSTASH_REDIS_REST_TOKEN || '',
});

/**
 * Utility to check if Redis is correctly configured
 */
export const isRedisConfigured = () => {
  return !!ENV.UPSTASH_REDIS_REST_URL && !!ENV.UPSTASH_REDIS_REST_TOKEN;
};
