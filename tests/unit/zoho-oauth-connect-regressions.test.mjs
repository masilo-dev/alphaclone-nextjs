import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function source(path) {
  return fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

test('Zoho OAuth sends comma-separated scopes', () => {
  const connect = source('src/app/api/auth/zoho/connect/route.ts');

  assert.match(connect, /scopes\.join\(','\)/);
  assert.doesNotMatch(connect, /scopes\.join\(' '\)/);
});

test('Zoho connect actions preserve active workspace context', () => {
  const inbox = source('src/components/dashboard/business/UnifiedInboxView.tsx');
  const campaigns = source('src/components/dashboard/zoho/ZohoCampaignsHub.tsx');

  for (const component of [inbox, campaigns]) {
    assert.match(component, /Select a workspace before connecting Zoho\./);
    assert.match(component, /auth\/zoho\/connect\?tenantId=/);
  }

  assert.doesNotMatch(campaigns, /auth\/zoho\/connect\?region=EU/);
});
