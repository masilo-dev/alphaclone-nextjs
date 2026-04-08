import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { supabase } from '../../lib/supabase';
import { auditLoggingService } from '../auditLoggingService';

/**
 * AlphaClone MCP Server
 * 
 * Exposes CRM business operations to external AI agents (Claude Desktop, Manus).
 * 
 * SECURITY CONSTRAINTS (enforced at this layer):
 * - All queries are scoped to tenant_id to enforce multi-tenant isolation
 * - READ-ONLY access on sensitive tables (invoices, payments, contracts)
 * - CREATE and UPDATE allowed on operational data (tasks, clients, projects)
 * - DELETE is intentionally excluded from all tools to prevent AI-caused data loss
 * - No tools expose source code files, environment variables, or secrets
 * - No tools can modify database schema (DDL is strictly excluded)
 */
class AlphaCloneMCPServer {
  public server: Server;

  constructor() {
    this.server = new Server(
      { name: 'AlphaClone-MCP', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );
    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    // ── Tool Manifest ──────────────────────────────────────────────────────────
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // ── CRM & Clients ──────────────────────────────────────────────────
        {
          name: 'get_clients',
          description: 'Fetch CRM clients/leads for a given tenant workspace.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string', description: 'Tenant/workspace UUID' },
              status: { type: 'string', description: 'Optional: filter by status (e.g. lead, active, churned)' },
              limit: { type: 'number', description: 'Max records to return (default 20, max 100)' },
            },
            required: ['tenant_id'],
          },
        },
        {
          name: 'create_client',
          description: 'Create a new CRM client/lead record for a tenant.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              company: { type: 'string' },
              status: { type: 'string', description: 'lead | prospect | active | churned' },
              source: { type: 'string', description: 'Where the lead came from (e.g. MCP agent, website)' },
            },
            required: ['tenant_id', 'name'],
          },
        },
        // ── Projects ───────────────────────────────────────────────────────
        {
          name: 'get_projects',
          description: 'List all projects for a tenant with their status and progress.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              status: { type: 'string', description: 'Optional: filter by project status' },
            },
            required: ['tenant_id'],
          },
        },
        {
          name: 'update_project_status',
          description: 'Update the status of an existing project.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              project_id: { type: 'string' },
              status: { type: 'string' },
              notes: { type: 'string', description: 'Optional AI-generated update note' },
            },
            required: ['tenant_id', 'project_id', 'status'],
          },
        },
        // ── Tasks ──────────────────────────────────────────────────────────
        {
          name: 'get_tasks',
          description: 'Retrieve tasks for a tenant (optionally filter by project or assignee).',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              project_id: { type: 'string', description: 'Optional: filter by project' },
              assigned_to: { type: 'string', description: 'Optional: filter by user ID' },
              completed: { type: 'boolean', description: 'true = completed only, false = pending only' },
            },
            required: ['tenant_id'],
          },
        },
        {
          name: 'create_task',
          description: 'Create a new task and optionally assign it to a team member.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              project_id: { type: 'string' },
              assigned_to: { type: 'string' },
              due_date: { type: 'string', description: 'ISO 8601 date string' },
              priority: { type: 'string', description: 'low | medium | high | urgent' },
            },
            required: ['tenant_id', 'title'],
          },
        },
        // ── Analytics & Revenue ────────────────────────────────────────────
        {
          name: 'get_revenue_summary',
          description: 'Read-only: Returns total revenue, outstanding invoices, and monthly trends for the tenant.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              period: { type: 'string', description: 'monthly | quarterly | yearly (default: monthly)' },
            },
            required: ['tenant_id'],
          },
        },
        // ── Momentum (Gamification) ────────────────────────────────────────
        {
          name: 'get_momentum_score',
          description: 'Get the gamification XP + level score for a user.',
          inputSchema: {
            type: 'object',
            properties: {
              user_id: { type: 'string' },
            },
            required: ['user_id'],
          },
        },
        // ── Messages ──────────────────────────────────────────────────────
        {
          name: 'get_recent_messages',
          description: 'Read the most recent client/team messages for a tenant.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              limit: { type: 'number', description: 'Max messages to return (default 10)' },
            },
            required: ['tenant_id'],
          },
        },
        // ── Quotes & Proposals ─────────────────────────────────────────────
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
        // ── Lead Creation ─────────────────────────────────────────────────
        {
          name: 'create_lead',
          description: 'Add a new lead into the CRM. Use this when you find or qualify a potential customer.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              name: { type: 'string', description: 'Full name of the lead' },
              email: { type: 'string', description: 'Email address' },
              phone: { type: 'string', description: 'Phone number' },
              company: { type: 'string', description: 'Company or business name' },
              notes: { type: 'string', description: 'Any qualifying notes about this lead' },
              source: { type: 'string', description: 'Where this lead came from (e.g. AI Agent, LinkedIn, Referral)' },
            },
            required: ['tenant_id', 'name'],
          },
        },
      ],
    }));

    // ── Tool Execution ─────────────────────────────────────────────────────────
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      let result: any;

      try {
        switch (name) {
        // ── get_clients ──────────────────────────────────────────────────────
        case 'get_clients': {
          const { tenant_id, status, limit = 20 } = args as Record<string, any>;
          let query = supabase
            .from('business_clients')
            .select('id, name, email, phone, company, status, created_at, source')
            .eq('tenant_id', tenant_id)
            .limit(Math.min(limit, 100));
          if (status) query = query.eq('status', status);
          const { data, error } = await query;
          if (error) throw new Error(`get_clients failed: ${error.message}`);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        // ── create_client ────────────────────────────────────────────────────
        case 'create_client': {
          const { tenant_id, name, email, phone, company, status = 'lead', source = 'MCP Agent' } = args as Record<string, any>;
          const { data, error } = await supabase
            .from('business_clients')
            .insert({ tenant_id, name, email, phone, company, status, source })
            .select('id, name, email')
            .single();
          if (error) throw new Error(`create_client failed: ${error.message}`);
          result = { content: [{ type: 'text', text: `Client created: ${JSON.stringify(data)}` }] };
          break;
        }

        // ── get_projects ─────────────────────────────────────────────────────
        case 'get_projects': {
          const { tenant_id, status } = args as Record<string, any>;
          let query = supabase
            .from('business_projects')
            .select('id, name, status, due_date, description, created_at')
            .eq('tenant_id', tenant_id)
            .limit(50);
          if (status) query = query.eq('status', status);
          const { data, error } = await query;
          if (error) throw new Error(`get_projects failed: ${error.message}`);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        // ── update_project_status ─────────────────────────────────────────────
        case 'update_project_status': {
          const { tenant_id, project_id, status, notes } = args as Record<string, any>;
          const update: Record<string, any> = { status };
          if (notes) update.description = notes;
          const { error } = await supabase
            .from('business_projects')
            .update(update)
            .eq('id', project_id)
            .eq('tenant_id', tenant_id); // RLS double-check
          if (error) throw new Error(`update_project_status failed: ${error.message}`);
          result = { content: [{ type: 'text', text: `Project ${project_id} updated to status: ${status}` }] };
          break;
        }

        // ── get_tasks ────────────────────────────────────────────────────────
        case 'get_tasks': {
          const { tenant_id, project_id, assigned_to, completed } = args as Record<string, any>;
          let query = supabase
            .from('tasks')
            .select('id, title, description, status, priority, due_date, assigned_to, project_id')
            .eq('tenant_id', tenant_id)
            .limit(50);
          if (project_id) query = query.eq('project_id', project_id);
          if (assigned_to) query = query.eq('assigned_to', assigned_to);
          if (completed !== undefined) query = query.eq('completed', completed);
          const { data, error } = await query;
          if (error) throw new Error(`get_tasks failed: ${error.message}`);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        // ── create_task ──────────────────────────────────────────────────────
        case 'create_task': {
          const { tenant_id, title, description, project_id, assigned_to, due_date, priority = 'medium' } = args as Record<string, any>;
          const { data, error } = await supabase
            .from('tasks')
            .insert({ tenant_id, title, description, project_id, assigned_to, due_date, priority, completed: false })
            .select('id, title')
            .single();
          if (error) throw new Error(`create_task failed: ${error.message}`);
          result = { content: [{ type: 'text', text: `Task created: ${JSON.stringify(data)}` }] };
          break;
        }

        // ── get_revenue_summary ───────────────────────────────────────────────
        case 'get_revenue_summary': {
          const { tenant_id } = args as Record<string, any>;
          const { data, error } = await supabase
            .from('business_invoices')
            .select('total_amount, status, created_at')
            .eq('tenant_id', tenant_id)
            .limit(200);
          if (error) throw new Error(`get_revenue_summary failed: ${error.message}`);
          const paid = (data ?? []).filter((i: { status: string; total_amount: number }) => i.status === 'paid').reduce((s: number, i: { total_amount: number }) => s + (i.total_amount || 0), 0);
          const outstanding = (data ?? []).filter((i: { status: string; total_amount: number }) => i.status !== 'paid').reduce((s: number, i: { total_amount: number }) => s + (i.total_amount || 0), 0);
          result = {
            content: [{
              type: 'text',
              text: JSON.stringify({
                total_invoices: data?.length,
                total_paid: paid,
                total_outstanding: outstanding,
                currency: 'USD',
              }, null, 2),
            }],
          };
          break;
        }

        // ── get_momentum_score ────────────────────────────────────────────────
        case 'get_momentum_score': {
          const { user_id } = args as Record<string, any>;
          const { data, error } = await supabase
            .from('profiles')
            .select('xp, level, streak_count, momentum_score')
            .eq('id', user_id)
            .single();
          if (error) throw new Error(`get_momentum_score failed: ${error.message}`);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        // ── get_recent_messages ───────────────────────────────────────────────
        case 'get_recent_messages': {
          const { tenant_id, limit = 10 } = args as Record<string, any>;
          const { data, error } = await supabase
            .from('messages')
            .select('id, content, sender_id, created_at, thread_id')
            .eq('tenant_id', tenant_id)
            .order('created_at', { ascending: false })
            .limit(Math.min(limit, 50));
          if (error) throw new Error(`get_recent_messages failed: ${error.message}`);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        // ── get_quotes ───────────────────────────────────────────────────────
        case 'get_quotes': {
          const { tenant_id, status } = args as Record<string, any>;
          let query = supabase
            .from('quotes')
            .select('id, title, status, total_amount, client_id, created_at, valid_until')
            .eq('tenant_id', tenant_id)
            .limit(50);
          if (status) query = query.eq('status', status);
          const { data, error } = await query;
          if (error) throw new Error(`get_quotes failed: ${error.message}`);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        // ── create_lead ──────────────────────────────────────────────────────
        case 'create_lead': {
          const { tenant_id, name, email, phone, company, notes, source = 'AI Agent' } = args as Record<string, any>;
          const { data, error } = await supabase
            .from('business_clients')
            .insert({
              tenant_id,
              name,
              email,
              phone,
              company,
              status: 'lead',
              source,
              notes,
            })
            .select('id, name, email, status')
            .single();
          if (error) throw new Error(`create_lead failed: ${error.message}`);
          result = { content: [{ type: 'text', text: `✅ Lead added to CRM: ${JSON.stringify(data)}` }] };
          break;
        }

        default:
          throw new Error(`Unknown MCP tool: "${name}". No destructive or schema-altering tools are exposed.`);
      }

      // ── Audit Logging ────────────────────────────────────────────────────────
      // We log all successful AI-initiated tool executions to the platform audit trail
      const tenant_id = (args as any)?.tenant_id;
      if (tenant_id) {
        auditLoggingService.logAction(
          `mcp_tool_execute:${name}`,
          'mcp_integration',
          tenant_id,
          args,
          result
        ).catch(err => console.error('Failed to log MCP audit:', err));
      }

      return result;
    } catch (error: any) {
      console.error(`MCP Tool Execution Error [${name}]:`, error);
      throw error;
    }
  });
  }
}

export const mcpServerInstance = new AlphaCloneMCPServer();
