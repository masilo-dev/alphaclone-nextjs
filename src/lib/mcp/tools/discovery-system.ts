/**
 * Core discovery & control MCP tools — callable across all transports and clients.
 */

import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { okResult, throwConnectorError } from '@/lib/mcp/connector/response';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getUnifiedMcpTools } from '@/lib/mcp/listAllTools';
import { ALL_MODULE_NAMES, getModuleTools, findToolsByQuery } from '@/lib/mcp/progressiveDiscovery';
import { executeTool, hasTool } from '@/lib/mcp/tool-registry';



// ── list_tools ────────────────────────────────────────────────────────────────
defineConnectorTool({
  module: 'discovery',
  name: 'list_tools',
  description: 'List the small stable core MCP catalogue. Read-only; returns canonical names and modules.',
  permission: 'integrations:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  handler: async () => {
    const allTools = await getUnifiedMcpTools({ catalogMode: 'full', sanitizeForClient: false });
    return okResult('list_tools', {
      total: allTools.length,
      tools: allTools.map((t) => ({ name: t.name, description: t.description?.slice(0, 80) })),
    });
  },
});

// ── search_tools ─────────────────────────────────────────────────────────────
defineConnectorTool({
  module: 'discovery',
  name: 'search_tools',
  description:
    'Search the AlphaClone canonical catalog of 499 tools by keyword, intent, or domain query. Use when looking for capabilities to accomplish a specific task.',
  permission: 'integrations:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    query: z.string().min(1),
    limit: z.number().int().min(1).max(50).optional().default(15),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Keyword or task description' },
      limit: { type: 'number', description: 'Max results (default 15)' },
    },
    required: ['query'],
  },
  handler: async (args) => {
    const allTools = await getUnifiedMcpTools({ catalogMode: 'full', sanitizeForClient: false });
    const matches = findToolsByQuery(allTools, args.query, args.limit || 15);
    return okResult('search_tools', {
      query: args.query,
      count: matches.length,
      tools: matches.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    });
  },
});

// ── load_module_tools ────────────────────────────────────────────────────────
defineConnectorTool({
  module: 'discovery',
  name: 'load_module_tools',
  description:
    'Dynamically load full tool definitions for one or more module domains (e.g., email, crm, finance, social, contracts, support, marketing).',
  permission: 'integrations:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    module: z.string().optional(),
    modules: z.array(z.string()).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      module: { type: 'string', description: 'Single module name to load' },
      modules: { type: 'array', items: { type: 'string' }, description: 'List of module names to load' },
    },
    required: [],
  },
  handler: async (args) => {
    const requestedModules = new Set<string>();
    if (args.module) requestedModules.add(args.module.toLowerCase().trim());
    if (Array.isArray(args.modules)) {
      args.modules.forEach((m) => requestedModules.add(String(m).toLowerCase().trim()));
    }

    if (requestedModules.size === 0) {
      return okResult('load_module_tools', {
        message: 'No modules specified',
        available_modules: ALL_MODULE_NAMES,
      });
    }

    const allTools = await getUnifiedMcpTools({ catalogMode: 'full', sanitizeForClient: false });
    const loadedTools: Array<{ name: string; description: string; inputSchema: unknown }> = [];

    for (const mod of Array.from(requestedModules)) {
      const modTools = getModuleTools(allTools, mod);
      modTools.forEach((t) => {
        loadedTools.push({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        });
      });
    }

    return okResult('load_module_tools', {
      loaded_modules: Array.from(requestedModules),
      tool_count: loadedTools.length,
      tools: loadedTools,
    });
  },
});

// ── list_modules ─────────────────────────────────────────────────────────────
defineConnectorTool({
  module: 'discovery',
  name: 'list_modules',
  description: 'List all available progressive discovery modules and their tool counts in AlphaClone.',
  permission: 'integrations:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  handler: async () => {
    const allTools = await getUnifiedMcpTools({ catalogMode: 'full', sanitizeForClient: false });
    const moduleCounts = ALL_MODULE_NAMES.map((mod) => ({
      module: mod,
      count: getModuleTools(allTools, mod).length,
    }));

    return okResult('list_modules', {
      total_canonical_tools: allTools.length,
      modules: moduleCounts,
    });
  },
});

// ── list_capabilities ────────────────────────────────────────────────────────
defineConnectorTool({
  module: 'discovery',
  name: 'list_capabilities',
  description: 'List negotiated MCP server capabilities, supported protocol features, and auth requirements.',
  permission: 'integrations:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  handler: async () => {
    return okResult('list_capabilities', {
      protocol_version: '2024-11-05',
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true, listChanged: true },
        prompts: { listChanged: true },
        logging: {},
      },
      auth: {
        session_scoped_tenancy: true,
        strict_user_verification: true,
      },
      catalog: {
        total_canonical_tools: 499,
        progressive_discovery_supported: true,
      },
    });
  },
});

