import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { MCPTool, MCPToolExecutionResult } from '@/types/mcp';
import { mergeSessionArgs, sanitizeToolSchemaForClient } from '@/lib/mcp/sanitizeToolSchema';
import { resolveMcpToolName } from '@/lib/mcp/canonicalToolRegistry';
import { normalizeToolArguments } from '@/lib/mcp/normalizeToolArguments';
import {
  isTransientToolError,
  resolveToolWorkaround,
  shouldChunkOutreach,
  sleep,
} from '@/lib/mcp/knownBrokenTools';
import { logMcpToolExecution, normalizeToolName } from '@/lib/mcp/mcpToolTelemetry';
import {
  formatQuotaExceededError,
  formatToolExecutionError,
  structuredErrorToMcpContent,
} from '@/lib/mcp/formatMcpError';

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
  const normalizedArgs = await normalizeToolArguments(tool.name, args, { tenantId, userId });
  const validatedArgs = tool.inputSchema.parse(
    mergeSessionArgs(normalizedArgs, { tenantId, userId })
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

import type { QuotaResourceType } from '@/services/quotaService';
import {
  determinePrimaryQuotaMetric,
  getBulkProjectedAmount,
  isBulkMeteredTool,
  parseBulkSucceededCount,
  shouldPreChargeMcpExecution,
} from '@/lib/mcp/toolQuotaPolicy';
import {
  recordSuccessfulUsage,
  validateProjectedUsage,
} from '@/lib/entitlements/meteringService';

export async function executeTool(
  tenantId: string,
  userId: string,
  toolName: string,
  args: Record<string, any>
): Promise<MCPToolExecutionResult> {
  const requestedTool = resolveMcpToolName(normalizeToolName(toolName));
  const startTime = Date.now();
  let success = false;
  let errorMessage: string | undefined;
  let resolvedToolName = requestedTool;
  let executionResult: MCPToolExecutionResult | undefined;

  const primaryMetric = determinePrimaryQuotaMetric(requestedTool);
  const bulkProjected = isBulkMeteredTool(requestedTool)
    ? getBulkProjectedAmount(requestedTool, args)
    : 0;
  const validateAmount = bulkProjected > 0 ? bulkProjected : 1;
  const idempotencyKey =
    typeof args.idempotency_key === 'string' ? args.idempotency_key.trim() : undefined;

  try {
    if (shouldPreChargeMcpExecution(requestedTool) && primaryMetric) {
      const projected = await validateProjectedUsage(
        tenantId,
        userId,
        primaryMetric,
        isBulkMeteredTool(requestedTool) ? validateAmount : 1,
      );
      if (!projected.allowed) {
        errorMessage = projected.reason || 'Daily quota would be exceeded';
        const quotaError = formatQuotaExceededError(requestedTool, {
          category: primaryMetric,
          used: projected.currentUsage ?? 0,
          limit: projected.limit ?? 0,
          message: errorMessage,
        });
        return structuredErrorToMcpContent(quotaError);
      }
    }

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
      executionResult = result;
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
    } else if (primaryMetric && shouldPreChargeMcpExecution(requestedTool)) {
      const resultText = result.content?.[0]?.text;
      const succeededCount = isBulkMeteredTool(requestedTool)
        ? parseBulkSucceededCount(requestedTool, resultText)
        : 1;
      if (succeededCount > 0) {
        await recordSuccessfulUsage({
          tenantId,
          userId,
          resource: primaryMetric,
          amount: succeededCount,
          operationId: idempotencyKey
            ? `${requestedTool}:${idempotencyKey}`
            : undefined,
          initiationSource: 'mcp_registry',
          metadata: { tool: requestedTool, succeededCount },
        });
      }
    }
    executionResult = result;
    return result;
  } catch (err: any) {
    const structured = formatToolExecutionError(resolvedToolName, err);
    errorMessage = structured.error.message;
    return structuredErrorToMcpContent(structured);
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

    if (userId) {
      const { notifyAfterMcpToolExecution } = await import('@/lib/notifications/mcpToolNotificationHook');
      void notifyAfterMcpToolExecution({
        tenantId,
        userId,
        toolName: resolvedToolName,
        args,
        success,
        resultContent: executionResult?.content,
        errorMessage,
      }).catch(() => undefined);
    }
  }
}

// ── Register all tools by importing the modules ────────────────────────────
// IMPORTANT: webpack/Next.js production bundles cannot resolve `require(variable)`.
// Each module path MUST be a static string literal so it is included in the bundle.
// Per-module try/catch keeps one broken module from wiping the entire tools/list.
let initialized = false;

function loadToolModule(loader: () => unknown, label: string) {
  try {
    loader();
  } catch (err: any) {
    console.error(
      `[mcp.registry] Failed to register tools from ${label}:`,
      err?.message || err
    );
  }
}

