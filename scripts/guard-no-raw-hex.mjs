#!/usr/bin/env node
/**
 * Fail when raw #RRGGBB literals appear outside token source-of-truth files.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HEX = /#[0-9a-fA-F]{3,8}\b/g;

const ALLOWLIST = new Set([
  'src/constants/brand.ts',
  'src/constants/calendarEventColors.ts',
  'src/app/globals.css',
  'src/styles/alphaclone-theme.css',
  'src/styles/marketing-system.css',
  'src/index.css',
  'src/lib/document-os/designSystem.ts',
  'src/lib/compliance/emailDesignSystem.ts',
  'src/lib/document-os/brandProfile.ts',
  'src/lib/document-os/fixtures/novusPower.ts',
]);

const ALLOW_PREFIX = [
  'src/lib/email/',
  'src/services/email',
  'src/services/emailTemplates',
  'src/lib/documents/renderDocument.ts',
  'src/utils/pdfGenerator.ts',
  'src/app/api/',
  'mobile/',
];

const SCAN_ROOTS = ['src/components', 'src/app', 'src/hooks', 'src/contexts', 'src/config'];

function rel(p) {
  return path.relative(root, p).split(path.sep).join('/');
}

function allowed(file) {
  const r = rel(file);
  if (ALLOWLIST.has(r)) return true;
  return ALLOW_PREFIX.some((p) => r.startsWith(p));
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.next') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts|css)$/.test(ent.name)) out.push(full);
  }
  return out;
}

/** Ignore invoice/check placeholders and numeric-only refs like #12345 in copy. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

function countColorHex(src) {
  let total = 0;
  for (const line of stripComments(src).split('\n')) {
    if (/placeholder\s*=/.test(line) && /#/.test(line)) continue;
    if (/invoice\s+#|Check\s+#|ticket:.*#/i.test(line)) continue;
    const matches = line.match(HEX);
    if (!matches) continue;
    for (const m of matches) {
      if (/^#\d{3,5}$/.test(m) && !/[a-fA-F]/.test(m)) continue;
      total++;
    }
  }
  return total;
}

const failures = [];
for (const scanRoot of SCAN_ROOTS) {
  for (const file of walk(path.join(root, scanRoot))) {
    if (allowed(file)) continue;
    const src = fs.readFileSync(file, 'utf8');
    const n = countColorHex(src);
    if (n > 0) {
      failures.push(`${rel(file)}: ${n} raw hex literal(s) — use cssVar, brand.ts, or theme tokens`);
    }
  }
}

const mkt = path.join(root, 'src/styles/marketing-redesign.css');
if (fs.existsSync(mkt)) {
  const n = countColorHex(fs.readFileSync(mkt, 'utf8'));
  if (n > 0) {
    failures.push(`src/styles/marketing-redesign.css: ${n} hex — move to alphaclone-theme tokens`);
  }
}

if (failures.length) {
  console.error('guard-no-raw-hex failed:\n' + failures.slice(0, 40).join('\n'));
  if (failures.length > 40) console.error(`… and ${failures.length - 40} more`);
  process.exit(1);
}
console.log('guard-no-raw-hex: OK');
