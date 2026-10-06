import test from 'node:test';
import assert from 'node:assert/strict';
import { isFirstRunEligible } from '../../src/lib/onboarding/firstRunPolicy.ts';
const now = Date.parse('2026-10-06T08:00:00Z');
const fresh = { createdAt: '2026-10-06T07:00:00Z', profileComplete: false,
  onboardingComplete: false, guidanceSeen: false, workspaceVerifiedEmpty: true, now };
test('only a verified fresh, empty, unguided account receives first-run guidance', () => {
  assert.equal(isFirstRunEligible(fresh), true);
  for (const changes of [
    { createdAt: '2026-09-01T07:00:00Z' }, { createdAt: null },
    { createdAt: '2026-10-07T07:00:00Z' }, { profileComplete: null },
    { profileComplete: true }, { onboardingComplete: true },
    { guidanceSeen: true }, { workspaceVerifiedEmpty: false },
  ]) assert.equal(isFirstRunEligible({ ...fresh, ...changes }), false, JSON.stringify(changes));
});

test('readable authentication neutral text meets AA on its actual light surfaces', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../../src/styles/product-system.css', import.meta.url), 'utf8');
  const luminance = hex => {
    const rgb = hex.replace('#', '').match(/../g).map(value => parseInt(value, 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
  for (const name of ['text-primary', 'text-secondary', 'text-muted']) {
    const color = css.match(new RegExp(`--${name}: (#[0-9a-f]{6});`))[1];
    for (const surface of ['#ffffff', '#f6f7f9']) assert.ok(ratio(color, surface) >= 4.5, `${name} on ${surface}`);
  }
});
