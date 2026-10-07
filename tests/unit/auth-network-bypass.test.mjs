import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bypassAuthenticationFetch } from '../../src/lib/pwa/authNetworkBypass.ts';

const origin = 'https://alphaclonesystems.com';
test('auth navigation, Supabase and Turnstile use native networking without respondWith', () => {
    for (const path of [
        '/auth/login', '/auth/login?returnTo=%2Fauthorize%3Fstate%3Dx',
        '/authorize', '/api/mcp/token', '/api/auth/human-check', '/portal-login',
        'https://ehekzoioqvtweugemktn.supabase.co/auth/v1/token?grant_type=password',
        'https://challenges.cloudflare.com/turnstile/v0/api.js',
    ]) {
        let stopped = false;
        const request = new Request(new URL(path, origin));
        const event = { request, stopImmediatePropagation() { stopped = true; }, respondWith() { assert.fail('must not intercept auth'); } };
        bypassAuthenticationFetch(event, origin);
        assert.equal(stopped, true, path);
        assert.equal(event.request, request);
    }
});
test('ordinary PWA traffic and lookalike hosts remain under normal routing', () => {
    for (const path of ['/dashboard', '/_next/static/build.js', '/api/invoices', '/authentication', 'https://supabase.co.attacker.test/auth/v1/token', 'https://other.test/auth/login']) {
        bypassAuthenticationFetch({ request: new Request(new URL(path, origin)), stopImmediatePropagation() { assert.fail(path); } }, origin);
    }
});
