import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('email hub header uses mailbox sections instead of unrelated channel navigation', () => {
  const source = read('src/components/dashboard/hubs/ChannelsHub.tsx');

  for (const label of ['Inbox', 'Sent', 'Drafts', 'Outreach', 'Needs reply', 'Channels']) {
    assert.match(source, new RegExp(label));
  }

  assert.match(source, /\/dashboard\/comms\?tab=sent/);
  assert.match(source, /\/dashboard\/comms\?tab=drafts/);
  assert.match(source, /\/dashboard\/comms\?tab=outreaches/);
  assert.match(source, /aliases: \['\/dashboard\/mail/);
  assert.doesNotMatch(source, /Tickets/);
  assert.doesNotMatch(source, /Team chat/);
  assert.doesNotMatch(source, /WhatsApp/);
});

test('hub shell supports query-aware active tab matching and aliases', () => {
  const source = read('src/components/dashboard/hubs/HubShell.tsx');

  assert.match(source, /useSearchParams/);
  assert.match(source, /currentHref/);
  assert.match(source, /aliases\?: string\[\]/);
  assert.match(source, /activeHrefs/);
});

test('business dashboard lets the email hub own top navigation', () => {
  const dashboard = read('src/components/dashboard/business/BusinessDashboard.tsx');
  const communicationHub = read('src/components/dashboard/communication/CommunicationHub.tsx');

  assert.match(dashboard, /<CommunicationHub user=\{user\} showLocalTabs=\{false\}/);
  assert.match(communicationHub, /showLocalTabs = true/);
  assert.match(communicationHub, /searchParams\?\.get\('tab'\)/);
  assert.match(communicationHub, /href=\{tab\.id === 'inbox'/);
});
