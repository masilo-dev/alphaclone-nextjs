import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import test from 'node:test';

const root = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');

test('alphaclone-theme exposes Untitled-style semantic tokens with teal brand', () => {
  const theme = read('src/styles/alphaclone-theme.css');
  assert.match(theme, /--color-brand-500:\s*#4199a4/i);
  assert.match(theme, /--color-text-primary/);
  assert.match(theme, /--color-bg-primary/);
  assert.match(theme, /--color-border-primary/);
  assert.match(theme, /--color-fg-brand-primary/);
  assert.match(theme, /--ac-accent:\s*var\(--brand-blue-500\)/);
  assert.match(theme, /--ac-bonnie:\s*var\(--brand-blue-500\)/);
  assert.doesNotMatch(theme, /#8950[Ff]5|#356[Aa][Ff]4|#00f0ff|#7f00ff/);
});

test('globals brand aliases converge to teal / navy intelligence', () => {
  const css = read('src/app/globals.css');
  assert.match(css, /--brand-blue-500:\s*#4199A4/);
  assert.match(css, /--brand-violet-500:\s*#3D4F73/);
  assert.match(css, /--ac-accent:\s*#4199A4/);
  assert.match(css, /--ac-bonnie:\s*#4199A4/);
  assert.doesNotMatch(css, /--dashboard-electric:\s*#00f0ff/);
  assert.doesNotMatch(css, /--marketing-accent:\s*#8950f5/);
});

test('layout loads finishing theme after globals', () => {
  const layout = read('src/app/layout.tsx');
  const globalsIdx = layout.indexOf('globals.css');
  const themeIdx = layout.indexOf('alphaclone-theme.css');
  assert.ok(globalsIdx >= 0 && themeIdx > globalsIdx);
});

test('brand.ts MODULE_IDENTITY no longer uses purple accents', () => {
  const brand = read('src/constants/brand.ts');
  assert.match(brand, /BRAND_INTELLIGENCE/);
  assert.doesNotMatch(brand, /supporting: '#8950F5'/);
  assert.doesNotMatch(brand, /primary: '#8950F5'/);
  assert.doesNotMatch(brand, /primary: '#6D4AFF'/);
  assert.doesNotMatch(brand, /primary: '#7D56D9'/);
});
