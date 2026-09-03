/**
 * Production hardening — unified Redis, HTTP resilience, worker split.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('unified redis client prefers REDIS_URL over Upstash', () => {
  const source = fs.readFileSync('src/lib/redis/client.ts', 'utf8');
  assert.match(source, /REDIS_URL/);
  assert.match(source, /lazyConnect/);
  assert.match(source, /closeRedis/);
  assert.match(source, /getRedisAsync/);
});

test('distributed lock uses async redis and fails closed when configured but unavailable', () => {
  const source = fs.readFileSync('src/lib/cron/distributedLock.ts', 'utf8');
  assert.match(source, /getRedisAsync/);
  assert.match(source, /redis_unavailable/);
  assert.doesNotMatch(source, /from '@\/lib\/redis'$/m);
});

test('cache redis delegates to centralized client', () => {
  const source = fs.readFileSync('src/lib/cache/redis.ts', 'utf8');
  assert.match(source, /from '@\/lib\/redis\/client'/);
  assert.doesNotMatch(source, /new IORedis/);
});

test('rate limit uses shared redis client not duplicate Upstash instance at module scope', () => {
  const source = fs.readFileSync('src/lib/rateLimit.ts', 'utf8');
  assert.match(source, /getRedisAsync/);
  assert.doesNotMatch(source, /const redis = process\.env\.UPSTASH/);
});

test('fetchWithTimeout and retryWithBackoff utilities exist', async () => {
  const { fetchWithTimeout, HttpTimeouts } = await import('../../src/lib/http/fetchWithTimeout.ts');
  const { retryWithBackoff, computeBackoffDelay, isTransientError } = await import(
    '../../src/lib/http/retryWithBackoff.ts'
  );
  assert.equal(typeof fetchWithTimeout, 'function');
  assert.ok(HttpTimeouts.ai >= 30_000);
  assert.ok(computeBackoffDelay(3) >= 4_000);
  assert.equal(isTransientError(new Error('503 Service Unavailable')), true);
  assert.equal(isTransientError(new Error('client_id mismatch on refresh')), false);

  let attempts = 0;
  await retryWithBackoff(
    async () => {
      attempts += 1;
      if (attempts < 2) throw new Error('503 temporary');
      return 'ok';
    },
    { maxAttempts: 3, baseDelayMs: 1 }
  );
  assert.equal(attempts, 2);
});

test('integration circuit breaker opens after repeated failures', async () => {
  const {
    assertIntegrationCircuitClosed,
    recordIntegrationFailure,
    recordIntegrationSuccess,
    IntegrationCircuitOpenError,
  } = await import('../../src/lib/http/integrationCircuitBreaker.ts');

  recordIntegrationSuccess('linkedin', 'tenant-1');
  for (let i = 0; i < 5; i += 1) {
    recordIntegrationFailure('linkedin', new Error('503'), 'tenant-1');
  }
  assert.throws(
    () => assertIntegrationCircuitClosed('linkedin', 'tenant-1'),
    IntegrationCircuitOpenError
  );
});

test('MCP refresh flow looks up redirect URIs for client binding', () => {
  const source = fs.readFileSync('src/app/api/mcp/token/route.ts', 'utf8');
  assert.match(source, /lookupOAuthClientRedirectUris/);
  assert.match(source, /tokenRedirectUris/);
  assert.match(source, /legacy/);
});

test('system-health endpoint is internal and separate from liveness', () => {
  const source = fs.readFileSync('src/app/api/system-health/route.ts', 'utf8');
  assert.match(source, /denyIfCronUnauthorized/);
  assert.match(source, /openai/);
});

test('worker entrypoint exists for Railway split deployment', () => {
  const source = fs.readFileSync('src/worker/index.ts', 'utf8');
  assert.match(source, /registerProcessGuards/);
  assert.match(source, /workerMain/);
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.match(pkg.scripts['start:worker'], /worker\/index/);
});

test('runtime NODE_OPTIONS default targets 4096MB not full container RAM', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.match(pkg.scripts.start, /max-old-space-size=4096/);
  const docker = fs.readFileSync('Dockerfile', 'utf8');
  assert.match(docker, /max-old-space-size=4096/);
  assert.match(docker, /max-old-space-size=12288/);
});

test('batch outreach uses bounded preflight concurrency', () => {
  const source = fs.readFileSync('src/lib/mcp/executeBatchOutreach.ts', 'utf8');
  assert.match(source, /mapWithConcurrency/);
  assert.doesNotMatch(source, /Promise\.all\(allEntities\.map/);
});

test('heavy cron routes include webhook and sequence workers', () => {
  for (const route of [
    'src/app/api/cron/webhook-deliveries/route.ts',
    'src/app/api/cron/sequence-worker/route.ts',
    'src/app/api/cron/lead-discovery-worker/route.ts',
  ]) {
    const source = fs.readFileSync(route, 'utf8');
    assert.match(source, /withCronJob/, `${route} should use withCronJob`);
  }
});

test('process guards close redis on shutdown', () => {
  const source = fs.readFileSync('src/lib/runtime/processGuards.ts', 'utf8');
  assert.match(source, /closeRedis/);
  assert.match(source, /onShutdown/);
});
