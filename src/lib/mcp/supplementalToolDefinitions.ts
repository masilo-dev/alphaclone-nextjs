export type McpToolAnnotations = {
  readOnlyHint: boolean;
  openWorldHint: boolean;
  destructiveHint: boolean;
};

export type McpDiscoveryTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: McpToolAnnotations;
};

const tenantIdProp = { type: 'string', description: 'AlphaClone Workspace ID' };

/** Tools not in toolManifest or registry but callable via /api/mcp or Bonnie custom executor */
export const SUPPLEMENTAL_MCP_TOOLS: McpDiscoveryTool[] = [
  {
    name: 'create_ticket',
    description: 'Create a new support ticket',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: tenantIdProp,
        title: { type: 'string', description: 'Ticket title' },
        description: { type: 'string', description: 'Ticket description' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        category: { type: 'string', enum: ['billing', 'technical', 'general', 'feature_request', 'bug', 'onboarding'] },
        source: { type: 'string', enum: ['whatsapp', 'email', 'chat', 'manual', 'bonnie_agent', 'api'] },
        contact_id: { type: 'string' },
        client_id: { type: 'string' },
      },
      required: ['tenant_id', 'title'],
    },
  },
  {
    name: 'get_tickets',
    description: 'Get support tickets with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: tenantIdProp,
        status: { type: 'string', enum: ['open', 'in_progress', 'waiting', 'resolved', 'closed'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        category: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['tenant_id'],
    },
  },
  {
    name: 'update_ticket',
    description: 'Update a support ticket status, priority, or resolution',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: tenantIdProp,
        ticket_id: { type: 'string' },
        status: { type: 'string', enum: ['open', 'in_progress', 'waiting', 'resolved', 'closed'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        resolution_note: { type: 'string' },
        assigned_to: { type: 'string' },
      },
      required: ['tenant_id', 'ticket_id'],
    },
  },
  {
    name: 'get_ticket_stats',
    description: 'Get ticket statistics including counts by status and SLA breaches',
    inputSchema: {
      type: 'object',
      properties: { tenant_id: tenantIdProp },
      required: ['tenant_id'],
    },
  },
  {
    name: 'escalate_ticket',
    description: 'Escalate a ticket to urgent priority',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: tenantIdProp,
        ticket_id: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['tenant_id', 'ticket_id', 'reason'],
    },
  },
  {
    name: 'run_autonomous_scan',
    description: 'Run Bonnie autonomous workspace scan across CRM, finance, campaigns, and automation health',
    inputSchema: {
      type: 'object',
      properties: { tenant_id: tenantIdProp },
      required: ['tenant_id'],
    },
  },
  {
    name: 'summarize_workspace',
    description: 'Summarize tenant workspace metrics and operational signals',
    inputSchema: {
      type: 'object',
      properties: { tenant_id: tenantIdProp },
      required: ['tenant_id'],
    },
  },
  {
    name: 'search_facebook_leads',
    description: 'Search Facebook lead ads and inbox leads for the tenant',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: tenantIdProp,
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['tenant_id'],
    },
  },
  {
    name: 'get_account_overview',
    description: 'Full tenant account overview: integrations, workspace counts, scraper campaigns, saved lead criteria',
    inputSchema: {
      type: 'object',
      properties: { tenant_id: tenantIdProp },
      required: ['tenant_id'],
    },
  },
  {
    name: 'find_and_qualify_leads',
    description: 'Discover leads by niche and location (OSM/Foursquare), score Hot/Warm/Cold, optionally save to CRM',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: tenantIdProp,
        niche: { type: 'string', description: 'Business type e.g. plumbers, dental clinics' },
        location: { type: 'string', description: 'City/region e.g. Austin TX' },
        min_score: { type: 'number', description: 'Minimum qualification score 0-100' },
        tiers: { type: 'array', items: { type: 'string', enum: ['hot', 'warm', 'cold'] } },
        exclude_keywords: { type: 'array', items: { type: 'string' } },
        max_results: { type: 'number' },
        save_to_crm: { type: 'boolean' },
      },
      required: ['tenant_id', 'niche', 'location'],
    },
  },
  {
    name: 'parse_lead_criteria',
    description: 'Parse natural-language lead criteria and save to tenant memory for future searches',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: tenantIdProp,
        criteria: { type: 'string', description: 'Describe ideal leads in plain English' },
      },
      required: ['tenant_id', 'criteria'],
    },
  },
  {
    name: 'qualify_crm_leads',
    description: 'Score existing CRM leads with industry-aware Hot/Warm/Cold tiers',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: tenantIdProp,
        industry: { type: 'string' },
        min_score: { type: 'number' },
        tiers: { type: 'array', items: { type: 'string' } },
        limit: { type: 'number' },
      },
      required: ['tenant_id'],
    },
  },
  {
    name: 'get_scraper_leads',
    description: 'List leads from scraper campaigns with score and grade filters',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: tenantIdProp,
        min_score: { type: 'number' },
        grade: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['tenant_id'],
    },
  },
  {
    name: 'draft_reply',
    description: 'Draft an AI reply for a ticket or message thread',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: tenantIdProp,
        thread_id: { type: 'string' },
        context: { type: 'string' },
      },
      required: ['tenant_id'],
    },
  },
  {
    name: 'summarize_ticket',
    description: 'Summarize a support ticket thread for quick triage',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: tenantIdProp,
        ticket_id: { type: 'string' },
      },
      required: ['tenant_id', 'ticket_id'],
    },
  },
  {
    name: 'generate_outreach_draft',
    description: 'Generate a personalized outreach email draft for a contact or lead',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: tenantIdProp,
        contact_id: { type: 'string' },
        lead_id: { type: 'string' },
        goal: { type: 'string' },
      },
      required: ['tenant_id'],
    },
  },
];
