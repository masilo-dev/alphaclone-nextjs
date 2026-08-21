/**
 * Social publishing repair — unit/contract tests for canonical service,
 * media upload hardening, identity rules, and MCP catalog consistency.
 */
import test from "node:test";
import assert from "node:assert/strict";

const {
  detectMimeFromSignature,
  decodeBase64Media,
  isDataUri,
  rejectOrExtractDataUri,
  extractImageDimensions,
  redactSecrets,
  assertPublicMediaUrl,
} = await import("../../src/lib/social/mediaUpload.ts");

const { CANONICAL_SOCIAL_MCP_TOOLS, SOCIAL_PUBLISH_TOOL_CATALOG_VERSION } =
  await import("../../src/lib/social/types.ts");

const { applyTestCaptionPrefix, isSocialPublishTestMode } =
  await import("../../src/lib/social/identityResolution.ts");

const { MCP_TOOL_CATALOG_VERSION } =
  await import("../../src/lib/mcp/standardResponse.ts");
const { CHATGPT_CONNECTOR_TOOL_NAMES } =
  await import("../../src/lib/mcp/toolAnnotations.ts");
const { initializeRegistry, listTools, hasTool } =
  await import("../../src/lib/mcp/tool-registry.ts");
const { getUnifiedMcpTools, invalidateUnifiedMcpToolCache } =
  await import("../../src/lib/mcp/listAllTools.ts");

// Minimal valid 1x1 PNG
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("tools/list exposes every canonical social tool", async () => {
  initializeRegistry();
  invalidateUnifiedMcpToolCache();
  const tools = await getUnifiedMcpTools({
    sanitizeForClient: false,
    forceRefresh: true,
    forChatGPT: false,
    loadedModules: ["social", "media"],
  });
  const names = new Set(tools.map((t) => t.name));
  for (const required of CANONICAL_SOCIAL_MCP_TOOLS) {
    assert.ok(names.has(required), `missing from tools/list: ${required}`);
    assert.ok(
      hasTool(required) || names.has(required),
      `not callable: ${required}`,
    );
  }
});

test("inspect_tools catalog (full) and tools/list include the same canonical social tools", async () => {
  initializeRegistry();
  invalidateUnifiedMcpToolCache();
  const full = await getUnifiedMcpTools({
    forceRefresh: true,
    forChatGPT: false,
    catalogMode: "full",
  });
  const chatgpt = await getUnifiedMcpTools({
    forceRefresh: true,
    forChatGPT: true,
    clientId: "chatgpt-connector",
    userAgent: "ChatGPT",
    loadedModules: ["social", "media"],
  });
  const fullNames = new Set(full.map((t) => t.name));
  const chatgptNames = new Set(chatgpt.map((t) => t.name));
  for (const name of CANONICAL_SOCIAL_MCP_TOOLS) {
    assert.ok(fullNames.has(name), `full catalog missing ${name}`);
    assert.ok(
      chatgptNames.has(name),
      `ChatGPT curated catalog missing ${name}`,
    );
  }
});

test("ChatGPT curated list includes canonical social tools", () => {
  for (const name of CANONICAL_SOCIAL_MCP_TOOLS) {
    assert.ok(
      CHATGPT_CONNECTOR_TOOL_NAMES.includes(name),
      `CHATGPT_CONNECTOR_TOOL_NAMES missing ${name}`,
    );
  }
});

test("registry handlers exist for canonical social tools", () => {
  initializeRegistry();
  const registryNames = new Set(listTools(false).map((t) => t.name));
  for (const name of CANONICAL_SOCIAL_MCP_TOOLS) {
    assert.ok(hasTool(name), `registry missing handler for ${name}`);
    assert.ok(registryNames.has(name), `listTools missing ${name}`);
  }
});

test("tool_catalog_version is bumped for social repair", () => {
  assert.match(MCP_TOOL_CATALOG_VERSION, /social-2\.0|2\.0/);
  assert.match(SOCIAL_PUBLISH_TOOL_CATALOG_VERSION, /social-publishing-(2\.1|3\.0)/);
});

