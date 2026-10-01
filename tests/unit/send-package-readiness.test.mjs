import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkActionReadiness,
  previewSendPackage,
  verifyApprovalToken,
} from '../../src/services/documents/sendPackageService.ts';

test('Send Package Readiness & Approval Token Invalidation', async (t) => {
  const fakeTenantId = '00000000-0000-0000-0000-000000000001';

  await t.test('checkActionReadiness detects missing customer email as blocking', async () => {
    // Mock minimal client that returns null
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null }),
            }),
          }),
        }),
      }),
    };

    const res = await checkActionReadiness(
      {
        tenantId: fakeTenantId,
        action: 'send_quote',
      },
      mockSupabase
    );

    assert.equal(res.ready, false);
    assert.equal(res.can_proceed, false);
    assert.ok(
      res.blocking_errors.some((e) => e.includes('Missing valid recipient email')),
      'Expected blocking error for missing recipient email'
    );
  });

  await t.test('previewSendPackage generates deterministic approval token and verifyApprovalToken validates it', async () => {
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: '00000000-0000-0000-0000-000000000002', name: 'Test Quote', total_amount: 2000 },
              }),
            }),
          }),
        }),
      }),
    };

    const preview = await previewSendPackage(
      {
        tenantId: fakeTenantId,
        recipientEmail: 'client@example.com',
        recipientName: 'Acme Corp',
        packageType: 'quote',
        quoteId: '00000000-0000-0000-0000-000000000002',
      },
      mockSupabase
    );

    assert.equal(preview.success, true);
    assert.ok(preview.approval_token.startsWith('appr_'));
    assert.equal(preview.attachments.length, 1);
    assert.equal(preview.attachments[0].document_type, 'quote');

    // Verification succeeds on unchanged content hash
    const verified = verifyApprovalToken(preview.approval_token, preview.content_hash);
    assert.equal(verified.valid, true);

    // Verification fails on modified content hash (e.g. amount or recipient changed)
    const tamperedHash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const invalidated = verifyApprovalToken(preview.approval_token, tamperedHash);
    assert.equal(invalidated.valid, false);
    assert.ok(invalidated.reason?.includes('Approval token invalidated'));
  });
});
