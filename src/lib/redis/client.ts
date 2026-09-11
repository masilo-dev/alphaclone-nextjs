/**
 * Centralized Redis adapter — Railway TCP (ioredis) preferred, Upstash REST fallback.
 * Single lazy singleton; safe reconnect; command timeouts; rate-limited error logs.
 */

import { Redis as UpstashRedis } from '@upstash/redis';
import IORedis from 'ioredis';
import { ENV } from '@/config/env';
import { isProduction } from '@/lib/security/productionGuard';
import { logRateLimited } from '@/lib/runtime/logRateLimit';

export type RedisBackend = 'railway' | 'upstash' | 'none';

export type RedisCommands = {
  get(key: string): Promise<unknown>;
  set(key: string, value: string, options?: { nx?: boolean; ex?: number }): Promise<unknown>;
  setex(key: string, seconds: number, value: string): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  ttl(key: string): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<unknown>;
  pttl(key: string): Promise<number>;
  ping(): Promise<unknown>;
  lpush(key: string, ...values: string[]): Promise<number>;
  rpush(key: string, ...values: string[]): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
};

const CONNECT_TIMEOUT_MS = Math.max(
  1000,
  Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 15_000)
);
const COMMAND_TIMEOUT_MS = Math.max(
  500,
  Number(process.env.REDIS_COMMAND_TIMEOUT_MS || 3_000)
);
const MAX_RECONNECT_DELAY_MS = Math.max(
  5_000,
  Number(process.env.REDIS_MAX_RECONNECT_DELAY_MS || 30_000)
);

let railwayClient: IORedis | null = null;
let upstashClient: UpstashRedis | null = null;
let initAttempted = false;
let missingWarned = false;
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function railwayUrl(): string | null {
  const direct = ENV.REDIS_URL?.trim() || process.env.REDIS_URL?.trim();
  if (direct) return direct;

  const host =
    process.env.REDISHOST?.trim() ||
    process.env.REDIS_HOST?.trim() ||
    process.env.RAILWAY_PRIVATE_DOMAIN?.trim();
  const port = process.env.REDISPORT?.trim() || process.env.REDIS_PORT?.trim() || '6379';
  const password =
    process.env.REDISPASSWORD?.trim() ||
    process.env.REDIS_PASSWORD?.trim();
  const user = process.env.REDISUSER?.trim() || 'default';
  if (host && password) {
    return `redis://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}`;
  }
  return null;
}

function isRailwayPrivateRedisUrl(url: string): boolean {
  return /\.railway\.internal\b/i.test(url) || url.includes('RAILWAY_PRIVATE_DOMAIN');
}