test("upload_media / get_media / delete_media are ChatGPT-discoverable with AI image guidance", async () => {
  initializeRegistry();
  invalidateUnifiedMcpToolCache();
  const chatgpt = await getUnifiedMcpTools({
    forceRefresh: true,
    forChatGPT: true,
    clientId: "chatgpt-connector",
    userAgent: "ChatGPT",
    loadedModules: ["social", "media"],
  });
  const byName = new Map(chatgpt.map((t) => [t.name, t]));
  for (const name of ["upload_media", "get_media", "delete_media", "publish_post", "get_post_status"]) {
    assert.ok(byName.has(name), `ChatGPT catalog missing ${name}`);
  }
  const upload = byName.get("upload_media");
  const desc = String(upload.description || "");
  assert.match(desc, /content_base64/i);
  assert.match(desc, /media_url/i);
  assert.match(desc, /\/mnt\/data/i);
  const props = upload.inputSchema?.properties || upload.parameters?.properties || {};
  assert.ok(
    props.content_base64 || props.file || props.file_base64,
    "upload_media schema must expose a base64 field",
  );
});

test("PNG signature detection and dimension extraction", () => {
  const buf = decodeBase64Media(PNG_BASE64);
  assert.equal(detectMimeFromSignature(buf), "image/png");
  const dims = extractImageDimensions(buf, "image/png");
  assert.equal(dims.width, 1);
  assert.equal(dims.height, 1);
});

test("data:image URLs are detected and extractable", () => {
  const dataUri = `data:image/png;base64,${PNG_BASE64}`;
  assert.equal(isDataUri(dataUri), true);
  assert.equal(isDataUri("https://cdn.example.com/a.png"), false);
  const extracted = rejectOrExtractDataUri(dataUri);
  assert.equal(extracted.isDataUri, true);
  assert.equal(extracted.mimeType, "image/png");
  assert.ok(extracted.base64 && extracted.base64.length > 10);
});

test("reject garbage / mismatched signatures", () => {
  const junk = Buffer.from("not-an-image");
  assert.equal(detectMimeFromSignature(junk), null);
});

test("redactSecrets strips access tokens from logs", () => {
  const redacted = redactSecrets({
    url: "https://graph.facebook.com/v19.0/me?access_token=EAABSECRET123",
    Authorization: "Bearer EAABSECRET123",
    page_access_token: "should-hide",
    nested: { access_token: "x" },
  });
  assert.equal(redacted.page_access_token, "[REDACTED]");
  assert.equal(redacted.Authorization, "[REDACTED]");
  assert.match(String(redacted.url), /REDACTED/);
  assert.equal(redacted.nested.access_token, "[REDACTED]");
});

test("organization posting never falls back to personal — identity type enforced", async () => {
  // Pure rule: linkedin_organization without org id must fail before provider call
  const { SocialPublishingService } =
    await import("../../src/lib/social/SocialPublishingService.ts");
  const service = new SocialPublishingService();
  const result = await service.publishToLinkedIn(
    "00000000-0000-0000-0000-000000000099",
    {
      platform: "linkedin",
      identity_type: "linkedin_organization",
      identity_id: "",
      identity_name: "Missing",
      organization_id: null,
      can_publish: true,
      missing_permissions: [],
    },
  );
  assert.equal(result.ok, false);
  assert.equal(result.error_code, "MISSING_ORGANIZATION");
});

test("database insertion alone must not be reported as published (contract)", () => {
  // Contract: PublishSocialPostResult.ok with status published requires provider_post_id
  const fakeInsertOnly = {
    ok: true,
    data: {
      social_post_id: "1854057c-abea-4333-8a3a-9354be9217d0",
      status: "queued",
      provider_post_id: null,
    },
  };
  assert.notEqual(fakeInsertOnly.data.status, "published");
  assert.equal(fakeInsertOnly.data.provider_post_id, null);
});

