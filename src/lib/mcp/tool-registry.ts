import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { MCPTool, MCPToolExecutionResult } from '@/types/mcp';

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

export function listTools() {
  return Array.from(registry.values()).map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.jsonSchema,
  }));
}

export async function executeTool(
  tenantId: string,
  userId: string,
  toolName: string,
  args: Record<string, any>
): Promise<MCPToolExecutionResult> {
  const tool = registry.get(toolName);
  if (!tool) {
    throw new Error(`Tool not found in registry: ${toolName}`);
  }

  const startTime = Date.now();
  let success = false;
  let errorMessage: string | undefined;

  try {
    // 1. Validate input schema using Zod
    const validatedArgs = tool.inputSchema.parse({
      ...args,
      tenant_id: tenantId, // Enforce tenant_id
    });

    // 2. Call handler
    const rawResult = await tool.handler(validatedArgs, { tenantId, userId });
    success = true;

    // 3. Format result
    if (rawResult && typeof rawResult === 'object' && 'content' in rawResult) {
      return rawResult as MCPToolExecutionResult;
    }
    const text = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult, null, 2);
    return {
      content: [{ type: 'text', text }],
    };
  } catch (err: any) {
    errorMessage = err.message || 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: true,
            message: errorMessage,
            tool: toolName,
          }),
        },
      ],
      isError: true,
    };
  } finally {
    const durationMs = Date.now() - startTime;

    // 4. Log to mcp_sessions
    try {
      const supabaseAdmin = createSupabaseAdminClient();
      const expiresAt = new Date(Date.now() + 1000 * 60).toISOString();
      await supabaseAdmin.from('mcp_sessions').insert({
        tenant_id: tenantId,
        user_id: userId || null,
        expires_at: expiresAt,
        tool_name: toolName,
        duration_ms: durationMs,
        success,
        error_message: errorMessage || null,
      });
    } catch (logErr) {
      console.error('Failed to log tool execution to mcp_sessions:', logErr);
    }
  }
}

// ── Register all tools by importing the modules ────────────────────────────
// Note: We use require/dynamic imports or direct registrations inside the module files themselves.
// To resolve circular dependency warning, the registry modules can import and register.
// We will call an initialize function to register all tools.
let initialized = false;
export function initializeRegistry() {
  if (initialized) return;
  initialized = true;

  // Statically import modules to register tools
  require('./tools/crm');
  require('./tools/deals');
  require('./tools/projects');
  require('./tools/invoicing');
  require('./tools/contracts');
  require('./tools/outreach');
  require('./tools/social');
  require('./tools/workspace');
  require('./tools/messaging');
  require('./tools/gamification');
  require('./tools/video');
  require('./tools/files');
  require('./tools/facebook');
  require('./tools/ai-analytics');
  require('./tools/bonnie-dream');
  require('./tools/bonnie-orchestrate');
  require('./tools/bonnie-outcomes');
  require('./tools/google-workspace');
  require('./tools/microsoft');
  require('./tools/api-health');
  require('./tools/documents');
}
