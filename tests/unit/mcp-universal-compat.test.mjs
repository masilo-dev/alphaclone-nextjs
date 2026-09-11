import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMcpClientId,
  shouldUseBrowserOAuthConsent,
  isRedirectUriAllowed,
  PLATFORM_MCP_OAUTH_CLIENT_IDS,
} from '../../src/lib/mcp/oauthRedirect.ts';
import { getToolCatalogModeForClient, resolveUnifiedCatalogMode } from '../../src/lib/mcp/ensureOAuthClient.ts';
import { isChatgptClient } from '../../src/lib/mcp/toolAnnotations.ts';
import { hasRequiredScopes, requiredScopesForTool } from '../../src/lib/mcp/scopes.ts';
import { getMcpPrompt, listMcpPrompts } from '../../src/lib/mcp/prompts/review_bonnie_patterns.ts';

test('normalizeMcpClientId never aliases generic client to chatgpt-connector', () => {
  assert.equal(normalizeMcpClientId('alphaclone-mcp-client'), 'alphaclone-mcp-client');
  assert.equal(normalizeMcpClientId('chatgpt-connector'), 'chatgpt-connector');
  assert.equal(normalizeMcpClientId('cursor-mcp'), 'cursor-mcp');
});

test('tool catalog mode: every platform connector gets the full executable catalog', () => {
  for (const clientId of [
    'chatgpt-connector',
    'cursor-connector',
    'alphaclone-mcp-client',
    '1778309945386-41bab8272f61',
    'claude-web',
    'manus-ai',
  ]) {
    assert.equal(getToolCatalogModeForClient(clientId), 'full', `${clientId} should use full catalog`);
    assert.equal(resolveUnifiedCatalogMode(clientId), 'full', `${clientId} should resolve to full mode`);
  }
  assert.equal(getToolCatalogModeForClient('some-new-client'), 'full');
  assert.equal(getToolCatalogModeForClient(null), 'full');
  assert.equal(getToolCatalogModeForClient(undefined), 'full');
  assert.equal(isChatgptClient({ clientId: 'alphaclone-mcp-client', userAgent: 'ChatGPT' }), false);
  assert.equal(isChatgptClient({ clientId: 'chatgpt-connector' }), true);
});

test('browser consent depends on PKCE/public, not provider name', () => {
  assert.equal(
    shouldUseBrowserOAuthConsent({ clientId: 'any-client', codeChallenge: 'abc', isPublicClient: false }),
    true
  );
  assert.equal(
    shouldUseBrowserOAuthConsent({ clientId: 'any-client', codeChallenge: null, isPublicClient: true }),
    true
  );
});

test('redirect URI matching rejects open redirects', () => {
  assert.equal(
    isRedirectUriAllowed('https://chatgpt.com/connector/oauth/callback', [
      'https://chatgpt.com/connector/oauth/*',
    ]),
    true
  );
  assert.equal(
    isRedirectUriAllowed('https://evil.com/chatgpt.com/connector/oauth/callback', [
      'https://chatgpt.com/connector/oauth/*',
    ]),
    false
  );
});

test('platform bootstrap set is optional seeds only', () => {
  assert.ok(PLATFORM_MCP_OAUTH_CLIENT_IDS.has('chatgpt-connector'));
  assert.ok(PLATFORM_MCP_OAUTH_CLIENT_IDS.has('alphaclone-mcp-client'));
});

test('scope enforcement fails closed for missing write', () => {
  const required = requiredScopesForTool('create_lead');
  const denied = hasRequiredScopes(['read'], required);
  assert.equal(denied.valid, false);
  const allowed = hasRequiredScopes(['read', 'write'], required);
  assert.equal(allowed.valid, true);
});

test('prompts registry supports get by name', () => {
  const list = listMcpPrompts();
  assert.ok(list.length >= 1);
  const prompt = getMcpPrompt(list[0].name);
  assert.ok(prompt);
  const text = prompt.template({
    patterns_json: '[]',
    memory_updates_json: '[]',
  });
  assert.match(text, /Bonnie/);
});
