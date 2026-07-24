/**
 * Owner / platform-admin user deletion gates.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const {
  isPlatformAdminRole,
  normalizePlatformRole,
  canRemoveWorkspaceMember,
  isWorkspaceOwnerRole,
} = await import('../../src/lib/platformAdmin.ts');

test('isPlatformAdminRole accepts canonical and alias roles', () => {
  assert.equal(isPlatformAdminRole('admin'), true);
  assert.equal(isPlatformAdminRole('super_admin'), true);
  assert.equal(isPlatformAdminRole('platform_owner'), true);
  assert.equal(isPlatformAdminRole('platform-admin'), true);
  assert.equal(isPlatformAdminRole('SuperAdmin'), true);
  assert.equal(isPlatformAdminRole('tenant_admin'), false);
  assert.equal(isPlatformAdminRole('owner'), false);
  assert.equal(isPlatformAdminRole('business_dashboard'), false);
});

test('normalizePlatformRole lowercases and underscores', () => {
  assert.equal(normalizePlatformRole('Platform Owner'), 'platform_owner');
  assert.equal(normalizePlatformRole('super-admin'), 'super_admin');
});

test('canRemoveWorkspaceMember blocks last owner and self', () => {
  assert.equal(canRemoveWorkspaceMember({ targetRole: 'member', ownerCount: 1 }).ok, true);
  assert.equal(
    canRemoveWorkspaceMember({ targetRole: 'owner', ownerCount: 1 }).ok,
    false
  );
  assert.equal(
    canRemoveWorkspaceMember({ targetRole: 'owner', ownerCount: 2 }).ok,
    true
  );
  assert.equal(
    canRemoveWorkspaceMember({ targetRole: 'member', ownerCount: 1, isSelf: true }).ok,
    false
  );
});

test('isWorkspaceOwnerRole covers owner and tenant_admin', () => {
  assert.equal(isWorkspaceOwnerRole('owner'), true);
  assert.equal(isWorkspaceOwnerRole('tenant_admin'), true);
  assert.equal(isWorkspaceOwnerRole('admin'), false);
});

test('tenant members API supports purge + last-owner guard (source)', () => {
  const src = fs.readFileSync(
    new URL('../../src/app/api/tenant/[tenantId]/members/route.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /purge/);
  assert.match(src, /canRemoveWorkspaceMember/);
  assert.match(src, /tenant_owner_delete/);
  assert.match(src, /tenant_members/);
});

test('requirePlatformSuperAdmin uses isPlatformAdminRole (source)', () => {
  const src = fs.readFileSync(
    new URL('../../src/lib/apiAuth.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /isPlatformAdminRole/);
  assert.match(src, /Platform admin role required/);
});

test('TenantSettings no longer hides remove for every owner (source)', () => {
  const src = fs.readFileSync(
    new URL('../../src/components/tenant/TenantSettings.tsx', import.meta.url),
    'utf8'
  );
  assert.equal(/member\.role !== 'owner'/.test(src), false);
  assert.match(src, /isLastOwner/);
});
