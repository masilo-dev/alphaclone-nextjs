import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveCommunicationCompliance,
  resolveLocale,
} from '../../src/lib/compliance/communicationCompliance.ts';
import { renderEmailShell } from '../../src/lib/compliance/emailDesignSystem.ts';

const privacy = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'privacy',
  version: '3.2',
  language: 'en',
  publicUrl: 'https://tenant.example/privacy',
  status: 'published',
};
const base = {
  tenantId: 'tenant',
  senderIdentityId: 'sender',
  senderEmail: 'sender@example.com',
  recipientEmail: 'person@example.com',
  classification: 'invoice',
  purpose: { category: 'billing', reasonText: 'it relates to your active service agreement.' },
  brand: { legalCompanyName: 'Example Ltd', postalAddress: '1 Main Street' },
  locale: 'en',
  localeSource: 'tenant_default',
  consentStatus: 'not_required',
  legalBasis: 'contract',
  policies: [privacy],
};

test('transactional communication does not require unsubscribe or marketing consent', () => {
  const result = resolveCommunicationCompliance(base);
  assert.equal(result.ready, true);
  assert.equal(result.unsubscribeRequired, false);
});

test('marketing blocks without consent, address, and unsubscribe', () => {
  const result = resolveCommunicationCompliance({
    ...base,
    classification: 'marketing',
    consentStatus: 'unknown',
    brand: { legalCompanyName: 'Example Ltd' },
  });
  assert.equal(result.ready, false);
  assert.deepEqual(result.issues.map((issue) => issue.code), [
    'MARKETING_BASIS_REQUIRED', 'UNSUBSCRIBE_REQUIRED', 'POSTAL_ADDRESS_REQUIRED',
  ]);
});

test('withdrawal and suppression cannot be bypassed by classification', () => {
  const result = resolveCommunicationCompliance({ ...base, suppressed: true });
  assert.equal(result.ready, false);
  assert.ok(result.issues.some((issue) => issue.code === 'RECIPIENT_SUPPRESSED'));
});

test('open tracking is disabled unless region and consent permit it', () => {
  const denied = resolveCommunicationCompliance({ ...base, requestedTracking: { opens: true } });
  assert.equal(denied.tracking.opens, false);
  const allowed = resolveCommunicationCompliance({
    ...base, consentStatus: 'granted', requestedTracking: { opens: true }, regionalOpenTrackingAllowed: true,
  });
  assert.equal(allowed.tracking.opens, true);
  assert.match(allowed.tracking.disclosure, /privacy-protection/);
});

test('locale resolution follows the documented fallback order', () => {
  assert.deepEqual(resolveLocale({ recipient: 'pl', tenantDefault: 'de' }), {
    locale: 'pl', source: 'recipient_preference',
  });
  assert.deepEqual(resolveLocale({ tenantDefault: 'de' }), {
    locale: 'de', source: 'tenant_default',
  });
});

test('email shell is table based, accessible, localised, and plain-text complete', () => {
  const compliance = resolveCommunicationCompliance(base);
  const rendered = renderEmailShell({
    subject: 'Invoice ready',
    preheader: 'Your invoice is ready',
    contentHtml: '<h1>Invoice ready</h1>',
    contentText: 'Invoice ready',
    brand: base.brand,
    purpose: base.purpose,
    compliance,
  });
  assert.match(rendered.html, /role="presentation"/);
  assert.match(rendered.html, /lang="en"/);
  assert.match(rendered.html, /Privacy policy/);
  assert.doesNotMatch(rendered.html, /Unsubscribe/);
  assert.match(rendered.text, /active service agreement/);
});
