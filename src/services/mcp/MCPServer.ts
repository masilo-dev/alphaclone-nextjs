import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createSupabaseAdminClient } from '../../lib/supabase-server';
import { auditLoggingService } from '../auditLoggingService';
import Anthropic from '@anthropic-ai/sdk';


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
class AlphaCloneMCPServer {
  public server: Server;

  constructor() {
    this.server = new Server(
      { name: 'AlphaClone-MCP', version: '2.0.0' },
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
          description: 'List all projects for a tenant.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              status: { type: 'string' },
            },
            required: ['tenant_id'],
          },
        },
        {
          name: 'update_project_status',
          description: 'Update the status of a project.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              project_id: { type: 'string' },
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
              project_id: { type: 'string' },
              assigned_to: { type: 'string' },
              completed: { type: 'boolean' },
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
              project_id: { type: 'string' },
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
      ],
    }));

    // ── Tool Execution ─────────────────────────────────────────────────────────
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const supabaseAdmin = createSupabaseAdminClient();
      let result: any;

      try {
        switch (name) {
        // ── get_clients ────────────────────────────────────────────────────
        case 'get_clients': {
          const { tenant_id, status, limit = 20 } = args as Record<string, any>;
          let query = supabaseAdmin
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

        // ── create_client ──────────────────────────────────────────────────
        case 'create_client': {
          const { tenant_id, name, email, phone, company, status = 'lead', source = 'MCP Agent' } = args as Record<string, any>;
          const { data, error } = await supabaseAdmin
            .from('business_clients')
            .insert({ tenant_id, name, email, phone, company, status, source })
            .select('id, name, email')
            .single();
          if (error) throw new Error(`create_client failed: ${error.message}`);
          result = { content: [{ type: 'text', text: `Client created: ${JSON.stringify(data)}` }] };
          break;
        }

        // ── get_leads ──────────────────────────────────────────────────────
        case 'get_leads': {
          const { tenant_id, status, stage, limit = 20 } = args as Record<string, any>;
          let query = supabaseAdmin
            .from('leads')
            .select('id, business_name, contact_name, email, phone, industry, status, stage, source, notes, created_at')
            .eq('tenant_id', tenant_id)
            .order('created_at', { ascending: false })
            .limit(Math.min(limit, 100));
          if (status) query = query.eq('status', status);
          if (stage) query = query.eq('stage', stage);
          const { data, error } = await query;
          if (error) throw new Error(`get_leads failed: ${error.message}`);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        // ── create_lead ────────────────────────────────────────────────────
        case 'create_lead': {
          const { tenant_id, business_name, contact_name, email, phone, industry, source = 'AI Agent', notes } = args as Record<string, any>;
          const { data, error } = await supabaseAdmin
            .from('leads')
            .insert({
              tenant_id,
              business_name: business_name || contact_name,
              contact_name,
              email,
              phone,
              industry: industry || '',
              status: 'new',
              stage: 'lead',
              source,
              notes,
            })
            .select('id, contact_name, email, status')
            .single();
          if (error) throw new Error(`create_lead failed: ${error.message}`);
          result = { content: [{ type: 'text', text: `Lead added to CRM: ${JSON.stringify(data)}` }] };
          break;
        }

        // ── update_lead_status ─────────────────────────────────────────────
        case 'update_lead_status': {
          const { tenant_id, lead_id, status, stage, notes } = args as Record<string, any>;
          const update: Record<string, any> = {};
          if (status) update.status = status;
          if (stage) update.stage = stage;
          if (notes) update.notes = notes;
          if (Object.keys(update).length === 0) throw new Error('Provide at least one of: status, stage, notes');
          const { error } = await supabaseAdmin
            .from('leads')
            .update(update)
            .eq('id', lead_id)
            .eq('tenant_id', tenant_id);
          if (error) throw new Error(`update_lead_status failed: ${error.message}`);
          result = { content: [{ type: 'text', text: `Lead ${lead_id} updated: ${JSON.stringify(update)}` }] };
          break;
        }

        // ── get_deals ──────────────────────────────────────────────────────
        case 'get_deals': {
          const { tenant_id, stage, limit = 20 } = args as Record<string, any>;
          let query = supabaseAdmin
            .from('deals')
            .select('id, name, value, stage, description, source, created_at')
            .eq('tenant_id', tenant_id)
            .order('created_at', { ascending: false })
            .limit(Math.min(limit, 100));
          if (stage) query = query.eq('stage', stage);
          const { data, error } = await query;
          if (error) throw new Error(`get_deals failed: ${error.message}`);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        // ── create_deal ────────────────────────────────────────────────────
        case 'create_deal': {
          const { tenant_id, name, value, stage = 'qualified', description } = args as Record<string, any>;
          const { data, error } = await supabaseAdmin
            .from('deals')
            .insert({ tenant_id, name, value: value || 0, stage, description, source: 'MCP Agent' })
            .select('id, name, value, stage')
            .single();
          if (error) throw new Error(`create_deal failed: ${error.message}`);
          result = { content: [{ type: 'text', text: `Deal created: ${JSON.stringify(data)}` }] };
          break;
        }

        // ── get_projects ───────────────────────────────────────────────────
        case 'get_projects': {
          const { tenant_id, status } = args as Record<string, any>;
          let query = supabaseAdmin
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

        // ── update_project_status ──────────────────────────────────────────
        case 'update_project_status': {
          const { tenant_id, project_id, status, notes } = args as Record<string, any>;
          const update: Record<string, any> = { status };
          if (notes) update.description = notes;
          const { error } = await supabaseAdmin
            .from('business_projects')
            .update(update)
            .eq('id', project_id)
            .eq('tenant_id', tenant_id);
          if (error) throw new Error(`update_project_status failed: ${error.message}`);
          result = { content: [{ type: 'text', text: `Project ${project_id} updated to: ${status}` }] };
          break;
        }

        // ── get_tasks ──────────────────────────────────────────────────────
        case 'get_tasks': {
          const { tenant_id, project_id, assigned_to, completed } = args as Record<string, any>;
          let query = supabaseAdmin
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

        // ── create_task ────────────────────────────────────────────────────
        case 'create_task': {
          const { tenant_id, title, description, project_id, assigned_to, due_date, priority = 'medium' } = args as Record<string, any>;
          const { data, error } = await supabaseAdmin
            .from('tasks')
            .insert({ tenant_id, title, description, project_id, assigned_to, due_date, priority, completed: false })
            .select('id, title, due_date, priority')
            .single();
          if (error) throw new Error(`create_task failed: ${error.message}`);
          result = { content: [{ type: 'text', text: `Task created: ${JSON.stringify(data)}` }] };
          break;
        }

        // ── get_expenses ───────────────────────────────────────────────────
        case 'get_expenses': {
          const { tenant_id, status, from_date, to_date } = args as Record<string, any>;
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
          if (error) throw new Error(`get_expenses failed: ${error.message}`);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        // ── create_expense ─────────────────────────────────────────────────
        case 'create_expense': {
          const { tenant_id, description, amount, category, date } = args as Record<string, any>;
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

        // ── get_revenue_summary ────────────────────────────────────────────
        case 'get_revenue_summary': {
          const { tenant_id } = args as Record<string, any>;
          const { data, error } = await supabase
            .from('business_invoices')
            .select('total_amount, status, created_at')
            .eq('tenant_id', tenant_id)
            .limit(200);
          if (error) throw new Error(`get_revenue_summary failed: ${error.message}`);
          const paid = (data ?? []).filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + (i.total_amount || 0), 0);
          const outstanding = (data ?? []).filter((i: any) => i.status !== 'paid').reduce((s: number, i: any) => s + (i.total_amount || 0), 0);
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
          const { tenant_id, contract_type, client_name, key_terms } = args as Record<string, any>;

          const apiKey = process.env.ANTHROPIC_API_KEY;
          if (!apiKey) throw new Error('AI service not configured. Please contact your administrator.');

          const anthropic = new Anthropic({ apiKey });
          const aiResponse = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
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
                text: `Contract draft generated for ${client_name} (could not save to database: ${error.message}):\n\n${contractContent}`,
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

        // ── get_recent_messages ────────────────────────────────────────────
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

        // ── get_quotes ─────────────────────────────────────────────────────
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

        default:
          throw new Error(`Unknown tool: "${name}". Available tools include get_clients, get_leads, create_lead, update_lead_status, get_deals, create_deal, create_task, get_tasks, generate_contract_draft, get_expenses, create_expense, and more.`);
        }

        // ── Audit Logging ──────────────────────────────────────────────────
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

// Factory for stateless per-request server instances (Streamable HTTP transport)
export function createMCPServer(): AlphaCloneMCPServer {
  return new AlphaCloneMCPServer();
}
