import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import test from 'node:test';

const root = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');

test('root layout does not import dashboard-only CSS globally', () => {
  const layout = read('src/app/layout.tsx');
  assert.doesNotMatch(layout, /alphaclone-os-v3\.css/);
  assert.doesNotMatch(layout, /crisp-product-ui\.css/);
  assert.doesNotMatch(layout, /fonts\.googleapis\.com/);
  assert.match(layout, /ProviderSwitcher/);
  assert.match(layout, /marketingFonts/);
});

test('dashboard layout loads workspace OS styles', () => {
  const layout = read('src/app/dashboard/layout.tsx');
  assert.match(layout, /alphaclone-os-v3\.css/);
});

test('marketing home does not preload the decorative backdrop twice', () => {
  const page = read('src/app/page.tsx');
  assert.doesNotMatch(page, /preload\(/);
  const home = read('src/components/marketing/system/MarketingHomePage.tsx');
  assert.match(home, /fetchPriority="low"/);
  assert.match(home, /src="\/screenshots\/deals-dashboard\.png"[\s\S]*?priority/);
});

test('public marketing routes use lightweight providers', () => {
  const mod = read('src/components/ProviderSwitcher.tsx');
  assert.match(mod, /MarketingProviders/);
  assert.match(mod, /isPublicMarketingRoute/);
});
