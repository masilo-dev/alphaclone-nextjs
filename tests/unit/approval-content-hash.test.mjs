import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeOutboundContentHash, verifyApprovalContentMatch } from '../../src/lib/email/approvalContentHash.ts';

test('Approval Content Hash: produces consistent deterministic hashes', () => {
  const payload1 = {
    to: 'lead@example.com',
    subject: 'Follow-up regarding Enterprise Plan',
    body: 'Hi Sarah, checking in on your review of our proposal.',
    sender: 'alex@alphaclonesystems.com',
    channel: 'email',
  };

  const payload2 = {
    to: ['LEAD@example.com'], // different casing & array wrapping
    subject: 'Follow-up regarding Enterprise Plan',
    body: 'Hi Sarah, checking in on your review of our proposal.',
    sender: 'alex@alphaclonesystems.com ',
    channel: 'email',
  };

  const hash1 = computeOutboundContentHash(payload1);
  const hash2 = computeOutboundContentHash(payload2);

  assert.equal(hash1, hash2, 'Normalized content hashes must match identically');
  assert.equal(typeof hash1, 'string');
  assert.equal(hash1.length, 64);
});

test('Approval Content Hash: detects content tampering and invalidates approval', () => {
  const original = {
    to: 'ceo@target.com',
    subject: 'Proposal Review',
    body: 'Original approved body text.',
  };

  const approvedHash = computeOutboundContentHash(original);

  const checkOriginal = verifyApprovalContentMatch(approvedHash, original);
  assert.equal(checkOriginal.valid, true);

  // Altered body
  const alteredBody = { ...original, body: 'Altered text with different terms.' };
  const checkAlteredBody = verifyApprovalContentMatch(approvedHash, alteredBody);
  assert.equal(checkAlteredBody.valid, false);
  assert.match(checkAlteredBody.reason || '', /modified after approval/);

  // Altered recipient
  const alteredRecipient = { ...original, to: 'attacker@evil.com' };
  const checkAlteredRecipient = verifyApprovalContentMatch(approvedHash, alteredRecipient);
  assert.equal(checkAlteredRecipient.valid, false);
});
