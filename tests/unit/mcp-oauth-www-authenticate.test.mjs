/**
 * Unit tests for MCP OAuth WWW-Authenticate / resource_metadata challenge.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('mcp oauth www-authenticate', () => {
  it('includes resource_metadata for ChatGPT OAuth discovery', async () => {
    const { createWWWAuthenticateHeader } = await import(
      '../../src/services/mcp/authMiddlewareApp.ts'
    );

    const header = createWWWAuthenticateHeader(
      'invalid_token',
      'Missing access token',
      ['read', 'write'],
      'https://alphaclonesystems.com/.well-known/oauth-protected-resource'
    );

    assert.match(header, /^Bearer /);
    assert.match(header, /resource_metadata="https:\/\/alphaclonesystems\.com\/\.well-known\/oauth-protected-resource"/);
    assert.match(header, /error="invalid_token"/);
    assert.match(header, /scope="read write"/);
  });

  it('allows ChatGPT Apps redirect URI patterns', async () => {
    const { isRedirectUriAllowed, CHATGPT_OAUTH_REDIRECT_URIS } = await import(
      '../../src/lib/mcp/oauthRedirect.ts'
    );

    assert.equal(
      isRedirectUriAllowed(
        'https://chatgpt.com/connector_platform_oauth_redirect',
        CHATGPT_OAUTH_REDIRECT_URIS
      ),
      true
    );
    assert.equal(
      isRedirectUriAllowed(
        'https://chatgpt.com/connector/oauth/abc123',
        CHATGPT_OAUTH_REDIRECT_URIS
      ),
      true
    );
    assert.equal(
      isRedirectUriAllowed('https://evil.com/callback', CHATGPT_OAUTH_REDIRECT_URIS),
      false
    );
  });
});
