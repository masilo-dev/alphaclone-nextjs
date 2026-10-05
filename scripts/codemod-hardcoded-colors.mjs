#!/usr/bin/env node
/**
 * Replace legacy hardcoded hex / electric-blue fallbacks in TS/TSX/CSS with CSS variables.
 * Token definition files are skipped (single source of truth stays in brand + theme CSS).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FALLBACK_STRIP, HEX_TO_VAR, TAILWIND_TO_TOKEN } from './hex-to-token-map.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'coverage']);

const ALLOWLIST_FILES = new Set([
  'src/constants/brand.ts',
  'src/app/globals.css',
  'src/styles/alphaclone-theme.css',
  'src/styles/marketing-system.css',
  'src/index.css',
  'src/lib/document-os/designSystem.ts',
  'src/lib/compliance/emailDesignSystem.ts',
]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts|css)$/.test(ent.name)) out.push(full);
  }
  return out;
}

function rel(full) {
  return path.relative(root, full).split(path.sep).join('/');
}

let changed = 0;
for (const file of walk(path.join(root, 'src'))) {
  const r = rel(file);
  if (ALLOWLIST_FILES.has(r)) continue;
  if (r.includes('/lib/email/') && r.endsWith('.ts')) continue;
  if (r.includes('/services/email') && r.endsWith('.ts')) continue;
  if (r.includes('emailTemplates')) continue;
  if (r.includes('renderDocument.ts')) continue;
  if (r.includes('pdfGenerator')) continue;

  let src = fs.readFileSync(file, 'utf8');
  const before = src;

  for (const [hex, v] of HEX_TO_VAR) {
    const re = new RegExp(hex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    src = src.replace(re, v);
  }

  for (const [re, v] of FALLBACK_STRIP) {
    src = src.replace(re, v);
  }
  src = src.replace(
    /var\((--[a-zA-Z0-9-]+),\s*(#[0-9a-fA-F]{3,8})\)/g,
    'var($1)',
  );
  if (/\.(tsx|ts)$/.test(file)) {
    for (const [re, v] of TAILWIND_TO_TOKEN) {
      src = src.replace(re, v);
    }
  }

  if (src !== before) {
    fs.writeFileSync(file, src);
    changed++;
  }
}

console.log(`codemod-hardcoded-colors: updated ${changed} files`);
