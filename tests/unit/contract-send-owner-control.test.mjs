import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContract } from '../../src/lib/documents/documentValidationEngine.ts';
import { runContractLegalConsistencyCheck } from '../../src/lib/documents/contractLegalPreflight.ts';
import { contractSendReview, sendsDraftReview } from '../../src/lib/contracts/contractSendReview.ts';

test('signature lines and filled draft signatures do not veto sending', () => {
  const text = 'USD 1\nClient signature: ______________________\nSupplier email: sales@example.com';
  const review = contractSendReview(validateContract({ text, isDraft: true, hasSignaturesFilled: true }), runContractLegalConsistencyCheck({ content: text }), ['{{client.address}}']);
  assert.equal(review.can_send, true);
  assert.ok(review.findings.some(f => f.id === 'draft-with-signatures' && f.severity === 'warning'));
  assert.ok(review.findings.some(f => f.id === 'blank_placeholder' && f.severity === 'warning'));
  assert.ok(review.findings.some(f => f.id === 'unresolved-template-tokens'));
});
test('owner-authored contract terms remain advisory even for signature delivery', () => {
  const result = contractSendReview(validateContract({ text: 'We promise an original logo. The client agreed to copy the logo.', isDraft: false }), []);
  assert.equal(result.can_send, true);
  assert.ok(result.findings.every(f => f.severity !== 'critical'));
});
test('supplier email is allowed; explicitly conflicting client identity stays blocked', () => {
  const base = { clientEmail: 'client@example.com', jurisdiction: 'Poland', hasSignatureBlock: true };
  assert.equal(contractSendReview(validateContract({ ...base, text: 'Supplier email: sales@example.com' }), []).can_send, true);
  assert.equal(contractSendReview(validateContract({ ...base, text: 'Client email: someoneelse@example.com' }), []).can_send, false);
});
test('draft status alone does not turn send into review-only delivery', () => {
  assert.equal(sendsDraftReview({}), false);
  assert.equal(sendsDraftReview({ draftReview: true }), true);
  assert.equal(sendsDraftReview({ send_draft_for_review: true }), true);
});

import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as sendReview from '../../src/lib/contracts/contractSendReview.ts';
import * as governingLaw from '../../src/lib/contracts/contractGoverningLaw.ts';
import * as variables from '../../src/lib/contracts/contractVariables.ts';
test('actual send handler records advice and proceeds to provider routing for a USD 1 draft', async () => {
  let routed = false; const updates = [];
  const dependencies = {
    '@/lib/contracts/contractSendReview': sendReview,
    '@/lib/contracts/contractGoverningLaw': governingLaw,
    '@/lib/contracts/contractVariables': variables,
    '@/lib/documents/documentValidationEngine': { validateContract },
    '@/lib/documents/contractLegalPreflight': { runContractLegalConsistencyCheck },
    '@/lib/email/providerIntegrationResolver': { resolveAllConnectedEmailProviders: async () => { routed = true; return []; } },
  };
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('src/app/api/contracts/management/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, require: name => dependencies[name] || {}, console, process, Buffer, Date });
  const row = { id: 'contract', status: 'draft', content: 'USD 1\nClient signature: ______________________', client_email: 'client@example.com', admin_signature: 'Supplier', metadata: {} };
  const db = { from(table) {
    const query = { select() { return query; }, eq() { return query; },
      single: async () => ({ data: row, error: null }),
      update(value) { updates.push({ table, value }); return query; },
      insert() { return query; }, then(resolve) { return Promise.resolve({ error: null }).then(resolve); } };
    return query;
  } };
  const result = await exports.sendContract('tenant', { contractId: row.id, recipients: ['client@example.com'] }, db, 'owner');
  assert.equal(routed, true);
  assert.ok(!result.error?.includes('legal checks'));
  const review = updates.find(update => update.value.last_risk_review_at)?.value;
  assert.equal(review.metadata.last_pre_send_validation.can_send, true);
  assert.equal(review.metadata.last_pre_send_validation.validation_mode, 'signature');
});
