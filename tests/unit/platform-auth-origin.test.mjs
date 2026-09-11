/**
 * Unit tests: public origin + MCP resource validation must ignore internal hosts.
 */
import assert from "node:assert/strict";
import { describe, it, before } from "node:test";

// Force production-like public origin for this suite (ignore local .env.local).
process.env.PUBLIC_APP_ORIGIN = "https://alphaclonesystems.com";
process.env.NEXT_PUBLIC_APP_URL = "https://alphaclonesystems.com";
process.env.NEXT_PUBLIC_SITE_URL = "https://alphaclonesystems.com";
process.env.PUBLIC_MCP_RESOURCE = "https://alphaclonesystems.com/api/mcp";
process.env.NODE_ENV = "test";

const {
  PUBLIC_APP_ORIGIN,
  PUBLIC_MCP_RESOURCE,
  normalizeResourceUrl,
  resourcesMatch,
  buildPublicCallbackUrl,
  validatePublicOriginConfig,
} = await import("../../src/lib/config/public-origin.ts");

const {
  isRedirectUriAllowed,
  CHATGPT_OAUTH_REDIRECT_URIS,
  normalizeMcpResourceUrl,
} = await import("../../src/lib/mcp/oauthRedirect.ts");

const { OAUTH_CALLBACKS, listOAuthCallbackUrls } =
  await import("../../src/lib/config/oauth-callbacks.ts");
const { hasRequiredScopes, MCP_SCOPES, formatScopeString } =
  await import("../../src/lib/mcp/scopes.ts");
const {
  createProtectedResourceResponse,
  createAuthorizationServerResponse,
  getMcpPublicBaseUrl,
} = await import("../../src/lib/mcpWellKnown.ts");

describe("public origin + MCP resource", () => {
  it("uses canonical production origin", () => {
    assert.equal(PUBLIC_APP_ORIGIN, "https://alphaclonesystems.com");
    assert.equal(PUBLIC_MCP_RESOURCE, "https://alphaclonesystems.com/api/mcp");
  });

  it("validates config as ok", () => {
    const result = validatePublicOriginConfig();
    assert.equal(result.ok, true);
  });

  it("matches token resource against configured resource even when request is 0.0.0.0:8080", () => {
    const tokenResource = "https://alphaclonesystems.com/api/mcp";
    const internalRequest = "http://0.0.0.0:8080/api/mcp";

    // Token must validate against PUBLIC_MCP_RESOURCE, not the internal request URL
    assert.equal(resourcesMatch(tokenResource, PUBLIC_MCP_RESOURCE), true);
    assert.equal(resourcesMatch(tokenResource, internalRequest), false);
    assert.notEqual(
      normalizeResourceUrl(internalRequest),
      normalizeResourceUrl(PUBLIC_MCP_RESOURCE),
    );
  });

  it("aliases /api/mcp/sse to /api/mcp", () => {
    const sse = "https://alphaclonesystems.com/api/mcp/sse";
    assert.equal(
      normalizeMcpResourceUrl(sse),
      "https://alphaclonesystems.com/api/mcp",
    );
    assert.equal(resourcesMatch(sse, PUBLIC_MCP_RESOURCE), true);
  });

  it("buildPublicCallbackUrl rejects non-absolute paths and uses public origin", () => {
    assert.equal(
      buildPublicCallbackUrl("/api/auth/google/gmail/callback"),
      "https://alphaclonesystems.com/api/auth/google/gmail/callback",
    );
    assert.throws(
      () => buildPublicCallbackUrl("api/auth/x"),
      /must start with/,
    );
  });

  it("OAUTH_CALLBACKS never contain localhost or 0.0.0.0", () => {
    for (const { provider, url } of listOAuthCallbackUrls()) {
      assert.ok(url.startsWith("https://alphaclonesystems.com/"), provider);
      assert.ok(!url.includes("localhost"), provider);
      assert.ok(!url.includes("0.0.0.0"), provider);
    }
    assert.equal(
      OAUTH_CALLBACKS.x,
      "https://alphaclonesystems.com/api/auth/callback/x",
    );
  });
});

describe("redirect URI matching", () => {
  it("allows exact ChatGPT redirect", () => {
    assert.equal(
      isRedirectUriAllowed(
        "https://chatgpt.com/connector_platform_oauth_redirect",
        CHATGPT_OAUTH_REDIRECT_URIS,
      ),
      true,
    );
  });

  it("allows path-prefix wildcard under same host", () => {
    assert.equal(
      isRedirectUriAllowed(
        "https://chatgpt.com/connector/oauth/callback",
        CHATGPT_OAUTH_REDIRECT_URIS,
      ),
      true,
    );
  });

  it("rejects evil.com and suffix domains and userinfo tricks", () => {
    assert.equal(
      isRedirectUriAllowed("https://evil.com/cb", CHATGPT_OAUTH_REDIRECT_URIS),
      false,
    );
    assert.equal(
      isRedirectUriAllowed(
        "https://chatgpt.com.evil.com/callback",
        CHATGPT_OAUTH_REDIRECT_URIS,
      ),
      false,
    );
    assert.equal(
      isRedirectUriAllowed(
        "https://chatgpt.com@evil.com/callback",
        CHATGPT_OAUTH_REDIRECT_URIS,
      ),
      false,
    );
  });
});

describe("scopes", () => {
  it("formats space-separated scopes", () => {
    assert.equal(formatScopeString(["read", "write"]), "read write");
  });

  it("fails closed on missing scopes", () => {
    const result = hasRequiredScopes(
      [MCP_SCOPES.READ],
      [MCP_SCOPES.WRITE, MCP_SCOPES.TOOLS],
    );
    assert.equal(result.valid, false);
    assert.ok(result.missing.includes(MCP_SCOPES.WRITE));
  });

  it("legacy read+write implies tools/resources", () => {
    const result = hasRequiredScopes(["read", "write"], [MCP_SCOPES.TOOLS]);
    assert.equal(result.valid, true);
  });
});

describe("well-known metadata", () => {
  it("never exposes 0.0.0.0 even if request Host is internal", () => {
    const fakeReq = {
      headers: {
        get(name) {
          if (name === "host") return "0.0.0.0:8080";
          if (name === "x-forwarded-host") return "0.0.0.0:8080";
          if (name === "x-forwarded-proto") return "http";
          return null;
        },
      },
    };

    assert.equal(getMcpPublicBaseUrl(fakeReq), "https://alphaclonesystems.com");

    // Response.json() on Web Response
    return Promise.all([
      createProtectedResourceResponse(fakeReq).json(),
      createAuthorizationServerResponse(fakeReq).json(),
    ]).then(([resource, asMeta]) => {
      assert.equal(resource.resource, "https://alphaclonesystems.com/api/mcp");
      assert.equal(asMeta.issuer, "https://alphaclonesystems.com");
      assert.ok(!JSON.stringify(resource).includes("0.0.0.0"));
      assert.ok(!JSON.stringify(asMeta).includes("0.0.0.0"));
    });
  });
});
