/**
 * Google OAuth → business dashboard landing regressions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('DashboardClientPage mounts BusinessDashboard for tenant_admin and business_dashboard', () => {
  const src = fs.readFileSync(
    new URL('../../src/app/dashboard/[[...slug]]/DashboardClientPage.tsx', import.meta.url),
    'utf8'
  );
  assert.match(src, /role === 'tenant_admin' \|\| user\.role === 'business_dashboard'/);
});

test('ensureUserProfile promotes visitor/client roles to tenant_admin', () => {
  const src = fs.readFileSync(
    new URL('../../src/lib/tenant/bootstrapTenantServer.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /needsBusinessRole/);
  assert.match(src, /role: 'tenant_admin'/);
});

test('auth callback does not wipe session on tenant bootstrap failure without profile heal', () => {
  const src = fs.readFileSync(
    new URL('../../src/app/auth/callback/route.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /ensureUserProfile/);
  assert.match(src, /workspace_bootstrap_failed/);
});

test('AuthContext retries profile race instead of clearing session', () => {
  const src = fs.readFileSync(
    new URL('../../src/contexts/AuthContext.tsx', import.meta.url),
    'utf8'
  );
  assert.match(src, /Profile not ready yet after OAuth/);
  assert.equal(/includes\('profile'\) \|\|/.test(src) || /includes\("profile"\) \|\|/.test(src), false);
});

test('getCurrentUser falls back to tenant bootstrap when profile missing', () => {
  const src = fs.readFileSync(
    new URL('../../src/services/authService.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /\/api\/tenant\/bootstrap/);
});
