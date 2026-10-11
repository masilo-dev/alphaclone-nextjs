#!/usr/bin/env node
/**
 * One-shot codemod: remove glassmorphism from product surfaces.
 *  - strips `backdrop-blur*` / `backdrop-saturate*` utilities
 *  - converts translucent SURFACE token fills `bg-[var(--ws-panel)]/50` -> solid `bg-[var(--ws-panel)]`
 * Text/border tokens are never touched. Marketing/landing/video are excluded.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../src');
const INCLUDE = [
  'components/dashboard', 'components/contracts', 'components/documents', 'components/leads',
  'components/common', 'components/ui', 'components/projects', 'components/auth', 'components/onboarding',
  'components/pwa', 'components/Dashboard.tsx', 'components/SessionTimeoutWarning.tsx',
  'app/portal', 'app/portal-login', 'app/dashboard', 'app/invoice', 'app/contract', 'app/invite', 'app/auth',
];
const EXCLUDE = ['components/dashboard/video', 'components/marketing', 'components/landing', 'components/legal'];

const SURFACES = 'panel|canvas|surface-primary|surface-secondary|surface-tertiary|sidebar|toolbar|panel-hover|hover|active';
const alphaFill = new RegExp(`(bg-\\[var\\(--ws-(?:${SURFACES})\\)\\])/\\d+`, 'g');
const blur = /(^|\s|["'`])((?:[a-z0-9-]+:)*backdrop-(?:blur|saturate)(?:-\[[^\]]+\]|-[a-z0-9]+)?)(?=$|\s|["'`])/g;

function walk(p, out) {
  const st = fs.statSync(p);
  if (st.isDirectory()) for (const f of fs.readdirSync(p)) walk(path.join(p, f), out);
  else if (/\.(tsx|ts)$/.test(p)) out.push(p);
}
const files = [];
for (const inc of INCLUDE) { const p = path.join(ROOT, inc); if (fs.existsSync(p)) walk(p, files); }

let changed = 0, fills = 0, blurs = 0;
for (const f of files) {
  const rel = path.relative(ROOT, f);
  if (EXCLUDE.some((e) => rel.startsWith(e))) continue;
  const src = fs.readFileSync(f, 'utf8');
  const before = fills + blurs;
  let out = src.replace(alphaFill, (_m, g1) => { fills++; return g1; });
  out = out.replace(blur, (_m, pre) => { blurs++; return pre; });
  if (fills + blurs === before) continue;
  // tidy double spaces created inside class strings
  out = out.replace(/className="([^"]*)"/g, (_m, c) => `className="${c.replace(/ {2,}/g, ' ').replace(/^ | $/g, '')}"`);
  if (out !== src) { fs.writeFileSync(f, out); changed++; }
}
console.log(JSON.stringify({ filesScanned: files.length, filesChanged: changed, alphaFillsSolidified: fills, blurUtilitiesRemoved: blurs }));