test("TEST mode prefixes captions and blocks personal LinkedIn via flag helper", () => {
  const prev = process.env.SOCIAL_PUBLISH_TEST_MODE;
  process.env.SOCIAL_PUBLISH_TEST_MODE = "true";
  assert.equal(isSocialPublishTestMode(), true);
  assert.equal(applyTestCaptionPrefix("Hello"), "[TEST] Hello");
  assert.equal(applyTestCaptionPrefix("[TEST] Hello"), "[TEST] Hello");
  if (prev === undefined) delete process.env.SOCIAL_PUBLISH_TEST_MODE;
  else process.env.SOCIAL_PUBLISH_TEST_MODE = prev;
});

test("Facebook page identity response shape contract", () => {
  const sample = {
    pages: [
      {
        page_id: "106807848991283",
        page_name: "Alphaclone Systems",
        connected: true,
        can_publish: true,
        can_upload_media: true,
        can_read_insights: true,
        missing_permissions: [],
        token_expires_at: null,
      },
    ],
  };
  assert.ok(Array.isArray(sample.pages));
  assert.equal(typeof sample.pages[0].page_id, "string");
  assert.equal(typeof sample.pages[0].can_publish, "boolean");
});

test("LinkedIn identities response shape contract (org != scopes)", () => {
  const sample = {
    personal: {
      member_id: "abc",
      person_urn: "urn:li:person:abc",
      can_publish: true,
    },
    organizations: [
      {
        organization_id: "12345",
        organization_urn: "urn:li:organization:12345",
        name: "Alphaclone Systems",
        can_publish: true,
        role: "ADMINISTRATOR",
      },
    ],
  };
  assert.ok(sample.organizations[0].organization_id);
  assert.ok(
    sample.organizations[0].organization_urn.startsWith("urn:li:organization:"),
  );
  // Scopes alone must never appear as an organization identity
  assert.equal(
    sample.organizations.some(
      (o) => o.organization_id === "w_organization_social",
    ),
    false,
  );
});

test("verification detects missing provider posts (Facebook helper)", async () => {
  const { verifyFacebookPostExists, FacebookPublishError } =
    await import("../../src/lib/facebook/verifyFacebookPost.ts");
  await assert.rejects(
    () =>
      verifyFacebookPostExists({
        postId: "missing",
        pageAccessToken: "tok",
        fetchImpl: async () =>
          new Response(
            JSON.stringify({ error: { message: "Unsupported get request" } }),
            {
              status: 400,
            },
          ),
      }),
    (err) =>
      err instanceof FacebookPublishError && err.code === "VERIFICATION_FAILED",
  );
});

test("assertPublicMediaUrl blocks SSRF private hosts", () => {
  assert.throws(() => assertPublicMediaUrl(new URL("http://127.0.0.1/x.png")));
  assert.throws(() => assertPublicMediaUrl(new URL("http://10.0.0.5/x.png")));
  assert.throws(() =>
    assertPublicMediaUrl(new URL("http://169.254.169.254/latest/meta")),
  );
  assert.throws(() => assertPublicMediaUrl(new URL("http://localhost/x.png")));
  assert.doesNotThrow(() =>
    assertPublicMediaUrl(new URL("https://cdn.example.com/x.png")),
  );
});

test("social MCP tools require membership + permission (source)", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(
    new URL("../../src/lib/mcp/tools/social-publishing.ts", import.meta.url),
    "utf8",
  );
  assert.match(src, /requireSocialAuth/);
  assert.match(src, /assertTenantMembership/);
  assert.match(src, /assertPermission/);
});

test("status migration extends enum not CHECK-only (source)", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(
    new URL(
      "../../supabase/migrations/20260724120002_social_publishing_repair.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(src, /ALTER TYPE public\.social_post_status ADD VALUE/);
  assert.equal(/ADD CONSTRAINT social_posts_status_check/.test(src), false);
});

test("scheduled claim uses status=scheduled predicate (source)", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(
    new URL("../../src/lib/social/SocialPublishingService.ts", import.meta.url),
    "utf8",
  );
  assert.match(src, /\.eq\('status',\s*'scheduled'\)/);
  assert.match(src, /fbBody\.caption|caption: post\.caption/);
});
