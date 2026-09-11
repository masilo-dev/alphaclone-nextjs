import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('the marketing shell mounts one shared atmosphere', () => {
  const shell = read('src/components/marketing/system/MarketingShell.tsx');
  const background = read('src/components/marketing/system/atmosphere/MarketingBackground.tsx');
  assert.match(shell, /<MarketingBackground \/>/);
  assert.match(background, /<MarketingAtmosphere \/>/);
});

test('atmosphere is decorative and performance tiered', () => {
  const source = read('src/components/marketing/system/atmosphere/MarketingAtmosphere.tsx');
  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /data-performance=\{tier\}/);
  assert.match(source, /usePointerIntent/);
});

test('motion has a static reduced-motion fallback', () => {
  const css = read('src/styles/marketing-system.css');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\[data-performance="static"\]/);
  assert.match(css, /animation: none !important/);
});

test('navigation and footer targets map to real public routes', () => {
  const combined =
    read('src/components/marketing/system/MarketingHeader.tsx') +
    read('src/components/marketing/system/MarketingFooter.tsx');
  const internalPaths = [...combined.matchAll(/(?:path:|href=)"?(\/[a-z0-9#/-]*)/gi)].map(
    (match) => match[1].split('#')[0],
  );
  for (const path of internalPaths) {
    if (!path || path === '/') continue;
    const pageUrl = new URL(`../../src/app${path}/page.tsx`, import.meta.url);
    assert.ok(existsSync(fileURLToPath(pageUrl)), `Expected a real page for ${path}`);
  }
});

test('route transitions do not delay navigation and honor reduced motion', () => {
  const source = read('src/components/PageTransition.tsx');
  assert.match(source, /mode="sync"/);
  assert.match(source, /useReducedMotion/);
  assert.doesNotMatch(source, /mode="wait"/);
});

test('the unknown-route page keeps users inside the shared marketing experience', () => {
  const source = read('src/app/not-found.tsx');
  assert.match(source, /<MarketingShell>/);
  assert.match(source, /href="\/crm"/);
  assert.match(source, /href="\/contact"/);
});
