import test from 'node:test';
import assert from 'node:assert/strict';
import {
  wrapInStandardEmailLayout,
  hasEmailLayoutContainer,
  EMAIL_SYSTEM_FONTS,
} from '../../src/lib/email/emailLayout.ts';
import {
  renderOutboundEmail,
  convertMarkdownToEmailHtml,
  convertMarkdownToPlainText,
  convertHtmlToPlainText,
} from '../../src/lib/email/emailRendering.ts';
import { renderEmail } from '../../src/lib/email/renderEmail.ts';
import { invoiceEmailTemplates } from '../../src/lib/email/invoiceEmailTemplates.ts';
import { insertBeforeEmailFooter } from '../../src/lib/email/emailComposition.ts';

test('wrapInStandardEmailLayout renders centered presentation table and left-aligned text', () => {
  const html = wrapInStandardEmailLayout('<p>This is a test email body.</p>', {
    subject: 'Welcome to Acme',
    tenantName: 'Acme Corp',
  });

  // Outer centering table
  assert.match(html, /<table role="presentation" width="100%"[^>]*align="center"/);
  // Inner max-width 600px container with margin: 0 auto
  assert.match(html, /max-width:600px;width:100%;margin:0 auto;/);
  // Left-aligned content
  assert.match(html, /text-align:left/);
  // System fonts and 16px body text
  assert.match(html, /font-family:-apple-system,\s*BlinkMacSystemFont,\s*'Segoe UI',\s*Roboto/);
  assert.match(html, /font-size:16px/);
  assert.match(html, /line-height:1.6/);
  // Mobile responsive media query
  assert.match(html, /@media only screen and \(max-width:\s*620px\)/);
  assert.match(html, /padding:\s*20px 16px !important;/);
  // Dark mode media query
  assert.match(html, /@media \(prefers-color-scheme:\s*dark\)/);
  // Accurate tenant branding in header
  assert.match(html, />Acme Corp</);
});

test('wrapInStandardEmailLayout supports compact layout without artificial card wrapper', () => {
  const html = wrapInStandardEmailLayout('<p>Quick update.</p>', {
    tenantName: 'Acme Corp',
    isCompact: true,
  });

  assert.match(html, /max-width:600px/);
  assert.match(html, /border:0;/);
  assert.match(html, /background-color:#ffffff/);
});

test('hasEmailLayoutContainer accurately detects existing email presentation layouts', () => {
  assert.equal(hasEmailLayoutContainer(''), false);
  assert.equal(hasEmailLayoutContainer('<p>Plain snippet</p>'), false);
  assert.equal(hasEmailLayoutContainer('<div>Some block</div>'), false);

  const wrapped = wrapInStandardEmailLayout('<p>Hello</p>');
  assert.equal(hasEmailLayoutContainer(wrapped), true);

  const tableContainer = '<table role="presentation" class="email-container" width="100%"><tr><td>Content</td></tr></table>';
  assert.equal(hasEmailLayoutContainer(tableContainer), true);

  const maxWidthTable = '<table role="presentation" style="max-width:600px;margin:0 auto;"><tr><td>Content</td></tr></table>';
  assert.equal(hasEmailLayoutContainer(maxWidthTable), true);
});

test('convertMarkdownToEmailHtml wraps markdown in centered presentation table with 16px body font', () => {
  const markdown = `Hi Bonnie,

We have standardized the email layout across all outbound communications.

* Centered 600px presentation table
* Readable 16px system font
* Responsive padding for mobile

Best regards,
AlphaClone Team`;

  const html = convertMarkdownToEmailHtml(markdown);

  assert.match(html, /<table role="presentation" width="100%"[^>]*class="email-container"/);
  assert.match(html, /max-width:\s*600px;\s*width:\s*100%;\s*margin:\s*0 auto;/);
  assert.match(html, /font-family:\s*-apple-system/);
  assert.match(html, /font-size:\s*16px/);
  assert.match(html, /<p style="margin: 0 0 16px 0; line-height: 1.6; color: #1e293b; font-size: 16px; text-align: left;">Hi Bonnie,<\/p>/);
  assert.match(html, /<li style="margin-bottom: 6px; font-size: 16px; line-height: 1.6;">/);
});

test('renderOutboundEmail prevents double wrapping when input is already containerized', () => {
  const prewrapped = wrapInStandardEmailLayout('<p>Already wrapped content</p>', { subject: 'Test' });
  const rendered = renderOutboundEmail({ html: prewrapped });

  // Count occurrences of role="presentation"
  const matches = (rendered.html.match(/role="presentation"/g) || []).length;
  // Should NOT nest an additional email-container table inside itself
  const containerMatches = (rendered.html.match(/class="[^"]*email-container/g) || []).length;
  assert.equal(containerMatches, 1, 'Should contain exactly one email-container presentation table');
});