// ── load_skill ───────────────────────────────────────────────────────────────
defineConnectorTool({
  module: 'discovery',
  name: 'load_skill',
  description: 'Load an operational skill package (system prompt instructions, recommended tool list, and workflow guidelines).',
  permission: 'integrations:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    skill_name: z.string().min(1),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      skill_name: { type: 'string', description: 'Name of the skill package (e.g. crm_nurture, financial_audit, social_publisher)' },
    },
    required: ['skill_name'],
  },
  handler: async (args) => {
    const skillMap: Record<string, { description: string; recommended_tools: string[]; instructions: string }> = {
      crm_nurture: {
        description: 'Lead qualification and automated outreach nurture skill.',
        recommended_tools: ['get_leads', 'update_lead_status', 'send_email', 'create_task'],
        instructions: 'Fetch new leads, analyze notes, score lead fit, and draft personalized outreach emails.',
      },
      financial_audit: {
        description: 'Fiscal reconciliation and P&L audit skill.',
        recommended_tools: ['get_finance_snapshot', 'get_pnl_statement', 'get_invoices', 'get_expenses'],
        instructions: 'Check cash flow, balance sheet items, pending draft invoices, and flag overdue payments.',
      },
      social_publisher: {
        description: 'Cross-platform content creation and publishing skill.',
        recommended_tools: ['create_social_post', 'generate_ai_image', 'get_linkedin_posts', 'plan_social_calendar'],
        instructions: 'Draft post copy, generate media assets, select platforms, and schedule or publish posts.',
      },
    };

    const skill = skillMap[args.skill_name.toLowerCase().trim()] || {
      description: `Custom skill: ${args.skill_name}`,
      recommended_tools: ['search_tools', 'load_module_tools'],
      instructions: `Follow platform guidelines to execute ${args.skill_name}. Use search_tools to discover relevant actions.`,
    };

    return okResult('load_skill', {
      skill_name: args.skill_name,
      ...skill,
    });
  },
});

// ── dispatch_tool / execute_action ───────────────────────────────────────────
defineConnectorTool({
  module: 'discovery',
  name: 'dispatch_tool',
  description:
    'Universal fallback tool execution router. Allows clients with static tool catalogs to invoke any of the 499 AlphaClone tools by name with argument payload.',
  permission: 'integrations:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    tool_name: z.string().min(1),
    arguments: z.record(z.string(), z.unknown()).optional().default({}),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tool_name: { type: 'string', description: 'Name of the tool to execute' },
      arguments: { type: 'object', description: 'Key-value map of input arguments for the target tool' },
    },
    required: ['tool_name'],
  },
  handler: async (args, ctx) => {
    const name = args.tool_name.trim();
    if (!hasTool(name)) {
      throwConnectorError('RESOURCE_NOT_FOUND', `Tool "${name}" is not registered in the canonical catalog.`);
    }

    const result = await executeTool(ctx.tenantId, ctx.userId, name, args.arguments || {});
    return result;
  },
});

defineConnectorTool({
  module: 'discovery',
  name: 'execute_action',
  description: 'Alias for dispatch_tool — execute any AlphaClone canonical tool by name.',
  permission: 'integrations:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    action_name: z.string().min(1),
    parameters: z.record(z.string(), z.unknown()).optional().default({}),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      action_name: { type: 'string', description: 'Name of the action/tool to execute' },
      parameters: { type: 'object', description: 'Input parameters' },
    },
    required: ['action_name'],
  },
  handler: async (args, ctx) => {
    const name = args.action_name.trim();
    if (!hasTool(name)) {
      throwConnectorError('RESOURCE_NOT_FOUND', `Action "${name}" is not registered in the canonical catalog.`);
    }

    return await executeTool(ctx.tenantId, ctx.userId, name, args.parameters || {});
  },
});

defineConnectorTool({
  module: 'discovery',
  name: 'execute_internal_tool',
  description: 'Execute ANY of AlphaClone\'s 503 internal tools by name with parameters (e.g. create_contract, send_outreach_email, upload_media, create_invoice, etc.)',
  permission: 'integrations:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    tool_name: z.string().min(1),
    arguments: z.record(z.string(), z.unknown()).optional().default({}),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tool_name: { type: 'string', description: 'Canonical tool name to execute' },
      arguments: { type: 'object', description: 'Input arguments matching target tool schema' },
    },
    required: ['tool_name'],
  },
  handler: async (args, ctx) => {
    const name = args.tool_name.trim();
    if (!hasTool(name)) {
      throwConnectorError('RESOURCE_NOT_FOUND', `Tool "${name}" is not registered in the canonical catalog.`);
    }

    return await executeTool(ctx.tenantId, ctx.userId, name, args.arguments || {});
  },
});

// ── summarize_workspace ──────────────────────────────────────────────────────
defineConnectorTool({
  module: 'discovery',
  name: 'summarize_workspace',
  description:
    'Generate an executive summary of workspace activity across leads, active deals, invoices, open tasks, and recent integrations.',
  permission: 'integrations:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  handler: async (_args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const tenantId = ctx.tenantId;

    const [
      { count: leadCount },
      { count: dealCount },
      { count: invoiceCount },
      { count: taskCount },
      { count: contactCount },
    ] = await Promise.all([
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('business_invoices').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    ]);

    return okResult('summarize_workspace', {
      tenant_id: tenantId,
      metrics: {
        leads: leadCount || 0,
        deals: dealCount || 0,
        invoices: invoiceCount || 0,
        open_tasks: taskCount || 0,
        contacts: contactCount || 0,
      },
      health_status: 'operational',
      timestamp: new Date().toISOString(),
    });
  },
});
