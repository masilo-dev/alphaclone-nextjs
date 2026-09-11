import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('only the authenticated workflow Edge Function remains deployable', () => {
  const config = read('supabase/config.toml');
  const workflow = read('supabase/functions/workflow-engine/index.ts');

  assert.match(config, /\[functions\.workflow-engine\][\s\S]*verify_jwt = true/);
  assert.match(workflow, /isServiceRoleRequest/);
  assert.match(workflow, /\.eq\('status', 'pending'\)/);
  assert.match(workflow, /\.eq\('tenant_id', claimed\.tenant_id\)/);
  assert.match(workflow, /Unsupported workflow actions/);

  const retiredMicrosoft = read('supabase/functions/microsoft-oauth-exchange/index.ts');
  assert.match(retiredMicrosoft, /status: 410/);
  assert.doesNotMatch(retiredMicrosoft, /access_token|refresh_token|client_secret/);

  for (const obsolete of ['get-acs-token', 'get-teams-token', 'microsoft-token-refresh']) {
    assert.equal(fs.existsSync(new URL(`../../supabase/functions/${obsolete}/index.ts`, import.meta.url)), false);
  }
});

test('Teams UI never exposes a Graph application token in a meeting URL', () => {
  const component = read('src/components/dashboard/video/MicrosoftMeetingEmbed.tsx');
  assert.doesNotMatch(component, /get-teams-token|functions\/v1|\?token=/);
  assert.match(component, /src=\{meetingLink\}/);
});

test('production validation checks configured OAuth credential pairs', () => {
  const validator = read('scripts/production-env.mjs');
  for (const provider of ['Microsoft OAuth', 'Zoho OAuth', 'Google OAuth', 'LinkedIn OAuth', 'HubSpot OAuth', 'Slack OAuth', 'Zoom OAuth']) {
    assert.match(validator, new RegExp(provider));
  }
});
