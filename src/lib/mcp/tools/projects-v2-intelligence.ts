import { z } from 'zod';
import { registerTool } from '@/lib/mcp/tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { isExecutionFeatureEnabled } from '@/lib/projects/executionFeatureFlags';
import {
  loadProjectIntelligence,
  loadWorkspaceProjectBrief,
} from '@/lib/projects/projectIntelligence';

const tenantIdSchema = z.string().describe('AlphaClone Workspace ID');

async function ensureProjectsV2(tenantId: string) {
  const supabase = createSupabaseAdminClient();
  const enabled = await isExecutionFeatureEnabled(supabase, 'PROJECTS_V2', tenantId);
  if (!enabled) throw new Error('projects_v2_not_enabled');
  return supabase;
}

registerTool('projects-v2-intelligence', {
  name: 'get_project_intelligence',
  description: 'Get database-grounded project status including overdue tasks, blockers, missing approvals, unpaid invoices, overdue milestones and recommended next actions.',
  inputSchema: z.object({ tenant_id: tenantIdSchema, project_id: z.string() }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string' }, project_id: { type: 'string' } },
    required: ['project_id'],
  },
  handler: async (args) => {
    const supabase = await ensureProjectsV2(args.tenant_id);
    const result = await loadProjectIntelligence(supabase, args.tenant_id, args.project_id);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
});

registerTool('projects-v2-intelligence', {
  name: 'get_daily_project_brief',
  description: 'Get a database-grounded workspace project brief with active projects, overdue work, blocked projects, approvals, unpaid invoices, highest risk and next actions.',
  inputSchema: z.object({ tenant_id: tenantIdSchema, limit: z.number().int().min(1).max(100).optional().default(50) }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string' }, limit: { type: 'number' } },
    required: [],
  },
  handler: async (args) => {
    const supabase = await ensureProjectsV2(args.tenant_id);
    const result = await loadWorkspaceProjectBrief(supabase, args.tenant_id, args.limit ?? 50);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
});

registerTool('projects-v2-intelligence', {
  name: 'list_projects_waiting_on_payment',
  description: 'List projects with outstanding invoices using real invoice balances and status from AlphaClone.',
  inputSchema: z.object({ tenant_id: tenantIdSchema, limit: z.number().int().min(1).max(100).optional().default(50) }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string' }, limit: { type: 'number' } },
    required: [],
  },
  handler: async (args) => {
    const supabase = await ensureProjectsV2(args.tenant_id);
    const brief = await loadWorkspaceProjectBrief(supabase, args.tenant_id, args.limit ?? 50);
    const projects = brief.projects.filter((entry: any) => entry.counts.unpaidInvoices > 0);
    return { content: [{ type: 'text', text: JSON.stringify({ count: projects.length, projects }, null, 2) }] };
  },
});

registerTool('projects-v2-intelligence', {
  name: 'list_projects_waiting_on_approval',
  description: 'List projects with outstanding approval requirements using project tasks and deliverables from AlphaClone.',
  inputSchema: z.object({ tenant_id: tenantIdSchema, limit: z.number().int().min(1).max(100).optional().default(50) }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string' }, limit: { type: 'number' } },
    required: [],
  },
  handler: async (args) => {
    const supabase = await ensureProjectsV2(args.tenant_id);
    const brief = await loadWorkspaceProjectBrief(supabase, args.tenant_id, args.limit ?? 50);
    const projects = brief.projects.filter((entry: any) => entry.counts.missingApprovals > 0);
    return { content: [{ type: 'text', text: JSON.stringify({ count: projects.length, projects }, null, 2) }] };
  },
});

registerTool('projects-v2-intelligence', {
  name: 'list_overdue_or_blocked_projects',
  description: 'List projects needing attention because work is overdue, blocked or milestones are overdue.',
  inputSchema: z.object({ tenant_id: tenantIdSchema, limit: z.number().int().min(1).max(100).optional().default(50) }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string' }, limit: { type: 'number' } },
    required: [],
  },
  handler: async (args) => {
    const supabase = await ensureProjectsV2(args.tenant_id);
    const brief = await loadWorkspaceProjectBrief(supabase, args.tenant_id, args.limit ?? 50);
    const projects = brief.projects.filter(
      (entry: any) =>
        entry.counts.overdueTasks > 0 ||
        entry.counts.blockedTasks > 0 ||
        entry.counts.overdueMilestones > 0,
    );
    return { content: [{ type: 'text', text: JSON.stringify({ count: projects.length, projects }, null, 2) }] };
  },
});
