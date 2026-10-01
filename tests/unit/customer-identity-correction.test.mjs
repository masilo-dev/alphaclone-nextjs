import test from 'node:test';
import assert from 'node:assert/strict';
import { correctCustomerIdentity } from '../../src/services/crm/customerIdentityCorrectionService.ts';

test('Customer Identity Correction Service', async (t) => {
  const fakeTenantId = '00000000-0000-0000-0000-000000000001';

  await t.test('detects email collision and blocks conflict', async () => {
    const existingClient = { id: '00000000-0000-0000-0000-000000000010', email: 'alice@example.com', name: 'Alice Original' };
    const conflictingClient = { id: '00000000-0000-0000-0000-000000000099', email: 'bob@example.com', name: 'Bob Distinct' };

    const mockSupabase = {
      from: (table) => ({
        select: () => ({
          eq: (col1, val1) => {
            const chain = {
              eq: (col2, val2) => {
                if (val2 === 'alice@example.com' && table === 'business_clients') {
                  return {
                    then: (fn) => fn({ data: [existingClient] }),
                    maybeSingle: async () => ({ data: existingClient }),
                  };
                }
                if (val2 === 'bob@example.com' && table === 'business_clients') {
                  return {
                    then: (fn) => fn({ data: [conflictingClient] }),
                    maybeSingle: async () => ({ data: conflictingClient }),
                  };
                }
                return {
                  then: (fn) => fn({ data: [] }),
                  maybeSingle: async () => ({ data: null }),
                };
              },
            };
            return chain;
          },
        }),
      }),
    };

    const res = await correctCustomerIdentity(
      {
        tenantId: fakeTenantId,
        identifier: 'alice@example.com',
        corrections: {
          email: 'bob@example.com',
        },
      },
      mockSupabase
    );

    assert.equal(res.success, false);
    assert.equal(res.status, 'conflict');
    assert.ok(res.conflict);
    assert.equal(res.conflict.conflict_type, 'email_collision');
    assert.equal(res.conflict.conflicting_email, 'bob@example.com');
  });

  await t.test('dryRun returns validated changes without mutations', async () => {
    const existingClient = { id: '00000000-0000-0000-0000-000000000010', email: 'alice@example.com', name: 'Alice Original' };

    const mockSupabase = {
      from: (table) => ({
        select: () => ({
          eq: () => ({
            eq: () => {
              if (table === 'business_clients') {
                return {
                  then: (fn) => fn({ data: [existingClient] }),
                  maybeSingle: async () => ({ data: existingClient }),
                };
              }
              return {
                then: (fn) => fn({ data: [] }),
                maybeSingle: async () => ({ data: null }),
              };
            },
          }),
        }),
      }),
    };

    const res = await correctCustomerIdentity(
      {
        tenantId: fakeTenantId,
        identifier: 'alice@example.com',
        corrections: {
          name: 'Alice Updated',
        },
        options: {
          dryRun: true,
        },
      },
      mockSupabase
    );

    assert.equal(res.success, true);
    assert.equal(res.status, 'no_change');
    assert.equal(res.updated_identity?.name, 'Alice Updated');
    assert.equal(res.updated_identity?.email, 'alice@example.com');
  });
});
