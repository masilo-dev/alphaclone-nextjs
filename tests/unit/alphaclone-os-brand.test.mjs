import test from 'node:test';
import assert from 'node:assert/strict';

// brand.ts is TypeScript — exercise via tsx loader (package test script uses tsx)
const brand = await import('../../src/constants/brand.ts');

test('brand blue primary is Alphaclone OS blue', () => {
  assert.equal(brand.BRAND_BLUE[500], '#356AF4');
});

test('Bonnie uses violet identity', () => {
  assert.equal(brand.MODULE_IDENTITY.bonnie.primary, '#8950F5');
  assert.equal(brand.BRAND_VIOLET[500], '#8950F5');
});

test('every module identity has primary and supporting colours', () => {
  for (const [id, identity] of Object.entries(brand.MODULE_IDENTITY)) {
    assert.match(identity.primary, /^#[0-9A-Fa-f]{6}$/, id);
    assert.match(identity.supporting, /^#[0-9A-Fa-f]{6}$/, id);
    assert.ok(identity.label.length > 0, id);
  }
});

test('dark neutrals are navy/graphite not pure black', () => {
  assert.notEqual(brand.DARK_NEUTRALS.appBackground, '#000000');
  assert.equal(brand.DARK_NEUTRALS.appBackground, '#0C1220');
  assert.equal(brand.DARK_NEUTRALS.sidebarBackground, '#090F1C');
});

test('light sidebar stays deep navy', () => {
  assert.equal(brand.LIGHT_NEUTRALS.sidebarBackground, '#10182D');
  assert.equal(brand.LIGHT_NEUTRALS.appBackground, '#F5F7FB');
});
