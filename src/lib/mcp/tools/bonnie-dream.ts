// @ts-nocheck
import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

// ── trigger_bonnie_dream ──────────────────────────────────────────────────────
registerTool('bonnie-dream', {
  name: 'trigger_bonnie_dream',
  description:
    'Triggers a Bonnie Dreaming session: fetches the last 50 MCP session logs for the tenant, calls the Claude Managed Agents dreaming endpoint to extract patterns, stores results in bonnie_dream_sessions, and optionally auto-applies memory updates.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    auto_apply: z.boolean().optional().default(false),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      auto_apply: { type: 'boolean', description: 'Auto-apply extracted patterns immediately', default: false },
    },
    required: ['tenant_id'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();

    // 1. Fetch last 50 mcp_sessions for the tenant
    const { data: sessions, error: sessErr } = await supabase
      .from('mcp_sessions')
      .select('id, tool_name, success, error_message, duration_ms, created_at')
      .eq('tenant_id', args.tenant_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (sessErr) throw new Error(`Failed to fetch sessions: ${sessErr.message}`);

    // 2. Call Claude Managed Agents dreaming endpoint (with beta header)
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    let patternsExtracted: any[] = [];
    let memoryUpdates: any[] = [];

    if (ANTHROPIC_API_KEY) {
      try {
        const dreamPrompt = `You are reviewing past AI agent session logs for a SaaS business platform.
Analyze the following session data and extract:
1. Common failure patterns (tools that often fail, error themes)
2. Performance insights (slow tools, high success rate tools)
3. Behavioral patterns (most used tools, usage trends)
4. Memory improvements (what the agent should remember to do better next time)

Session data:
${JSON.stringify(sessions || [], null, 2)}

Return a JSON object with:
- "patterns_extracted": array of pattern objects { type, description, frequency, severity }
- "memory_updates": array of memory update objects { category, insight, action_recommendation }
- "summary": one-sentence summary of the dreaming session

Respond ONLY with valid JSON.`;

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
            max_tokens: 2048,
            messages: [{ role: 'user', content: dreamPrompt }],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const rawText = data.content?.[0]?.text || '{}';
          const cleanText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
          const parsed = JSON.parse(cleanText);
          patternsExtracted = parsed.patterns_extracted || [];
          memoryUpdates = parsed.memory_updates || [];
        }
      } catch (e) {
        console.warn('[bonnie-dream] Dreaming endpoint call failed, using mock patterns:', e);
        // Fallback: synthesize basic patterns from session data
        const failedTools = (sessions || []).filter(s => !s.success).map(s => s.tool_name);
        const uniqueFailed = [...new Set(failedTools)];
        patternsExtracted = uniqueFailed.map(tool => ({
          type: 'failure_pattern',
          description: `Tool "${tool}" has recurring failures`,
          frequency: failedTools.filter(t => t === tool).length,
          severity: 'medium',
        }));
        memoryUpdates = [{ category: 'reliability', insight: 'Some tools have recurring failures', action_recommendation: 'Review tool implementations' }];
      }
    }

    // 3. Store dream session
    const status = args.auto_apply ? 'applied' : 'pending';
    const { data: dreamSession, error: insertErr } = await supabase
      .from('bonnie_dream_sessions')
      .insert({
        tenant_id: args.tenant_id,
        reviewed_sessions: sessions || [],
        patterns_extracted: patternsExtracted,
        memory_updates: memoryUpdates,
        status,
        applied_at: args.auto_apply ? new Date().toISOString() : null,
      })
      .select('id, status, created_at')
      .single();

    if (insertErr) throw new Error(`Failed to save dream session: ${insertErr.message}`);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          session_id: dreamSession.id,
          status: dreamSession.status,
          reviewed_sessions_count: (sessions || []).length,
          patterns_extracted_count: patternsExtracted.length,
          memory_updates_count: memoryUpdates.length,
          auto_applied: args.auto_apply,
        }, null, 2),
      }],
    };
  },
});

// ── get_dream_sessions ────────────────────────────────────────────────────────
registerTool('bonnie-dream', {
  name: 'get_dream_sessions',
  description: 'Fetches the list of Bonnie dreaming sessions for a tenant, including extracted patterns and memory updates.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    limit: z.number().int().min(1).max(50).optional().default(10),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      limit: { type: 'number', description: 'Max number of sessions to return (default 10)', default: 10 },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('bonnie_dream_sessions')
      .select('id, status, patterns_extracted, memory_updates, created_at, applied_at')
      .eq('tenant_id', args.tenant_id)
      .order('created_at', { ascending: false })
      .limit(args.limit);

    if (error) throw new Error(`Failed to fetch dream sessions: ${error.message}`);

    return {
      content: [{ type: 'text', text: JSON.stringify({ sessions: data || [] }, null, 2) }],
    };
  },
});

// ── approve_dream_update ──────────────────────────────────────────────────────
registerTool('bonnie-dream', {
  name: 'approve_dream_update',
  description: 'Approves a pending Bonnie dreaming session, marking it as applied and persisting the memory updates.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    session_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      session_id: { type: 'string', description: 'Dream session UUID to approve' },
    },
    required: ['tenant_id', 'session_id'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const { mergeDreamSession } = await import('@/services/nexusMemoryService');
    const { data, error } = await supabase
      .from('bonnie_dream_sessions')
      .update({ status: 'applied', applied_at: new Date().toISOString() })
      .eq('id', args.session_id)
      .eq('tenant_id', args.tenant_id)
      .select('id, status, applied_at')
      .single();

    if (error) throw new Error(`Failed to approve dream session: ${error.message}`);

    const mergeResult = await mergeDreamSession(args.tenant_id, args.session_id, ctx.userId);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          session: data,
          memories_merged: mergeResult.merged,
          memory_summary_updated: mergeResult.memorySummary.slice(0, 500),
        }, null, 2),
      }],
    };
  },
});