test('renderEmail respects tenant branding and applies responsive mobile styles', () => {
  const rendered = renderEmail({
    type: 'transactional',
    subject: 'Project Delivery Update',
    heading: 'Milestone 1 Completed',
    content: 'All deliverable assets have been generated and reviewed.',
    tenantName: 'Starlight Media',
  });

  // Tenant branding in header and footer
  assert.match(rendered.html, />Starlight Media</);
  assert.match(rendered.html, /alt="Starlight Media"/);
  assert.match(rendered.html, /Starlight Media/);
  // System font hierarchy
  assert.match(rendered.html, /font-family:-apple-system,\s*BlinkMacSystemFont,\s*'Segoe UI',\s*Roboto/);
  // 16px body text
  assert.match(rendered.html, /font-size:16px;/);
  // Centered 620px presentation container
  assert.match(rendered.html, /align="center"/);
  assert.match(rendered.html, /max-width:620px;/);
  assert.match(rendered.html, /margin:0 auto;/);
  // Mobile styles in head
  assert.match(rendered.html, /@media only screen and \(max-width: 620px\)/);
  assert.match(rendered.html, /\.email-content-cell, \.ac-email-body td \{\s*padding: 20px 16px !important;\s*\}/);
});

test('invoice email templates inline all button and card styles and preserve them through sanitization', () => {
  const data = {
    recipientName: 'Alice Smith',
    recipientEmail: 'alice@example.com',
    tenantId: '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4',
    invoiceNumber: 'INV-2026-001',
    amount: 1500,
    currency: 'USD',
    dueDate: '2026-11-01',
    actionUrl: 'https://alphaclonesystems.com/invoice/INV-2026-001',
    workspaceName: 'Acme Design Studio',
    senderName: 'Bob Vance',
    notes: 'Thank you for your business!',
    trackingPixelUrl: 'https://alphaclonesystems.com/api/track/px123.gif',
  };

  const html = invoiceEmailTemplates.invoiceSent(data);

  // Inlined amount styling
  assert.match(html, /class="invoice-amount" style="[^"]*font-size:\s*28px;[^"]*font-weight:\s*700;/);
  // Inlined card styling with inner table layout (no float: right)
  assert.match(html, /class="invoice-card" style="[^"]*background-color:\s*#f8fafc;[^"]*border-radius:\s*8px;/);
  assert.match(html, /<td class="invoice-val"[^>]*align="right"[^>]*>INV-2026-001<\/td>/);
  // Inlined button styling surviving sanitization with email-safe table button
  assert.match(html, /<a href="https:\/\/alphaclonesystems\.com\/invoice\/INV-2026-001" class="email-btn invoice-btn"/);
  assert.match(html, /background-color:\s*#0284c7;/);
  assert.match(html, /color:\s*#ffffff/);
  // Tracking pixel preserved
  assert.match(html, /<img src="https:\/\/alphaclonesystems\.com\/api\/track\/px123\.gif"/);
  // Accurate workspace/tenant name
  assert.match(html, /Acme Design Studio/);
});

test('plain text conversion produces clean text without raw markdown or brackets', () => {
  const markdown = `Hello Bonnie,

Please review the proposal at [our client portal](https://alphaclonesystems.com/portal) or view [https://cal.com/alphaclonesystems/30min](https://cal.com/alphaclonesystems/30min).

**Key highlights**:
* *Enterprise* readiness
* High performance

> "A great step forward"`;

  const plain = convertMarkdownToPlainText(markdown);

  assert.doesNotMatch(plain, /\[our client portal\]/);
  assert.doesNotMatch(plain, /\[https:\/\/cal\.com/);
  assert.match(plain, /our client portal \(https:\/\/alphaclonesystems\.com\/portal\)/);
  assert.match(plain, /https:\/\/cal\.com\/alphaclonesystems\/30min/);
  assert.match(plain, /Key highlights:/);
  assert.match(plain, /\* Enterprise readiness/);
  assert.match(plain, /"A great step forward"/);
});

test('attachments notice is inserted before compliance footer without disrupting layout', () => {
  const rendered = renderOutboundEmail({
    text: 'Please find the contract attached.',
    unsubscribeUrl: 'https://alphaclonesystems.com/api/unsubscribe?token=abc',
    includeFooter: true,
  });

  const withAttachment = insertBeforeEmailFooter(rendered.html, '<p>Attached: <strong>Agreement.pdf</strong></p>');

  assert.match(withAttachment, /Attached: <strong>Agreement\.pdf<\/strong>/);
  assert.match(withAttachment, /Privacy Policy/);
  assert.match(withAttachment, /Unsubscribe/);
  // Attachment notice should appear before Privacy Policy
  const attachIdx = withAttachment.indexOf('Agreement.pdf');
  const privacyIdx = withAttachment.indexOf('Privacy Policy');
  assert.ok(attachIdx < privacyIdx, 'Attachment must be positioned before compliance footer');
});
