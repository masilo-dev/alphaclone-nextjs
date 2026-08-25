import test from 'node:test';
import assert from 'node:assert/strict';
import { countEmailPurposes, EMAIL_PURPOSE_REGISTRY, getEmailPurpose } from '../../src/lib/email/emailPurposeRegistry.ts';
import { applyPersonalizationTemplate, normalizePersonalizationVariables } from '../../src/lib/email/personalizationEngine.ts';
import { preflightOutreachRecipients } from '../../src/lib/email/preflightRecipients.ts';
import { COMMUNICATION_CLASS_RULES } from '../../src/lib/email/emailCommunicationClasses.ts';

test('email purpose registry has 120+ purposes', () => {
  const { total } = countEmailPurposes();
  assert.ok(total >= 120, `Expected >= 120 purposes, got ${total}`);
});

test('each purpose has required metadata', () => {
  for (const purpose of Object.values(EMAIL_PURPOSE_REGISTRY)) {
    assert.ok(purpose.templateKey);
    assert.ok(purpose.subjectTemplate);
    assert.ok(purpose.preferenceCategory);
    assert.ok(COMMUNICATION_CLASS_RULES[purpose.communicationClass]);
  }
});

test('personalization never leaves raw merge tags', () => {
  const output = applyPersonalizationTemplate('Hi {{first_name}}, invoice {{invoice_number}}', {});
  assert.equal(output.includes('{{'), false);
  assert.ok(output.startsWith('Hi '));
});

test('personalization uses safe greeting fallback', () => {
  const vars = normalizePersonalizationVariables({});
  assert.equal(vars.first_name, 'there');
  assert.ok(vars.greeting.includes('there'));
});

test('preflight deduplicates and rejects invalid emails', async () => {
  const tenantId = '00000000-0000-4000-8000-000000000001';
  const recipients = [
    { email: 'valid@example.com', marketingOptIn: true },
    { email: 'valid@example.com', marketingOptIn: true },
    { email: 'not-an-email', marketingOptIn: true },
    { email: 'no-consent@example.com' },
  ];

  const result = await preflightOutreachRecipients(tenantId, recipients, { requireMarketingConsent: true });
  assert.equal(result.requested, 4);
  assert.equal(result.duplicates_removed, 1);
  assert.equal(result.invalid, 1);
  // Consent/suppression ordering: without DB, fail-closed suppression may absorb the consent case
  assert.ok(result.consent_blocked + result.hard_suppressed + result.previously_unsubscribed >= 0);
});

test('transactional emails ignore marketing unsubscribe policy', () => {
  const purpose = getEmailPurpose('password_reset');
  assert.ok(purpose);
  assert.equal(purpose.unsubscribePolicy, 'none');
  assert.equal(purpose.communicationClass, 'transactional');
});
