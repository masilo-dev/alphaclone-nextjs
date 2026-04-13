import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { unitsForTextGeneration } from '../../config/aiUsageQuotas';
import { createSupabaseAdminClient } from '../../lib/supabase-admin';
import { consumeTenantAiUnits } from '../../lib/quotas/tenantAiUnitsQuota';
import { auditLoggingService } from '../auditLoggingService';
import Anthropic from '@anthropic-ai/sdk';

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidString(value: unknown): value is string {
    return typeof value === 'string' && UUID_RE.test(value.trim());
}

const MCP_GENERIC_OPERATION_ERROR =
  'This action could not be completed right now. Please try again in a few minutes. If the issue continues, contact support.';

function supabaseErrorToMcpClientError(toolName: string, message: string): Error {
  const m = message.toLowerCase();
  console.error(`[MCP ${toolName}]`, message);
  if (
    m.includes('does not exist') ||
    m.includes('schema cache') ||
    m.includes('could not find') ||
    m.includes('42703') ||
    m.includes('42p01') ||
    m.includes('invalid input syntax')
  ) {
    return new Error(
      'Workspace data could not be loaded (database or schema error on our side). Retry shortly. If it persists, contact support with your workspace ID and the MCP tool name you used.'
    );
  }
  return new Error(MCP_GENERIC_OPERATION_ERROR);
}

/**
 * AlphaClone MCP Server
 *
 * Exposes CRM, leads, deals, expenses, contracts, and scheduling tools
 * to external AI agents (Claude Desktop, Manus AI).
 *
 * SECURITY CONSTRAINTS (enforced at this layer):
 * - All queries are scoped to tenant_id to enforce multi-tenant isolation
 * - READ-ONLY access on sensitive tables (invoices, payments)
 * - CREATE and UPDATE allowed on operational data
 * - DELETE is intentionally excluded from all tools to prevent AI-caused data loss
 * - No tools expose source code files, environment variables, or secrets
 */
export type MCPConnectionContext = {
  tenantId: string;
  userId: string;
};

class AlphaCloneMCPServer {
  public server: Server;
  private readonly ctx?: MCPConnectionContext;

  constructor(ctx?: MCPConnectionContext) {
    this.ctx = ctx;
    this.server = new Server(
      { name: 'AlphaClone-MCP', version: '2.0.0' },
      { capabilities: { tools: {} } }
    );
    this.setupToolHandlers();
  }

  /** Workspace scope for this HTTP connection (from API key or OAuth). */
  private requireTenant(args: Record<string, any>): string {
    if (this.ctx?.tenantId) {
      const r = args.tenant_id;
      if (r != null && r !== '' && typeof r === 'string' && r !== this.ctx.tenantId) {
        throw new Error(
          'tenant_id does not match this MCP connection. Use the tenant_id from your personal MCP URL in the dashboard.'
        );
      }
      return this.ctx.tenantId;
    }
    const t = args.tenant_id;
    if (!t || typeof t !== 'string') throw new Error('tenant_id is required');
    const tid = t.trim();
    if (!isUuidString(tid)) {
      throw new Error(
        'tenant_id must be a valid workspace UUID from your MCP dashboard URL, not a name or slug.'
      );
    }
    return tid;
  }

  /** Profile / gamification scope (same user as the connection by default). */
  private requireProfileUser(args: Record<string, any>): string {
    if (this.ctx?.userId) {
      const r = args.user_id;
      if (r != null && r !== '' && typeof r === 'string' && r !== this.ctx.userId) {
        throw new Error('user_id does not match this MCP connection.');
      }
      return this.ctx.userId;
    }
    const u = args.user_id;
    if (!u || typeof u !== 'string') throw new Error('user_id is required');
    const uid = u.trim();
    if (!isUuidString(uid)) {
      throw new Error('user_id must be a valid UUID from your MCP connection URL.');
    }
    return uid;
  }

