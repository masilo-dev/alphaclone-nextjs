import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateProjectKickoff,
  projectKickoffIdempotencyKey,
} from '../../src/lib/projects/projectAutomationPolicy.ts';

const basePolicy = {
  enabled: true,
  requireSignedContract: true,
  requireDeposit: false,
};

test('signed contract is eligible when no deposit is required', () => {
  const result = evaluateProjectKickoff(basePolicy, { contractSigned: true });
  assert.equal(result.eligible, true);
  assert.equal(result.idempotentSuccess, false);
});

test('unsigned contract is rejected when signing is required', () => {
  const result = evaluateProjectKickoff(basePolicy, { contractSigned: false });
  assert.equal(result.eligible, false);
  assert.match(result.reasons[0], /signed/i);
});

test('deposit amount threshold is enforced', () => {
  const result = evaluateProjectKickoff(
    { ...basePolicy, requireDeposit: true, minimumDepositAmount: 500 },
    { contractSigned: true, contractValue: 2000, amountPaid: 300 },
  );
  assert.equal(result.eligible, false);
  assert.match(result.reasons[0], /500 required/i);
});

test('deposit percentage threshold is enforced from contract value', () => {
  const result = evaluateProjectKickoff(
    { ...basePolicy, requireDeposit: true, minimumDepositPercent: 25 },
    { contractSigned: true, contractValue: 2000, amountPaid: 500 },
  );
  assert.equal(result.eligible, true);
});

test('stricter of fixed amount and percentage wins', () => {
  const result = evaluateProjectKickoff(
    {
      ...basePolicy,
      requireDeposit: true,
      minimumDepositAmount: 300,
      minimumDepositPercent: 25,
    },
    { contractSigned: true, contractValue: 2000, amountPaid: 400 },
  );
  assert.equal(result.eligible, false);
});

test('existing project makes retries idempotently successful', () => {
  const result = evaluateProjectKickoff(
    { ...basePolicy, enabled: false },
    { contractSigned: false, projectAlreadyExists: true },
  );
  assert.equal(result.eligible, true);
  assert.equal(result.idempotentSuccess, true);
});

test('idempotency key is stable for tenant, contract and policy version', () => {
  const key = projectKickoffIdempotencyKey({
    tenantId: 'tenant-1',
    contractId: 'contract-1',
    policyVersion: 3,
  });
  assert.equal(key, 'project-kickoff:tenant-1:contract-1:v3');
});
