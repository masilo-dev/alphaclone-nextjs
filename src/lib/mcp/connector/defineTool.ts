import { z } from 'zod';
import { registerTool } from '@/lib/mcp/tool-registry';
import type { MCPToolContext } from '@/types/mcp';
import type { ConnectorPermission } from './types';
import { assertPermission } from './permissions';
import { checkConnectorRateLimit, type CONNECTOR_RATE_LIMITS } from './rateLimit';
import { errorResult, okResult, toMcpContent, throwConnectorError } from './response';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

type RateClass = keyof typeof CONNECTOR_RATE_LIMITS;

type DefineConnectorToolOptions<T extends z.ZodObject<any>> = {
  module: string;
  name: string;
  description: string;
  inputSchema: T;
  jsonSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  permission: ConnectorPermission | ConnectorPermission[];
  rateLimitClass?: RateClass;
  auditAction?: string;
  handler: (
    args: z.infer<T>,
    context: MCPToolContext
  ) => Promise<unknown>;
};

/**
 * Registers an MCP tool with auth, permission, rate-limit, structured response,
 * and audit-trail instrumentation for ChatGPT Apps discovery.
 */
export function defineConnectorTool<T extends z.ZodObject<any>>(
  options: DefineConnectorToolOptions<T>
) {
  registerTool(options.module, {
    name: options.name,
    description: options.description,
    inputSchema: options.inputSchema,
    jsonSchema: options.jsonSchema,
    handler: async (args, context) => {
      // Session context is authoritative — never prefer model/client-supplied IDs.
      const tenantId = context.tenantId;
      const userId = context.userId;

      if (!tenantId) {
        return toMcpContent(
          errorResult(
            options.name,
            'TENANT_REQUIRED',
            'Active workspace required. tenant_id from the model is not authoritative.'
          )
        );
      }
      if (!userId) {
        return toMcpContent(
          errorResult(
            options.name,
            'AUTH_REQUIRED',
            'Authenticated user required. user_id from the model is not authoritative.'
          )
        );
      }

      try {
        await assertPermission(tenantId, userId, options.permission);

        const rl = await checkConnectorRateLimit({
          tenantId,
          userId,
          toolName: options.name,
          className: options.rateLimitClass || 'default',
        });
        if (!rl.allowed) {
          throwConnectorError(
            'RATE_LIMITED',
            `Rate limit exceeded for ${options.name}. Retry after ${new Date(rl.resetAt).toISOString()}`,
            { limit: rl.limit, remaining: rl.remaining, reset_at: new Date(rl.resetAt).toISOString() }
          );
        }

        const data = await options.handler(args, { tenantId, userId });

        if (options.auditAction) {
          try {
            const supabase = createSupabaseAdminClient();
            await supabase.from('audit_logs').insert({
              tenant_id: tenantId,
              user_id: userId,
              action: options.auditAction,
              entity_type: 'mcp_tool',
              entity_id: options.name,
              new_value: {
                tool: options.name,
                module: options.module,
                at: new Date().toISOString(),
              },
              created_at: new Date().toISOString(),
            });
          } catch (auditErr) {
            console.warn(`[connector] audit write failed for ${options.name}:`, auditErr);
          }
        }

        // Handlers may already return ConnectorResult / MCP content
        if (data && typeof data === 'object' && 'content' in (data as any)) {
          return data;
        }
        if (data && typeof data === 'object' && 'ok' in (data as any)) {
          return toMcpContent(data as any);
        }

        return toMcpContent(
          okResult(options.name, data, {
            meta: {
              rate_limit: {
                remaining: rl.remaining,
                limit: rl.limit,
                reset_at: new Date(rl.resetAt).toISOString(),
              },
            },
          })
        );
      } catch (err: any) {
        const code = err?.code || 'TOOL_ERROR';
        const message = err?.message || 'Tool execution failed';
        return toMcpContent(errorResult(options.name, code, message, err?.details));
      }
    },
  });
}

export const tenantIdField = z.string().uuid();
export const optionalTenantId = z.string().uuid().optional();
