import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canApproveHighRisk,
  evaluateRiskPolicy,
} from '../../src/lib/bonnie/bonnieRiskPolicy.ts';

test('evaluateRiskPolicy requires admin for high risk when gate enabled', () => {
  const decision = evaluateRiskPolicy('high', {
    enabled: true,
    auto_send_enabled: true,
    auto_send_confidence_threshold: 80,
    high_risk_approval_required: true,
  });
  assert.equal(decision, 'require_admin_approval');
});

test('evaluateRiskPolicy auto executes low risk when auto send enabled', () => {
  const decision = evaluateRiskPolicy('low', {
    enabled: true,
    auto_send_enabled: true,
    auto_send_confidence_threshold: 80,
    high_risk_approval_required: true,
  });
  assert.equal(decision, 'auto_execute');
});

test('canApproveHighRisk allows tenant admins and owners', () => {
  assert.equal(canApproveHighRisk('tenant_admin'), true);
  assert.equal(canApproveHighRisk('owner'), true);
  assert.equal(canApproveHighRisk('member'), false);
});
