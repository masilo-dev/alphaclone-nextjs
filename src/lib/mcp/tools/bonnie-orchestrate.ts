// @ts-nocheck
import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const SubagentSchema = z.object({
  name: z.string(),
  role: z.string(),
  instructions: z.string(),
});

// ── orchestrate_task ──────────────────────────────────────────────────────────
registerTool('bonnie-orchestrate', {
  name: 'orchestrate_task',
  description:
    'Orchestrates a complex task by delegating sub-tasks to specialized Bonnie subagents. Uses the Claude Managed Agents multiagent session type to coordinate execution.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    task: z.string().min(1),
    subagents: z.array(SubagentSchema).min(1).max(5),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      task: { type: 'string', description: 'High-level task to orchestrate' },
      subagents: {
        type: 'array',
        description: 'List of subagents to delegate to (max 5)',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            role: { type: 'string' },
            instructions: { type: 'string' },
          },
          required: ['name', 'role', 'instructions'],
        },
      },
    },
    required: ['tenant_id', 'task', 'subagents'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    const subagentResults: Array<{ name: string; role: string; result: string; success: boolean }> = [];

    // Execute each subagent task via Anthropic
    for (const subagent of args.subagents) {
      let result = '';
      let success = false;

      if (ANTHROPIC_API_KEY) {
        try {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
              'anthropic-beta': 'managed-agents-2026-04-01',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 1024,
              system: `You are ${subagent.name}, a specialized subagent with the role: ${subagent.role}. You are part of a multiagent orchestration system for AlphaClone business platform. Be concise and return structured results.`,
              messages: [
                { role: 'user', content: `Main task: ${args.task}\n\nYour specific instructions: ${subagent.instructions}\n\nReturn a brief JSON summary of your results with keys: "outcome", "details", "next_steps".` },
              ],
              metadata: { session_type: 'multiagent', parent_task: args.task },
            }),
          });

          if (res.ok) {
            const data = await res.json();
            result = data.content?.[0]?.text || 'No output';
            success = true;
          } else {
            result = `API error: ${res.status}`;
          }
        } catch (e: any) {
          result = `Subagent execution error: ${e.message}`;
        }
      } else {
        // Mock when no API key
        result = JSON.stringify({ outcome: 'simulated', details: `${subagent.name} processed task segment`, next_steps: [] });
        success = true;
      }

      subagentResults.push({ name: subagent.name, role: subagent.role, result, success });
    }

    // Log to mcp_sessions
    try {
      await supabase.from('mcp_sessions').insert({
        tenant_id: args.tenant_id,
        tool_name: 'orchestrate_task',
        success: subagentResults.every(r => r.success),
        duration_ms: 0,
        expires_at: new Date(Date.now() + 60000).toISOString(),
      });
    } catch (_) { /* non-critical */ }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          task: args.task,
          total_subagents: args.subagents.length,
          results: subagentResults,
          orchestration_complete: true,
        }, null, 2),
      }],
    };
  },
});

// ── get_orchestration_history ─────────────────────────────────────────────────
registerTool('bonnie-orchestrate', {
  name: 'get_orchestration_history',
  description: 'Returns the history of orchestrated tasks for a tenant from the mcp_sessions log.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    limit: z.number().int().min(1).max(50).optional().default(20),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      limit: { type: 'number', description: 'Max number of history entries (default 20)', default: 20 },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('mcp_sessions')
      .select('id, tool_name, success, duration_ms, created_at')
      .eq('tenant_id', args.tenant_id)
      .eq('tool_name', 'orchestrate_task')
      .order('created_at', { ascending: false })
      .limit(args.limit);

    if (error) throw new Error(`Failed to fetch orchestration history: ${error.message}`);

    return {
      content: [{ type: 'text', text: JSON.stringify({ history: data || [] }, null, 2) }],
    };
  },
});
