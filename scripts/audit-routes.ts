#!/usr/bin/env tsx
import { readdirSync, readFileSync, existsSync } from 'node:fs';
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
const routes = files.filter((f) =>
  /^src\/app\/(?:.*\/)?(?:(?:page|route)\.(?:tsx?|jsx?)|sitemap\.ts|robots\.ts|manifest\.ts|favicon\.(?:ico|png))$/.test(
    f
  )
);
const routePaths = routes
  .map((f) => {
    let path = f.replace(/^src\/app\//, '').replace(/\([^/]+\)\//g, '');
    if (path.endsWith('sitemap.ts')) path = path.replace(/sitemap\.ts$/, 'sitemap.xml');
    if (path.endsWith('robots.ts')) path = path.replace(/robots\.ts$/, 'robots.txt');
    if (path.endsWith('manifest.ts')) path = path.replace(/manifest\.ts$/, 'manifest.webmanifest');
    path = path.replace(/(?:^|\/)(?:page|route)\.[^.]+$/, '');
    path = `/${path}`.replace(/\/+/g, '/');
    return path === '' ? '/' : path;
  })
  .filter(Boolean);
const paths = new Set(routePaths);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function routePathToRegex(routePath: string): RegExp {
  const normalized = routePath.replace(/\/+$/, '') || '/';
  const segments = normalized.split('/').filter(Boolean);
  let pattern = '^';
  if (segments.length === 0) return /^\/$/;
  for (const seg of segments) {
    if (/^\[\[\.\.\..+\]\]$/.test(seg)) {
      pattern += '(?:/.*)?';
      return new RegExp(`${pattern}$`);
    }
    if (/^\[\.\.\..+\]$/.test(seg)) {
      pattern += '(?:/[^/]+)+';
      return new RegExp(`${pattern}$`);
    }
    if (/^\[.+\]$/.test(seg)) {
      pattern += '/[^/]+';
      continue;
    }
    pattern += `/${escapeRegex(seg)}`;
  }
  return new RegExp(`${pattern}$`);
}

const routeMatchers = routePaths.map(routePathToRegex);

function isCoveredByKnownRoutes(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (paths.has(normalized)) return true;
  if (existsSync(resolve(root, 'public', normalized.replace(/^\/+/, '')))) return true;
  return routeMatchers.some((re) => re.test(normalized));
}
const links: Array<{ file: string; target: string }> = [];
for (const file of files.filter((f) => /\.[jt]sx?$/.test(f))) {
  const source = readFileSync(resolve(root, file), 'utf8');
  for (const match of source.matchAll(/(?:href|redirectTo)\s*[=:]\s*['"`]([^'"`]+)['"`]/g)) links.push({ file, target: match[1] });
}
const localhost = links.filter((x) => /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(x.target));
const broken = links.filter((x) => {
  if (!x.target.startsWith('/')) return false;
  if (x.target.includes('${')) return false;
  if (x.target.includes('[')) return false;
  if (x.target.startsWith('/api/')) return false;
  const pathname = x.target.split(/[?#]/)[0] || '/';
  return !isCoveredByKnownRoutes(pathname);
});
const result = { routes: routes.length, links: links.length, localhost, potentialBrokenLinks: broken };
if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`Routes: ${result.routes}; static links: ${result.links}`);
  console.log(`Customer-facing localhost links: ${localhost.length}`);
  console.log(`Potential broken static links: ${broken.length}`);
}
process.exitCode = localhost.length ? 1 : 0;
