import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { MCPTool, MCPToolExecutionResult } from '@/types/mcp';
import { mergeSessionArgs, sanitizeToolSchemaForClient } from '@/lib/mcp/sanitizeToolSchema';
import {
  isTransientToolError,
  resolveToolWorkaround,
  shouldChunkOutreach,
  sleep,
} from '@/lib/mcp/knownBrokenTools';
import { logMcpToolExecution, normalizeToolName } from '@/lib/mcp/mcpToolTelemetry';

const registry = new Map<string, MCPTool>();

export function registerTool<T extends z.ZodObject<any>>(
  moduleName: string,
  tool: MCPTool<T>
) {
  registry.set(tool.name, tool);
}

export function hasTool(name: string): boolean {
  return registry.has(name);
}

export function listTools(sanitizeForClient = false) {
  return Array.from(registry.values()).map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: sanitizeForClient
      ? sanitizeToolSchemaForClient(tool.jsonSchema as Record<string, unknown>)
      : tool.jsonSchema,
  }));
}

async function invokeToolHandler(
  tool: MCPTool,
  tenantId: string,
  userId: string,
  args: Record<string, any>
): Promise<MCPToolExecutionResult> {
  const validatedArgs = tool.inputSchema.parse(
    mergeSessionArgs(args, { tenantId, userId })
  );
  const rawResult = await tool.handler(validatedArgs, { tenantId, userId });

  if (rawResult && typeof rawResult === 'object' && 'content' in rawResult) {
    return rawResult as MCPToolExecutionResult;
  }
  const text = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult, null, 2);
  return { content: [{ type: 'text', text }] };
}

async function executeChunkedOutreach(
  tenantId: string,
  userId: string,
  toolName: string,
  args: Record<string, any>,
  chunkSize: number,
  listArg: string
): Promise<MCPToolExecutionResult> {
  const tool = registry.get(toolName);
  if (!tool) throw new Error(`Tool not found in registry: ${toolName}`);

  const leadIds = Array.isArray(args[listArg]) ? [...args[listArg]] : [];
  if (leadIds.length <= chunkSize) {
    return invokeToolHandler(tool, tenantId, userId, args);
  }

  const chunks: string[][] = [];
  for (let i = 0; i < leadIds.length; i += chunkSize) {
    chunks.push(leadIds.slice(i, i + chunkSize));
  }

  const results: unknown[] = [];
  for (const chunk of chunks) {
    const chunkArgs = { ...args, [listArg]: chunk };
    const chunkResult = await invokeToolHandler(tool, tenantId, userId, chunkArgs);
    if (chunkResult.isError) return chunkResult;
    results.push(chunkResult.content?.[0]?.text || chunkResult);
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        chunked: true,
        chunks: chunks.length,
        chunk_size: chunkSize,
        results,
      }, null, 2),
    }],
  };
}

export async function executeTool(
  tenantId: string,
  userId: string,
  toolName: string,
  args: Record<string, any>
): Promise<MCPToolExecutionResult> {
  const requestedTool = normalizeToolName(toolName);
  const startTime = Date.now();
  let success = false;
  let errorMessage: string | undefined;
  let resolvedToolName = requestedTool;

  try {
    const chunkConfig = shouldChunkOutreach(requestedTool);
    if (chunkConfig) {
      const result = await executeChunkedOutreach(
        tenantId,
        userId,
        requestedTool,
        args,
        chunkConfig.chunkSize,
        chunkConfig.listArg
      );
      success = !result.isError;
      if (result.isError) {
        errorMessage = result.content?.[0]?.text;
      }
      return result;
    }

    const resolved = resolveToolWorkaround(requestedTool, args);
    resolvedToolName = normalizeToolName(resolved.toolName);
    if (resolved.note) {
      console.info(`[tool-registry] ${resolved.note}`);
    }

    const tool = registry.get(resolvedToolName);
    if (!tool) {
      throw new Error(`Tool not found in registry: ${resolvedToolName}`);
    }

    let result: MCPToolExecutionResult;
    try {
      result = await invokeToolHandler(tool, tenantId, userId, resolved.args);
    } catch (firstErr: any) {
      const firstMessage = firstErr?.message || 'Unknown error';
      if (!isTransientToolError(firstMessage)) throw firstErr;
      await sleep(1000);
      result = await invokeToolHandler(tool, tenantId, userId, resolved.args);
    }

    success = !result.isError;
    if (result.isError) {
      errorMessage = result.content?.[0]?.text;
    }
    return result;
  } catch (err: any) {
    errorMessage = err.message || 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: true,
            message: errorMessage,
            tool: resolvedToolName,
            requested_tool: requestedTool,
          }),
        },
      ],
      isError: true,
    };
  } finally {
    const durationMs = Date.now() - startTime;
    await logMcpToolExecution({
      tenantId,
      userId,
      toolName: resolvedToolName,
      durationMs,
      success,
      errorMessage,
      metadata: requestedTool !== resolvedToolName ? { requested_tool: requestedTool } : {},
    });
  }
}

// ── Register all tools by importing the modules ────────────────────────────
// Note: We use require/dynamic imports or direct registrations inside the module files themselves.
// To resolve circular dependency warning, the registry modules can import and register.
// We will call an initialize function to register all tools.
let initialized = false;

/**
 * Load a tool module for registration. One broken module must NOT wipe the
 * entire tools/list — log the failure and continue with the rest.
 */
function loadToolModule(modulePath: string) {
  try {
    require(modulePath);
  } catch (err: any) {
    console.error(
      `[mcp.registry] Failed to register tools from ${modulePath}:`,
      err?.message || err
    );
  }
}

export function initializeRegistry() {
  if (initialized) return;
  initialized = true;

  // Statically import modules to register tools (per-module isolation)
  const modules = [
    './tools/crm',
    './tools/deals',
    './tools/projects',
    './tools/invoicing',
    './tools/contracts',
    './tools/outreach',
    './tools/social',
    './tools/workspace',
    './tools/messaging',
    './tools/gamification',
    './tools/video',
    './tools/files',
    './tools/facebook',
    './tools/ai-analytics',
    './tools/bonnie-dream',
    './tools/bonnie-orchestrate',
    './tools/bonnie-os',
    './tools/bonnie-outcomes',
    './tools/bonnie-approvals',
    './tools/bonnie-skills',
    './tools/google-workspace',
    './tools/microsoft',
    './tools/microsoft-diagnostics',
    './tools/x',
    './tools/accounting',
    './tools/campaigns',
    './tools/business-state',
    './tools/solo-owner',
    './tools/platform-advantage',
    './tools/api-health',
    './tools/documents',
    './tools/nexus-memory',
    // Connector / multi-client surface
    './tools/platform-ops',
    './tools/bonnie-inspect',
    './tools/crm-ops',
    './tools/social-ops',
    './tools/marketing-ops',
    './tools/sales-ops',
    './tools/calendar-ops',
    './tools/documents-ops',
    './tools/reports-ops',
    './tools/integrations-health',
    './tools/chatgpt-aliases',
    './tools/autonomous-ops',
    './tools/document-os',
  ];

  for (const mod of modules) {
    loadToolModule(mod);
  }

  console.info(`[mcp.registry] initialized with ${registry.size} tools`);
}
