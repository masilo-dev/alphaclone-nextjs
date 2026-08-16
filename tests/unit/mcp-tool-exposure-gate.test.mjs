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
  for (const name of [
    "list_tools",
    "list_modules",
    "list_capabilities",
    "search_tools",
    "load_module_tools",
    "dispatch_tool",
    "execute_action",
  ]) {
    assert.ok(
      CHATGPT_CONNECTOR_TOOL_NAMES.includes(name),
      `ChatGPT connector missing discovery gateway ${name}`,
    );
  }
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

test("unified tools/list exposes the full executable catalog by default", async () => {
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
  assert.ok(tools.length >= registryNames.size, `expected full catalog with at least ${registryNames.size} tools, got ${tools.length}`);
  for (const registered of registryNames) {
    assert.ok(names.has(registered), `default tools/list missing registered tool ${registered}`);
  }
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
    catalogMode: "progressive",
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

  for (const tool of tools) {
    assert.ok(
      registered.some((registeredTool) => registeredTool.name === tool.name) ||
        ["search", "fetch", "list_tools", "list_modules", "list_capabilities", "search_tools", "load_module_tools"].includes(tool.name),
      `loaded tool ${tool.name} is discoverable but not executable`,
    );
  }

  const uploadMedia = registered.find((tool) => tool.name === "upload_media");
  assert.ok(uploadMedia, "upload_media must be registered as an executable tool");
  for (const field of ["content_base64", "file_base64", "data_url", "url"]) {
    assert.ok(uploadMedia.inputSchema.properties[field], `upload_media missing ${field}`);
  }

  // Compaction: property descriptions should be stripped on discovery schemas
  const sample = tools.find((t) => t.name === "search_leads") || tools[0];
  const props = sample?.inputSchema?.properties || {};
  for (const prop of Object.values(props)) {
    assert.equal(prop?.description, undefined);
  }
});

test("search_tools intent can discover upload_media before loading media tools", async () => {
  invalidateUnifiedMcpToolCache();
  const full = await getUnifiedMcpTools({
    sanitizeForClient: false,
    forceRefresh: true,
    catalogMode: "full",
  });
  const { searchToolCatalog, moduleForTool } = await import("../../src/lib/mcp/progressiveDiscovery.ts");
  const matches = searchToolCatalog(full, { query: "upload image", limit: 10 });
  assert.ok(
    matches.some((tool) => tool.name === "upload_media"),
    `upload_media missing from upload image search results: ${matches.map((tool) => tool.name).join(", ")}`,
  );
  assert.equal(moduleForTool("upload_media"), "media");
});

test("every progressive module exposes only executable routed tools", async () => {
  invalidateUnifiedMcpToolCache();
  const { initializeRegistry, listTools } = await import("../../src/lib/mcp/tool-registry.ts");
  const { MODULE_KEYWORDS } = await import("../../src/lib/mcp/progressiveDiscovery.ts");
  initializeRegistry();

  const executable = new Set([
    ...listTools(false).map((tool) => tool.name),
    "search",
    "fetch",
    "list_tools",
    "list_modules",
    "list_capabilities",
    "search_tools",
    "load_module_tools",
  ]);

  for (const moduleName of Object.keys(MODULE_KEYWORDS)) {
    const tools = await getUnifiedMcpTools({
      sanitizeForClient: true,
      forceRefresh: true,
      catalogMode: "progressive",
      loadedModules: [moduleName],
    });
    const nonExecutable = tools
      .map((tool) => tool.name)
      .filter((name) => !executable.has(name));
    assert.deepEqual(nonExecutable, [], `${moduleName} exposed non-executable tools`);
  }
});

test("credentialed ChatGPT MCP audit scripts exist and default to non-destructive dry-run", async () => {
  const fs = await import("node:fs");
  const inventory = fs.readFileSync(
    new URL("../../scripts/generate-mcp-tool-inventory.ts", import.meta.url),
    "utf8",
  );
  const execution = fs.readFileSync(
    new URL("../../scripts/chatgpt-mcp-execution-audit.ts", import.meta.url),
    "utf8",
  );
  assert.match(inventory, /mcp-canonical-tool-inventory\.json/);
  assert.match(inventory, /executable_status/);
  assert.match(execution, /chatgpt-mcp-execution-audit\.json/);
  assert.match(execution, /--execute-read-tools/);
  assert.match(execution, /--execute-write-tools/);
  assert.match(execution, /skipped_destructive/);
});

test("progressive catalog remains available only for explicit compatibility mode", async () => {
  invalidateUnifiedMcpToolCache();
  const progressive = await getUnifiedMcpTools({
    sanitizeForClient: true,
    forceRefresh: true,
    clientId: null,
    catalogMode: "progressive",
  });
  const full = await getUnifiedMcpTools({
    sanitizeForClient: true,
    forceRefresh: true,
    clientId: null,
  });
  const { initializeRegistry, listTools } = await import("../../src/lib/mcp/tool-registry.ts");
  initializeRegistry();
  assert.ok(full.length >= listTools(false).length, `default full catalog omitted registered tools`);
  assert.ok(progressive.length < full.length, `explicit progressive catalog should be smaller than full catalog`);
});
