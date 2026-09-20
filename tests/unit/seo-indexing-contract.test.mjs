import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const repoRoot = new URL('../../', import.meta.url);

test('robots advertises one authoritative sitemap', async () => {
  const source = await readFile(new URL('src/app/robots.ts', repoRoot), 'utf8');
  assert.match(source, /sitemap:\s*`\$\{baseUrl\}\/sitemap\.xml`/);
  assert.doesNotMatch(source, /sitemaps\/marketing\.xml/);
});

test('retired public routes have permanent canonical redirects', async () => {
  const source = await readFile(new URL('next.config.ts', repoRoot), 'utf8');
  const expected = new Map([
    ['/portfolio', '/results'],
    ['/compare', '/pricing'],
    ['/login', '/auth/login'],
    ['/marketing', '/services'],
    ['/solutions', '/who-we-serve'],
  ]);

  for (const [oldPath, canonicalPath] of expected) {
    const escapedOld = oldPath.replaceAll('/', '\\/');
    const escapedCanonical = canonicalPath.replaceAll('/', '\\/');
    assert.match(
      source,
      new RegExp(`source: ['"]${escapedOld}['"], destination: ['"]${escapedCanonical}['"], permanent: true`),
    );
  }
});

test('HTML responses opt out of Cloudflare email link transformation', async () => {
  const source = await readFile(new URL('next.config.ts', repoRoot), 'utf8');
  assert.match(source, /no-cache, no-store, no-transform, must-revalidate, max-age=0/);
});

test('legacy register redirect uses the canonical public origin', async () => {
  const source = await readFile(new URL('src/app/register/route.ts', repoRoot), 'utf8');
  assert.match(source, /absoluteUrl\('\/auth\/login\?register=true&type=business&plan=starter'\)/);
  assert.doesNotMatch(source, /req\.nextUrl\.origin/);
});
