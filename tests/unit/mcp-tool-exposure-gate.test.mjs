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
  assert.equal(
    isChatgptClient({ clientLabel: "OpenAI Apps Connector" }),
    false,
  );
  assert.ok(CHATGPT_CONNECTOR_TOOL_NAMES.length > 20);
});

test("ToolPolicyGate enforces human oversight for high-risk tools (source)", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(
    new URL("../../src/lib/ai/ToolPolicyGate.ts", import.meta.url),
    "utf8",
  );
  assert.match(src, /queue_approval/);
  assert.match(src, /source === 'mcp' \|\| source === 'bonnie'/);
  assert.equal(/INTENTIONALLY DISABLED/.test(src), false);
  assert.match(src, /requiresApproval/);
});

test("unified tools/list returns bounded progressive catalog for internal client", async () => {
  invalidateUnifiedMcpToolCache();
  const tools = await getUnifiedMcpTools({
    sanitizeForClient: false,
    forceRefresh: true,
    clientId: "alphaclone-mcp-client",
    clientLabel: "internal",
    userAgent: null,
  });
  assert.ok(tools.length >= 20 && tools.length <= 40, `expected 20-40 core tools, got ${tools.length}`);
  const names = new Set(tools.map((t) => t.name));
  for (const required of [
    "search_tools",
    "load_module_tools",
    "search_leads",
    "list_modules",
  ]) {
    assert.ok(names.has(required), `missing required tool ${required}`);
  }
});

test("Claude OAuth client gets compacted progressive catalog", async () => {
  invalidateUnifiedMcpToolCache();
  const tools = await getUnifiedMcpTools({
    sanitizeForClient: true,
    forceRefresh: true,
    clientId: "1778309945386-41bab8272f61",
    clientLabel: "claude.ai",
    userAgent: "Claude-User",
  });
  assert.ok(
    tools.length >= 20 && tools.length <= 40,
    `expected progressive platform catalog, got ${tools.length}`,
  );
  const names = new Set(tools.map((t) => t.name));
  for (const required of [
    "search_tools",
    "search_leads",
    "load_module_tools",
    "list_capabilities",
  ]) {
    assert.ok(names.has(required), `missing platform tool ${required}`);
  }
  // Compaction: property descriptions should be stripped on discovery schemas
  const sample = tools.find((t) => t.name === "search_leads") || tools[0];
  const props = sample?.inputSchema?.properties || {};
  for (const prop of Object.values(props)) {
    assert.equal(prop?.description, undefined);
  }
});

test("API-key path also gets progressive catalog by default", async () => {
  invalidateUnifiedMcpToolCache();
  const tools = await getUnifiedMcpTools({
    sanitizeForClient: true,
    forceRefresh: true,
    clientId: null,
  });
  assert.ok(
    tools.length >= 20 && tools.length <= 40,
    `expected progressive platform default, got ${tools.length}`,
  );
});
