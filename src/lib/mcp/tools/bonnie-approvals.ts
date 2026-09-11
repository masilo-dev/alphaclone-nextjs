import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { approveAndResumeBonnieMission } from '@/lib/bonnie/resumeBonnieMission';
import { canApproveHighRisk } from '@/lib/bonnie/bonnieRiskPolicy';

/**
 * MCP approval tools — approve/reject queued Bonnie actions (e.g. social posts)
 * without opening the dashboard UI.
 */

registerTool('bonnie-approvals', {
  name: 'list_pending_approvals',
  description:
    'List pending Bonnie/MCP action approvals for this workspace (social posts, emails, sends). Use before approve_pending_action.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    limit: z.number().int().min(1).max(50).optional().default(20),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      limit: { type: 'number', description: 'Max pending items (default 20)' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const admin = createSupabaseAdminClient();
    const limit = args.limit ?? 20;

    const { data: runnerRows, error: runnerErr } = await admin
      .from('autonomous_runner_approvals')
      .select('id, action_key, risk_level, status, reason, payload, created_at, workflow_id')
      .eq('tenant_id', args.tenant_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (runnerErr) throw new Error(`Failed to list approvals: ${runnerErr.message}`);

    const { data: agentRows, error: agentErr } = await admin
      .from('agent_approvals')
      .select('id, task_id, run_id, proposed_action, status, created_at, runner_approval_id')
      .eq('tenant_id', args.tenant_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (agentErr) {
      console.warn('[list_pending_approvals] agent_approvals query failed:', agentErr.message);
    }

    const seen = new Set<string>();
    const items: Array<Record<string, unknown>> = [];

    for (const row of runnerRows || []) {
      seen.add(String(row.id));
      const payload = (row.payload || {}) as Record<string, unknown>;
      items.push({
        approval_id: row.id,
        source: 'autonomous_runner_approvals',
        tool: payload.tool || payload.toolName || row.action_key,
        risk_level: row.risk_level || 'medium',
        created_at: row.created_at,
        summary: payload.summary || payload.reason || row.reason || null,
        preview: payload.preview || null,
        args: payload.args || payload.proposed_action || null,
      });
    }

    for (const row of agentRows || []) {
      if (row.runner_approval_id && seen.has(String(row.runner_approval_id))) continue;
      if (seen.has(String(row.id))) continue;
      const proposed = (row.proposed_action || {}) as Record<string, unknown>;
      items.push({
        approval_id: row.runner_approval_id || row.id,
        agent_approval_id: row.id,
        source: 'agent_approvals',
        tool: proposed.tool || proposed.toolName || proposed.task_type || 'bonnie_task',
        risk_level: 'high',
        created_at: row.created_at,
        summary: proposed.summary || proposed.reason || null,
        preview: proposed.preview || null,
        args: proposed,
        task_id: row.task_id,
        run_id: row.run_id,
      });
    }

    items.sort(
      (a, b) =>
        new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime()
    );

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          ok: true,
          tool: 'list_pending_approvals',
          data: {
            pending_count: items.length,
            approvals: items.slice(0, limit),
          },
          error: null,
          hint: items.length
            ? 'Call approve_pending_action with approval_id to execute, or reject_pending_action to cancel.'
            : 'No pending approvals.',
        }, null, 2),
      }],
    };
  },
});

