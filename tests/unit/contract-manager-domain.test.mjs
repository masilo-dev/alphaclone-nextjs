import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  canTransitionContract,
  explainContractRisk,
} from '../../src/lib/contracts/contractManagerDomain.ts';

test('contract lifecycle permits only server-approved transitions', () => {
  assert.equal(canTransitionContract('draft', 'internal_review'), true);
  assert.equal(canTransitionContract('draft', 'active'), false);
  assert.equal(canTransitionContract('signed', 'active'), true);
  assert.equal(canTransitionContract('archived', 'draft'), false);
  assert.equal(canTransitionContract('made_up', 'active'), false);
});

test('contract risk is explainable and notice deadline takes precedence', () => {
  const result = explainContractRisk({
    status: 'active',
    signatureStatus: 'signed',
    noticeDeadline: '2026-08-01',
    endDate: '2026-09-01',
    overdueObligations: 2,
    now: new Date('2026-07-26T00:00:00Z'),
  });
  assert.equal(result.level, 'critical');
  assert.ok(result.reasons.some((reason) => reason.code === 'notice_deadline'));
  assert.ok(result.reasons.some((reason) => reason.code === 'overdue_obligations'));
  assert.ok(result.reasons.every((reason) => reason.reason.length > 0));
});

test('active unsigned contract is a critical deterministic risk', () => {
  const result = explainContractRisk({ status: 'active', signatureStatus: 'sent' });
  assert.equal(result.level, 'critical');
  assert.equal(result.reasons[0].code, 'active_without_signature');
});

test('public signer cannot manufacture a certified document in the browser', async () => {
  const page = await readFile('src/app/contract/[id]/page.tsx', 'utf8');
  assert.doesNotMatch(page, /jsPDF|CERTIFIED CONTRACT|AUTHENTIC DOCUMENT|generateAndDownloadPDF/);
  assert.doesNotMatch(page, /AIOutputDisclaimer/);
  assert.match(page, /fetch\('\/api\/contracts\/sign'/);
  assert.match(page, /authoritative agreement and completion receipt/i);
});
