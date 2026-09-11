import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function source(path) {
  return fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

test('Turnstile callback changes do not remount a verified widget', () => {
  const widget = source('src/components/security/TurnstileWidget.tsx');
  assert.match(widget, /onTokenChangeRef\.current\(token\)/);
  assert.match(widget, /\[bypassOnError, siteKey, theme\]/);
  assert.doesNotMatch(widget, /\[bypassOnError, onError, onExpire, onTokenChange, siteKey, theme\]/);
});

test('Microsoft OAuth connect and callback use the canonical callback registry', () => {
  const connect = source('src/app/api/auth/microsoft/connect/route.ts');
  const callback = source('src/app/auth/microsoft/callback/route.ts');
  assert.match(connect, /OAUTH_CALLBACKS\.microsoft/);
  assert.match(callback, /OAUTH_CALLBACKS\.microsoft/);
  assert.match(callback, /return PUBLIC_APP_ORIGIN/);
});

test('Outlook email uses refresh-aware encrypted Microsoft connections', () => {
  const provider = source('src/lib/email/providerSdk.ts');
  const microsoft = source('src/services/server/microsoftServerService.ts');
  assert.match(provider, /microsoftServerService\.sendEmail/);
  assert.doesNotMatch(provider, /\.eq\('type', 'outlook'\)/);
  assert.match(microsoft, /refreshMicrosoftAccessToken/);
  assert.match(microsoft, /saveToSentItems: true/);
  assert.match(microsoft, /#microsoft\.graph\.fileAttachment/);
});
