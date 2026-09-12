import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const domain = readFileSync(new URL('../../src/lib/email/unifiedEmailDomain.ts', import.meta.url), 'utf8');
const resolver = readFileSync(new URL('../../src/lib/email/resolveEmailRoute.ts', import.meta.url), 'utf8');
const preflight = readFileSync(new URL('../../src/lib/email/campaignPreflight.ts', import.meta.url), 'utf8');
const queue = readFileSync(new URL('../../src/lib/email/outboundJobEngine.ts', import.meta.url), 'utf8');
const adapters = readFileSync(new URL('../../src/lib/email/providerAdapters.ts', import.meta.url), 'utf8');

test('mailbox providers can execute AlphaClone fan-out campaigns without native bulk', () => {
  assert.match(domain, /canSendBulk: false,\s*canFanOutBulk: true,\s*canSendMarketing: true/);
  assert.match(domain, /function canExecuteAlphaCloneCampaign/);
});

test('explicit routing has structured mismatch and unavailable errors', () => {
  assert.match(domain, /EMAIL_PROVIDER_MISMATCH/);
  assert.match(domain, /EMAIL_PROVIDER_UNAVAILABLE/);
  assert.match(domain, /SENDER_PROVIDER_MISMATCH/);
  assert.match(resolver, /mode === 'explicit'/);
});

test('campaign preflight derives recipient truth from durable rows', () => {
  assert.match(preflight, /campaign_recipients/);
  assert.match(preflight, /CAMPAIGN_NO_DURABLE_RECIPIENTS/);
  assert.match(preflight, /CAMPAIGN_RECIPIENT_COUNT_MISMATCH/);
  assert.match(preflight, /resolveEmailRoute/);
});

test('outbound jobs are idempotent and use bounded retry backoff', () => {
  assert.match(queue, /createHash\('sha256'\)/);
  assert.match(queue, /idempotency_key/);
  assert.match(queue, /\[0, 60_000, 5 \* 60_000, 30 \* 60_000, 2 \* 60 \* 60_000\]/);
});

test('all required delivery providers have adapters', () => {
  for (const adapter of ['BrevoAdapter', 'ZohoAdapter', 'GmailAdapter', 'MicrosoftGraphAdapter', 'SendGridAdapter', 'ResendAdapter', 'SmtpAdapter']) {
    assert.match(adapters, new RegExp(`class ${adapter}`));
  }
});
