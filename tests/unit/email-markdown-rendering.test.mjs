import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderOutboundEmail,
  convertMarkdownToEmailHtml,
  convertMarkdownToPlainText,
} from '../../src/lib/email/emailRendering.ts';

test('converts markdown links with matching text and url to clickable anchors', () => {
  const input = 'Schedule a session: [https://cal.com/alphaclonesystems/30min](https://cal.com/alphaclonesystems/30min)';
  const rendered = renderOutboundEmail({ text: input });

  assert.ok(rendered.html, 'HTML output should be present');
  assert.match(rendered.html, /<a\s+href="https:\/\/cal\.com\/alphaclonesystems\/30min"/);
  assert.match(rendered.html, />https:\/\/cal\.com\/alphaclonesystems\/30min<\/a>/);
  assert.match(rendered.html, /target="_blank"/);
  assert.match(rendered.html, /rel="noopener noreferrer"/);
});

test('converts markdown links with custom anchor text to clickable anchors', () => {
  const input = 'Feel free to [book a 30-min call](https://cal.com/alphaclonesystems/30min) with us.';
  const rendered = renderOutboundEmail({ text: input });

  assert.match(rendered.html, /<a\s+href="https:\/\/cal\.com\/alphaclonesystems\/30min"/);
  assert.match(rendered.html, />book a 30-min call<\/a>/);
});

test('converts bare URLs into clickable links without double-encoding query parameters', () => {
  const input = 'Check our availability at https://cal.com/alphaclonesystems/30min?utm_source=email&team=alpha';
  const rendered = renderOutboundEmail({ text: input });

  assert.match(rendered.html, /<a\s+href="https:\/\/cal\.com\/alphaclonesystems\/30min\?utm_source=email&amp;team=alpha"/);
  assert.doesNotMatch(rendered.html, /&amp;amp;/);
});

test('renders bold, italic, headings, lists, blockquotes and code blocks', () => {
  const input = `### Welcome to AlphaClone

Here is what **we offer**:
* *Enterprise* intelligence
* Autonomous communication

> "Building the future of business operations"

Check the code snippet:
\`\`\`js
console.log("Ready");
\`\`\``;

  const rendered = renderOutboundEmail({ text: input });

  assert.match(rendered.html, /<h3[^>]*>Welcome to AlphaClone<\/h3>/);
  assert.match(rendered.html, /<strong[^>]*>we offer<\/strong>/);
  assert.match(rendered.html, /<em>Enterprise<\/em>/);
  assert.match(rendered.html, /<ul[^>]*>/);
  assert.match(rendered.html, /<li[^>]*>/);
  assert.match(rendered.html, /<blockquote[^>]*>/);
  assert.match(rendered.html, /<pre[^>]*><code[^>]*>/);
});

test('preserves signatures and clean line breaks', () => {
  const input = `Hi Treasure,

Thanks for reaching out to AlphaClone Systems.

Best regards,
Bonnie Masilo
AlphaClone Systems, LLC
alphaclonesystems.com`;

  const rendered = renderOutboundEmail({ text: input });

  assert.match(rendered.html, /Hi Treasure,/);
  assert.match(rendered.html, /Best regards,<br\s*\/?>\s*Bonnie Masilo/);
});

