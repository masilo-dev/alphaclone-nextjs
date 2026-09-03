/**
 * Email gateway + usage metering tests
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isEmailReadTool,
  isEmailSendTool,
  shouldPreChargeMcpExecution,
  determinePreExecutionQuotaMetric,
} from '../../src/lib/mcp/toolQuotaPolicy.ts';
import {
  recordProviderFailure,
  resetProviderCircuit,
  assertProviderCircuitClosed,
  ProviderCircuitOpenError,
} from '../../src/lib/email/providerCircuitBreaker.ts';
import { buildEmailContentHtml, buildEmailContentText } from '../../src/lib/email/emailContentBuilder.ts';
import { buildPlatformEmailBranding } from '../../src/lib/email/tenantEmailBranding.ts';
import { renderEmailShell } from '../../src/lib/compliance/emailDesignSystem.ts';
import { resolveCommunicationCompliance } from '../../src/lib/compliance/communicationCompliance.ts';

describe('tool quota policy', () => {
  it('does not charge email reads or mailbox sync tools', () => {
    assert.equal(isEmailReadTool('get_zoho_mail_messages'), true);
    assert.equal(isEmailReadTool('read_emails'), true);
    assert.equal(isEmailReadTool('microsoft_get_emails'), true);
    assert.equal(shouldPreChargeMcpExecution('get_zoho_mail_messages'), false);
    assert.equal(shouldPreChargeMcpExecution('microsoft_get_emails'), false);
    assert.equal(determinePreExecutionQuotaMetric('get_zoho_mail_messages'), null);
    assert.equal(determinePreExecutionQuotaMetric('microsoft_get_emails'), null);
  });

  it('charges send tools only on success path', () => {
    assert.equal(isEmailSendTool('send_email'), true);
    assert.equal(determinePreExecutionQuotaMetric('send_email'), null);
  });

  it('still pre-charges non-email business tools', () => {
    assert.equal(determinePreExecutionQuotaMetric('create_lead'), 'leads');
    assert.equal(shouldPreChargeMcpExecution('create_lead'), true);
  });
});

describe('provider circuit breaker', () => {
  it('opens after five identical consecutive failures', () => {
    resetProviderCircuit('tenant-a', 'zoho', 'get_zoho_mail_messages');
    for (let i = 0; i < 4; i += 1) {
      const state = recordProviderFailure({
        tenantId: 'tenant-a',
        provider: 'zoho',
        operation: 'get_zoho_mail_messages',
        fingerprint: 'auth_expired',
      });
      assert.equal(state.paused, false);
    }
    const final = recordProviderFailure({
      tenantId: 'tenant-a',
      provider: 'zoho',
      operation: 'get_zoho_mail_messages',
      fingerprint: 'auth_expired',
    });
    assert.equal(final.paused, true);
    assert.throws(
      () => assertProviderCircuitClosed('tenant-a', 'zoho', 'get_zoho_mail_messages'),
      ProviderCircuitOpenError,
    );
  });
});

describe('email content builder', () => {
  it('hides raw URLs behind readable labels', () => {
    const html = buildEmailContentHtml({
      body: 'Please review https://alphaclonesystems.com/invoices/abc123 today.',
      cta: { label: 'View invoice', url: 'https://alphaclonesystems.com/invoices/abc123' },
    });
    assert.match(html, /View invoice/);
    assert.doesNotMatch(html, /Please review https:\/\//);
  });

  it('renders branded shell with styled footer links', () => {
    const branding = buildPlatformEmailBranding('Acme Corp');
    const compliance = resolveCommunicationCompliance({
      tenantId: 'tenant-1',
      senderIdentityId: 'user-1',
      senderEmail: 'hello@acme.test',
      recipientEmail: 'client@example.com',
      classification: 'marketing',
      purpose: { category: 'marketing', reasonText: 'you opted in to receive updates from Acme Corp' },
      brand: { ...branding.brand, postalAddress: '123 Main Street, Denver CO' },
      locale: 'en',
      localeSource: 'platform_fallback',
      consentStatus: 'granted',
      policies: [
        { id: 'privacy', type: 'privacy', version: '1', language: 'en', publicUrl: branding.privacyPolicyUrl, status: 'published' },
        { id: 'terms', type: 'terms', version: '1', language: 'en', publicUrl: branding.termsUrl, status: 'published' },
      ],
      unsubscribeUrl: 'https://alphaclonesystems.com/api/unsubscribe?token=test',
    });
    assert.equal(compliance.ready, true);
    const contentText = buildEmailContentText({ body: 'Your invoice is ready.' });
    const rendered = renderEmailShell({
      subject: 'Invoice ready',
      contentHtml: buildEmailContentHtml({ body: 'Your invoice is ready.' }),
      contentText,
      brand: branding.brand,
      purpose: { category: 'transactional', reasonText: 'you requested an invoice from Acme Corp' },
      compliance,
      unsubscribeUrl: 'https://alphaclonesystems.com/api/unsubscribe?token=test',
    });
    assert.match(rendered.html, /Privacy Policy/);
    assert.match(rendered.html, /Unsubscribe/);
    assert.doesNotMatch(rendered.html, /Unsubscribe: https:\/\//);
    assert.match(rendered.text, /Your invoice is ready/);
  });
});

describe('sendEmailServer routes through gateway', () => {
  it('sendEmailServer module imports email gateway', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile('src/lib/email/sendEmailServer.ts', 'utf8'),
    );
    assert.match(source, /sendViaEmailGateway/);
    assert.doesNotMatch(source, /sendEmail\(/);
  });
});
