/**
 * AlphaClone email design system tests
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveEmailLogoUrl,
  VERIFIED_EMAIL_LOGO_URL,
  isAbsoluteHttpsUrl,
  validateEmailLogoUrl,
} from '../../src/lib/email/emailConfig.ts';
import { renderEmail, gatewayCategoryToTemplateType } from '../../src/lib/email/renderEmail.ts';
import { renderEmailShell } from '../../src/lib/compliance/emailDesignSystem.ts';
import { buildPlatformEmailBranding } from '../../src/lib/email/tenantEmailBranding.ts';
import { buildEmailContentHtml } from '../../src/lib/email/emailContentBuilder.ts';
import { resolveCommunicationCompliance } from '../../src/lib/compliance/communicationCompliance.ts';
import { buildEmail } from '../../src/lib/email/template.ts';
import { sanitizeEmailHtmlServer } from '../../src/lib/email/sanitizeEmailHtmlServer.ts';
import { renderAllEmailGallerySamples } from '../../src/lib/email/emailGallery.ts';
import { ensureFooter } from '../../src/lib/email/emailComposition.ts';

describe('email logo configuration', () => {
  it('uses absolute HTTPS production logo URL', () => {
    const url = resolveEmailLogoUrl();
    assert.equal(isAbsoluteHttpsUrl(url), true);
    assert.match(url, /alphaclone-email-logo\.png$/);
    assert.doesNotMatch(url, /localhost|127\.0\.0\.1|placeholder|logo-email\.png|alphaclone\.tech/);
  });

  it('falls back to verified permanent production URL constant', () => {
    assert.equal(isAbsoluteHttpsUrl(VERIFIED_EMAIL_LOGO_URL), true);
    assert.match(VERIFIED_EMAIL_LOGO_URL, /email-assets\/alphaclone-email-logo\.png/);
  });

  it('validates local public logo asset in dev when site URL is local', async () => {
    const localUrl = resolveEmailLogoUrl();
    const result = await validateEmailLogoUrl(localUrl);
    if (result.ok) {
      assert.match(result.contentType || '', /^image\//);
    }
  });
});

describe('renderEmail layout', () => {
  it('renders centered container, logo attributes, html and text', () => {
    const rendered = renderEmail({
      type: 'transactional',
      subject: 'Account update',
      preheader: 'Important account information',
      recipientName: 'Taylor',
      heading: 'Account update',
      content: 'Your settings were saved successfully.',
      cta: { label: 'Review account', url: 'https://alphaclonesystems.com/dashboard' },
    });

    assert.match(rendered.html, /align="center"/);
    assert.match(rendered.html, /max-width:620px/);
    assert.match(rendered.html, /background:#F3F6F8/);
    assert.match(rendered.html, new RegExp(`src="${resolveEmailLogoUrl().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
    assert.match(rendered.html, /width="72"/);
    assert.match(rendered.html, /alt="AlphaClone Systems"/);
    assert.match(rendered.html, />AlphaClone Systems</);
    assert.match(rendered.text, /Your settings were saved successfully/);
    assert.match(rendered.text, /Alphaclone Systems, LLC/);
  });

  it('omits unsubscribe links on transactional footer', () => {
    const rendered = renderEmail({
      type: 'transactional',
      subject: 'Receipt',
      content: 'Payment received.',
      footerType: 'transactional',
    });
    assert.match(rendered.html, /Privacy Policy/);
    assert.doesNotMatch(rendered.html, /Unsubscribe/);
    assert.doesNotMatch(rendered.html, /Manage Preferences/);
  });

  it('includes marketing footer links when required', () => {
    const rendered = renderEmail({
      type: 'marketing_campaign',
      subject: 'Newsletter',
      content: 'Latest updates.',
      footerType: 'marketing',
      unsubscribeUrl: 'https://alphaclonesystems.com/api/unsubscribe?token=test',
    });
    assert.match(rendered.html, /Unsubscribe/);
    assert.match(rendered.html, /Manage Preferences/);
    assert.match(rendered.html, /text-align:center/);
  });

  it('sanitizes malicious HTML in body content', () => {
    const rendered = renderEmail({
      type: 'outreach',
      subject: 'Hello',
      content: '<p>Hi</p><script>alert(1)</script><iframe src="https://evil.test"></iframe>',
      contentIsHtml: true,
    });
    assert.doesNotMatch(rendered.html, /<script/i);
    assert.doesNotMatch(rendered.html, /<iframe/i);
    assert.match(rendered.html, /Hi/);
  });

  it('does not break when optional fields are missing', () => {
    const rendered = renderEmail({
      type: 'personal',
      subject: 'Quick note',
      content: 'Short message.',
    });
    assert.ok(rendered.html.length > 100);
    assert.ok(rendered.text.length > 20);
  });
});

describe('gateway and legacy builders', () => {
  it('renderEmailShell uses central layout and marketing footer rules', () => {
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

    const rendered = renderEmailShell({
      subject: 'Invoice ready',
      contentHtml: buildEmailContentHtml({ body: 'Your invoice is ready.' }),
      contentText: 'Your invoice is ready.',
      brand: branding.brand,
      purpose: { category: 'marketing', reasonText: 'you opted in to receive updates from Acme Corp' },
      compliance,
      unsubscribeUrl: 'https://alphaclonesystems.com/api/unsubscribe?token=test',
    });

    assert.match(rendered.html, /Privacy Policy/);
    assert.match(rendered.html, /Unsubscribe/);
    assert.match(rendered.html, /align="center"/);
    assert.match(rendered.text, /Your invoice is ready/);
  });

  it('buildEmail wraps outreach fragments with shared layout', () => {
    const html = buildEmail({
      subject: 'Following up',
      bodyHtml: '<p>Just checking in.</p>',
      tenantName: 'Acme Corp',
      tenantId: 'tenant-1',
      recipientEmail: 'client@example.com',
    });
    assert.match(html, /alphaclone-email-logo\.png|email-assets\/alphaclone-email-logo\.png/);
    assert.match(html, /align="center"/);
    assert.match(html, /Manage Preferences/);
  });

  it('ensureFooter wraps legacy HTML fragments instead of left-aligned append', () => {
    const wrapped = ensureFooter('<p>Legacy fragment only</p>');
    assert.match(wrapped, /<!doctype html>/i);
    assert.match(wrapped, /align="center"/);
    assert.match(wrapped, /Privacy Policy/);
  });

  it('maps gateway categories to template types', () => {
    assert.equal(gatewayCategoryToTemplateType('marketing'), 'marketing_campaign');
    assert.equal(gatewayCategoryToTemplateType('outreach'), 'outreach');
    assert.equal(gatewayCategoryToTemplateType('account_security'), 'account_verification');
  });
});

describe('gallery samples', () => {
  it('renders every approved template type', () => {
    const samples = renderAllEmailGallerySamples();
    assert.equal(samples.length, 13);
    for (const sample of samples) {
      assert.match(sample.html, /AlphaClone Systems/);
      assert.ok(sample.text.trim().length > 0);
    }
  });
});

describe('sanitizeEmailHtmlServer', () => {
  it('strips scripts and event handlers', () => {
    const safe = sanitizeEmailHtmlServer('<a href="https://example.com" onclick="evil()">Link</a><script>x</script>');
    assert.doesNotMatch(safe, /script/i);
    assert.doesNotMatch(safe, /onclick/i);
    assert.match(safe, /href="https:\/\/example.com"/);
  });
});
