import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('provider success requires canonical outbound persistence', async () => {
  const sendEmail = await read('src/lib/email/sendEmail.ts');
  const persistence = await read('src/lib/email/persistCanonicalEmail.ts');

  assert.match(sendEmail, /persistCanonicalOutboundEmail\(/);
  assert.match(sendEmail, /LOCAL_EMAIL_PERSISTENCE_FAILED/);
  assert.match(sendEmail, /canonicalMessageId/);
  assert.match(persistence, /\.from\('email_threads'\)/);
  assert.match(persistence, /\.from\('email_messages'\)/);
  assert.match(persistence, /\.from\('email_message_recipients'\)/);
  assert.match(persistence, /event_type: 'email_sent'/);
  assert.match(persistence, /provider_message_id: params\.providerMessageId/);
});

test('lead-backed email pickers use the canonical lead columns', async () => {
  const compose = await read('src/components/dashboard/business/ComposeEmailModal.tsx');
  const outreach = await read('src/components/dashboard/communication/EmailOutreachComposer.tsx');
  const emailOps = await read('src/lib/mcp/tools/email-ops.ts');

  for (const source of [compose, outreach, emailOps]) {
    assert.doesNotMatch(source, /from\('leads'\)[\s\S]{0,100}select\('id, name, email/);
    assert.match(source, /business_name/);
  }
});

test('related deal lookup never embeds SQL in a PostgREST filter', async () => {
  const leads = await read('src/services/leadService.ts');
  assert.doesNotMatch(leads, /contact_id\.in\.\(SELECT/i);
  assert.match(leads, /\.select\('client_id'\)/);
});
