import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getPostAuthDashboardPath } from '../../src/lib/auth/postAuthRedirect';
import { normalizeBusinessRoute } from '../../src/lib/normalizeDashboardRoute';
import { CLIENT_NAV_ITEMS, TENANT_ADMIN_NAV_ITEMS } from '../../src/constants';

test('getPostAuthDashboardPath routes all non-admin users to /dashboard', () => {
  assert.equal(getPostAuthDashboardPath('super_admin'), '/dashboard/admin/tenants');
  assert.equal(getPostAuthDashboardPath('admin'), '/dashboard/admin/tenants');
  assert.equal(getPostAuthDashboardPath('tenant_admin'), '/dashboard');
  assert.equal(getPostAuthDashboardPath('business_dashboard'), '/dashboard');
  // Legacy role must never route to /dashboard/projects
  assert.equal(getPostAuthDashboardPath('client'), '/dashboard');
  assert.equal(getPostAuthDashboardPath(null), '/dashboard');
  assert.equal(getPostAuthDashboardPath(undefined), '/dashboard');
});

test('normalizeBusinessRoute resolves canonical business aliases regardless of legacy role string', () => {
  assert.equal(normalizeBusinessRoute('/dashboard/clients', 'client'), '/dashboard/crm/unified-contacts');
  assert.equal(normalizeBusinessRoute('/dashboard/finance', 'client'), '/dashboard/business/billing');
  assert.equal(normalizeBusinessRoute('/dashboard/invoices', 'client'), '/dashboard/business/billing/manage');
  assert.equal(normalizeBusinessRoute('/dashboard/contracts', 'client'), '/dashboard/business/contracts');
  assert.equal(normalizeBusinessRoute('/dashboard/projects', 'client'), '/dashboard/business/projects');
});

test('CLIENT_NAV_ITEMS is aliased to TENANT_ADMIN_NAV_ITEMS', () => {
  assert.equal(CLIENT_NAV_ITEMS, TENANT_ADMIN_NAV_ITEMS);
  assert.ok(CLIENT_NAV_ITEMS.length > 0);
});

test('DashboardClientPage mounts TenantAdminDashboardShell for all business users', () => {
  const src = fs.readFileSync(
    new URL('../../src/app/dashboard/[[...slug]]/DashboardClientPage.tsx', import.meta.url),
    'utf8'
  );
  assert.ok(src.includes('TenantAdminDashboardShell'));
  assert.match(src, /role === 'tenant_admin' \|\| user\.role === 'business_dashboard'/);
  assert.ok(!src.includes("user.role === 'client' ? <Dashboard"));
});

test('BusinessDashboard does not block users with legacy client role', () => {
  const src = fs.readFileSync(
    new URL('../../src/components/dashboard/business/BusinessDashboard.tsx', import.meta.url),
    'utf8'
  );
  assert.equal(src.includes("user.role === 'client'"), false);
});
