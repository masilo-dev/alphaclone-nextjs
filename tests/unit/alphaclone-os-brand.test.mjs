import test from 'node:test';
import assert from 'node:assert/strict';

// brand.ts is TypeScript — exercise via tsx loader (package test script uses tsx)
const brand = await import('../../src/constants/brand.ts');

test('Alphaclone Systems uses the approved navy, teal, and coral anchors', () => {
  assert.equal(brand.BRAND.navy, '#212446');
  assert.equal(brand.BRAND.teal, '#4199A4');
  assert.equal(brand.BRAND.coral, '#FB7268');
  assert.equal(brand.BRAND_BLUE[500], brand.BRAND.teal);
});

test('Bonnie uses restrained teal identity', () => {
  assert.equal(brand.MODULE_IDENTITY.bonnie.primary, brand.BRAND.teal);
  assert.equal(brand.MODULE_IDENTITY.bonnie.supporting, brand.BRAND.navy);
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
  assert.equal(brand.DARK_NEUTRALS.appBackground, '#0D0F18');
  assert.equal(brand.DARK_NEUTRALS.sidebarBackground, '#15182A');
});

test('light sidebar stays deep navy', () => {
  assert.equal(brand.LIGHT_NEUTRALS.sidebarBackground, '#212446');
  assert.equal(brand.LIGHT_NEUTRALS.appBackground, '#F6F7F9');
});
