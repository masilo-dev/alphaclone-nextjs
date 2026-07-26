/**
 * knownBrokenTools — redirect/block semantics for MCP tool registry.
 */
import test from "node:test";
import assert from "node:assert/strict";

const {
  resolveToolWorkaround,
  isAutomationBlockedTool,
  getBrokenToolConfig,
} = await import("../../src/lib/mcp/knownBrokenTools.ts");

test("block_automation does not throw for interactive MCP calls", () => {
  assert.equal(isAutomationBlockedTool("create_deal"), true);
  const resolved = resolveToolWorkaround("create_deal", {
    name: "Acme",
    value: 10,
  });
  assert.equal(resolved.toolName, "create_deal");
  assert.equal(resolved.redirected, false);
  assert.equal(resolved.args.name, "Acme");
});

test("schedule_social_post is not redirected (handler maps args itself)", () => {
  assert.equal(getBrokenToolConfig("schedule_social_post"), null);
  const resolved = resolveToolWorkaround("schedule_social_post", {
    platform: "linkedin",
    content: "hello",
    scheduled_at: "2030-01-01T00:00:00.000Z",
  });
  assert.equal(resolved.toolName, "schedule_social_post");
  assert.equal(resolved.redirected, false);
  assert.equal(resolved.args.content, "hello");
  assert.equal(resolved.args.platform, "linkedin");
});

test("block_with_hint still throws", () => {
  assert.throws(
    () => resolveToolWorkaround("gmail_send_email", {}),
    /known_broken_tool/,
  );
});
