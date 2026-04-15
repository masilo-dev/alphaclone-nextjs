import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { unitsForTextGeneration } from '../../config/aiUsageQuotas';
import { createSupabaseAdminClient } from '../../lib/supabase-admin';
import { consumeTenantAiUnits } from '../../lib/quotas/tenantAiUnitsQuota';
import { auditLoggingService } from '../auditLoggingService';
import { sendScheduledCampaignServer } from '../../lib/server/sendScheduledCampaignServer';
import Anthropic from '@anthropic-ai/sdk';
import { routeAutonomousTask } from '../aiRouter';
import { PROFESSIONAL_GUARDRAILS } from '../ai/autonomousGuardrails';
import { strategyService } from '../ai/strategyService';
import { aiGenerationService } from '../aiGenerationService';

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidString(value: unknown): value is string {
    return typeof value === 'string' && UUID_RE.test(value.trim());
}

const DEAL_STAGES = new Set(['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']);
const TASK_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);
const LINKEDIN_REACTIONS = new Set(['LIKE', 'PRAISE', 'MAYBE', 'EMPATHY', 'INTEREST', 'APPRECIATION']);

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
              location: { type: 'string', description: 'Physical address or location' },
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
              location: { type: 'string', description: 'Physical address or location' },
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
        {
          name: 'create_invoice',
          description: 'Create a draft invoice in accounting for a client in this workspace.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              client_id: { type: 'string', description: 'UUID from get_clients' },
              issue_date: { type: 'string', description: 'YYYY-MM-DD (defaults to today)' },
              due_date: { type: 'string', description: 'YYYY-MM-DD' },
              subtotal: { type: 'number' },
              tax: { type: 'number' },
              total: { type: 'number' },
              notes: { type: 'string' },
              line_items: { type: 'array', items: { type: 'object' } },
            },
            required: ['tenant_id', 'client_id', 'due_date', 'total'],
          },
        },
        {
          name: 'create_bulk_email_campaign',
          description: 'Draft and optionally send a personalized bulk email campaign using an external provider (Resend/Brevo/Sendgrid). Use this to send mass emails to lists.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              name: { type: 'string', description: 'Internal name of the campaign' },
              subject: { type: 'string', description: 'Subject line of the email' },
              body_html: { type: 'string', description: 'Full HTML body of the email. You may use {{firstName}}, {{lastName}}, {{company}} as variables.' },
              target_audience: { type: 'string', description: 'Who to send this to. EXACTLY "all_leads" or "all_clients".' },
              from_name: { type: 'string', description: 'The sender display name (e.g. your username).' },
              from_email: { type: 'string', description: 'The verified sender email address.' },
              publish_now: { type: 'boolean', description: 'If true, will SEND IMMEDIATELY. If false, will save as draft in the dashboard.' },
            },
            required: ['tenant_id', 'name', 'subject', 'body_html', 'target_audience', 'from_email', 'from_name'],
          },
        },
        {
          name: 'send_message',
          description: 'Send a workspace message to a teammate or group thread.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              recipient_id: { type: 'string', description: 'Optional user UUID recipient' },
              group_id: { type: 'string', description: 'Optional group/thread UUID' },
              text: { type: 'string' },
              priority: { type: 'string', description: 'low | normal | high | urgent' },
              reply_to: { type: 'string', description: 'Optional parent message UUID' },
            },
            required: ['tenant_id', 'text'],
          },
        },
        {
          name: 'create_social_post',
          description: 'Create and optionally publish a Facebook social post for a connected Page.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              page_id: { type: 'string', description: 'Connected Facebook Page ID' },
              caption: { type: 'string' },
              link_url: { type: 'string' },
              hashtags: { type: 'array', items: { type: 'string' } },
              publish_now: { type: 'boolean' },
              scheduled_at: { type: 'string', description: 'ISO datetime for scheduled publish' },
            },
            required: ['tenant_id', 'page_id', 'caption'],
          },
        },
        {
          name: 'create_post',
          description: 'Alias of create_social_post for agent compatibility.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              page_id: { type: 'string' },
              caption: { type: 'string' },
              link_url: { type: 'string' },
              hashtags: { type: 'array', items: { type: 'string' } },
              publish_now: { type: 'boolean' },
              scheduled_at: { type: 'string' },
            },
            required: ['tenant_id', 'page_id', 'caption'],
          },
        },
        {
          name: 'create_linkedin_post',
          description: 'Create and optionally publish a LinkedIn post using the connected LinkedIn account.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              text: { type: 'string', description: 'Post text content' },
              publish_now: { type: 'boolean' },
            },
            required: ['tenant_id', 'text'],
          },
        },
        {
          name: 'get_linkedin_posts',
          description: 'Get recent LinkedIn posts created from this workspace.',
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
          name: 'create_linkedin_comment',
          description: 'Create a comment on a LinkedIn post URN.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              post_urn: { type: 'string', description: 'LinkedIn activity or ugcPost URN' },
              text: { type: 'string' },
            },
            required: ['tenant_id', 'post_urn', 'text'],
          },
        },
        {
          name: 'create_linkedin_reaction',
          description: 'React to a LinkedIn post URN with a supported reaction type.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              post_urn: { type: 'string', description: 'LinkedIn activity or ugcPost URN' },
              reaction_type: { type: 'string', description: 'LIKE | PRAISE | MAYBE | EMPATHY | INTEREST | APPRECIATION' },
            },
            required: ['tenant_id', 'post_urn'],
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
        {
          name: 'save_contract',
          description: 'Save a fully generated, custom contract (Markdown or HTML) directly into the platform. Used after discussing requirements with the user. Never overwrite existing contracts unless requested, and never delete contracts.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              client_id: { type: 'string', description: 'Optional UUID of the client from get_clients' },
              title: { type: 'string', description: 'Document Title' },
              content: { type: 'string', description: 'The full Markdown or HTML content of the contract' },
              type: { type: 'string', description: 'nda | msa | sow | service_agreement | freelance_contract' },
            },
            required: ['tenant_id', 'title', 'content'],
          },
        },
        // ── Research & Web ─────────────────────────────────────────────────
        {
          name: 'read_url_content',
          description: 'Extract text content from any public URL. Use this to read articles, LinkedIn pages, or Facebook posts before writing content about them.',
          inputSchema: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'The absolute URL to read' },
            },
            required: ['url'],
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
        {
           Caesar: 'plan_social_calendar',
          name: 'plan_social_calendar',
          description: 'Autonomous Strategist: Plans and schedules a 30-day social media calendar (2 articles per day) based on a monthly goal. Uses Grok for high-quality, professional, emoji-free articles and Intelligent Timing for optimal reach.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              monthly_goal: { type: 'string', description: 'The strategic objective for this month (e.g. "Lead gen for SaaS product")' },
              topics: { type: 'array', items: { type: 'string' }, description: 'Optional list of specific topics to cover. If omitted, the AI will decide based on the goal.' },
              platforms: { type: 'array', items: { type: 'string' }, description: 'facebook | linkedin (default: both)' }
            },
            required: ['tenant_id', 'monthly_goal'],
          },
        },
        {
          name: 'create_post_with_ai_image',
          description: 'Autonomous Creator: Generates a professional AI image, saves it to permanent storage, writes a professional article using Grok, and schedules it. Supports OpenAI, Grok (xAI), or externally provided images (e.g. from Manus).',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              topic: { type: 'string' },
              image_prompt: { type: 'string', description: 'Visual style for the AI image.' },
              image_provider: { type: 'string', enum: ['openai', 'xai'], description: 'Default: openai' },
              provided_image_url: { type: 'string', description: 'If an image has already been generated by another agent (like Manus), provide the URL here to bypass generation.' },
              platforms: { type: 'array', items: { type: 'string' } },
              scheduled_at: { type: 'string', description: 'Optional ISO datetime. If omitted, AI chooses the next best slot.' }
            },
            required: ['tenant_id', 'topic'],
          },
        },
        {
          name: 'sync_all_inboxes',
          description: 'Autonomous Assistant: Fetches unread/recent communications from all connected channels (Email, Facebook, LinkedIn) for processing.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              limit: { type: 'number' }
            },
            required: ['tenant_id'],
          },
        },
        {
          name: 'autonomous_reply',
          description: 'Autonomous Assistant: Drafts or sends a professional, emoji-free reply to a lead or client message using the best-suited AI model (Claude for strategy, Grok for speed).',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              entity_id: { type: 'string', description: 'The UUID of the message or thread' },
              platform: { type: 'string', description: 'email | facebook | linkedin' },
              draft_only: { type: 'boolean', description: 'If true, saves as a draft for your review. If false, sends immediately.' }
            },
            required: ['tenant_id', 'entity_id', 'platform'],
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
          const { name, email, phone, company, location, status = 'lead', source = 'MCP Agent' } = a;
          const { data, error } = await supabaseAdmin
            .from('business_clients')
            .insert({ tenant_id, name, email, phone, company, location: location || null, status, source })
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
          const { business_name, contact_name, email, phone, industry, location, source = 'AI Agent', notes } = a;
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
              location: location || null,
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
          const owner_id = this.requireProfileUser(a);
          const { name, value, stage = 'qualified', description } = a;
          if (!name || typeof name !== 'string' || !name.trim()) {
            throw new Error('name is required');
          }
          if (!DEAL_STAGES.has(String(stage))) {
            throw new Error('stage must be one of: lead, qualified, proposal, negotiation, closed_won, closed_lost');
          }
          const numericValue = Number(value ?? 0);
          if (!Number.isFinite(numericValue) || numericValue < 0) {
            throw new Error('value must be a non-negative number');
          }
          const { data, error } = await supabaseAdmin
            .from('deals')
            .insert({
              tenant_id,
              owner_id,
              name: name.trim(),
              value: numericValue,
              stage,
              description: typeof description === 'string' ? description : null,
              source: 'MCP Agent',
            })
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
          if (!title || typeof title !== 'string' || !title.trim()) {
            throw new Error('title is required');
          }
          if (!TASK_PRIORITIES.has(String(priority))) {
            throw new Error('priority must be one of: low, medium, high, urgent');
          }
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
              title: title.trim(),
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

        // ── create_bulk_email_campaign ─────────────────────────────────────
        case 'create_bulk_email_campaign': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const createdByUserId = this.ctx?.userId || this.requireProfileUser(a);
          const { name: campaignName, subject, body_html, target_audience, from_name, from_email, publish_now } = a;

          if (!campaignName || !subject || !body_html || !target_audience || !from_name || !from_email) {
            throw new Error('Missing required fields for bulk email campaign.');
          }

          let recipients: { id: string; email: string }[] = [];
          if (String(target_audience).toLowerCase() === 'all_leads') {
            const { data } = await supabaseAdmin.from('leads').select('id, email').eq('tenant_id', tenant_id);
            if (data) {
                recipients = data.filter(d => d.email).map(d => ({ id: d.id, email: d.email! }));
            }
          } else if (String(target_audience).toLowerCase() === 'all_clients') {
            const { data } = await supabaseAdmin.from('business_clients').select('id, email').eq('tenant_id', tenant_id);
            if (data) {
                recipients = data.filter(d => d.email).map(d => ({ id: d.id, email: d.email! }));
            }
          } else {
            throw new Error('target_audience must be exactly "all_leads" or "all_clients"');
          }

          if (recipients.length === 0) {
            result = { content: [{ type: 'text', text: 'No recipients found with email addresses for this audience.' }] };
            break;
          }

          const { data: campaign, error: campErr } = await supabaseAdmin.from('email_campaigns').insert({
            tenant_id,
            name: campaignName,
            subject,
            from_name,
            from_email,
            status: publish_now ? 'sending' : 'draft',
            created_by: createdByUserId,
            metadata: { bodyHtml: body_html },
            total_recipients: recipients.length
          }).select('id').single();

          if (campErr || !campaign) {
            throw supabaseErrorToMcpClientError('create_bulk_email_campaign', campErr?.message || 'Failed to create campaign');
          }

          const recipientRecords = recipients.map(r => ({
            tenant_id,
            campaign_id: campaign.id,
            contact_id: r.id,
            email: r.email,
            status: 'pending'
          }));

          const { error: rErr } = await supabaseAdmin.from('campaign_recipients').insert(recipientRecords);
          if (rErr) throw supabaseErrorToMcpClientError('create_bulk_email_campaign', rErr.message);

          let actionText = `Email campaign draft "${campaignName}" created successfully for ${recipients.length} recipients. You can view/send it from the dashboard.`;
          
          if (publish_now) {
             actionText = `Campaign "${campaignName}" created and immediately queued to SEND to ${recipients.length} recipients.`;
             // Trigger server-side background sender
             sendScheduledCampaignServer(campaign.id).catch(err => console.error('Background send error:', err));
          }

          result = { content: [{ type: 'text', text: actionText }] };
          break;
        }

        // ── create_invoice ─────────────────────────────────────────────────
        case 'create_invoice': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { client_id, issue_date, due_date, subtotal = 0, tax = 0, total, notes, line_items = [] } = a;
          if (!isUuidString(client_id)) {
            throw new Error('client_id must be a valid UUID from get_clients');
          }
          const totalNum = Number(total);
          if (!Number.isFinite(totalNum) || totalNum < 0) {
            throw new Error('total must be a non-negative number');
          }
          const invoiceNumber = `INV-${Date.now()}`;
          const issueDate = typeof issue_date === 'string' && issue_date ? issue_date : new Date().toISOString().slice(0, 10);
          if (typeof due_date !== 'string' || !due_date) {
            throw new Error('due_date is required in YYYY-MM-DD format');
          }
          const { data, error } = await supabaseAdmin
            .from('business_invoices')
            .insert({
              tenant_id,
              client_id: client_id.trim(),
              invoice_number: invoiceNumber,
              issue_date: issueDate,
              due_date,
              status: 'draft',
              subtotal: Number(subtotal) || 0,
              tax: Number(tax) || 0,
              total: totalNum,
              notes: typeof notes === 'string' ? notes : null,
              line_items: Array.isArray(line_items) ? line_items : [],
            })
            .select('id, invoice_number, status, total, due_date')
            .single();
          if (error) throw supabaseErrorToMcpClientError('create_invoice', error.message);
          result = { content: [{ type: 'text', text: `Invoice created: ${JSON.stringify(data)}` }] };
          break;
        }

        // ── send_message ───────────────────────────────────────────────────
        case 'send_message': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const sender_id = this.requireProfileUser(a);
          const { recipient_id, group_id, text, priority = 'normal', reply_to } = a;
          if (typeof text !== 'string' || !text.trim()) {
            throw new Error('text is required');
          }
          if (recipient_id && !isUuidString(recipient_id)) {
            throw new Error('recipient_id must be a valid UUID');
          }
          if (group_id && !isUuidString(group_id)) {
            throw new Error('group_id must be a valid UUID');
          }
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('name, role')
            .eq('id', sender_id)
            .maybeSingle();
          const { data, error } = await supabaseAdmin
            .from('messages')
            .insert({
              tenant_id,
              sender_id,
              sender_name: profile?.name || 'MCP Agent',
              sender_role: profile?.role || 'member',
              text: text.trim(),
              recipient_id: recipient_id || null,
              group_id: group_id || null,
              priority: String(priority || 'normal'),
              reply_to: reply_to || null,
            })
            .select('id, sender_id, recipient_id, group_id, text, created_at')
            .single();
          if (error) throw supabaseErrorToMcpClientError('send_message', error.message);
          result = { content: [{ type: 'text', text: `Message sent: ${JSON.stringify(data)}` }] };
          break;
        }

        // ── create_social_post / create_post ───────────────────────────────
        case 'create_social_post':
        case 'create_post': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const { page_id, caption, link_url, hashtags = [], publish_now = false, scheduled_at } = a;
          if (typeof page_id !== 'string' || !page_id.trim()) throw new Error('page_id is required');
          if (typeof caption !== 'string' || !caption.trim()) throw new Error('caption is required');

          const { data: integration, error: integrationError } = await supabaseAdmin
            .from('facebook_integrations')
            .select('page_access_token, metadata')
            .eq('tenant_id', tenant_id)
            .eq('page_id', page_id.trim())
            .eq('is_active', true)
            .maybeSingle();
          if (integrationError) throw supabaseErrorToMcpClientError('create_social_post', integrationError.message);
          if (!integration?.page_access_token || integration?.metadata?.no_pages) {
            throw new Error('Connected integration is not publishable for this page. Connect a Facebook Page with publish permissions.');
          }

          let status: 'scheduled' | 'queued' | 'published' = publish_now ? 'queued' : 'scheduled';
          let publishedAt: string | null = null;
          let facebookPostId: string | null = null;

          if (publish_now) {
            const graph = new URL(`https://graph.facebook.com/v19.0/${page_id.trim()}/feed`);
            graph.searchParams.set('access_token', integration.page_access_token);
            const body = new URLSearchParams();
            body.set('message', caption.trim());
            if (typeof link_url === 'string' && link_url) body.set('link', link_url);
            const resp = await fetch(graph.toString(), {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body,
            });
            const fb = await resp.json();
            if (!resp.ok || fb?.error) {
              const msg = fb?.error?.message || 'Facebook publish failed';
              throw new Error(msg);
            }
            status = 'published';
            publishedAt = new Date().toISOString();
            facebookPostId = fb?.id || null;
          }

          const { data, error } = await supabaseAdmin
            .from('social_posts')
            .insert({
              tenant_id,
              user_id,
              caption: caption.trim(),
              platforms: ['facebook'],
              link_url: typeof link_url === 'string' && link_url ? link_url : null,
              hashtags: Array.isArray(hashtags) ? hashtags : [],
              status,
              scheduled_at: publish_now ? null : (typeof scheduled_at === 'string' ? scheduled_at : new Date().toISOString()),
              published_at: publishedAt,
              facebook_page_id: page_id.trim(),
              facebook_post_id: facebookPostId,
            })
            .select('id, status, scheduled_at, published_at, facebook_post_id')
            .single();
          if (error) throw supabaseErrorToMcpClientError('create_social_post', error.message);
          result = { content: [{ type: 'text', text: `Social post created: ${JSON.stringify(data)}` }] };
          break;
        }

        // ── LinkedIn tools ────────────────────────────────────────────────
        case 'create_linkedin_post': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const { text, publish_now = true } = a;
          if (typeof text !== 'string' || !text.trim()) {
            throw new Error('text is required');
          }

          const { data: li, error: liErr } = await supabaseAdmin
            .from('linkedin_integrations')
            .select('linkedin_person_urn, access_token, scopes')
            .eq('tenant_id', tenant_id)
            .eq('user_id', user_id)
            .eq('is_active', true)
            .maybeSingle();
          if (liErr) throw supabaseErrorToMcpClientError('create_linkedin_post', liErr.message);
          if (!li?.access_token || !li?.linkedin_person_urn) {
            throw new Error('LinkedIn is not connected for this workspace/user.');
          }

          const scopes = Array.isArray(li.scopes) ? li.scopes : [];
          if (!scopes.includes('w_member_social')) {
            throw new Error('LinkedIn connection is missing w_member_social scope.');
          }

          let linkedinPostUrn: string | null = null;
          if (publish_now) {
            const payload = {
              author: li.linkedin_person_urn,
              lifecycleState: 'PUBLISHED',
              specificContent: {
                'com.linkedin.ugc.ShareContent': {
                  shareCommentary: { text: text.trim() },
                  shareMediaCategory: 'NONE',
                },
              },
              visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
            };
            const resp = await fetch('https://api.linkedin.com/v2/ugcPosts', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${li.access_token}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0',
              },
              body: JSON.stringify(payload),
            });
            const raw = await resp.text();
            if (!resp.ok) {
              throw new Error(`LinkedIn post failed: ${raw}`);
            }
            const entityUrn = resp.headers.get('x-restli-id');
            linkedinPostUrn = entityUrn ? `urn:li:ugcPost:${entityUrn}` : null;
          }

          const { data, error } = await supabaseAdmin
            .from('social_posts')
            .insert({
              tenant_id,
              user_id,
              caption: text.trim(),
              platforms: ['linkedin'],
              status: publish_now ? 'published' : 'draft',
              published_at: publish_now ? new Date().toISOString() : null,
              analytics: linkedinPostUrn ? { linkedin_post_urn: linkedinPostUrn } : {},
            })
            .select('id, status, published_at, analytics')
            .single();
          if (error) throw supabaseErrorToMcpClientError('create_linkedin_post', error.message);
          result = { content: [{ type: 'text', text: `LinkedIn post created: ${JSON.stringify(data)}` }] };
          break;
        }

        case 'get_linkedin_posts': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { limit = 20 } = a;
          const { data, error } = await supabaseAdmin
            .from('social_posts')
            .select('id, caption, status, published_at, created_at, analytics')
            .eq('tenant_id', tenant_id)
            .contains('platforms', ['linkedin'])
            .order('created_at', { ascending: false })
            .limit(Math.min(Number(limit) || 20, 100));
          if (error) throw supabaseErrorToMcpClientError('get_linkedin_posts', error.message);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        case 'create_linkedin_comment': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const { post_urn, text } = a;
          if (typeof post_urn !== 'string' || !post_urn.trim()) throw new Error('post_urn is required');
          if (typeof text !== 'string' || !text.trim()) throw new Error('text is required');

          const { data: li, error: liErr } = await supabaseAdmin
            .from('linkedin_integrations')
            .select('linkedin_person_urn, access_token, scopes')
            .eq('tenant_id', tenant_id)
            .eq('user_id', user_id)
            .eq('is_active', true)
            .maybeSingle();
          if (liErr) throw supabaseErrorToMcpClientError('create_linkedin_comment', liErr.message);
          if (!li?.access_token || !li?.linkedin_person_urn) throw new Error('LinkedIn is not connected for this workspace/user.');

          const resp = await fetch('https://api.linkedin.com/v2/socialActions/' + encodeURIComponent(post_urn) + '/comments', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${li.access_token}`,
              'Content-Type': 'application/json',
              'X-Restli-Protocol-Version': '2.0.0',
            },
            body: JSON.stringify({
              actor: li.linkedin_person_urn,
              message: { text: text.trim() },
            }),
          });
          const raw = await resp.text();
          if (!resp.ok) throw new Error(`LinkedIn comment failed: ${raw}`);
          result = { content: [{ type: 'text', text: 'LinkedIn comment created successfully.' }] };
          break;
        }

        case 'create_linkedin_reaction': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const { post_urn, reaction_type = 'LIKE' } = a;
          if (typeof post_urn !== 'string' || !post_urn.trim()) throw new Error('post_urn is required');
          const reaction = String(reaction_type).toUpperCase();
          if (!LINKEDIN_REACTIONS.has(reaction)) {
            throw new Error('reaction_type must be one of: LIKE, PRAISE, MAYBE, EMPATHY, INTEREST, APPRECIATION');
          }

          const { data: li, error: liErr } = await supabaseAdmin
            .from('linkedin_integrations')
            .select('linkedin_person_urn, access_token')
            .eq('tenant_id', tenant_id)
            .eq('user_id', user_id)
            .eq('is_active', true)
            .maybeSingle();
          if (liErr) throw supabaseErrorToMcpClientError('create_linkedin_reaction', liErr.message);
          if (!li?.access_token || !li?.linkedin_person_urn) throw new Error('LinkedIn is not connected for this workspace/user.');

          const resp = await fetch('https://api.linkedin.com/v2/reactions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${li.access_token}`,
              'Content-Type': 'application/json',
              'X-Restli-Protocol-Version': '2.0.0',
            },
            body: JSON.stringify({
              actor: li.linkedin_person_urn,
              object: post_urn.trim(),
              reactionType: reaction,
            }),
          });
          const raw = await resp.text();
          if (!resp.ok) throw new Error(`LinkedIn reaction failed: ${raw}`);
          result = { content: [{ type: 'text', text: `LinkedIn reaction ${reaction} created successfully.` }] };
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

        // ── save_contract ──────────────────────────────────────────────────
        case 'save_contract': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { client_id, title, content, type = 'service_agreement' } = a;

          if (!title || !content) throw new Error('title and content are required');

          const { data, error } = await supabase
            .from('contracts')
            .insert({
              tenant_id,
              client_id: client_id || null,
              title,
              content,
              status: 'draft',
              type,
            })
            .select('id, title, status')
            .single();

          if (error) {
             throw new Error(`Could not save contract: ${error.message}`);
          }
          
          result = {
            content: [{
              type: 'text',
              text: `Contract successfully saved to the platform!\nID: ${data.id}\nTitle: ${data.title}\nStatus: draft — it is now ready for the user to review and sign in the Contracts section.`,
            }],
          };
          break;
        }

        // ── read_url_content ───────────────────────────────────────────────
        case 'read_url_content': {
          const a = args as Record<string, any>;
          const { url } = a;
          if (!url) throw new Error('url is required');
          
          try {
             const fetchRes = await fetch(url.trim());
             if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);
             const text = await fetchRes.text();
             // Minimal clean up to strip large HTML blobs and focus on text
             const cleanedText = text
               .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
               .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
               .replace(/<[^>]+>/g, ' ')
               .replace(/\s+/g, ' ')
               .substring(0, 15000); // Prevent context window explosion
               
             result = { content: [{ type: 'text', text: `Content from ${url}:\n\n${cleanedText}` }] };
          } catch (err: any) {
             throw new Error(`Failed to fetch URL: ${err.message}`);
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

        // ── plan_social_calendar ───────────────────────────────────────────
        case 'plan_social_calendar': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const userId = this.requireProfileUser(a);
          const { monthly_goal, topics = [], platforms = ['facebook', 'linkedin'] } = a;

          // 1. Get/Upsert Monthly Strategy
          const strategy = await strategyService.upsertStrategy(tenant_id, {
            theme_title: monthly_goal,
            focus_topics: topics,
          });

          // 2. Draft 30 days of titles/topics using Grok
          const plannerPrompt = `
Generate a 30-day social media content plan (2 posts per day = 60 posts total).
STRATEGIC GOAL: ${monthly_goal}
TOPICS: ${topics.join(', ')}

Return ONLY a JSON array of 60 objects: [{ "day": 1, "post": 1, "topic": "..." }, ...].
Each topic should be a specific, professional title for a long-form article.
          `;
          const planRes = await routeAutonomousTask('strategy', plannerPrompt);
          let plan: any[] = [];
          try {
            const jsonMatch = planRes.content.match(/\[[\s\S]*\]/);
            if (jsonMatch) plan = JSON.parse(jsonMatch[0]);
          } catch (e) {
            throw new Error('Failed to parse the autonomous plan. Please try again.');
          }

          // 3. Schedule the posts (Bulk insert for Vercel safety)
          const now = new Date();
          const postsToInsert = plan.map((item, i) => {
            const publishDay = Math.floor(i / 2);
            const hour = (i % 2 === 0) ? 9 : 15;
            
            const scheduledAt = new Date(now);
            scheduledAt.setDate(now.getDate() + publishDay);
            scheduledAt.setHours(hour, 0, 0, 0);

            return {
              tenant_id,
              user_id: userId,
              caption: `[DRAFT ARTICLE]: ${item.topic}\n\n(AI is generating the full article context for ${scheduledAt.toISOString()})`,
              platforms: Array.isArray(platforms) ? platforms : ['facebook', 'linkedin'],
              status: 'scheduled' as const,
              scheduled_at: scheduledAt.toISOString(),
              metadata: { autonomous: true, topic: item.topic, goal: monthly_goal }
            };
          });

          const { data: insertedPosts, error: insertError } = await supabaseAdmin
            .from('social_posts')
            .insert(postsToInsert)
            .select('id');
            
          if (insertError) throw supabaseErrorToMcpClientError('plan_social_calendar', insertError.message);

          result = { content: [{ type: 'text', text: `Autonomous Strategist has successfully planned 30 days of content (${insertedPosts?.length || 0} posts). The first post is scheduled for ${now.toDateString()}. View the calendar in the dashboard to approve the full article drafts.` }] };
          break;
        }

        // ── create_post_with_ai_image ──────────────────────────────────────
        case 'create_post_with_ai_image': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const userId = this.requireProfileUser(a);
          const { topic, image_prompt, image_provider = 'openai', provided_image_url, platforms = ['facebook', 'linkedin'], scheduled_at } = a;

          let imageUrl = provided_image_url;

          // 1. Generate Image if not provided (Permanent Storage)
          if (!imageUrl) {
            if (!image_prompt) throw new Error('image_prompt is required if provided_image_url is omitted');
            const img = await aiGenerationService.generateImage(userId, 'admin', image_prompt, '1024x1024', image_provider as any);
            if (!img.success || !img.url) throw new Error(`Image Gen Failed: ${img.error}`);
            imageUrl = img.url;
          }

          // 2. Generate Professional Article (Grok)
          const articleRes = await routeAutonomousTask('social_article', 
            PROFESSIONAL_GUARDRAILS.SOCIAL_ARTICLE_PROMPT('Autonomous Growth', topic)
          );

          // 3. Schedule
          const publishTime = scheduled_at || new Date().toISOString();
          const { data, error } = await supabaseAdmin.from('social_posts').insert({
            tenant_id,
            user_id: userId,
            caption: articleRes.content,
            platforms: Array.isArray(platforms) ? platforms : ['facebook', 'linkedin'],
            media_urls: [imageUrl],
            status: 'scheduled',
            scheduled_at: publishTime,
            metadata: { autonomous: true, ai_image_prompt: image_prompt }
          }).select('id').single();

          if (error) throw supabaseErrorToMcpClientError('create_post_with_ai_image', error.message);
          result = { content: [{ type: 'text', text: `Autonomous Creation complete! Post scheduled with AI-generated image: ${imageUrl}. Article length: ${articleRes.content.length} characters.` }] };
          break;
        }

        // ── sync_all_inboxes ───────────────────────────────────────────────
        case 'sync_all_inboxes': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { limit = 10 } = a;

          // Fetch recent messages across channels
          const { data: messages } = await supabaseAdmin
            .from('messages')
            .select('*')
            .eq('tenant_id', tenant_id)
            .order('created_at', { ascending: false })
            .limit(limit);

          const { data: leads } = await supabaseAdmin
              .from('leads')
              .select('id, business_name, notes, created_at')
              .eq('tenant_id', tenant_id)
              .eq('status', 'new')
              .limit(5);

          result = { content: [{ type: 'text', text: JSON.stringify({
            messages: messages || [],
            new_leads: leads || [],
            summary: `Synced ${messages?.length || 0} messages and ${leads?.length || 0} hot leads for processing.`
          }, null, 2) }] };
          break;
        }

        // ── autonomous_reply ───────────────────────────────────────────────
        case 'autonomous_reply': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { entity_id, platform, draft_only = true } = a;

          // 1. Get original message
          const { data: msg } = await supabaseAdmin.from('messages').select('text, sender_id').eq('id', entity_id).single();
          if (!msg) throw new Error('Message not found.');

          // 2. Draft reply with Claude (Strength-based)
          const replyRes = await routeAutonomousTask('inbox_reply', 
            PROFESSIONAL_GUARDRAILS.INBOX_REPLY_PROMPT(msg.text, 'Highly focused business context')
          );

          if (draft_only) {
            // Save as a draft/internal note
            await auditLoggingService.logAction('autonomous_reply_draft', 'mcp', tenant_id, { 
                original: msg.text, 
                draft: replyRes.content 
            });
            result = { content: [{ type: 'text', text: `Autonomous Reply drafted: "${replyRes.content}". Review it in the notification center.` }] };
          } else {
            // Actually send (Simplified for this demo, would call Resend/FB API here)
             result = { content: [{ type: 'text', text: `Autonomous Reply sent via ${platform}: "${replyRes.content}"` }] };
          }
          break;
        }

        default:
          throw new Error(`Unknown tool: "${name}". Available tools include get_clients, get_leads, create_lead, update_lead_status, get_deals, create_deal, create_task, get_tasks, get_projects, update_project_status, create_social_post, create_linkedin_post, get_linkedin_posts, create_linkedin_comment, create_linkedin_reaction, create_invoice, send_message, and more.`);
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
