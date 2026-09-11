// @ts-nocheck
import { z } from 'zod';
import { registerTool } from '../tool-registry';
import {
  DEPARTMENT_AGENTS,
  decideSupervision,
  getLatestDigitalTwin,
  getKnowledgeGraphSummary,
  listRegisteredAgents,
  refreshDigitalTwin,
  runCognitiveLoop,
  selectAgentsForGoal,
  syncBusinessKnowledgeGraph,
} from '@/lib/bonnie/os';

registerTool('bonnie-os', {
  name: 'list_department_agents',
  description:
    'List Bonnie specialized department agents (CEO, Sales, Finance, Support, etc.) that report to the Supervisor.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID (optional)' },
    },
  },
  handler: async () => {
    const agents = listRegisteredAgents().map((a) => ({
      id: a.id,
      name: a.name,
      department: a.department,
      role: a.role,
      tools: a.tools,
      write_allowed: a.writeAllowed === true,
    }));
    return {
      content: [{ type: 'text', text: JSON.stringify({ total: agents.length, agents }, null, 2) }],
    };
  },
});

registerTool('bonnie-os', {
  name: 'supervise_task',
  description:
    'Bonnie Supervisor: select best agents, collaboration mode, risk, approval need, and strategy for a goal.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    goal: z.string().min(1),
    event_type: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string' },
      goal: { type: 'string' },
      event_type: { type: 'string' },
    },
    required: ['tenant_id', 'goal'],
  },
  handler: async (args) => {
    const agents = selectAgentsForGoal(args.goal, { eventType: args.event_type, maxAgents: 5 });
    const decision = decideSupervision({
      goal: args.goal,
      eventType: args.event_type,
      selectedAgents: agents,
    });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          supervisor: decision,
          selected_agents: agents.map((a) => ({ id: a.id, name: a.name, department: a.department })),
        }, null, 2),
      }],
    };
  },
});

registerTool('bonnie-os', {
  name: 'run_cognitive_loop',
  description:
    'Run Bonnie full cognitive loop: Observe→Understand→Reason→Plan→Simulate→Risk→Strategy→Agents→Tools→Execute→Verify→Reflect→Learn→Memory→Improve→Monitor.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    user_id: z.string().uuid().optional(),
    goal: z.string().min(1),
    trigger_type: z.enum(['instruction', 'event', 'cron', 'approval_resume', 'continuous']).optional(),
    event_type: z.string().optional(),
    execute_actions: z.boolean().optional().default(true),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string' },
      user_id: { type: 'string' },
      goal: { type: 'string' },
      trigger_type: { type: 'string' },
      event_type: { type: 'string' },
      execute_actions: { type: 'boolean', default: true },
    },
    required: ['tenant_id', 'goal'],
  },
  handler: async (args, ctx) => {
    const result = await runCognitiveLoop({
      tenantId: args.tenant_id,
      userId: ctx.userId || args.user_id,
      goal: args.goal,
      triggerType: args.trigger_type || 'instruction',
      eventType: args.event_type,
      executeActions: args.execute_actions !== false,
    });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          run_id: result.runId,
          status: result.status,
          confidence: result.confidence,
          strategy: result.strategy,
          risk: result.riskAssessment,
          selected_agents: result.selectedAgents.map((a) => a.id),
          selected_tools: result.selectedTools,
          stages: result.stages.map((s) => ({ name: s.name, status: s.status, summary: s.summary })),
          reflection_id: result.reflectionId,
          twin_snapshot_id: result.twinSnapshotId,
          outcome: result.outcome,
        }, null, 2),
      }],
    };
  },
});

registerTool('bonnie-os', {
  name: 'refresh_business_digital_twin',
  description: 'Rebuild and persist the business digital twin snapshot (KPIs, risks, opportunities, department health).',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string' } },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const { id, snapshot } = await refreshDigitalTwin(args.tenant_id, 'manual');
    return {
      content: [{ type: 'text', text: JSON.stringify({ snapshot_id: id, snapshot }, null, 2) }],
    };
  },
});

registerTool('bonnie-os', {
  name: 'get_business_digital_twin',
  description: 'Return the latest persisted business digital twin snapshot for the tenant.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string' } },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const latest = await getLatestDigitalTwin(args.tenant_id);
    return {
      content: [{ type: 'text', text: JSON.stringify({ twin: latest }, null, 2) }],
    };
  },
});

registerTool('bonnie-os', {
  name: 'sync_knowledge_graph',
  description: 'Persist CRM/business entities into Bonnie knowledge graph nodes and edges.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    limit: z.number().int().min(5).max(100).optional().default(50),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string' },
      limit: { type: 'number', default: 50 },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const synced = await syncBusinessKnowledgeGraph(args.tenant_id, args.limit || 50);
    const summary = await getKnowledgeGraphSummary(args.tenant_id, 30);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          upserted_nodes: synced.nodes,
          upserted_edges: synced.edges,
          graph: summary,
        }, null, 2),
      }],
    };
  },
});

registerTool('bonnie-os', {
  name: 'get_agentic_os_status',
  description: 'Return Bonnie Agentic OS status: agent roster, latest twin, knowledge graph counts, and supervisor readiness.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string' } },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const [twin, graph] = await Promise.all([
      getLatestDigitalTwin(args.tenant_id),
      getKnowledgeGraphSummary(args.tenant_id, 5),
    ]);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          os: 'Bonnie Agentic Business Operating System',
          agents: DEPARTMENT_AGENTS.length,
          departments: [...new Set(DEPARTMENT_AGENTS.map((a) => a.department))],
          twin_health: twin?.health_score ?? null,
          twin_risk: twin?.risk_level ?? null,
          knowledge_nodes_sample: (graph.nodes || []).length,
          knowledge_edges_sample: (graph.edges || []).length,
          capabilities: [
            'continuous_planning',
            'continuous_reasoning',
            'continuous_observation',
            'layered_memory',
            'knowledge_graph',
            'digital_twin',
            'multi_agent_collaboration',
            'human_approval',
            'audit_evidence',
            'reflection_self_improvement',
            'event_driven_reasoning',
          ],
        }, null, 2),
      }],
    };
  },
});
