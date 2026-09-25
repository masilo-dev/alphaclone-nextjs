import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.resolve(here, rel), 'utf8');

const layout = read('../../src/app/layout.tsx');
const globalsCss = read('../../src/app/globals.css');
const tour = read('../../src/components/onboarding/ProductTour.tsx');
const welcomeBanner = read('../../src/components/dashboard/PlatformExecutionWelcome.tsx');
const onboardingGate = read('../../src/lib/onboarding/resolveOnboardingGate.ts');
const themeToggle = read('../../src/components/ThemeToggle.tsx');
const applyAcTheme = read('../../src/lib/applyAcTheme.ts');

describe('Light Mode / Dark Mode Systems & Tour Branding Integrity', () => {
  it('anti-flash script in layout.tsx synchronously handles both light and dark mode preferences', () => {
    assert.match(layout, /id="ac-anti-flash-init"/);
    assert.match(layout, /document\.documentElement\.classList\.add\('dark'\)/);
    assert.match(layout, /document\.documentElement\.classList\.add\('light'\)/);
    assert.match(layout, /document\.documentElement\.style\.colorScheme\s*=\s*'dark'/);
    assert.match(layout, /document\.documentElement\.style\.colorScheme\s*=\s*'light'/);
    assert.match(layout, /document\.documentElement\.style\.backgroundColor\s*=\s*'#020D1A'/);
    assert.match(layout, /document\.documentElement\.style\.backgroundColor\s*=\s*'#F6F7F9'/);
    assert.doesNotMatch(layout, /backgroundColor = '#020D1A';\s*\}\s*catch/, 'must not blindly force dark background regardless of theme');
  });

  it('globals.css defines explicit html.light and html.dark color-scheme and backgrounds', () => {
    assert.match(globalsCss, /html\.light\s*\{[^}]*--background:\s*#F6F7F9/);
    assert.match(globalsCss, /html\.light\s*\{[^}]*color-scheme:\s*light/);
    assert.match(globalsCss, /html\.dark\s*\{[^}]*--background:\s*#020D1A/);
    assert.match(globalsCss, /html\.dark\s*\{[^}]*color-scheme:\s*dark/);
  });

  it('applyAcThemeClass updates root backgroundColor synchronously on dynamic toggle', () => {
    assert.match(applyAcTheme, /root\.style\.backgroundColor = isDark \? '#020D1A' : '#F6F7F9'/);
  });

  it('ProductTour uses AlphaClone brand teal and contains zero royal blue hardcoded hexes', () => {
    // Primary color must be Brand Teal (#4199A4)
    assert.match(tour, /primaryColor:\s*'#4199A4'/);
    assert.match(tour, /backgroundColor:\s*'#4199A4'/);
    // Must NOT contain royal blue #356AF4 anywhere
    assert.doesNotMatch(tour, /#356AF4/i);
    // Must support both light and dark tooltip styles
    assert.match(tour, /isDark \? '#0D1526' : '#FFFFFF'/);
    assert.match(tour, /isDark \? '#F1F5F9' : '#0F172A'/);
    assert.match(tour, /data-product-tour-active/);
  });

  it('ProductTour targets stable dashboard landmarks rather than transient welcome banners', () => {
    // Step 1 should target stable navigation or dashboard landmarks, not the temporary welcome card
    assert.doesNotMatch(tour, /target:\s*'\[data-tour="platform-welcome"\]'/);
    assert.match(tour, /\[data-tour="os-home"\]/);
  });

  it('PlatformExecutionWelcome prevents dual-tour conflicts by yielding when tour is active', () => {
    assert.match(welcomeBanner, /document\.documentElement\.getAttribute\('data-product-tour-active'\) === 'true'/);
    assert.match(welcomeBanner, /alphaclone:walkthrough-state-changed/);
    assert.match(welcomeBanner, /dismiss\(\);\s*requestPlatformTour\(\);/, 'clicking tour button in banner must dismiss banner');
    assert.doesNotMatch(welcomeBanner, /#356AF4/i, 'banner must use brand tokens instead of hardcoded blue');
  });

  it('resolveOnboardingGate suppresses welcome banner if walkthrough is completed or dismissed', () => {
    assert.match(onboardingGate, /tourRecord\.state === 'completed' \|\| tourRecord\.state === 'dismissed'/);
  });

  it('ThemeToggle uses semantic design tokens and brand teal instead of dark slate blocks', () => {
    assert.match(themeToggle, /bg-\[var\(--surface-secondary\)\]/);
    assert.match(themeToggle, /border-\[var\(--border-default\)\]/);
    assert.doesNotMatch(themeToggle, /bg-slate-800/);
    assert.doesNotMatch(themeToggle, /text-blue-400/);
  });
});
