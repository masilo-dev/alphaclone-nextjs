/**
 * Universal Manifest Bridge — Ensures 100% of canonical tools in toolManifest.ts
 * and supplementalToolDefinitions.ts are registered, discoverable, and executable.
 *
 * This module runs last in initializeRegistry() to pick up any tools from the
 * static manifest that were not registered by a dedicated domain module.
 * Each bridge tool routes execution through the existing MCPServer switch via
 * the route.ts POST handler, giving full parity with the legacy execution path.
 */

import { z } from 'zod';
import { registerTool, hasTool } from '@/lib/mcp/tool-registry';
import { MCP_TOOLS } from '@/services/mcp/toolManifest';
import { SUPPLEMENTAL_MCP_TOOLS } from '@/lib/mcp/supplementalToolDefinitions';
import { okResult, toMcpContent } from '@/lib/mcp/connector/response';


function jsonSchemaToZod(jsonSchema: Record<string, unknown> | undefined): z.ZodObject<any> {
  const schema = (jsonSchema || {}) as { properties?: Record<string, any>; required?: string[] };
  const properties = schema.properties || {};
  const required = new Set(schema.required || []);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, prop] of Object.entries<any>(properties)) {
    let fieldSchema: z.ZodTypeAny;

    switch (prop?.type) {
      case 'string':
        fieldSchema = z.string();
        break;
      case 'number':
      case 'integer':
        fieldSchema = z.number();
        break;
      case 'boolean':
        fieldSchema = z.boolean();
        break;
      case 'array':
        fieldSchema = z.array(z.unknown());
        break;
      case 'object':
        fieldSchema = z.record(z.string(), z.unknown());
        break;
      default:
        fieldSchema = z.unknown();
    }

    if (!required.has(key)) {
      fieldSchema = fieldSchema.optional();
    }

    shape[key] = fieldSchema;
  }

  return z.object(shape).passthrough();
}

/**
 * Register all unmapped manifest & supplemental tools into the tool registry.
 * Tools that already have a dedicated handler (registered by domain modules)
 * are skipped — the bridge only fills genuine gaps.
 */
export function registerManifestBridgeTools() {
  const allManifestTools = [...MCP_TOOLS, ...SUPPLEMENTAL_MCP_TOOLS];

  let bridgedCount = 0;
  for (const toolDef of allManifestTools) {
    if (!toolDef?.name || hasTool(toolDef.name)) {
      continue;
    }

    const zodSchema = jsonSchemaToZod(
      (toolDef.inputSchema ?? {}) as Record<string, unknown>
    );

    registerTool('manifest-bridge', {
      name: toolDef.name,
      description: toolDef.description || '',
      jsonSchema: {
        type: 'object' as const,
        properties: ((toolDef.inputSchema as any)?.properties ?? {}) as Record<string, any>,
        required: ((toolDef.inputSchema as any)?.required ?? []) as string[],
      },
      inputSchema: zodSchema,
      handler: async (args: Record<string, unknown>, ctx: { tenantId: string; userId: string }) => {
        // Bridge handler: executes via the canonical MCPServer execution path.
        let mcpServerError: string | null = null;
        try {
          const { createMCPServer } = await import('@/services/mcp/MCPServer');
          const { createSupabaseAdminClient } = await import('@/lib/supabase-admin');
          const server = createMCPServer({ tenantId: ctx.tenantId, userId: ctx.userId });
          const supabase = createSupabaseAdminClient();
          const legacyResult = await (server as any).executeToolInternal(
            toolDef.name,
            { ...args, tenant_id: ctx.tenantId, user_id: ctx.userId },
            crypto.randomUUID(),
            supabase
          );
          if (legacyResult) return legacyResult;
        } catch (err: any) {
          mcpServerError = err?.message || String(err);
          console.error(`[manifest-bridge] ${toolDef.name} MCPServer error:`, mcpServerError);
        }

        // MCPServer returned nothing or errored — return structured not_configured
        // so ChatGPT can surface the real issue instead of showing fake success.
        const isOAuthRequired = /oauth|not connected|not configured|missing token|no account/i.test(mcpServerError || '');
        console.warn(`[manifest-bridge] ${toolDef.name} has no real handler — returning not_configured`);
        return toMcpContent(
          okResult(toolDef.name, {
            status: isOAuthRequired ? 'requires_oauth' : 'not_configured',
            tool: toolDef.name,
            tenant_id: ctx.tenantId,
            message: isOAuthRequired
              ? `${toolDef.name} requires an OAuth connection. Please connect the relevant integration in your AlphaClone workspace settings.`
              : `${toolDef.name} is not yet fully configured for this workspace. Check your AlphaClone integrations or contact support.`,
            ...(mcpServerError ? { debug_error: mcpServerError } : {}),
            timestamp: new Date().toISOString(),
          })
        );
      },
    });
    bridgedCount++;
  }

  if (bridgedCount > 0) {
    console.info(`[mcp.registry] manifest-bridge registered ${bridgedCount} additional tools`);
  }
}

// Auto-run registration when module is required
registerManifestBridgeTools();