function upstashConfigured(): boolean {
  return Boolean(
    ENV.UPSTASH_REDIS_REST_URL?.trim() && ENV.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

export function isRedisConfigured(): boolean {
  return Boolean(railwayUrl() || upstashConfigured());
}

export function getRedisBackend(): RedisBackend {
  if (railwayUrl()) return 'railway';
  if (upstashConfigured()) return 'upstash';
  return 'none';
}

function isRedisRequired(): boolean {
  return (
    process.env.REDIS_REQUIRED === 'true' ||
    process.env.REDIS_REQUIRED === '1' ||
    process.env.REQUIRE_REDIS === 'true' ||
    process.env.REQUIRE_REDIS === '1'
  );
}

function warnMissingOnce(): void {
  if (missingWarned || process.env.NODE_ENV === 'test') return;
  missingWarned = true;
  logRateLimited(
    'redis:unavailable',
    'warn',
    '[redis] Unavailable: set REDIS_URL (Railway) or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN. Optional cache/rate-limit will use in-process fallbacks; durable coordination requires Redis.'
  );
}

function withCommandTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Redis command timeout: ${label}`)),
        COMMAND_TIMEOUT_MS
      ).unref?.();
    }),
  ]);
}

function wrapRailway(client: IORedis): RedisCommands {
  return {
    async get(key) {
      return withCommandTimeout(client.get(key), 'get');
    },
    async set(key, value, options) {
      if (options?.nx && options?.ex) {
        const result = await withCommandTimeout(
          client.set(key, value, 'EX', options.ex, 'NX'),
          'set-nx-ex'
        );
        return result === 'OK' ? 'OK' : null;
      }
      if (options?.ex) {
        return withCommandTimeout(client.setex(key, options.ex, value), 'setex');
      }
      return withCommandTimeout(client.set(key, value), 'set');
    },
    async setex(key, seconds, value) {
      return withCommandTimeout(client.setex(key, seconds, value), 'setex');
    },
    async del(...keys) {
      if (keys.length === 0) return 0;
      return withCommandTimeout(client.del(...keys), 'del');
    },
    async keys(pattern) {
      return withCommandTimeout(client.keys(pattern), 'keys');
    },
    async incr(key) {
      return withCommandTimeout(client.incr(key), 'incr');
    },
    async decr(key) {
      return withCommandTimeout(client.decr(key), 'decr');
    },
    async exists(key) {
      return withCommandTimeout(client.exists(key), 'exists');
    },
    async expire(key, seconds) {
      return withCommandTimeout(client.expire(key, seconds), 'expire');
    },
    async ttl(key) {
      return withCommandTimeout(client.ttl(key), 'ttl');
    },
    async pexpire(key, milliseconds) {
      return withCommandTimeout(client.pexpire(key, milliseconds), 'pexpire');
    },
    async pttl(key) {
      return withCommandTimeout(client.pttl(key), 'pttl');
    },
    async ping() {
      return withCommandTimeout(client.ping(), 'ping');
    },
    async lpush(key, ...values) {
      return withCommandTimeout(client.lpush(key, ...values), 'lpush');
    },
    async rpush(key, ...values) {
      return withCommandTimeout(client.rpush(key, ...values), 'rpush');
    },
    async lrange(key, start, stop) {
      const result = await withCommandTimeout(client.lrange(key, start, stop), 'lrange');
      return result as string[];
    },
  };
}

function wrapUpstash(client: UpstashRedis): RedisCommands {
  return {
    async get(key) {
      return withCommandTimeout(client.get(key), 'get');
    },
    async set(key, value, options) {
      if (options?.nx) {
        return withCommandTimeout(client.set(key, value, { nx: true }), 'set');
      }
      if (options?.ex !== undefined) {
        return withCommandTimeout(client.set(key, value, { ex: options.ex }), 'set');
      }
      return withCommandTimeout(client.set(key, value), 'set');
    },
    async setex(key, seconds, value) {
      return withCommandTimeout(client.setex(key, seconds, value), 'setex');
    },
    async del(...keys) {
      if (keys.length === 0) return 0;
      return withCommandTimeout(client.del(...keys), 'del');
    },
    async keys(pattern) {
      return withCommandTimeout(client.keys(pattern), 'keys');
    },
    async incr(key) {
      return withCommandTimeout(client.incr(key), 'incr');
    },
    async decr(key) {
      return withCommandTimeout(client.decr(key), 'decr');
    },
    async exists(key) {
      return withCommandTimeout(client.exists(key), 'exists');
    },
    async expire(key, seconds) {
      return withCommandTimeout(client.expire(key, seconds), 'expire');
    },
    async ttl(key) {
      return withCommandTimeout(client.ttl(key), 'ttl');
    },
    async pexpire(key, milliseconds) {
      return withCommandTimeout(client.pexpire(key, milliseconds), 'pexpire');
    },
    async pttl(key) {
      return withCommandTimeout(client.pttl(key), 'pttl');
    },
    async ping() {
      return withCommandTimeout(client.ping(), 'ping');
    },
    async lpush(key, ...values) {
      return withCommandTimeout(client.lpush(key, ...values), 'lpush');
    },
    async rpush(key, ...values) {
      return withCommandTimeout(client.rpush(key, ...values), 'rpush');
    },
    async lrange(key, start, stop) {
      const result = await withCommandTimeout(client.lrange(key, start, stop), 'lrange');
      return (result as string[]) || [];
    },
  };
}

function scheduleReconnect(): void {
  if (reconnectTimer || !railwayUrl()) return;
  reconnectAttempt += 1;
  const delay = Math.min(
    1000 * 2 ** Math.min(reconnectAttempt - 1, 5),
    MAX_RECONNECT_DELAY_MS
  );
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!railwayClient || railwayClient.status === 'end') {
      railwayClient = null;
      initAttempted = false;
      void initRailwayClient();
    }
  }, delay);
  reconnectTimer.unref?.();
}

async function connectRailwayClient(client: IORedis): Promise<void> {
  await Promise.race([
    client.connect(),
    new Promise<void>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Redis connect timeout after ${CONNECT_TIMEOUT_MS}ms`)),
        CONNECT_TIMEOUT_MS
      ).unref?.();
    }),
  ]);
}

async function initRailwayClient(): Promise<IORedis | null> {
  const url = railwayUrl();
  if (!url) return null;

  try {
    const client = new IORedis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: CONNECT_TIMEOUT_MS,
      // Required for Railway private hostnames (redis.railway.internal).
      family: isRailwayPrivateRedisUrl(url) ? 0 : undefined,
      retryStrategy(times) {
        if (times > 8) return null;
        return Math.min(times * 500, MAX_RECONNECT_DELAY_MS);
      },
    });

    client.on('error', (err) => {
      logRateLimited('redis:railway:error', 'error', '[redis] Railway connection error', {
        message: err.message,
      });
    });

    client.on('close', () => {
      scheduleReconnect();
    });

    await connectRailwayClient(client);
    reconnectAttempt = 0;
    railwayClient = client;
    logRateLimited('redis:railway:connected', 'info', '[redis] Railway TCP connected');
    return client;
  } catch (err) {
    logRateLimited('redis:railway:connect-failed', 'warn', '[redis] Railway connect failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    scheduleReconnect();
    return null;
  }
}