export function initializeRegistry() {
  if (initialized) return;
  initialized = true;

  loadToolModule(() => require('./tools/crm'), './tools/crm');
  loadToolModule(() => require('./tools/deals'), './tools/deals');
  loadToolModule(() => require('./tools/projects'), './tools/projects');
  loadToolModule(() => require('./tools/invoicing'), './tools/invoicing');
  loadToolModule(() => require('./tools/contracts'), './tools/contracts');
  loadToolModule(() => require('./tools/outreach'), './tools/outreach');
  loadToolModule(() => require('./tools/social'), './tools/social');
  loadToolModule(() => require('./tools/workspace'), './tools/workspace');
  loadToolModule(() => require('./tools/messaging'), './tools/messaging');
  loadToolModule(() => require('./tools/gamification'), './tools/gamification');
  loadToolModule(() => require('./tools/video'), './tools/video');
  loadToolModule(() => require('./tools/files'), './tools/files');
  loadToolModule(() => require('./tools/facebook'), './tools/facebook');
  loadToolModule(() => require('./tools/ai-analytics'), './tools/ai-analytics');
  loadToolModule(() => require('./tools/bonnie-dream'), './tools/bonnie-dream');
  loadToolModule(() => require('./tools/bonnie-orchestrate'), './tools/bonnie-orchestrate');
  loadToolModule(() => require('./tools/bonnie-os'), './tools/bonnie-os');
  loadToolModule(() => require('./tools/bonnie-outcomes'), './tools/bonnie-outcomes');
  loadToolModule(() => require('./tools/bonnie-approvals'), './tools/bonnie-approvals');
  loadToolModule(() => require('./tools/bonnie-skills'), './tools/bonnie-skills');
  loadToolModule(() => require('./tools/google-workspace'), './tools/google-workspace');
  loadToolModule(() => require('./tools/microsoft'), './tools/microsoft');
  loadToolModule(() => require('./tools/microsoft-diagnostics'), './tools/microsoft-diagnostics');
  loadToolModule(() => require('./tools/x'), './tools/x');
  loadToolModule(() => require('./tools/accounting'), './tools/accounting');
  loadToolModule(() => require('./tools/campaigns'), './tools/campaigns');
  loadToolModule(() => require('./tools/business-state'), './tools/business-state');
  loadToolModule(() => require('./tools/solo-owner'), './tools/solo-owner');
  loadToolModule(() => require('./tools/platform-advantage'), './tools/platform-advantage');
  loadToolModule(() => require('./tools/api-health'), './tools/api-health');
  loadToolModule(() => require('./tools/documents'), './tools/documents');
  loadToolModule(() => require('./tools/nexus-memory'), './tools/nexus-memory');
  // Connector / multi-client surface
  loadToolModule(() => require('./tools/platform-ops'), './tools/platform-ops');
  loadToolModule(() => require('./tools/operations-ops'), './tools/operations-ops');
  loadToolModule(() => require('./tools/bonnie-inspect'), './tools/bonnie-inspect');
  loadToolModule(() => require('./tools/crm-ops'), './tools/crm-ops');
  loadToolModule(() => require('./tools/bulk-operations'), './tools/bulk-operations');
  loadToolModule(() => require('./tools/social-ops'), './tools/social-ops');
  loadToolModule(() => require('./tools/marketing-ops'), './tools/marketing-ops');
  loadToolModule(() => require('./tools/sales-ops'), './tools/sales-ops');
  loadToolModule(() => require('./tools/calendar-ops'), './tools/calendar-ops');
  loadToolModule(() => require('./tools/documents-ops'), './tools/documents-ops');
  loadToolModule(() => require('./tools/revenue-lifecycle'), './tools/revenue-lifecycle');
  loadToolModule(() => require('./tools/reports-ops'), './tools/reports-ops');
  loadToolModule(() => require('./tools/integrations-health'), './tools/integrations-health');
  loadToolModule(() => require('./tools/chatgpt-aliases'), './tools/chatgpt-aliases');
  loadToolModule(() => require('./tools/autonomous-ops'), './tools/autonomous-ops');
  loadToolModule(() => require('./tools/email-ops'), './tools/email-ops');
  loadToolModule(() => require('./tools/document-os'), './tools/document-os');
  loadToolModule(() => require('./tools/discovery-system'), './tools/discovery-system');
  loadToolModule(() => require('./tools/banking-ops'), './tools/banking-ops');
  loadToolModule(() => require('./tools/contracts-ops'), './tools/contracts-ops');
  loadToolModule(() => require('./tools/tickets-ops'), './tools/tickets-ops');
  loadToolModule(() => require('./tools/lead-scraping-ops'), './tools/lead-scraping-ops');
  loadToolModule(() => require('./tools/gap-tools-finance'), './tools/gap-tools-finance');
  loadToolModule(() => require('./tools/gap-tools-crm'), './tools/gap-tools-crm');
  loadToolModule(() => require('./tools/gap-tools-email-social'), './tools/gap-tools-email-social');
  loadToolModule(() => require('./tools/gap-tools-contracts-strategy'), './tools/gap-tools-contracts-strategy');
  // Universal Manifest Bridge — registers all remaining canonical tools from toolManifest & supplemental definitions
  loadToolModule(() => require('./tools/manifest-bridge'), './tools/manifest-bridge');
  // Canonical social publishing — MUST load last so it overrides legacy stubs
  // (publish_post wrappers, upload_media, get_*_identities, create_social_post).
  loadToolModule(() => require('./tools/social-publishing'), './tools/social-publishing');

  console.info(`[mcp.registry] initialized with ${registry.size} tools`);
}
