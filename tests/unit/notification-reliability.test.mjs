import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('notification realtime is tenant scoped and reconnects without leaking channels', () => {
  const source = read('src/services/notificationService.ts');
  assert.match(source, /tenantService\.getCurrentTenantId/);
  assert.match(source, /filter: `tenant_id=eq\.\$\{tenantId\}`/);
  assert.match(source, /notification\.user_id === userId\.trim\(\)/);
  assert.match(source, /CHANNEL_ERROR.*TIMED_OUT.*CLOSED/);
  assert.match(source, /Math\.min\(30_000/);
  assert.match(source, /await cleanupChannel\(\)/);
  assert.match(source, /clearTimeout\(retryTimer\)/);
});

test('liveness and readiness never label unchecked dependencies healthy', () => {
  const liveness = read('src/app/api/health/route.ts');
  const readiness = read('src/app/api/readiness/route.ts');
  assert.match(liveness, /database: 'not_checked'/);
  assert.match(readiness, /dbStatus = 'unchecked'/);
  assert.match(readiness, /configured && dbStatus === 'ready'/);
  assert.doesNotMatch(readiness, /process\.env\.NODE_ENV === 'production'/);
});
