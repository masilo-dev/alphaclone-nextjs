import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('Canonical Vanity and Legal Redirects Registry Integrity', async () => {
  const nextConfigSrc = fs.readFileSync(path.join(projectRoot, 'next.config.ts'), 'utf8');

  // Verify critical vanity aliases are registered as permanent redirects
  const expectedRedirects = [
    { source: '/terms', destination: '/legal/terms' },
    { source: '/privacy', destination: '/legal/privacy' },
    { source: '/cookies', destination: '/legal/cookies' },
    { source: '/security', destination: '/security-policy' },
    { source: '/status', destination: '/platform-status' },
    { source: '/login', destination: '/auth/login' },
    { source: '/privacy-policy', destination: '/legal/privacy' },
    { source: '/terms-of-service', destination: '/legal/terms' },
    { source: '/cookie-policy', destination: '/legal/cookies' },
    { source: '/dpa', destination: '/legal/dpa' },
  ];

  for (const { source, destination } of expectedRedirects) {
    const pattern = new RegExp(
      `\\{\\s*source:\\s*['"]${source}['"],\\s*destination:\\s*['"]${destination}['"],\\s*permanent:\\s*true\\s*\\}`
    );
    assert.match(
      nextConfigSrc,
      pattern,
      `Expected permanent redirect from ${source} to ${destination} in next.config.ts`
    );
  }
});

test('Redirect destinations exist as valid pages or route endpoints in src/app', () => {
  const destinations = [
    '/legal/terms',
    '/legal/privacy',
    '/legal/cookies',
    '/security-policy',
    '/platform-status',
    '/auth/login',
    '/legal/dpa',
  ];

  for (const dest of destinations) {
    const routeFolder = path.join(projectRoot, 'src', 'app', dest.replace(/^\//, ''));
    const pageTsx = path.join(routeFolder, 'page.tsx');
    const routeTs = path.join(routeFolder, 'route.ts');
    const exists = fs.existsSync(pageTsx) || fs.existsSync(routeTs);
    assert.ok(exists, `Redirect destination ${dest} must exist in src/app at ${pageTsx} or ${routeTs}`);
  }
});
