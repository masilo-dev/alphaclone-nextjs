/**
 * Ensures MCP tool modules load via static require paths (webpack-safe)
 * and that connector tools like get_platform_status are registered.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const registryPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/lib/mcp/tool-registry.ts",
);

describe("mcp tool-registry production loading", () => {
  it("uses static require() string literals (not require(variable))", () => {
    const source = readFileSync(registryPath, "utf8");
    assert.match(source, /require\('\.\/tools\/platform-ops'\)/);
    assert.match(source, /require\('\.\/tools\/document-os'\)/);
    assert.match(source, /require\('\.\/tools\/bulk-operations'\)/);
    assert.match(source, /require\('\.\/tools\/social-publishing'\)/);
    assert.doesNotMatch(
      source,
      /require\(modulePath\)|require\(mod\)|require\(modules\[/,
    );
  });

  it("registers get_platform_status and core CRM tools", async () => {
    // Dynamic import via tsx so side-effect module registration runs.
    const { initializeRegistry, hasTool, listTools } =
      await import("../../src/lib/mcp/tool-registry.ts");
    initializeRegistry();
    const names = listTools().map((t) => t.name);
    assert.ok(names.length > 50, `expected many tools, got ${names.length}`);
    assert.equal(hasTool("get_platform_status"), true);
    assert.equal(hasTool("get_clients"), true);
    assert.equal(hasTool("search_leads"), true);
    assert.equal(hasTool("get_social_identities"), true);
    assert.equal(hasTool("publish_post"), true);
    assert.equal(hasTool("bulk_update_records"), true);
    assert.equal(hasTool("bulk_upload_media"), true);
    assert.equal(hasTool("send_bulk_email"), true);
  });
});
