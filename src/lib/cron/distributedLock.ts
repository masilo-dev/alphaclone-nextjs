import { randomUUID } from 'node:crypto';
import { getRedisAsync, isRedisConfigured } from '@/lib/redis/client';
import { logRateLimited } from '@/lib/runtime/logRateLimit';

export type CronLockResult =
  | { acquired: true; ownerId: string; release: () => Promise<void> }
  | { acquired: false; reason: 'held' | 'redis_unavailable' };

const localLocks = new Map<string, { ownerId: string; expiresAt: number }>();

function lockKey(jobName: string): string {
  return `cron:lock:${jobName}`;
}

function cleanupExpiredLocal(key: string): void {
  const entry = localLocks.get(key);
  if (entry && entry.expiresAt <= Date.now()) {
    localLocks.delete(key);
  }
}

/**
 * Acquire a distributed cron singleton lock (Redis SET NX EX).
 * When Redis is configured but unreachable, returns redis_unavailable (no in-process fallback).
 * In-process fallback is only used when Redis is not configured at all (single-replica dev).
 */
export async function acquireCronLock(
  jobName: string,
  ttlSec = 120
): Promise<CronLockResult> {
  const ownerId = `${process.pid}-${randomUUID()}`;
  const key = lockKey(jobName);

  if (isRedisConfigured()) {
    try {
      const redis = await getRedisAsync({ requireConfigured: true });
      if (!redis) {
        return { acquired: false, reason: 'redis_unavailable' };
      }

      const ok = await redis.set(key, ownerId, { nx: true, ex: ttlSec });
      const acquired = ok === 'OK' || ok === true;
      if (!acquired) {
        return { acquired: false, reason: 'held' };
      }

      return {
        acquired: true,
        ownerId,
        release: async () => {
          try {
            const current = await redis.get(key);
            if (current === ownerId) {
              await redis.del(key);
            }
          } catch (err) {
            logRateLimited(
              `cron-lock:release:${jobName}`,
              'warn',
              `[cron-lock] release failed for ${jobName}`,
              err instanceof Error ? err.message : err
            );
          }
        },
      };
    } catch (err) {
      logRateLimited(
        `cron-lock:acquire:${jobName}`,
        'warn',
        `[cron-lock] Redis unavailable for ${jobName}`,
        err instanceof Error ? err.message : err
      );
      return { acquired: false, reason: 'redis_unavailable' };
    }
  }

  // Dev / single-replica fallback when Redis is not configured
  cleanupExpiredLocal(key);
  const held = localLocks.get(key);
  if (held && held.expiresAt > Date.now()) {
    return { acquired: false, reason: 'held' };
  }
  localLocks.set(key, { ownerId, expiresAt: Date.now() + ttlSec * 1000 });
  return {
    acquired: true,
    ownerId,
    release: async () => {
      const current = localLocks.get(key);
      if (current?.ownerId === ownerId) {
        localLocks.delete(key);
      }
    },
  };
}

/** Force-clear an expired lock (test / recovery helper). */
export function clearLocalCronLockForTests(jobName: string): void {
  localLocks.delete(lockKey(jobName));
}
