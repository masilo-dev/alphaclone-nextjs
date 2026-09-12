/**
 * Social UI route separation regression coverage.
 * Facebook, LinkedIn, Instagram and X must remain distinct dashboard surfaces.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('BusinessDashboard renders Facebook and LinkedIn with different components', () => {
  const src = read('../../src/components/dashboard/business/BusinessDashboard.tsx');

  assert.match(
    src,
    /case '\/dashboard\/business\/facebook':[\s\S]*?<FacebookIntegrationTab[\s\S]*?case '\/dashboard\/business\/linkedin':[\s\S]*?<LinkedInManagementTab/
  );
});

test('Marketing Hub exposes explicit provider routes instead of one sticky social destination', () => {
  const src = read('../../src/components/dashboard/hubs/MarketingHub.tsx');

  assert.match(src, /label: 'Facebook', href: '\/dashboard\/business\/facebook'/);
  assert.match(src, /label: 'LinkedIn', href: '\/dashboard\/business\/linkedin'/);
  assert.match(src, /label: 'Instagram', href: '\/dashboard\/business\/instagram'/);
  assert.match(src, /label: 'X', href: '\/dashboard\/business\/x'/);
});

test('hub route registry keeps Facebook and LinkedIn independently addressable', () => {
  const src = read('../../src/lib/dashboard/hubRoutes.tsx');

  assert.match(src, /'\/dashboard\/business\/facebook'/);
  assert.match(src, /'\/dashboard\/business\/linkedin'/);
});

test('tenant dashboard route comes from pathname, not persisted provider state', () => {
  const src = read('../../src/app/dashboard/[[...slug]]/DashboardClientPage.tsx');

  assert.match(src, /const location = usePathname\(\)/);
  assert.match(src, /normalizeBusinessRoute\(location \|\| '\/dashboard', user\.role\)/);
});
