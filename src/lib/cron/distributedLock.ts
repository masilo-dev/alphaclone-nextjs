import { randomUUID } from 'node:crypto';
import { getRedis, isRedisConfigured } from '@/lib/redis';

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
 * Falls back to in-process lock when Redis is unavailable (single-replica only).
 */
export async function acquireCronLock(
  jobName: string,
  ttlSec = 120
): Promise<CronLockResult> {
  const ownerId = `${process.pid}-${randomUUID()}`;
  const key = lockKey(jobName);
  const redis = getRedis();

  if (redis) {
    const ok = await redis.set(key, ownerId, { nx: true, ex: ttlSec });
    if (!ok) {
      return { acquired: false, reason: 'held' };
    }
    return {
      acquired: true,
      ownerId,
      release: async () => {
        try {
          const current = await redis.get<string>(key);
          if (current === ownerId) {
            await redis.del(key);
          }
        } catch (err) {
          console.warn(`[cron-lock] release failed for ${jobName}:`, err);
        }
      },
    };
  }

  if (!isRedisConfigured()) {
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

  return { acquired: false, reason: 'redis_unavailable' };
}

/** Force-clear an expired lock (test / recovery helper). */
export function clearLocalCronLockForTests(jobName: string): void {
  localLocks.delete(lockKey(jobName));
}
