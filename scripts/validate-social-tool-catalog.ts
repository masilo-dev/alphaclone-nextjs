/**
 * Catalog consistency: registry handlers must match tools/list and inspect_tools.
 * Fail deployment if a registered tool lacks a handler or inspect advertises
 * tools missing from tools/list.
 *
 * Usage: npx tsx scripts/validate-social-tool-catalog.ts
 */
import { createRequire } from 'node:module';

// CLI/tsx loads tool modules outside Next — stub before any server-only imports.
createRequire(import.meta.url)('./stub-server-only.cjs');

import { initializeRegistry, listTools, hasTool } from '../src/lib/mcp/tool-registry';
import { getUnifiedMcpTools, invalidateUnifiedMcpToolCache } from '../src/lib/mcp/listAllTools';
import { CANONICAL_SOCIAL_MCP_TOOLS } from '../src/lib/social/types';
import { MCP_TOOL_CATALOG_VERSION } from '../src/lib/mcp/standardResponse';

async function main() {
  initializeRegistry();
  invalidateUnifiedMcpToolCache();

  const registryTools = listTools(false);
  const registryNames = new Set(registryTools.map((t) => t.name));

  const fullList = await getUnifiedMcpTools({
    sanitizeForClient: false,
    forceRefresh: true,
    forChatGPT: false,
  });
  const fullNames = new Set(fullList.map((t) => t.name));

  const chatgptList = await getUnifiedMcpTools({
    sanitizeForClient: false,
    forceRefresh: true,
    forChatGPT: true,
    clientId: 'chatgpt-connector',
    userAgent: 'ChatGPT',
  });
  const chatgptNames = new Set(chatgptList.map((t) => t.name));

  const errors: string[] = [];

  for (const name of CANONICAL_SOCIAL_MCP_TOOLS) {
    if (!hasTool(name) && !fullNames.has(name)) {
      errors.push(`Canonical tool missing from registry and tools/list: ${name}`);
    }
    if (!fullNames.has(name)) {
      errors.push(`Canonical tool missing from tools/list: ${name}`);
    }
    if (!chatgptNames.has(name)) {
      errors.push(`Canonical tool missing from ChatGPT curated tools/list: ${name}`);
    }
  }

  // inspect_tools uses full catalog; every registry tool must be listable
  for (const name of registryNames) {
    if (!fullNames.has(name)) {
      errors.push(`Registry tool not in tools/list: ${name}`);
    }
  }

  // Every tools/list entry that is in registry must have a handler (hasTool)
  for (const tool of fullList) {
    if (registryNames.has(tool.name) && !hasTool(tool.name)) {
      errors.push(`tools/list entry lacks callable registry handler: ${tool.name}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        tool_catalog_version: MCP_TOOL_CATALOG_VERSION,
        registry_count: registryTools.length,
        tools_list_count: fullList.length,
        chatgpt_list_count: chatgptList.length,
        canonical_social_required: CANONICAL_SOCIAL_MCP_TOOLS.length,
        ok: errors.length === 0,
        errors,
      },
      null,
      2
    )
  );

  if (errors.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
