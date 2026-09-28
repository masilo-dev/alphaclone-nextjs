import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('connecting a Facebook Page asks only for publishing permissions by default', () => {
  const route = read('src/app/api/auth/facebook/connect/route.ts');
  const page = read('src/components/dashboard/facebook/FacebookIntegrationTab.tsx');
  assert.match(route, /get\('scope_mode'\) === 'advanced' \? 'advanced' : 'publishing'/);
  const publishing = route.match(/const publishingScopes = \[([\s\S]*?)\];/)?.[1];
  assert.ok(publishing);
  for (const scope of ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts']) {
    assert.match(publishing, new RegExp(`'${scope}'`));
  }
  for (const scope of ['pages_messaging', 'ads_management', 'leads_retrieval', 'instagram_content_publish', 'read_insights']) {
    assert.doesNotMatch(publishing, new RegExp(`'${scope}'`));
  }
  assert.match(page, /\/api\/auth\/facebook\/connect\?/);
  assert.doesNotMatch(page, /scope_mode=advanced/);
});

test('lead retrieval and WhatsApp intentionally request additional capabilities', () => {
  assert.match(read('src/services/integrationService.ts'), /facebook-leads[\s\S]*?scope_mode=advanced/);
  assert.match(read('src/components/dashboard/business/WhatsAppIntegration.tsx'), /scope_mode=advanced/);
});
