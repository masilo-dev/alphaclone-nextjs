import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { scheduleAction, scheduledActionResponse } from '@/lib/scheduling/scheduledActions';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

registerTool('calendar', {
  name: 'schedule_mcp_action',
  description: 'Save an exact user-approved email, contract, invoice, campaign, outreach or social publishing action for a user-chosen date/time. Runs after ChatGPT closes without another approval. Use ISO timestamp with UTC offset, or local ISO timestamp plus IANA timezone. Never invent a time. For prepared content, supply the execution tool and its full args. Optional repeat_cron repeats the frozen action in the supplied timezone.',
  inputSchema: z.object({ tool_name: z.string().min(1), args: z.record(z.string(), z.unknown()), scheduled_at: z.string(), timezone: z.string().optional(), repeat_cron: z.string().optional() }),
  jsonSchema: { type: 'object', properties: { tool_name: { type: 'string' }, args: { type: 'object', additionalProperties: true }, scheduled_at: { type: 'string' }, timezone: { type: 'string' }, repeat_cron: { type: 'string' } }, required: ['tool_name', 'args', 'scheduled_at'] },
  handler: async (args, context) => scheduledActionResponse(await scheduleAction({ tenantId: context.tenantId, userId: context.userId, toolName: args.tool_name, args: args.args, scheduledAt: args.scheduled_at, timezone: args.timezone, repeatCron: args.repeat_cron })),
});
registerTool('calendar', {
  name: 'list_scheduled_actions',
  description: 'Inspect frozen scheduled MCP actions, chosen times/timezones, execution results and errors in this workspace.',
  inputSchema: z.object({ status: z.enum(['scheduled', 'running', 'completed', 'provider_accepted', 'failed', 'unknown', 'cancelled']).optional(), limit: z.number().int().min(1).max(100).default(50) }),
  jsonSchema: { type: 'object', properties: { status: { type: 'string' }, limit: { type: 'number' } } },
  handler: async (args, context) => {
    let query = createSupabaseAdminClient().from('scheduled_mcp_actions').select('*').eq('tenant_id', context.tenantId).order('scheduled_at').limit(args.limit);
    if (args.status) query = query.eq('status', args.status);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: { actions: data } };
  },
});
registerTool('calendar', {
  name: 'cancel_scheduled_action',
  description: 'Cancel an action before its execution worker claims it. Running/accepted actions cannot be cancelled or resent blindly.',
  inputSchema: z.object({ action_id: z.string().uuid() }),
  jsonSchema: { type: 'object', properties: { action_id: { type: 'string' } }, required: ['action_id'] },
  handler: async (args, context) => {
    const { data, error } = await createSupabaseAdminClient().from('scheduled_mcp_actions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', args.action_id).eq('tenant_id', context.tenantId).eq('status', 'scheduled').select('id,status').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Action not found or already claimed; check its status before retrying');
    return { ok: true, data };
  },
});
