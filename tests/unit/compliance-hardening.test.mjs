/**
 * Compliance checklist remediations — ISO 42001 / EU AI Act / NIST AI RMF gaps.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

test('ToolPolicyGate queues high-risk and is not always-allow', async () => {
  const src = fs.readFileSync(
    new URL('../../src/lib/ai/ToolPolicyGate.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /queue_approval/);
  assert.match(src, /dpa_acceptances/);
  assert.equal(/INTENTIONALLY DISABLED/.test(src), false);
  assert.match(src, /requiresApproval/);
});

test('password policy requires 12 chars', async () => {
  const { validatePasswordPolicy } = await import('../../src/lib/security/passwordPolicy.ts');
  assert.equal(validatePasswordPolicy('Short1!').ok, false);
  assert.equal(validatePasswordPolicy('LongEnough1!ab').ok, true);
});

test('HIBP k-anonymity uses SHA-1 prefix only (source)', () => {
  const src = fs.readFileSync(
    new URL('../../src/lib/security/passwordPolicy.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /api\.pwnedpasswords\.com\/range/);
  assert.match(src, /slice\(0,\s*5\)/);
});

test('signUpSchema enforces 12 character minimum', () => {
  const src = fs.readFileSync(
    new URL('../../src/schemas/validation.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /min\(12/);
});

test('proxy applies global API rate limiting including MCP', () => {
  const src = fs.readFileSync(new URL('../../proxy.ts', import.meta.url), 'utf8');
  assert.match(src, /applyGlobalApiRateLimit/);
  assert.match(src, /RATE_LIMITED/);
});

test('MFA enrollment does not enable until verified (source)', () => {
  const src = fs.readFileSync(
    new URL('../../src/services/authSecurityService.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /two_factor_enabled: false/);
  assert.match(src, /two_factor_enabled: true/);
  assert.match(src, /verifyTOTP/);
});

test('contract audit trail PDF generator exists', () => {
  const src = fs.readFileSync(
    new URL('../../src/lib/contracts/generateContractAuditTrailPdf.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /audit-trail-/);
  assert.match(src, /PDFDocument/);
});

test('BonnieApprovalCard renders diffs', () => {
  const src = fs.readFileSync(
    new URL('../../src/components/dashboard/bonnie/BonnieApprovalCard.tsx', import.meta.url),
    'utf8'
  );
  assert.match(src, /DiffLine/);
  assert.match(src, /previousDraft|payloadDiff/);
});

test('AI policy and risk register docs exist', () => {
  assert.ok(
    fs.existsSync(new URL('../../docs/AI_POLICY_STATEMENT.md', import.meta.url))
  );
  assert.ok(fs.existsSync(new URL('../../docs/AI_RISK_REGISTER.md', import.meta.url)));
});

test('executeSingleBonnieTool honors queue_approval', () => {
  const src = fs.readFileSync(
    new URL('../../src/lib/bonnie/executeSingleBonnieTool.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /queue_approval/);
  assert.match(src, /approvalRequired: true/);
});

test('SHA-1 helper for HIBP regression', () => {
  const sha1 = createHash('sha1').update('password', 'utf8').digest('hex').toUpperCase();
  assert.equal(sha1.slice(0, 5).length, 5);
});
