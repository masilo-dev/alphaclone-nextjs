import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const layout = readFileSync(new URL('../../src/app/layout.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../src/styles/alphaclone-os-v3.css', import.meta.url), 'utf8');
const brand = readFileSync(new URL('../../src/constants/brand.ts', import.meta.url), 'utf8');

test('OS v3 is loaded globally from the root layout', () => {
  assert.match(layout, /@\/styles\/alphaclone-os-v3\.css/);
});

test('OS v3 preserves AlphaClone brand anchors instead of introducing an Apple palette', () => {
  assert.match(brand, /#356AF4/);
  assert.match(brand, /#8950F5/);
  assert.doesNotMatch(css, /apple-blue|sf-pro-only|macos-window/i);
});

test('OS v3 has semantic material levels and selective glass', () => {
  for (const token of ['ac-v3-content', 'ac-v3-elevated', 'ac-v3-floating', 'ac-v3-intelligence']) {
    assert.match(css, new RegExp(token));
  }
  assert.match(css, /backdrop-filter/);
});

test('OS v3 respects reduced motion and visible keyboard focus', () => {
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /focus-visible/);
});
