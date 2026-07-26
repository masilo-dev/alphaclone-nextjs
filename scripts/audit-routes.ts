#!/usr/bin/env tsx
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const ignored = new Set(['node_modules', '.git', '.next', 'artifacts']);
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (ignored.has(entry.name)) return [];
    const path = resolve(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [relative(root, path).replaceAll('\\', '/')];
  });
}
const files = walk(resolve(root, 'src'));
const routes = files.filter((f) => /^src\/app\/(?:.*\/)?(?:page|route)\.(?:tsx?|jsx?)$/.test(f));
const paths = new Set(routes.map((f) => `/${f.replace(/^src\/app\//, '').replace(/\/(?:page|route)\.[^.]+$/, '').replace(/\([^/]+\)\//g, '')}`.replace(/\/+/g, '/')));
const links: Array<{ file: string; target: string }> = [];
for (const file of files.filter((f) => /\.[jt]sx?$/.test(f))) {
  const source = readFileSync(resolve(root, file), 'utf8');
  for (const match of source.matchAll(/(?:href|redirectTo)\s*[=:]\s*['"`]([^'"`]+)['"`]/g)) links.push({ file, target: match[1] });
}
const localhost = links.filter((x) => /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(x.target));
const broken = links.filter((x) => x.target.startsWith('/') && !x.target.includes('${') && !x.target.includes('[') && !x.target.startsWith('/api/') && !paths.has(x.target.split(/[?#]/)[0]));
const result = { routes: routes.length, links: links.length, localhost, potentialBrokenLinks: broken };
if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`Routes: ${result.routes}; static links: ${result.links}`);
  console.log(`Customer-facing localhost links: ${localhost.length}`);
  console.log(`Potential broken static links: ${broken.length}`);
}
process.exitCode = localhost.length ? 1 : 0;
