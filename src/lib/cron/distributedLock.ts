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

function allowLocalLockWhenRedisDown(): boolean {
  return process.env.CRON_LOCAL_LOCK_WHEN_REDIS_DOWN !== 'false';
}

function acquireLocalCronLock(
  key: string,
  ownerId: string,
  ttlSec: number,
  store: Map<string, { ownerId: string; expiresAt: number }>
): CronLockResult {
  cleanupExpiredLocal(key);
  const held = store.get(key);
  if (held && held.expiresAt > Date.now()) {
    return { acquired: false, reason: 'held' };
  }
  store.set(key, { ownerId, expiresAt: Date.now() + ttlSec * 1000 });
  return {
    acquired: true,
    ownerId,
    release: async () => {
      const current = store.get(key);
      if (current?.ownerId === ownerId) {
        store.delete(key);
      }
    },
  };
}

/**
 * Acquire a distributed cron singleton lock (Redis SET NX EX).
 * When Redis is configured but unreachable, falls back to in-process lock on single replica
 * unless CRON_LOCAL_LOCK_WHEN_REDIS_DOWN=false.
 */
export async function acquireCronLock(
  jobName: string,
  ttlSec = 120
): Promise<CronLockResult> {
  const ownerId = `${process.pid}-${randomUUID()}`;
  const key = lockKey(jobName);

  if (isRedisConfigured()) {
    try {
      const redis = await getRedisAsync();
      if (!redis) {
        if (allowLocalLockWhenRedisDown()) {
          logRateLimited(
            `cron-lock:fallback:${jobName}`,
            'warn',
            `[cron-lock] Redis unavailable for ${jobName}; using in-process lock fallback`
          );
          return acquireLocalCronLock(key, ownerId, ttlSec, localLocks);
        }
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
      if (allowLocalLockWhenRedisDown()) {
        return acquireLocalCronLock(key, ownerId, ttlSec, localLocks);
      }
      return { acquired: false, reason: 'redis_unavailable' };
    }
  }

  // Dev / single-replica fallback when Redis is not configured
  return acquireLocalCronLock(key, ownerId, ttlSec, localLocks);
}

/** Force-clear an expired lock (test / recovery helper). */
export function clearLocalCronLockForTests(jobName: string): void {
  localLocks.delete(lockKey(jobName));
}

const bonnieLocalLocks = new Map<string, { ownerId: string; expiresAt: number }>();

function bonnieLockKey(name: string): string {
  return `lock:bonnie:${name}`;
}

/**
 * Bonnie worker lock — Redis SET NX EX only (no in-process fallback when Redis configured).
 */
export async function acquireBonnieLock(
  name: string,
  ttlSec: number
): Promise<CronLockResult> {
  const ownerId = `${process.pid}-${randomUUID()}`;
  const key = bonnieLockKey(name);

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
              `bonnie-lock:release:${name}`,
              'warn',
              `[bonnie-lock] release failed for ${name}`,
              err instanceof Error ? err.message : err
            );
          }
        },
      };
    } catch (err) {
      logRateLimited(
        `bonnie-lock:acquire:${name}`,
        'warn',
        `[bonnie-lock] Redis unavailable for ${name}`,
        err instanceof Error ? err.message : err
      );
      return { acquired: false, reason: 'redis_unavailable' };
    }
  }

  const held = bonnieLocalLocks.get(key);
  if (held && held.expiresAt > Date.now()) {
    return { acquired: false, reason: 'held' };
  }
  bonnieLocalLocks.set(key, { ownerId, expiresAt: Date.now() + ttlSec * 1000 });
  return {
    acquired: true,
    ownerId,
    release: async () => {
      const current = bonnieLocalLocks.get(key);
      if (current?.ownerId === ownerId) {
        bonnieLocalLocks.delete(key);
      }
    },
  };
}
