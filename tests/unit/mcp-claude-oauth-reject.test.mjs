/**
 * Regression: Claude McpAuthorizationError — credentials issued then rejected.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

process.env.PUBLIC_APP_ORIGIN =
  process.env.PUBLIC_APP_ORIGIN || "https://alphaclonesystems.com";
process.env.NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://alphaclonesystems.com";
process.env.PUBLIC_MCP_RESOURCE =
  process.env.PUBLIC_MCP_RESOURCE || "https://alphaclonesystems.com/api/mcp";

test("MCP rate limit is generous and OAuth protocol paths are exempt", () => {
  const proxy = fs.readFileSync(
    new URL("../../proxy.ts", import.meta.url),
    "utf8",
  );
  const rate = fs.readFileSync(
    new URL("../../src/lib/rateLimit.ts", import.meta.url),
    "utf8",
  );
  assert.match(rate, /mcp:\s*\{\s*limit:\s*300/);
  assert.match(proxy, /rateLimitConfigs\.api\.mcp/);
  assert.match(proxy, /isMcpOAuthProtocolPath/);
  assert.match(proxy, /\/api\/mcp\/token/);
  // Must not put MCP JSON-RPC on the old 20/min heavy bucket
  assert.equal(
    proxy.includes("isMcp\n          ? rateLimitConfigs.api.heavy"),
    false,
  );
  assert.equal(
    /isMcp\s*\n\s*\?\s*rateLimitConfigs\.api\.heavy/.test(proxy),
    false,
  );
});

test("Claude redirect seed includes api/oauth/callback and merges URIs", async () => {
  const { CLAUDE_OAUTH_REDIRECT_URIS } =
    await import("../../src/lib/mcp/oauthRedirect.ts");
  assert.ok(
    CLAUDE_OAUTH_REDIRECT_URIS.includes("https://claude.ai/api/oauth/callback"),
  );
  assert.ok(
    CLAUDE_OAUTH_REDIRECT_URIS.includes(
      "https://claude.ai/api/mcp/auth_callback",
    ),
  );

  const ensureSrc = fs.readFileSync(
    new URL("../../src/lib/mcp/ensureOAuthClient.ts", import.meta.url),
    "utf8",
  );
  assert.match(ensureSrc, /mergeRedirectUris/);
  assert.match(ensureSrc, /CLAUDE_OAUTH_REDIRECT_URIS/);
  assert.match(ensureSrc, /never shrinks/);
});

test("OAuth approve bootstraps workspace without probing tenant_users.status", () => {
  const src = fs.readFileSync(
    new URL("../../src/app/api/mcp/oauth/approve/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(src, /bootstrapTenantForUser/);
  assert.match(src, /\.select\(['"]tenant_id, role['"]\)/);
  assert.doesNotMatch(src, /\.select\(['"]tenant_id, role, status['"]\)/);
  assert.match(src, /CLAUDE_OAUTH_REDIRECT_URIS/);
  assert.match(src, /maxDuration/);
  assert.match(src, /mcp-oauth-approve-v1/);
  assert.match(src, /No active workspace/);
  assert.match(src, /ensurePlatformMcpOAuthClient/);
  assert.match(src, /maybeSingle\(\)/);
  const codeOnly = src
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal(/\.\s*single\s*\(/.test(codeOnly), false);
});

test("service worker bypasses authorize and MCP OAuth network-only", () => {
  const src = fs.readFileSync(
    new URL("../../src/app/sw.ts", import.meta.url),
    "utf8",
  );
  assert.match(src, /pathname === '\/authorize'/);
  assert.match(src, /\/api\/mcp/);
  assert.match(src, /new NetworkOnly\(\)/);
});

test("token revoke falls back when revoked_at column missing", () => {
  const src = fs.readFileSync(
    new URL("../../src/lib/mcp/oauthTokenIsolation.ts", import.meta.url),
    "utf8",
  );
  assert.match(src, /revoked_at/);
  assert.match(src, /Older schemas may lack revoked_at/);
  assert.match(src, /update\(\{\s*revoked:\s*true\s*\}\)/);
});

test("migration restores Claude OAuth redirect URIs", () => {
  const src = fs.readFileSync(
    new URL(
      "../../supabase/migrations/20260724210000_fix_claude_mcp_oauth_redirects.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(src, /claude\.ai\/api\/oauth\/callback/);
  assert.match(src, /1778309945386-41bab8272f61/);
});