test('sanitizes malicious scripts and dangerous event handlers in HTML input', () => {
  const htmlInput = `Malicious text <script>alert("xss")</script><img src="x" onerror="alert(1)" />`;
  const renderedHtml = renderOutboundEmail({ html: htmlInput });

  assert.doesNotMatch(renderedHtml.html, /<script/i);
  assert.doesNotMatch(renderedHtml.html, /onerror/i);
  assert.doesNotMatch(renderedHtml.html, /alert\(/i);
});

test('escapes raw HTML tags when input is plain text or markdown', () => {
  const textInput = `Malicious text <script>alert("xss")</script><img src="x" onerror="alert(1)" />`;
  const renderedText = renderOutboundEmail({ text: textInput });

  assert.match(renderedText.html, /&lt;script&gt;/);
  assert.doesNotMatch(renderedText.html, /<script/i);
});

test('generates clean plain text fallback without raw markdown brackets', () => {
  const input = `Schedule a call: [https://cal.com/alphaclonesystems/30min](https://cal.com/alphaclonesystems/30min) or [our website](https://alphaclonesystems.com).`;
  const plain = convertMarkdownToPlainText(input);

  assert.equal(plain, 'Schedule a call: https://cal.com/alphaclonesystems/30min or our website (https://alphaclonesystems.com).');
});

test('handles empty or missing inputs safely', () => {
  const renderedEmpty = renderOutboundEmail({});
  assert.equal(renderedEmpty.html, '');
  assert.equal(renderedEmpty.text, '');

  const renderedBlank = renderOutboundEmail({ text: '   ' });
  assert.equal(renderedBlank.html, '');
  assert.equal(renderedBlank.text, '');
});

test('prevents nested anchors when markdown link text contains a full url', () => {
  const input = 'Booking: [https://cal.com/alphaclonesystems/30min](https://cal.com/alphaclonesystems/30min)';
  const rendered = renderOutboundEmail({ text: input });

  assert.match(rendered.html, /<a\s+href="https:\/\/cal\.com\/alphaclonesystems\/30min"/);
  assert.doesNotMatch(rendered.html, /<a[^>]*>\s*<a/);
  assert.doesNotMatch(rendered.html, /<\/a>\s*<\/a>/);
});

test('appends compliant footer with privacy and unsubscribe links when requested or unsubscribeUrl is present', () => {
  const input = 'Hello Bonnie,\n\nThis is a test message.';
  const unsubUrl = 'https://alphaclonesystems.com/api/unsubscribe?token=test_token_123';
  const rendered = renderOutboundEmail({
    text: input,
    unsubscribeUrl: unsubUrl,
    includeFooter: true,
  });

  assert.ok(rendered.html.includes('Privacy Policy'), 'HTML should contain Privacy Policy link');
  assert.ok(rendered.html.includes('https://alphaclonesystems.com/privacy-policy'), 'HTML should contain privacy policy URL');
  assert.ok(rendered.html.includes('Unsubscribe'), 'HTML should contain Unsubscribe link');
  assert.ok(rendered.html.includes(unsubUrl), 'HTML should contain specific unsubscribe URL');
  assert.ok(rendered.html.includes('Terms'), 'HTML should contain Terms link');
  assert.ok(rendered.html.includes('Alphaclone Systems, LLC'), 'HTML should contain legal company name');
  assert.ok(rendered.html.includes('30 N Gould St, Sheridan, WY 82801, USA'), 'HTML should contain physical address');

  assert.ok(rendered.text.includes('Privacy Policy: https://alphaclonesystems.com/privacy-policy'), 'Text should contain Privacy Policy link');
  assert.ok(rendered.text.includes(`Unsubscribe: ${unsubUrl}`), 'Text should contain Unsubscribe URL');
  assert.ok(rendered.text.includes('30 N Gould St, Sheridan, WY 82801, USA'), 'Text should contain physical address');
});

test('appends compliant footer even when body text mentions Privacy Policy and Unsubscribe', () => {
  const input = `Hello Bonnie,

Here is our review:
* Compliant footer containing Privacy Policy and Unsubscribe links
* Recipient display in Unified Inbox & Sent views

Best regards,
Bonnie Masilo`;

  const unsubUrl = 'https://alphaclonesystems.com/api/unsubscribe?token=my_secret_token';
  const rendered = renderOutboundEmail({
    text: input,
    unsubscribeUrl: unsubUrl,
    includeFooter: true,
  });

  assert.ok(rendered.html.includes('Privacy Policy'), 'HTML should contain Privacy Policy link');
  assert.ok(rendered.html.includes(unsubUrl), 'HTML should contain unsubscribe URL');
  assert.ok(rendered.html.includes('<ul'), 'HTML should contain unordered list');
  assert.ok(rendered.html.includes('<li'), 'HTML should contain list items');
  assert.ok(rendered.html.includes('>Hello Bonnie,</p>'), 'HTML should have separate Hello paragraph');
});

test('sanitizeBonnieOutboundText preserves newlines and paragraph structure', async () => {
  const { sanitizeBonnieOutboundText } = await import('../../src/lib/bonnie/bonnieBannedLanguage.ts');
  const input = `Hello Bonnie,

This is a multi-paragraph email.

* Bullet 1
* Bullet 2

Best regards,
Bonnie Masilo`;

  const { clean } = sanitizeBonnieOutboundText(input);
  assert.ok(clean.includes('\n\n'), 'Double newlines must be preserved for paragraph rendering');
  assert.ok(clean.includes('* Bullet 1\n* Bullet 2'), 'Bullet lines must not be collapsed onto a single line');
  assert.ok(clean.includes('Best regards,\nBonnie Masilo'), 'Sign-off line break must be preserved');
});

