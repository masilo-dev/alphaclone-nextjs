#!/usr/bin/env node
/**
 * Convert dark-hardcoded Tailwind utilities in dashboard/app surfaces to
 * workspace semantic tokens so light mode inherits correctly.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const REPLACEMENTS = [
  // Borders / translucent whites → workspace border / hover
  [/\bborder-white\/10\b/g, 'border-[var(--ws-border)]'],
  [/\bborder-white\/5\b/g, 'border-[var(--ws-border)]'],
  [/\bborder-white\/20\b/g, 'border-[var(--ws-border-strong)]'],
  [/\bdivide-white\/10\b/g, 'divide-[var(--ws-border)]'],
  [/\bring-white\/10\b/g, 'ring-[var(--ws-border)]'],
  [/\bbg-white\/5\b/g, 'bg-[var(--ws-hover)]'],
  [/\bbg-white\/10\b/g, 'bg-[var(--ws-hover)]'],
  [/\bhover:bg-white\/5\b/g, 'hover:bg-[var(--ws-hover)]'],
  [/\bhover:bg-white\/10\b/g, 'hover:bg-[var(--ws-hover)]'],
  [/\bhover:text-white\b/g, 'hover:text-[var(--ws-text-primary)]'],
  [/\bplaceholder-slate-500\b/g, 'placeholder-[var(--ws-text-muted)]'],
  [/\bplaceholder:text-slate-500\b/g, 'placeholder:text-[var(--ws-text-muted)]'],
  // Slate dark canvas leftovers
  [/\bbg-slate-950\b/g, 'bg-[var(--ws-canvas)]'],
  [/\bbg-slate-900\b/g, 'bg-[var(--ws-panel)]'],
  [/\bbg-slate-800\b/g, 'bg-[var(--ws-surface-secondary)]'],
  [/\btext-slate-100\b/g, 'text-[var(--ws-text-primary)]'],
  [/\btext-slate-200\b/g, 'text-[var(--ws-text-secondary)]'],
  [/\btext-slate-300\b/g, 'text-[var(--ws-text-secondary)]'],
  [/\btext-slate-400\b/g, 'text-[var(--ws-text-muted)]'],
  [/\btext-slate-500\b/g, 'text-[var(--ws-text-muted)]'],
  [/\bborder-slate-800\b/g, 'border-[var(--ws-border)]'],
  [/\bborder-slate-700\b/g, 'border-[var(--ws-border)]'],
];

function replaceTextWhite(src) {
  return src.replace(/(^|[^\w/-])text-white(?![/\w-])/gm, (match, pre, offset, full) => {
    const start = Math.max(0, offset - 160);
    const window = full.slice(start, offset + 40);
    const onSolidCta =
      /bg-\[var\(--(?:interactive-primary|brand-coral|danger|error|success|brand-blue|interactive-secondary)/.test(window) ||
      /bg-(?:teal|emerald|rose|red|coral|orange)-(?:500|600)/.test(window) ||
      /from-\[var\(--brand-blue/.test(window) ||
      /bg-gradient-to-/.test(window);
    if (onSolidCta) return `${pre}text-[var(--text-inverse)]`;
    return `${pre}text-[var(--ws-text-primary)]`;
  });
}

const SCAN = [
  'src/components/dashboard',
  'src/components/ui',
  'src/components/alpha',
  'src/app/dashboard',
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(ent.name)) out.push(full);
  }
  return out;
}

let changed = 0;
for (const scan of SCAN) {
  for (const file of walk(path.join(root, scan))) {
    let src = fs.readFileSync(file, 'utf8');
    const before = src;
    for (const [re, to] of REPLACEMENTS) src = src.replace(re, to);
    src = replaceTextWhite(src);
    if (src !== before) {
      fs.writeFileSync(file, src);
      changed++;
    }
  }
}

console.log(`codemod-light-theme-tokens: updated ${changed} files`);
