/**
 * Platform-wide multi-tenant isolation unit tests.
 */
import test from "node:test";
import assert from "node:assert/strict";

const {
  bindSessionTenant,
  assertRowTenant,
  tenantCacheKey,
  tenantStoragePath,
  assertCronRowTenantContext,
  assertTenantStoragePath,
  sanitizeTenantErrorMessage,
  PlatformTenantError,
  isUuid,
} = await import("../../src/lib/tenant/platformTenant.ts");

test("bindSessionTenant prefers session over client tenant", () => {
  assert.equal(
    bindSessionTenant({
      sessionTenantId: "11111111-1111-4111-8111-111111111111",
      clientTenantId: "22222222-2222-4222-8222-222222222222",
    }),
    "11111111-1111-4111-8111-111111111111",
  );
});

test("bindSessionTenant rejects client-only without allowClientFallback", () => {
  assert.throws(
    () =>
      bindSessionTenant({
        sessionTenantId: null,
        clientTenantId: "22222222-2222-4222-8222-222222222222",
      }),
    (err) =>
      err instanceof PlatformTenantError && err.code === "TENANT_REQUIRED",
  );
});

test("assertRowTenant hides cross-tenant existence", () => {
  assert.throws(
    () =>
      assertRowTenant(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "invoice",
      ),
    (err) => err instanceof PlatformTenantError && err.code === "NOT_FOUND",
  );
});

test("tenantCacheKey and tenantStoragePath require tenant prefix", () => {
  const tid = "11111111-1111-4111-8111-111111111111";
  assert.equal(
    tenantCacheKey(tid, "crm", "contacts"),
    `tenant:${tid}:crm:contacts`,
  );
  assert.match(
    tenantStoragePath(tid, "uploads", "resource-1", "a.pdf"),
    new RegExp(`^tenant/${tid}/uploads/resource-1/`),
  );
  assert.throws(() => tenantCacheKey("not-a-uuid", "x"), PlatformTenantError);
});

test("assertCronRowTenantContext quarantines missing tenant_id", () => {
  assert.throws(
    () => assertCronRowTenantContext({ id: "x", tenant_id: null }),
    (err) =>
      err instanceof PlatformTenantError && /quarantined/i.test(err.message),
  );
  assert.equal(
    assertCronRowTenantContext({
      id: "x",
      tenant_id: "11111111-1111-4111-8111-111111111111",
    }),
    "11111111-1111-4111-8111-111111111111",
  );
});

test("sanitizeTenantErrorMessage does not leak membership details", () => {
  assert.equal(
    sanitizeTenantErrorMessage(
      new PlatformTenantError("Not a member of this workspace", "NOT_A_MEMBER"),
    ),
    "Resource not found",
  );
});

test("MCPServer requireTenant no longer trusts args.tenant_id (source)", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(
    new URL("../../src/services/mcp/MCPServer.ts", import.meta.url),
    "utf8",
  );
  assert.match(src, /tenant_id from the model is not authoritative/);
  assert.equal(
    /args\.tenant_id[\s\S]{0,80}must be a valid workspace UUID/.test(src),
    false,
  );
});

test("defineConnectorTool requires session tenant (source)", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(
    new URL("../../src/lib/mcp/connector/defineTool.ts", import.meta.url),
    "utf8",
  );
  assert.match(src, /context\.tenantId/);
  assert.equal(
    src.includes("context.tenantId || (args as any).tenant_id"),
    false,
  );
});

test("MCP cookie fallback verifies membership (source)", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(
    new URL("../../src/app/api/mcp/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(src, /resolveActiveTenantForUser/);
  assert.match(src, /Hint is NEVER authoritative/);
});

test("file uploads use tenant-prefixed storage paths (source)", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(
    new URL("../../src/services/fileUploadService.ts", import.meta.url),
    "utf8",
  );
  assert.match(src, /tenantStoragePath/);
  assert.equal(src.includes("`${finalUserId as string}/${timestamp}"), false);
  assert.equal(src.includes("`${userId}/${timestamp}"), false);
});

test("storage proxy enforces tenant path prefix (source)", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(
    new URL(
      "../../src/app/api/storage/[bucket]/[...path]/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(src, /assertTenantStoragePath/);
  assert.match(src, /resolveActiveTenantForUser/);
});

test("connector permissions fail closed without membership (source)", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(
    new URL("../../src/lib/mcp/connector/permissions.ts", import.meta.url),
    "utf8",
  );
  assert.match(src, /Fail closed/);
  assert.equal(
    src.includes(
      "return { role: 'member', permissions: ROLE_PERMISSIONS.member };",
    ),
    false,
  );
});

test("assertTenantStoragePath rejects cross-tenant paths", () => {
  const tid = "11111111-1111-4111-8111-111111111111";
  assert.throws(
    () =>
      assertTenantStoragePath({
        filePath: `tenant/22222222-2222-4222-8222-222222222222/uploads/x/a.pdf`,
        tenantId: tid,
      }),
    (err) => err instanceof PlatformTenantError && err.code === "NOT_FOUND",
  );
  assert.doesNotThrow(() =>
    assertTenantStoragePath({
      filePath: `tenant/${tid}/uploads/x/a.pdf`,
      tenantId: tid,
    }),
  );
});

test("CacheKeys exposes tenant-scoped builders", async () => {
  const { CacheKeys } = await import("../../src/lib/cache/redis.ts");
  const tid = "11111111-1111-4111-8111-111111111111";
  assert.equal(
    CacheKeys.tenantApiResponse(tid, "crm", "q=1"),
    `tenant:${tid}:api:crm:q=1`,
  );
  assert.ok(isUuid(tid));
});