  private setupToolHandlers() {
    // ── Tool Manifest ──────────────────────────────────────────────────────────
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // ── CRM & Clients ──────────────────────────────────────────────────
        {
          name: 'get_clients',
          description: 'Fetch CRM clients for a tenant. Use to look up existing clients or filter by status.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string', description: 'Tenant/workspace UUID' },
              status: { type: 'string', description: 'lead | prospect | active | churned' },
              limit: { type: 'number', description: 'Max records (default 20, max 100)' },
            },
            required: ['tenant_id'],
          },
        },
        {
          name: 'create_client',
          description: 'Create a new CRM client/contact record.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              company: { type: 'string' },
              status: { type: 'string', description: 'lead | prospect | active | churned' },
              source: { type: 'string' },
            },
            required: ['tenant_id', 'name'],
          },
        },
        // ── Leads Pipeline ─────────────────────────────────────────────────
        {
          name: 'get_leads',
          description: 'Fetch leads from the sales pipeline. Use to review, qualify, or prioritize leads.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              status: { type: 'string', description: 'new | contacted | qualified | converted | disqualified' },
              stage: { type: 'string', description: 'lead | prospect | opportunity | negotiation | closed_won | closed_lost' },
              limit: { type: 'number', description: 'Max records (default 20, max 100)' },
            },
            required: ['tenant_id'],
          },
        },
        {
          name: 'create_lead',
          description: 'Add a new lead into the CRM pipeline.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              business_name: { type: 'string' },
              contact_name: { type: 'string', description: 'Full name of the contact' },
              email: { type: 'string' },
              phone: { type: 'string' },
              industry: { type: 'string' },
              source: { type: 'string', description: 'Where this lead came from (e.g. AI Agent, Referral, LinkedIn)' },
              notes: { type: 'string', description: 'Qualifying notes about this lead' },
            },
            required: ['tenant_id', 'contact_name'],
          },
        },
        {
          name: 'update_lead_status',
          description: 'Qualify, disqualify, or advance a lead through the pipeline. Use when a lead is ready to be moved to the next stage.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              lead_id: { type: 'string', description: 'UUID of the lead to update' },
              status: { type: 'string', description: 'new | contacted | qualified | converted | disqualified' },
              stage: { type: 'string', description: 'lead | prospect | opportunity | negotiation | closed_won | closed_lost' },
              notes: { type: 'string', description: 'Reason for the status change or qualifying notes' },
            },
            required: ['tenant_id', 'lead_id'],
          },
        },
        // ── Deals ──────────────────────────────────────────────────────────
        {
          name: 'get_deals',
          description: 'Fetch deals/opportunities from the CRM pipeline.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              stage: { type: 'string', description: 'lead | qualified | proposal | negotiation | closed_won | closed_lost' },
              limit: { type: 'number' },
            },
            required: ['tenant_id'],
          },
        },
        {
          name: 'create_deal',
          description: 'Create a new deal in the CRM pipeline from a qualified lead.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              name: { type: 'string', description: 'Deal name/title' },
              value: { type: 'number', description: 'Estimated deal value in USD' },
              stage: { type: 'string', description: 'lead | qualified | proposal | negotiation | closed_won | closed_lost (default: qualified)' },
              description: { type: 'string' },
            },
            required: ['tenant_id', 'name'],
          },
        },
        // ── Projects ───────────────────────────────────────────────────────
        {
          name: 'get_projects',
          description:
            'List business projects for the workspace. tenant_id must be the workspace UUID from your MCP URL (never a name or slug).',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string', description: 'Workspace UUID' },
              status: { type: 'string' },
            },
            required: ['tenant_id'],
          },
        },
        {
          name: 'update_project_status',
          description:
            'Update a project status. project_id must be the UUID from get_projects, not the project name.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              project_id: { type: 'string', description: 'UUID from get_projects' },
              status: { type: 'string' },
              notes: { type: 'string' },
            },
            required: ['tenant_id', 'project_id', 'status'],
          },
        },
        // ── Tasks & Scheduling ─────────────────────────────────────────────
        {
          name: 'get_tasks',
          description: 'Retrieve tasks. Use to see what is pending, what is due, or what is assigned to a team member.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              project_id: {
                type: 'string',
                description: 'Optional. UUID of the linked business project (same as tasks.related_to_project).',
              },
              assigned_to: { type: 'string' },
              completed: { type: 'boolean', description: 'If true, only completed tasks; if false, only open tasks.' },
            },
            required: ['tenant_id'],
          },
        },
        {
          name: 'create_task',
          description: 'Create a task or schedule a follow-up. Use for reminders, action items, and scheduled calls.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              project_id: {
                type: 'string',
                description: 'Optional. UUID of business project to link (stored as related_to_project).',
              },
              assigned_to: { type: 'string' },
              due_date: { type: 'string', description: 'ISO 8601 datetime (e.g. 2026-04-15T09:00:00Z)' },
              priority: { type: 'string', description: 'low | medium | high | urgent' },
            },
            required: ['tenant_id', 'title'],
          },
        },
        // ── Finance & Expenses ─────────────────────────────────────────────
        {
          name: 'get_expenses',
          description: 'Read-only: Fetch expense records for a tenant. Use to review spending or find receipts.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              status: { type: 'string', description: 'pending | approved | rejected' },
              from_date: { type: 'string', description: 'YYYY-MM-DD' },
              to_date: { type: 'string', description: 'YYYY-MM-DD' },
            },
            required: ['tenant_id'],
          },
        },
        {
          name: 'create_expense',
          description: 'Log a new business expense. Use when the user describes a purchase or receipt they want recorded.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              description: { type: 'string', description: 'What was purchased / vendor name' },
              amount: { type: 'number', description: 'Amount in USD' },
              category: { type: 'string', description: 'Office Supplies | Travel | Software | Marketing | Meals | Utilities | Other' },
              date: { type: 'string', description: 'YYYY-MM-DD (defaults to today)' },
            },
            required: ['tenant_id', 'description', 'amount'],
          },
        },
        {
          name: 'get_revenue_summary',
          description: 'Read-only: Total revenue, outstanding invoices, and paid amounts for the tenant.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              period: { type: 'string', description: 'monthly | quarterly | yearly' },
            },
            required: ['tenant_id'],
          },
        },
        // ── Contracts ──────────────────────────────────────────────────────
        {
          name: 'generate_contract_draft',
          description: 'Use AI to draft a professional contract (NDA, MSA, SOW, Service Agreement, etc.) and save it to the system for review.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              contract_type: { type: 'string', description: 'NDA | MSA | SOW | Service Agreement | Consulting Agreement | Freelance Contract' },
              client_name: { type: 'string', description: 'Name of the client or counterparty' },
              key_terms: { type: 'string', description: 'Describe the scope, payment terms, duration, deliverables, and any special conditions' },
            },
            required: ['tenant_id', 'contract_type', 'client_name'],
          },
        },
        // ── Analytics & Momentum ───────────────────────────────────────────
        {
          name: 'get_momentum_score',
          description: 'Get the gamification XP, level, and momentum score for a user.',
          inputSchema: {
            type: 'object',
            properties: { user_id: { type: 'string' } },
            required: ['user_id'],
          },
        },
        {
          name: 'get_recent_messages',
          description: 'Read the most recent client or team messages.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              limit: { type: 'number' },
            },
            required: ['tenant_id'],
          },
        },
        {
          name: 'get_quotes',
          description: 'Read-only: List quotes and proposals with their statuses.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              status: { type: 'string', description: 'draft | sent | accepted | declined' },
            },
            required: ['tenant_id'],
          },
        },
        {
          name: 'write_audit_log',
          description:
            'Insert a row into audit_logs (tenant-scoped). Use to persist agent notes, integration events, or any structured record the user asked to store.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              action: { type: 'string', description: 'Short action key, e.g. mcp_note | integration_sync | user_request' },
              entity_type: { type: 'string', description: 'Category, e.g. mcp | lead | integration' },
              entity_id: { type: 'string', description: 'Optional UUID of related entity' },
              summary: { type: 'string', description: 'Human-readable one-line summary' },
              payload: {
                type: 'object',
                description: 'Optional JSON object merged into new_values (along with summary and source)',
              },
            },
            required: ['tenant_id', 'action', 'entity_type'],
          },
        },
      ],
    }));

    // ── Tool Execution ─────────────────────────────────────────────────────────
    this.server.setRequestHandler(CallToolRequestSchema, async (request: unknown) => {
      const { name, arguments: args } = (request as {
        params: { name: string; arguments?: Record<string, unknown> };
      }).params;
      const supabaseAdmin = createSupabaseAdminClient();
      const supabase = supabaseAdmin;
      let result: any;

      try {
        switch (name) {
        // ── get_clients ────────────────────────────────────────────────────
        case 'get_clients': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { status, limit = 20 } = a;
          let query = supabaseAdmin
            .from('business_clients')
            .select('id, name, email, phone, company, status, created_at, source')
            .eq('tenant_id', tenant_id)
            .limit(Math.min(limit, 100));
          if (status) query = query.eq('status', status);
          const { data, error } = await query;
          if (error) throw supabaseErrorToMcpClientError('get_clients', error.message);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        // ── create_client ──────────────────────────────────────────────────
        case 'create_client': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { name, email, phone, company, status = 'lead', source = 'MCP Agent' } = a;
          const { data, error } = await supabaseAdmin
            .from('business_clients')
            .insert({ tenant_id, name, email, phone, company, status, source })
            .select('id, name, email')
            .single();
          if (error) throw supabaseErrorToMcpClientError('create_client', error.message);
          result = {
            content: [
              {
                type: 'text',
                text: `Client created: ${JSON.stringify(data)}. Next: open Contacts to verify details, advance funnel stage forward only, and attach a Deal or Invoice when there is real opportunity.`,
              },
            ],
          };
          break;
        }

        // ── get_leads ──────────────────────────────────────────────────────
        case 'get_leads': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { status, stage, limit = 20 } = a;
          let query = supabaseAdmin
            .from('leads')
            .select(
              'id, business_name, email, phone, industry, location, status, stage, source, notes, assigned_to, created_at'
            )
            .eq('tenant_id', tenant_id)
            .order('created_at', { ascending: false })
            .limit(Math.min(Number(limit) || 20, 100));
          if (status) query = query.eq('status', status);
          if (stage) query = query.eq('stage', stage);
          const { data, error } = await query;
          if (error) throw supabaseErrorToMcpClientError('get_leads', error.message);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        // ── create_lead ────────────────────────────────────────────────────
        case 'create_lead': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { business_name, contact_name, email, phone, industry, source = 'AI Agent', notes } = a;
          const primaryName = (business_name || contact_name || '').trim();
          if (!primaryName) throw new Error('create_lead requires contact_name or business_name');
          const { data, error } = await supabaseAdmin
            .from('leads')
            .insert({
              tenant_id,
              business_name: primaryName,
              email: email || null,
              phone: phone || null,
              industry: industry || '',
              status: 'new',
              stage: 'lead',
              source,
              notes: notes || null,
            })
            .select('id, business_name, email, status')
            .single();
          if (error) throw supabaseErrorToMcpClientError('create_lead', error.message);
          result = {
            content: [
              {
                type: 'text',
                text: `Lead added to CRM: ${JSON.stringify(data)}. Next for the business: in AlphaClone open Leads pipeline to qualify, then create a Deal with amount and expected close; source is stored on the lead for attribution.`,
              },
            ],
          };
          break;
        }

        // ── update_lead_status ─────────────────────────────────────────────
        case 'update_lead_status': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { lead_id, status, stage, notes } = a;
          if (!isUuidString(lead_id)) {
            throw new Error('lead_id must be a valid lead UUID from get_leads');
          }
          const update: Record<string, any> = {};
          if (status) update.status = status;
          if (stage) update.stage = stage;
          if (notes) update.notes = notes;
          if (Object.keys(update).length === 0) throw new Error('Provide at least one of: status, stage, notes');
          const { error } = await supabaseAdmin
            .from('leads')
            .update(update)
            .eq('id', lead_id.trim())
            .eq('tenant_id', tenant_id);
          if (error) throw supabaseErrorToMcpClientError('update_lead_status', error.message);
          result = { content: [{ type: 'text', text: `Lead ${lead_id} updated: ${JSON.stringify(update)}` }] };
          break;
        }

        // ── get_deals ──────────────────────────────────────────────────────
        case 'get_deals': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { stage, limit = 20 } = a;
          let query = supabaseAdmin
            .from('deals')
            .select('id, name, value, stage, description, source, created_at')
            .eq('tenant_id', tenant_id)
            .order('created_at', { ascending: false })
            .limit(Math.min(limit, 100));
          if (stage) query = query.eq('stage', stage);
          const { data, error } = await query;
          if (error) throw supabaseErrorToMcpClientError('get_deals', error.message);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        // ── create_deal ────────────────────────────────────────────────────
        case 'create_deal': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { name, value, stage = 'qualified', description } = a;
          const { data, error } = await supabaseAdmin
            .from('deals')
            .insert({ tenant_id, name, value: value || 0, stage, description, source: 'MCP Agent' })
            .select('id, name, value, stage')
            .single();
          if (error) throw supabaseErrorToMcpClientError('create_deal', error.message);
          result = {
            content: [
              {
                type: 'text',
                text: `Deal created: ${JSON.stringify(data)}. Next: set expected close and probability in Deals, tie to a contact, and when won use Billing/Accounting so revenue is recorded.`,
              },
            ],
          };
          break;
        }

        // ── get_projects ───────────────────────────────────────────────────
        case 'get_projects': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { status } = a;
          let query = supabaseAdmin
            .from('business_projects')
            .select('id, name, status, due_date, description, created_at')
            .eq('tenant_id', tenant_id)
            .limit(50);
          if (status) query = query.eq('status', status);
          const { data, error } = await query;
          if (error) throw supabaseErrorToMcpClientError('get_projects', error.message);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        // ── update_project_status ──────────────────────────────────────────
        case 'update_project_status': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { project_id, status, notes } = a;
          if (!isUuidString(project_id)) {
            throw new Error('project_id must be a valid UUID from get_projects (not a project name)');
          }
          const update: Record<string, any> = { status };
          if (notes) update.description = notes;
          const { error } = await supabaseAdmin
            .from('business_projects')
            .update(update)
            .eq('id', project_id.trim())
            .eq('tenant_id', tenant_id);
          if (error) throw supabaseErrorToMcpClientError('update_project_status', error.message);
          result = { content: [{ type: 'text', text: `Project ${project_id} updated to: ${status}` }] };
          break;
        }

        // ── get_tasks ──────────────────────────────────────────────────────
        case 'get_tasks': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { project_id, assigned_to, completed } = a;
          let query = supabaseAdmin
            .from('tasks')
            .select(
              'id, title, description, status, priority, due_date, assigned_to, related_to_project, related_to_contact, related_to_deal, related_to_lead, created_at'
            )
            .eq('tenant_id', tenant_id)
            .limit(50);
          if (project_id) {
            if (!isUuidString(project_id)) {
              throw new Error('project_id must be a valid business project UUID from get_projects');
            }
            query = query.eq('related_to_project', project_id.trim());
          }
          if (assigned_to) {
            if (!isUuidString(assigned_to)) {
              throw new Error('assigned_to must be a valid user profile UUID');
            }
            query = query.eq('assigned_to', assigned_to.trim());
          }
          if (completed === true) query = query.eq('status', 'completed');
          if (completed === false) query = query.neq('status', 'completed');
          const { data, error } = await query;
          if (error) throw supabaseErrorToMcpClientError('get_tasks', error.message);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        // ── create_task ────────────────────────────────────────────────────
        case 'create_task': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { title, description, project_id, assigned_to, due_date, priority = 'medium' } = a;
          if (project_id != null && project_id !== '' && !isUuidString(project_id)) {
            throw new Error('project_id must be a valid business project UUID or omitted');
          }
          if (assigned_to != null && assigned_to !== '' && !isUuidString(assigned_to)) {
            throw new Error('assigned_to must be a valid user UUID or omitted');
          }
          const { data, error } = await supabaseAdmin
            .from('tasks')
            .insert({
              tenant_id,
              title,
              description: description ?? null,
              related_to_project: project_id && isUuidString(project_id) ? project_id.trim() : null,
              assigned_to: assigned_to && isUuidString(assigned_to) ? assigned_to.trim() : null,
              due_date: due_date ?? null,
              priority,
              status: 'todo',
            })
            .select('id, title, due_date, priority, related_to_project')
            .single();
          if (error) throw supabaseErrorToMcpClientError('create_task', error.message);
          result = { content: [{ type: 'text', text: `Task created: ${JSON.stringify(data)}` }] };
          break;
        }

        // ── get_expenses ───────────────────────────────────────────────────
        case 'get_expenses': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { status, from_date, to_date } = a;
          let query = supabase
            .from('expenses')
            .select('id, description, amount, category, date, status, receipt_url, created_at')
            .eq('tenant_id', tenant_id)
            .order('date', { ascending: false })
            .limit(50);
          if (status) query = query.eq('status', status);
          if (from_date) query = query.gte('date', from_date);
          if (to_date) query = query.lte('date', to_date);
          const { data, error } = await query;
          if (error) throw supabaseErrorToMcpClientError('get_expenses', error.message);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        // ── create_expense ─────────────────────────────────────────────────
        case 'create_expense': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { description, amount, category, date } = a;
          const { data, error } = await supabase
            .from('expenses')
            .insert({
              tenant_id,
              description,
              amount,
              category: category || 'Uncategorized',
              date: date || new Date().toISOString().split('T')[0],
              status: 'pending',
            })
            .select('id, description, amount, category, date')
            .single();
          if (error) throw new Error(`create_expense failed: ${error.message}`);
          result = { content: [{ type: 'text', text: `Expense logged: ${JSON.stringify(data)}` }] };
          break;
        }

        // ── write_audit_log ────────────────────────────────────────────────
        case 'write_audit_log': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { action, entity_type, entity_id, summary, payload } = a;
          const newValues: Record<string, unknown> = {
            source: 'mcp_agent',
            ...(payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}),
          };
          if (summary != null && summary !== '') newValues.summary = String(summary);

          const { data, error } = await supabaseAdmin
            .from('audit_logs')
            .insert({
              tenant_id,
              action: String(action).slice(0, 100),
              entity_type: String(entity_type).slice(0, 50),
              entity_id: entity_id || null,
              new_values: newValues,
            })
            .select('id, action, entity_type, created_at')
            .single();

          if (error) throw supabaseErrorToMcpClientError('write_audit_log', error.message);
          result = { content: [{ type: 'text', text: `Audit log written: ${JSON.stringify(data)}` }] };
          break;
        }

        // ── get_revenue_summary ────────────────────────────────────────────
        case 'get_revenue_summary': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { data, error } = await supabase
            .from('business_invoices')
            .select('total, status, created_at')
            .eq('tenant_id', tenant_id)
            .limit(200);
          if (error) throw supabaseErrorToMcpClientError('get_revenue_summary', error.message);
          const paid = (data ?? [])
            .filter((i: { status?: string }) => i.status === 'paid')
            .reduce((s: number, i: { total?: number }) => s + (Number(i.total) || 0), 0);
          const outstanding = (data ?? [])
            .filter((i: { status?: string }) => i.status !== 'paid')
            .reduce((s: number, i: { total?: number }) => s + (Number(i.total) || 0), 0);
          result = {
            content: [{
              type: 'text',
              text: JSON.stringify({ total_invoices: data?.length, total_paid: paid, total_outstanding: outstanding, currency: 'USD' }, null, 2),
            }],
          };
          break;
        }

        // ── generate_contract_draft ────────────────────────────────────────
        case 'generate_contract_draft': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { contract_type, client_name, key_terms } = a;

          const { data: tenantRow } = await supabaseAdmin
            .from('tenants')
            .select('subscription_plan')
            .eq('id', tenant_id)
            .maybeSingle();
          const plan = (tenantRow?.subscription_plan as string) || 'free';
          const quota = await consumeTenantAiUnits(
            supabaseAdmin,
            tenant_id,
            plan,
            unitsForTextGeneration(2048)
          );
          if (!quota.ok) {
            throw new Error(
              'Daily AI usage limit reached for this workspace. Try again after UTC midnight or upgrade your plan.'
            );
          }

          const apiKey = process.env.ANTHROPIC_API_KEY;
          if (!apiKey) throw new Error(MCP_GENERIC_OPERATION_ERROR);

          const anthropic = new Anthropic({ apiKey });
          const aiResponse = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 2048,
            messages: [{
              role: 'user',
              content: `Draft a professional ${contract_type} for a client named "${client_name}". Key terms and scope: ${key_terms || 'Standard professional terms'}. Write a complete, legally-structured contract with all standard sections (parties, recitals, terms, obligations, payment, termination, governing law). Use plain, professional language.`,
            }],
          });

          const contractContent = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : '';

          // Attempt to save to contracts table
          const { data, error } = await supabase
            .from('contracts')
            .insert({
              tenant_id,
              title: `${contract_type}: ${client_name}`,
              content: contractContent,
              status: 'draft',
              type: contract_type.toLowerCase().replace(/\s+/g, '_'),
            })
            .select('id, title, status')
            .single();

          if (error) {
            // Return the draft even if save fails
            result = {
              content: [{
                type: 'text',
                text: `Contract draft generated for ${client_name} (could not be saved automatically — open Contracts in the app to save):\n\n${contractContent}`,
              }],
            };
          } else {
            result = {
              content: [{
                type: 'text',
                text: `Contract draft saved!\nID: ${data.id}\nTitle: ${data.title}\nStatus: draft — ready for your review in the Contracts section.\n\nPreview:\n${contractContent.substring(0, 400)}...`,
              }],
            };
          }
          break;
        }

        // ── get_momentum_score ─────────────────────────────────────────────
        case 'get_momentum_score': {
          const a = args as Record<string, any>;
          const user_id = this.requireProfileUser(a);
          const { data, error } = await supabase
            .from('profiles')
            .select('xp, level, streak_count, momentum_score')
            .eq('id', user_id)
            .single();
          if (error) throw supabaseErrorToMcpClientError('get_momentum_score', error.message);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        // ── get_recent_messages ────────────────────────────────────────────
        case 'get_recent_messages': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { limit = 10 } = a;
          const { data, error } = await supabase
            .from('messages')
            .select('id, content, sender_id, created_at, thread_id')
            .eq('tenant_id', tenant_id)
            .order('created_at', { ascending: false })
            .limit(Math.min(limit, 50));
          if (error) throw supabaseErrorToMcpClientError('get_recent_messages', error.message);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        // ── get_quotes ─────────────────────────────────────────────────────
        case 'get_quotes': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { status } = a;
          let query = supabase
            .from('quotes')
            .select('id, title, status, total_amount, client_id, created_at, valid_until')
            .eq('tenant_id', tenant_id)
            .limit(50);
          if (status) query = query.eq('status', status);
          const { data, error } = await query;
          if (error) throw supabaseErrorToMcpClientError('get_quotes', error.message);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        default:
          throw new Error(`Unknown tool: "${name}". Available tools include get_clients, get_leads, create_lead, update_lead_status, get_deals, create_deal, create_task, get_tasks, generate_contract_draft, get_expenses, create_expense, and more.`);
        }

        // ── Audit Logging ──────────────────────────────────────────────────
        const auditTenant = this.ctx?.tenantId ?? (args as Record<string, any>)?.tenant_id;
        if (auditTenant) {
          auditLoggingService.logAction(
            `mcp_tool_execute:${name}`,
            'mcp_integration',
            auditTenant as string,
            args,
            result
          ).catch(err => console.error('Failed to log MCP audit:', err));
        }

        return result;
      } catch (error: unknown) {
        console.error(`MCP Tool Execution Error [${name}]:`, error);
        if (error instanceof Error) {
          throw error;
        }
        throw new Error(MCP_GENERIC_OPERATION_ERROR);
      }
    });
  }
}

export const mcpServerInstance = new AlphaCloneMCPServer();

/** Per-request MCP server bound to the authenticated tenant + user (from API key or OAuth). */
export function createMCPServer(ctx?: MCPConnectionContext): AlphaCloneMCPServer {
  return new AlphaCloneMCPServer(ctx);
}