registerTool('bonnie-approvals', {
  name: 'approve_pending_action',
  description:
    'Approve a queued Bonnie/MCP action (e.g. social media post, email send) and execute it immediately. Use list_pending_approvals first if you do not have the approval_id. Prefer this over asking the user to open the dashboard.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    approval_id: z.string().uuid(),
    user_id: z.string().uuid().optional(),
    edited_args: z.record(z.string(), z.unknown()).optional(),
    resume_mission: z.boolean().optional().default(true),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      approval_id: { type: 'string', description: 'Pending approval UUID from list_pending_approvals' },
      user_id: { type: 'string', description: 'Acting user UUID (defaults to approval creator / system)' },
      edited_args: { type: 'object', description: 'Optional arg overrides before execute' },
      resume_mission: { type: 'boolean', description: 'Continue Bonnie mission after approve (default true)' },
    },
    required: ['tenant_id', 'approval_id'],
  },
  handler: async (args, ctx) => {
    const admin = createSupabaseAdminClient();
    const { data: existing, error } = await admin
      .from('autonomous_runner_approvals')
      .select('*')
      .eq('id', args.approval_id)
      .eq('tenant_id', args.tenant_id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!existing) throw new Error('Approval not found');
    if (existing.status !== 'pending') {
      throw new Error(`Approval is already ${existing.status}`);
    }

    const actorUserId =
      String(args.user_id || (ctx as { userId?: string })?.userId || existing.created_by || existing.user_id || '').trim();
    if (!actorUserId) {
      throw new Error('user_id is required to approve this action');
    }

    const riskLevel = String(existing.risk_level || 'medium').toLowerCase();
    if (riskLevel === 'high' || riskLevel === 'critical') {
      const { data: tenantUser } = await admin
        .from('tenant_users')
        .select('role')
        .eq('tenant_id', args.tenant_id)
        .eq('user_id', actorUserId)
        .maybeSingle();
      if (!canApproveHighRisk(tenantUser?.role)) {
        throw new Error('Only tenant admins can approve high-risk actions');
      }
    }

    let payload = (existing.payload || {}) as Record<string, unknown>;
    let editHistory = Array.isArray(existing.edit_history) ? existing.edit_history : [];
    if (args.edited_args && Object.keys(args.edited_args).length > 0) {
      const currentArgs = (payload.args || {}) as Record<string, unknown>;
      editHistory = [
        ...editHistory,
        {
          timestamp: new Date().toISOString(),
          action: 'approved_via_mcp',
          approved_by: actorUserId,
          previous_args: currentArgs,
          new_args: args.edited_args,
        },
      ];
      payload = { ...payload, args: { ...currentArgs, ...args.edited_args } };
      await admin
        .from('autonomous_runner_approvals')
        .update({
          payload,
          edit_history: editHistory,
          updated_at: new Date().toISOString(),
        })
        .eq('id', args.approval_id)
        .eq('tenant_id', args.tenant_id);
    }

    const result = await approveAndResumeBonnieMission({
      tenantId: args.tenant_id,
      userId: actorUserId,
      approvalId: args.approval_id,
      instruction: args.resume_mission === false
        ? undefined
        : String((payload as { instruction?: string }).instruction || ''),
    });

    if (!result.execution?.success) {
      throw new Error(result.execution?.error || 'Approval execution failed');
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          approval_id: args.approval_id,
          executed: true,
          tool: result.execution.result?.tool,
          summary: result.execution.result?.summary,
          continuation: result.continuation?.continued
            ? {
                continued: true,
                response: result.continuation.response,
                executionStatus: result.continuation.executionStatus,
              }
            : { continued: false },
        }, null, 2),
      }],
    };
  },
});

registerTool('bonnie-approvals', {
  name: 'reject_pending_action',
  description:
    'Reject a queued Bonnie/MCP action so it will not execute. Use list_pending_approvals to find approval_id.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    approval_id: z.string().uuid(),
    user_id: z.string().uuid().optional(),
    reason: z.string().max(500).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string' },
      approval_id: { type: 'string' },
      user_id: { type: 'string' },
      reason: { type: 'string' },
    },
    required: ['tenant_id', 'approval_id'],
  },
  handler: async (args, ctx) => {
    const admin = createSupabaseAdminClient();
    const actorUserId = String(args.user_id || (ctx as { userId?: string })?.userId || '').trim() || null;

    const { data: existing } = await admin
      .from('autonomous_runner_approvals')
      .select('id, status, edit_history')
      .eq('id', args.approval_id)
      .eq('tenant_id', args.tenant_id)
      .maybeSingle();

    if (!existing) throw new Error('Approval not found');
    if (existing.status !== 'pending') {
      throw new Error(`Approval is already ${existing.status}`);
    }

    const editHistory = [
      ...(Array.isArray(existing.edit_history) ? existing.edit_history : []),
      {
        timestamp: new Date().toISOString(),
        action: 'rejected_via_mcp',
        rejected_by: actorUserId,
        reason: args.reason || null,
      },
    ];

    const { error } = await admin
      .from('autonomous_runner_approvals')
      .update({
        status: 'rejected',
        edit_history: editHistory,
        updated_at: new Date().toISOString(),
      })
      .eq('id', args.approval_id)
      .eq('tenant_id', args.tenant_id);

    if (error) throw new Error(error.message);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          approval_id: args.approval_id,
          status: 'rejected',
          reason: args.reason || null,
        }, null, 2),
      }],
    };
  },
});
