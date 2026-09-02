/**
 * Canonical OAuth client resolution — same tenant across ChatGPT accounts.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const {
  CHATGPT_CANONICAL_CLIENT_ID,
  CLAUDE_CANONICAL_CLIENT_ID,
  resolveCanonicalOAuthClientIdSync,
  oauthClientsAreEquivalent,
  getOAuthClientDisplayName,
  getOAuthClientFamily,
} = await import("../../src/lib/mcp/resolveCanonicalOAuthClient.ts");

const CHATGPT_REDIRECT = "https://chatgpt.com/connector_platform_oauth_redirect";
const CLAUDE_REDIRECT = "https://claude.ai/api/mcp/auth_callback";

describe("MCP canonical OAuth client resolution", () => {
  it("maps ChatGPT redirect URIs to chatgpt-connector even for ac_* DCR ids", () => {
    const acClient = "ac_deadbeef1234567890abcdef12345678";
    assert.equal(
      resolveCanonicalOAuthClientIdSync(acClient, [CHATGPT_REDIRECT]),
      CHATGPT_CANONICAL_CLIENT_ID,
    );
    assert.equal(getOAuthClientDisplayName(acClient, [CHATGPT_REDIRECT]), "ChatGPT");
    assert.equal(getOAuthClientFamily(acClient, [CHATGPT_REDIRECT]), "chatgpt");
  });

  it("treats ac_* ChatGPT DCR and chatgpt-connector as equivalent on refresh", () => {
    const acClient = "ac_deadbeef1234567890abcdef12345678";
    assert.ok(
      oauthClientsAreEquivalent(
        acClient,
        CHATGPT_CANONICAL_CLIENT_ID,
        [CHATGPT_REDIRECT],
        [CHATGPT_REDIRECT],
      ),
    );
  });

  it("keeps Claude and ChatGPT as distinct families", () => {
    assert.ok(
      !oauthClientsAreEquivalent(
        CHATGPT_CANONICAL_CLIENT_ID,
        CLAUDE_CANONICAL_CLIENT_ID,
        [CHATGPT_REDIRECT],
        [CLAUDE_REDIRECT],
      ),
    );
  });

  it("preserves unknown generic client ids without redirect hints", () => {
    const generic = "ac_customnonplatformclient123456";
    assert.equal(resolveCanonicalOAuthClientIdSync(generic, null), generic);
  });
});
