#!/usr/bin/env node
/**
 * Guard: Charcoal Dark Design System & Ultra-Compact Density System.
 * Ensures the application permanently adheres to the charcoal color palette
 * and compact density requirements, preventing regression to legacy blue backgrounds
 * or oversized elements.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const failures = [];

function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    failures.push(`Missing expected file: ${rel}`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
}

// 1. Verify brand.ts charcoal tokens
const brandSrc = read('src/constants/brand.ts');
const requiredBrandTokens = [
  ["appBackground: '#111113'", "DARK_NEUTRALS.appBackground must be '#111113'"],
  ["sidebarBackground: '#151517'", "DARK_NEUTRALS.sidebarBackground must be '#151517'"],
  ["surfacePrimary: '#19191C'", "DARK_NEUTRALS.surfacePrimary must be '#19191C'"],
  ["surfaceSecondary: '#202024'", "DARK_NEUTRALS.surfaceSecondary must be '#202024'"],
  ["surfaceTertiary: '#29292E'", "DARK_NEUTRALS.surfaceTertiary must be '#29292E'"],
  ["borderSubtle: '#2C2C31'", "DARK_NEUTRALS.borderSubtle must be '#2C2C31'"],
  ["borderStrong: '#3A3A40'", "DARK_NEUTRALS.borderStrong must be '#3A3A40'"],
  ["textPrimary: '#F2F2F3'", "DARK_NEUTRALS.textPrimary must be '#F2F2F3'"],
  ["textSecondary: '#B0B0B8'", "DARK_NEUTRALS.textSecondary must be '#B0B0B8'"],
  ["textMuted: '#85858F'", "DARK_NEUTRALS.textMuted must be '#85858F'"],
  ["accent: '#4D8DFF'", "DARK_NEUTRALS.accent must be '#4D8DFF'"],
  ["success: '#36B98A'", "DARK_NEUTRALS.success must be '#36B98A'"],
  ["warning: '#E5AC55'", "DARK_NEUTRALS.warning must be '#E5AC55'"],
  ["danger: '#E36B72'", "DARK_NEUTRALS.danger must be '#E36B72'"],
];

for (const [token, msg] of requiredBrandTokens) {
  if (!brandSrc.includes(token)) {
    failures.push(`src/constants/brand.ts: ${msg}`);
  }
}

// 2. Verify globals.css charcoal tokens & anti-gradients
const globalsSrc = read('src/app/globals.css');
const requiredGlobalsTokens = [
  '--app-bg: #111113;',
  '--sidebar-bg: #151517;',
  '--header-bg: #151517;',
  '--surface-1: #19191C;',
  '--surface-2: #202024;',
  '--surface-3: #29292E;',
  '--border-subtle: #2C2C31;',
  '--border-strong: #3A3A40;',
  '--text-primary: #F2F2F3;',
  '--text-secondary: #B0B0B8;',
  '--text-muted: #85858F;',
  '--accent: #4D8DFF;',
  '--success: #36B98A;',
  '--warning: #E5AC55;',
  '--danger: #E36B72;',
];

for (const token of requiredGlobalsTokens) {
  if (!globalsSrc.includes(token)) {
    failures.push(`src/app/globals.css: missing required charcoal token '${token}'`);
  }
}

// Prohibit legacy blue backgrounds in dark theme definitions
if (/--background-app:\s*#(?:0D0F18|0d0f18)/.test(globalsSrc)) {
  failures.push('src/app/globals.css: --background-app must not be legacy blue #0D0F18');
}
if (/--ws-sidebar:\s*#(?:15182A|15182a)/.test(globalsSrc)) {
  failures.push('src/app/globals.css: --ws-sidebar must not be legacy blue #15182A');
}
if (/--ws-toolbar:\s*#(?:171A26|171a26)/.test(globalsSrc)) {
  failures.push('src/app/globals.css: --ws-toolbar must not be legacy blue #171A26');
}

// 3. Verify density system implementation
const densityLib = read('src/lib/applyAcDensity.ts');
if (!densityLib.includes("'ac-density'")) {
  failures.push("src/lib/applyAcDensity.ts: must manage 'ac-density' storage key");
}
if (!densityLib.includes("setAttribute('data-density', density)")) {
  failures.push("src/lib/applyAcDensity.ts: must reflect density onto data-density attribute");
}

const productSystemCss = read('src/styles/product-system.css');
if (!productSystemCss.includes('data-density="comfortable"')) {
  failures.push('src/styles/product-system.css: must support data-density="comfortable" overrides');
}

// 4. Verify no CSS zoom hack on root or containers
const cssFiles = [
  'src/app/globals.css',
  'src/styles/product-system.css',
  'src/styles/alphaclone-theme.css',
  'src/styles/alphaclone-os-v3.css',
  'src/styles/alphaclone-os-v3-pwa.css',
];

for (const rel of cssFiles) {
  const content = read(rel);
  if (/^\s*zoom:\s*0\.\d+/m.test(content)) {
    failures.push(`${rel}: prohibited CSS zoom hack detected. Sizing must be token-driven.`);
  }
}

// Report
if (failures.length > 0) {
  console.error('\x1b[31m[guard-charcoal-density] FAILED:\x1b[0m');
  for (const f of failures) {
    console.error(`  ✖ ${f}`);
  }
  process.exit(1);
} else {
  console.log('\x1b[32m[guard-charcoal-density] OK: Charcoal theme and compact density rules verified.\x1b[0m');
  process.exit(0);
}
