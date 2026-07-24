import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getOAuthRedirectOrigin,
  normalizeOrigin,
  stripWwwAlphacloneHost,
} from '../../src/lib/config/public-origin.ts';
import { getProductionBaseUrl } from '../../src/lib/urls/publicUrlGuard.ts';

test('stripWwwAlphacloneHost forces apex', () => {
  assert.equal(stripWwwAlphacloneHost('www.alphaclonesystems.com'), 'alphaclonesystems.com');
  assert.equal(stripWwwAlphacloneHost('alphaclonesystems.com'), 'alphaclonesystems.com');
});

test('normalizeOrigin rewrites www to apex', () => {
  assert.equal(normalizeOrigin('https://www.alphaclonesystems.com'), 'https://alphaclonesystems.com');
  assert.equal(normalizeOrigin('https://www.alphaclonesystems.com/'), 'https://alphaclonesystems.com');
  assert.equal(normalizeOrigin('https://alphaclonesystems.com/path'), 'https://alphaclonesystems.com');
});

test('getOAuthRedirectOrigin never returns www', () => {
  const prev = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = 'https://www.alphaclonesystems.com';
  try {
    assert.equal(getOAuthRedirectOrigin('https://www.alphaclonesystems.com'), 'https://alphaclonesystems.com');
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prev;
  }
});

test('getProductionBaseUrl strips www alphaclone host', () => {
  const prev = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = 'https://www.alphaclonesystems.com/';
  try {
    assert.equal(getProductionBaseUrl(), 'https://alphaclonesystems.com');
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prev;
  }
});