function initUpstashClient(): UpstashRedis | null {
  if (!upstashConfigured()) return null;
  return new UpstashRedis({
    url: ENV.UPSTASH_REDIS_REST_URL!,
    token: ENV.UPSTASH_REDIS_REST_TOKEN!,
  });
}

let wrappedClient: RedisCommands | null = null;
let wrappedBackend: RedisBackend = 'none';
let initPromise: Promise<RedisCommands | null> | null = null;

async function ensureClient(): Promise<RedisCommands | null> {
  if (wrappedClient) return wrappedClient;

  if (!initPromise) {
    initPromise = (async () => {
      if (!initAttempted) {
        initAttempted = true;

        if (railwayUrl()) {
          const raw = await initRailwayClient();
          if (raw) {
            wrappedClient = wrapRailway(raw);
            wrappedBackend = 'railway';
            return wrappedClient;
          }
        }

        upstashClient = initUpstashClient();
        if (upstashClient) {
          wrappedClient = wrapUpstash(upstashClient);
          wrappedBackend = 'upstash';
          logRateLimited('redis:upstash:connected', 'info', '[redis] Upstash REST connected');
          return wrappedClient;
        }

        wrappedBackend = 'none';
        if (isProduction() && isRedisRequired() && !isRedisConfigured()) {
          throw new Error(
            'Redis is required but not configured. Set REDIS_URL or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.'
          );
        }
        if (isProduction() && isRedisRequired() && isRedisConfigured()) {
          logRateLimited(
            'redis:required-unavailable',
            'warn',
            '[redis] REDIS_REQUIRED=true but TCP/REST connection failed; coordination paths will defer'
          );
        }
        warnMissingOnce();
      }

      return wrappedClient;
    })().catch((err) => {
      initPromise = null;
      initAttempted = false;
      throw err;
    });
  }

  return initPromise;
}

/** Synchronous backend hint (may be 'none' before lazy init completes). */
export const redisBackend: RedisBackend = getRedisBackend();
export const redisEnabled = isRedisConfigured();

/**
 * Returns the shared Redis command facade, or null when optional and unavailable.
 * Pass `{ requireConfigured: true }` to fail closed for coordination-critical paths.
 */
export async function getRedisAsync(options?: {
  requireConfigured?: boolean;
}): Promise<RedisCommands | null> {
  const required = options?.requireConfigured === true;
  const client = await ensureClient();
  if (!client && required) {
    throw new Error('Redis is required for this operation but is not available.');
  }
  return client;
}

/** Sync accessor — triggers init; returns client once warm. Prefer getRedisAsync for locks. */
export function getRedis(options?: { requireConfigured?: boolean }): RedisCommands | null {
  const required = options?.requireConfigured === true;

  if (!isRedisConfigured()) {
    if (required) {
      throw new Error('Redis is required but not configured.');
    }
    warnMissingOnce();
    return null;
  }

  if (wrappedClient) return wrappedClient;

  void ensureClient().catch((err) => {
    logRateLimited('redis:init-failed', 'error', '[redis] Lazy init failed', {
      message: err instanceof Error ? err.message : String(err),
    });
  });

  if (required && !wrappedClient) {
    throw new Error('Redis client not yet initialized. Use getRedisAsync() for coordination paths.');
  }
  return wrappedClient;
}

/** Block until Redis is ready (used by sync proxy and startup warming). */
export async function warmRedisConnection(): Promise<boolean> {
  const client = await ensureClient();
  return client !== null;
}

export function getActiveRedisBackend(): RedisBackend {
  return wrappedBackend !== 'none' ? wrappedBackend : getRedisBackend();
}

export function getRedisConnectionState(): {
  backend: RedisBackend;
  configured: boolean;
  connected: boolean;
} {
  return {
    backend: getActiveRedisBackend(),
    configured: isRedisConfigured(),
    connected: wrappedClient !== null,
  };
}

/** Close Redis connections on shutdown. */
export async function closeRedis(): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (railwayClient) {
    try {
      await railwayClient.quit();
    } catch {
      railwayClient.disconnect();
    }
    railwayClient = null;
  }
  upstashClient = null;
  wrappedClient = null;
  wrappedBackend = 'none';
  initAttempted = false;
}
