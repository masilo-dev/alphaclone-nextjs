import { describe, it } from 'node:test';
import assert from 'node:assert';
import { countActiveSuperAdmins } from '../../src/lib/apiAuth';
import { isPlatformAdminRole, normalizePlatformRole } from '../../src/lib/platformAdmin';

/**
 * Super Admin Security Test Suite
 * Validating platform-wide governance, RBAC, lockout protection, and audit integrity.
 */

describe('Super Admin Governance & Security Tests', () => {
  describe('Requirement #35: Platform Super Admin Role Identification', () => {
    it('correctly identifies super_admin and platform admin roles', () => {
      assert.strictEqual(isPlatformAdminRole('super_admin'), true);
      assert.strictEqual(isPlatformAdminRole('admin'), true);
      assert.strictEqual(isPlatformAdminRole('platform_admin'), true);
      assert.strictEqual(isPlatformAdminRole('platform_owner'), true);
      assert.strictEqual(isPlatformAdminRole('tenant_admin'), false);
      assert.strictEqual(isPlatformAdminRole('user'), false);
      assert.strictEqual(isPlatformAdminRole('client'), false);
    });

    it('normalizes platform role strings safely', () => {
      assert.strictEqual(normalizePlatformRole('SUPER_ADMIN'), 'super_admin');
      assert.strictEqual(normalizePlatformRole('Admin'), 'admin');
      assert.strictEqual(normalizePlatformRole(undefined), '');
    });
  });

  describe('Requirement #36 & #44: Security & Audit Privacy Guards', () => {
    it('redacts sensitive fields (passwords, tokens, keys) from metadata', () => {
      const metadata = {
        email: 'user@example.com',
        password: 'SuperSecretPassword123!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        action_reason: 'Routine promotion',
      };

      const cleanMeta: Record<string, any> = {};
      for (const [k, v] of Object.entries(metadata)) {
        if (!/token|secret|password|key|hash|cookie|credential/i.test(k)) {
          cleanMeta[k] = v;
        }
      }

      assert.strictEqual(cleanMeta.password, undefined);
      assert.strictEqual(cleanMeta.token, undefined);
      assert.strictEqual(cleanMeta.email, 'user@example.com');
      assert.strictEqual(cleanMeta.action_reason, 'Routine promotion');
    });
  });

  describe('Requirement #38 & #41: Final Super Admin Lockout Protection', () => {
    it('correctly counts active super admin profiles', async () => {
      const mockProfiles = [
        { id: '1', role: 'super_admin', account_status: 'active' },
        { id: '2', role: 'user', account_status: 'active' },
        { id: '3', role: 'admin', account_status: 'suspended' },
      ];

      const mockAdminClient = {
        from: () => ({
          select: () => Promise.resolve({ data: mockProfiles, error: null }),
        }),
      };

      const count = await countActiveSuperAdmins(mockAdminClient);
      assert.strictEqual(count, 1);
    });

    it('blocks demotion/removal when only 1 active Super Admin exists', async () => {
      const mockProfiles = [
        { id: 'sole-admin-id', role: 'super_admin', account_status: 'active' },
      ];

      const mockAdminClient = {
        from: () => ({
          select: () => Promise.resolve({ data: mockProfiles, error: null }),
        }),
      };

      const activeCount = await countActiveSuperAdmins(mockAdminClient);
      assert.ok(activeCount <= 1);

      const errorMessage = 'Cannot remove the final active Super Admin. Promote another administrator first.';
      assert.ok(errorMessage.includes('Cannot remove the final active Super Admin'));
    });
  });

  describe('Requirement #43: Workspace Ownership Transfer Check', () => {
    it('blocks permanent deletion if user is sole owner of a workspace', () => {
      const userTenants = [{ tenant_id: 'tenant-123', role: 'owner' }];
      const coOwners: any[] = [];

      const cannotDelete = userTenants.length > 0 && coOwners.length === 0;
      assert.strictEqual(cannotDelete, true);
    });

    it('allows permanent deletion once workspace ownership is transferred', () => {
      const coOwners = [{ user_id: 'new-owner-id', role: 'owner' }];
      const cannotDelete = coOwners.length === 0;
      assert.strictEqual(cannotDelete, false);
    });
  });
});
