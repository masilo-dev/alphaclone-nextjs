import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import test from 'node:test';

const root = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');

test('login uses Untitled auth canvas, not electric-blue network bg', () => {
  const page = read('src/app/auth/login/page.tsx');
  assert.match(page, /ac-auth-canvas/);
  assert.match(page, /ac-auth-card/);
  assert.doesNotMatch(page, /page-network-bg/);
  assert.doesNotMatch(page, /#356AF4|#041027|bg-blue-600/);
});

test('auth theme tokens reject electric blue page-network default', () => {
  const mkt = read('src/styles/marketing-system.css');
  assert.doesNotMatch(mkt, /\.page-network-bg \{\s*background:\s*#041027/);
  const theme = read('src/styles/alphaclone-theme.css');
  assert.match(theme, /\.ac-auth-canvas/);
  assert.match(theme, /brand-teal/);
  assert.doesNotMatch(theme, /rgba\(53,\s*106,\s*244/);
});
