import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { NextRequest } from 'next/server';
const hooks = registerHooks({
  resolve(specifier, context, next) {
    return specifier === '@/lib/supabase-admin' ? { url: 'logo-test:db', shortCircuit: true } : next(specifier, context);
  },
  load(url, context, next) {
    return url === 'logo-test:db' ? { format: 'module', source: 'export const createSupabaseAdminClient = () => globalThis.__logoTestDb;', shortCircuit: true } : next(url, context);
  },
});
const { GET } = await import('../../src/app/api/contracts/logo/route.ts');
let downloads = 0;
function database({ link, logo }) {
  return {
    from(table) {
      const query = { select() { return query; }, eq() { return query; }, is() { return query; },
        async maybeSingle() { return { data: table === 'contract_signing_tokens' ? link : table === 'tenants' ? { name: 'Issuer', logo_url: logo } : null, error: null }; } };
      return query;
    },
    storage: { from() { return { async download() { downloads++; return { data: new Blob(['fixture image'], { type: 'image/png' }), error: null }; } }; } },
  };
}
const link = { tenant_id: 'tenant-a', expires_at: '2099-01-01T00:00:00Z' };
const request = () => new NextRequest('https://example.test/api/contracts/logo?token=fixture');

test('token serves only its configured tenant logo with private cache headers', async () => {
  downloads = 0;
  globalThis.__logoTestDb = database({ link, logo: '/api/storage/uploads/tenant/tenant-a/logo.png' });
  const response = await GET(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(response.headers.get('Content-Type'), 'image/png');
  assert.equal(downloads, 1);
});
test('cross-tenant logo path and traversal never reach storage', async () => {
  for (const logo of ['/api/storage/uploads/tenant/tenant-b/logo.png', '/api/storage/uploads/tenant/tenant-a/../tenant-b/logo.png']) {
    downloads = 0;
    globalThis.__logoTestDb = database({ link, logo });
    assert.equal((await GET(request())).status, 404);
    assert.equal(downloads, 0);
  }
});
test('expired, invalid and malformed-expiry links never reach storage', async () => {
  for (const invalid of [null, { ...link, expires_at: '2020-01-01' }, { ...link, expires_at: 'not-a-date' }]) {
    downloads = 0;
    globalThis.__logoTestDb = database({ link: invalid, logo: '/api/storage/uploads/tenant/tenant-a/logo.png' });
    assert.equal((await GET(request())).status, 404);
    assert.equal(downloads, 0);
  }
});
test.after(() => { hooks.deregister(); delete globalThis.__logoTestDb; });
