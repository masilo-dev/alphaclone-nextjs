/**
 * Per-tenant MCP tool rate limiting with Redis when available, in-memory fallback.
 */

type Bucket = { count: number; resetAt: number };

const memoryBuckets = new Map<string, Bucket>();

export type ToolRateLimitConfig = {
  limit: number;
  windowMs: number;
};

export const CONNECTOR_RATE_LIMITS: Record<string, ToolRateLimitConfig> = {
  default: { limit: 120, windowMs: 60_000 },
  audit: { limit: 10, windowMs: 60_000 },
  write: { limit: 60, windowMs: 60_000 },
  publish: { limit: 20, windowMs: 60_000 },
  restart: { limit: 3, windowMs: 300_000 },
  heavy: { limit: 15, windowMs: 60_000 },
};

function memoryCheck(key: string, config: ToolRateLimitConfig) {
  const now = Date.now();
  const existing = memoryBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + config.windowMs };
    memoryBuckets.set(key, bucket);
    return { allowed: true, remaining: config.limit - 1, resetAt: bucket.resetAt };
  }
  if (existing.count >= config.limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }
  existing.count += 1;
  return { allowed: true, remaining: config.limit - existing.count, resetAt: existing.resetAt };
}

export async function checkConnectorRateLimit(params: {
  tenantId: string;
  userId: string;
  toolName: string;
  className?: keyof typeof CONNECTOR_RATE_LIMITS;
}): Promise<{ allowed: boolean; remaining: number; resetAt: number; limit: number }> {
  const config = CONNECTOR_RATE_LIMITS[params.className || 'default'] || CONNECTOR_RATE_LIMITS.default;
  const key = `mcp:rl:${params.tenantId}:${params.userId}:${params.toolName}`;

  try {
    const { redis, redisEnabled } = await import('@/lib/cache/redis');
    if (redisEnabled && redis) {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.pexpire(key, config.windowMs);
      }
      const ttl = await redis.pttl(key);
      const resetAt = Date.now() + (ttl > 0 ? ttl : config.windowMs);
      if (count > config.limit) {
        return { allowed: false, remaining: 0, resetAt, limit: config.limit };
      }
      return { allowed: true, remaining: Math.max(config.limit - count, 0), resetAt, limit: config.limit };
    }
  } catch {
    // fall through to memory
  }

  const result = memoryCheck(key, config);
  return { ...result, limit: config.limit };
}
