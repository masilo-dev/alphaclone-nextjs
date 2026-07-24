import test from "node:test";
import assert from "node:assert/strict";
import {
  isChatgptClient,
  CHATGPT_CONNECTOR_TOOL_NAMES,
} from "../../src/lib/mcp/toolAnnotations.ts";
import {
  invalidateUnifiedMcpToolCache,
  getUnifiedMcpTools,
} from "../../src/lib/mcp/listAllTools.ts";

test("alphaclone-mcp-client is NOT treated as ChatGPT (fixes Claude empty tools)", () => {
  assert.equal(
    isChatgptClient({
      clientId: "alphaclone-mcp-client",
      clientLabel: null,
      userAgent: null,
    }),
    false,
  );
  assert.equal(isChatgptClient({ userAgent: "Claude-User/1.0" }), false);
  assert.equal(isChatgptClient({ clientLabel: "anthropic-claude" }), false);
  assert.equal(isChatgptClient({ clientId: "cursor-ide" }), false);
});

test("ChatGPT connector clients are still detected for curated catalog", () => {
  assert.equal(
    isChatgptClient({ clientId: "chatgpt-connector", userAgent: "ChatGPT" }),
    true,
  );
  // Labels/UA alone must NOT flip curated mode — registration id does
  assert.equal(isChatgptClient({ clientLabel: "OpenAI Apps Connector" }), false);
  assert.ok(CHATGPT_CONNECTOR_TOOL_NAMES.length > 20);
});

test("ToolPolicyGate enforces human oversight for high-risk tools (source)", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(
    new URL("../../src/lib/ai/ToolPolicyGate.ts", import.meta.url),
    "utf8",
  );
  assert.match(src, /queue_approval/);
  assert.match(src, /dpa_acceptances/);
  assert.equal(/INTENTIONALLY DISABLED/.test(src), false);
  assert.match(src, /requiresApproval/);
});

test("unified tools/list returns non-empty full catalog for Claude-like clients", async () => {
  invalidateUnifiedMcpToolCache();
  const tools = await getUnifiedMcpTools({
    sanitizeForClient: false,
    forceRefresh: true,
    clientId: "alphaclone-mcp-client",
    clientLabel: "claude.ai",
    userAgent: "Claude-User",
  });
  assert.ok(tools.length > 50, `expected full catalog, got ${tools.length}`);
  const names = new Set(tools.map((t) => t.name));
  // Core tools that must remain exposed (do not delete/rename)
  for (const required of [
    "create_lead",
    "create_post",
    "search_leads",
    "list_leads",
  ]) {
    assert.ok(names.has(required), `missing required tool ${required}`);
  }
});
