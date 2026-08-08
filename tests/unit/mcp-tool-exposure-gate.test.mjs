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

test("unified tools/list exposes bounded progressive catalog by default", async () => {
  invalidateUnifiedMcpToolCache();
  const tools = await getUnifiedMcpTools({
    sanitizeForClient: false,
    forceRefresh: true,
    clientId: "alphaclone-mcp-client",
    clientLabel: "internal",
    userAgent: null,
  });
  const { initializeRegistry, listTools } = await import("../../src/lib/mcp/tool-registry.ts");
  initializeRegistry();
  const registryNames = new Set(listTools(false).map((tool) => tool.name));
  const names = new Set(tools.map((t) => t.name));
  assert.ok(tools.length < registryNames.size, `expected progressive catalog smaller than ${registryNames.size}, got ${tools.length}`);
  for (const required of [
    "search_tools",
    "load_module_tools",
    "search_leads",
    "list_modules",
  ]) {
    assert.ok(names.has(required), `missing required tool ${required}`);
  }
});

test("module loading adds executable tools for that module", async () => {
  invalidateUnifiedMcpToolCache();
  const tools = await getUnifiedMcpTools({
    sanitizeForClient: true,
    forceRefresh: true,
    clientId: "chatgpt-connector",
    loadedModules: ["social"],
  });
  const { initializeRegistry, listTools } = await import("../../src/lib/mcp/tool-registry.ts");
  initializeRegistry();
  const registered = listTools(false);
  const discoveredNames = new Set(tools.map((tool) => tool.name));
  const names = new Set(tools.map((t) => t.name));
  for (const required of [
    "search_tools",
    "load_module_tools",
    "list_capabilities",
    "upload_media",
    "get_social_identities",
    "publish_social_post",
    "verify_social_post_published",
  ]) {
    assert.ok(names.has(required), `missing platform tool ${required}`);
  }
  assert.ok(tools.length < registered.length, `loaded module should not expose every registered tool`);
  // Compaction: property descriptions should be stripped on discovery schemas
  const sample = tools.find((t) => t.name === "search_leads") || tools[0];
  const props = sample?.inputSchema?.properties || {};
  for (const prop of Object.values(props)) {
    assert.equal(prop?.description, undefined);
  }
});

test("full catalog remains available only for explicit internal audit mode", async () => {
  invalidateUnifiedMcpToolCache();
  const tools = await getUnifiedMcpTools({
    sanitizeForClient: true,
    forceRefresh: true,
    clientId: null,
    catalogMode: "full",
  });
  const { initializeRegistry, listTools } = await import("../../src/lib/mcp/tool-registry.ts");
  initializeRegistry();
  assert.ok(tools.length >= listTools(false).length, `full catalog omitted registered tools`);
});
