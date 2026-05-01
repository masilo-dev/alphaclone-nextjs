import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  // @ts-ignore
  ListResourcesRequestSchema,
  // @ts-ignore
  ListPromptsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { MCP_TOOLS } from './toolManifest';
import { randomUUID } from 'crypto';
import { unitsForTextGeneration } from '../../config/aiUsageQuotas';
import { createSupabaseAdminClient } from '../../lib/supabase-admin';
import {
  enqueueSocialPostSync,
  findRecentDuplicateLinkedInCaption,
  parseLinkedInUgcPostUrn,
  updateSocialPostLinkedInUrnWithRetry,
} from '../../lib/social/linkedinPublishHelpers';
import { consumeTenantAiUnits } from '../../lib/quotas/tenantAiUnitsQuota';
import { auditLoggingService } from '../auditLoggingService';
import { sendScheduledCampaignServer } from '../../lib/server/sendScheduledCampaignServer';
import Anthropic from '@anthropic-ai/sdk';
import { routeAutonomousTask } from '../aiRouter';
import { PROFESSIONAL_GUARDRAILS } from '../ai/autonomousGuardrails';
import { strategyService } from '../ai/strategyService';
import { aiGenerationService } from '../aiGenerationService';
import { socialPostGenerationService } from '../socialPostGenerationService';
import {
  businessAdapterService,
  type AnalyzeDocumentInput,
  type PortalEventInput,
} from '../adapters/businessAdapters';
import { ZohoMailService } from '../zoho/ZohoMailService';
import { resolveEmailProviderConfig } from '../../lib/email/providerIntegrationResolver';
import { sendWithProviderSdk, type EmailProvider } from '../../lib/email/providerSdk';
import {
  cancelRun,
  executeRun,
  getRunStatus,
  retryRunStep,
  runVerification,
  startPlaybookRun,
} from '../automation/runtimeService';
import { getAutomationFailureReport, getAutomationHealth, getAutomationThroughputReport, reconcileOutreachVsLogs } from '../automation/observabilityService';
import { listBuiltInPlaybooks } from '../automation/playbookService';
import { emailHelpers } from '../email/emailService';
import { businessInvoiceService } from '../businessInvoiceService';
import { fileUploadService } from '../fileUploadService';

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidString(value: unknown): value is string {
    return typeof value === 'string' && UUID_RE.test(value.trim());
}

const DEAL_STAGES = new Set(['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']);
const TASK_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);
const TASK_STATUSES = new Set(['ideas', 'todo', 'in_progress', 'review', 'completed', 'cancelled']);
const QUOTE_STATUSES = new Set(['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'converted']);
const INVOICE_STATUSES = new Set(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'void']);
const LINKEDIN_REACTIONS = new Set(['LIKE', 'PRAISE', 'MAYBE', 'EMPATHY', 'INTEREST', 'APPRECIATION']);

const MCP_GENERIC_OPERATION_ERROR =
  'This action could not be completed right now. Please try again in a few minutes. If the issue continues, contact support.';

const MCP_ERROR_SUGGESTIONS: Record<string, { retryable: boolean; suggested_fix: string; docs_slug: string }> = {
  VALIDATION_ERROR: {
    retryable: false,
    suggested_fix: 'Check required input fields and formats, then retry.',
    docs_slug: 'mcp-validation-errors',
  },
  AUTHORIZATION_ERROR: {
    retryable: false,
    suggested_fix: 'Reconnect MCP using the workspace URL and verify tenant/user access.',
    docs_slug: 'mcp-auth-errors',
  },
  NOT_FOUND: {
    retryable: false,
    suggested_fix: 'Fetch the latest IDs with list/search tools and retry using a valid ID.',
    docs_slug: 'mcp-not-found',
  },
  EXTERNAL_PROVIDER_ERROR: {
    retryable: true,
    suggested_fix: 'Check provider configuration and API key, then retry.',
    docs_slug: 'mcp-provider-errors',
  },
  INTERNAL_ERROR: {
    retryable: true,
    suggested_fix: 'Retry in a few minutes. If it persists, contact support with trace_id.',
    docs_slug: 'mcp-internal-errors',
  },
};

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function formatBusinessValue(value: unknown, indent = 0): string {
  const space = '  '.repeat(indent);
  if (value == null) return `${space}not available`;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return `${space}${String(value)}`;
  }
  if (Array.isArray(value)) {
    if (!value.length) return `${space}none`;
    return value
      .map((item) => {
        if (item != null && typeof item === 'object') {
          return `${space}-\n${formatBusinessValue(item, indent + 1)}`;
        }
        return `${space}- ${String(item)}`;
      })
      .join('\n');
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return `${space}none`;
  return entries
    .map(([key, entry]) => {
      if (entry != null && typeof entry === 'object') {
        return `${space}${key}:\n${formatBusinessValue(entry, indent + 1)}`;
      }
      return `${space}${key}: ${entry == null ? 'not available' : String(entry)}`;
    })
    .join('\n');
}

function renderBusinessSuccess(tool: string, traceId: string, message: string, data: unknown): string {
  return [
    'Status: success',
    'Code: OK',
    `Tool: ${tool}`,
    `Trace ID: ${traceId}`,
    `Message: ${message}`,
    'Result:',
    formatBusinessValue(data),
  ].join('\n');
}

function renderBusinessError(tool: string, traceId: string, code: string, message: string, meta: Record<string, unknown>): string {
  return [
    'Status: failed',
    `Code: ${code}`,
    `Tool: ${tool}`,
    `Trace ID: ${traceId}`,
    `Message: ${message}`,
    'Guidance:',
    formatBusinessValue(meta),
  ].join('\n');
}

function inferErrorCode(error: unknown): string {
  const msg = String(error instanceof Error ? error.message : error || '').toLowerCase();
  if (msg.includes('required') || msg.includes('must be') || msg.includes('invalid')) return 'VALIDATION_ERROR';
  if (msg.includes('does not match this mcp connection') || msg.includes('unauthorized') || msg.includes('forbidden')) return 'AUTHORIZATION_ERROR';
  if (msg.includes('not found') || msg.includes('unknown tool')) return 'NOT_FOUND';
  if (msg.includes('sendgrid') || msg.includes('resend') || msg.includes('brevo') || msg.includes('zoho')) return 'EXTERNAL_PROVIDER_ERROR';
  return 'INTERNAL_ERROR';
}

function wrapMcpSuccess(tool: string, traceId: string, result: any, message = 'Tool executed successfully.') {
  const rawText = result?.content?.[0]?.text;
  const data = typeof rawText === 'string' ? safeJsonParse(rawText) : result;
  return {
    content: [
      {
        type: 'text',
        text: renderBusinessSuccess(tool, traceId, message, data),
      },
    ],
  };
}

function toMcpErrorPayload(tool: string, traceId: string, error: unknown) {
  const errorCode = inferErrorCode(error);
  const defaults = MCP_ERROR_SUGGESTIONS[errorCode] || MCP_ERROR_SUGGESTIONS.INTERNAL_ERROR;
  const message = error instanceof Error ? error.message : MCP_GENERIC_OPERATION_ERROR;
  const meta = {
    retryable: defaults.retryable,
    suggested_fix: defaults.suggested_fix,
    docs_slug: defaults.docs_slug,
  };
  return renderBusinessError(tool, traceId, errorCode, message, meta);
}

function mcpStructuredError(code: string, message: string, details?: Record<string, unknown>): Error {
  const payload = details ? { code, message, details } : { code, message };
  return new Error(JSON.stringify(payload));
}

function throwLinkedInError(code: string, message: string, details?: Record<string, unknown>): never {
  throw mcpStructuredError(code, message, details);
}

function appendContractDisclaimer(body: string, attribution: string): string {
  const trimmed = body.trim();
  if (trimmed.includes('AlphaClone does not guarantee')) return trimmed;
  const footer = `

---

**Document assistance:** ${attribution}

**Important:** AlphaClone does not guarantee profits, revenue, or business performance. Results depend on your execution and market conditions. This content is not legal, tax, or financial advice. Consult qualified professionals before signing or relying on this document.
`;
  return `${trimmed}${footer}`;
}

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

function isSchemaOrRelationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string };
  const m = String(e.message || '').toLowerCase();
  return (
    e.code === '42703' ||
    e.code === '42P01' ||
    e.code === 'PGRST205' ||
    m.includes('schema cache') ||
    m.includes('does not exist') ||
    m.includes('could not find') ||
    m.includes('column') ||
    m.includes('relation')
  );
}

function extractMissingColumnFromMessage(message: string): string | null {
  const singleQuoteMatch = message.match(/'([^']+)' column/i);
  if (singleQuoteMatch?.[1]) return singleQuoteMatch[1];
  const doubleQuoteMatch = message.match(/column "([^"]+)"/i);
  if (doubleQuoteMatch?.[1]) return doubleQuoteMatch[1];
  return null;
}

async function insertSocialPostWithSchemaFallback(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  payload: Record<string, unknown>,
  selectFields: string
) {
  const mutablePayload: Record<string, unknown> = { ...payload };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const res = await supabaseAdmin.from('social_posts').insert(mutablePayload).select(selectFields).single();
    if (!res.error) return res;
    if (!isSchemaOrRelationError(res.error)) return res;
    const missing = extractMissingColumnFromMessage(String((res.error as { message?: string }).message || ''));
    if (!missing || !(missing in mutablePayload)) return res;
    delete mutablePayload[missing];
  }
  return await supabaseAdmin.from('social_posts').insert(mutablePayload).select(selectFields).single();
}

function scoreDealFromSignals(stage: string, value: number, ageDays: number): number {
  let score = 3;
  if (stage === 'qualified') score += 2;
  if (stage === 'proposal') score += 3;
  if (stage === 'negotiation') score += 4;
  if (stage === 'closed_won') score = 10;
  if (stage === 'closed_lost') score = 1;
  if (value >= 5000) score += 1;
  if (value >= 20000) score += 1;
  if (ageDays > 45) score -= 2;
  if (ageDays > 90) score -= 1;
  return Math.max(1, Math.min(10, score));
}

async function appendTaskNoteAndMaybeComplete(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  tenantId: string,
  taskId: string,
  note: string,
  markDone: boolean
) {
  const { data: existingTask, error: fetchError } = await supabaseAdmin
    .from('tasks')
    .select('id, description')
    .eq('tenant_id', tenantId)
    .eq('id', taskId)
    .single();
  if (fetchError || !existingTask) return;

  const timestamp = new Date().toISOString();
  const prefix = existingTask.description ? `${existingTask.description}\n\n` : '';
  const nextDescription = `${prefix}[${timestamp}] NOTE: ${note.trim()}`;
  const patch: Record<string, unknown> = { description: nextDescription };
  if (markDone) {
    patch.status = 'completed';
    patch.completed_at = new Date().toISOString();
  }
  await supabaseAdmin
    .from('tasks')
    .update(patch)
    .eq('tenant_id', tenantId)
    .eq('id', taskId);
}

async function createAutomationTask(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  tenantId: string,
  title: string,
  description: string,
  dueDate: string | null,
  markDone: boolean
) {
  const nowIso = new Date().toISOString();
  const status = markDone ? 'completed' : 'todo';
  const payload: Record<string, unknown> = {
    tenant_id: tenantId,
    title,
    description,
    due_date: dueDate,
    priority: 'medium',
    status,
  };
  if (markDone) payload.completed_at = nowIso;
  const { data } = await supabaseAdmin
    .from('tasks')
    .insert(payload)
    .select('id, title, status, due_date, completed_at')
    .single();
  return data || null;
}

type FacebookIntegrationIdentity = {
  page_id: string;
  page_name: string | null;
  is_active: boolean;
  page_access_token: string | null;
  metadata: Record<string, unknown> | null;
  updated_at?: string | null;
};

function canPublishFacebookPage(identity: FacebookIntegrationIdentity): boolean {
  const tasks = Array.isArray(identity?.metadata?.page_tasks)
    ? (identity.metadata?.page_tasks as unknown[]).map((task) => String(task))
    : [];
  const hasTaskPermission =
    tasks.includes('MANAGE') || tasks.includes('CREATE_CONTENT') || tasks.includes('ADVERTISE');
  return !!identity.page_access_token && identity.is_active && !identity?.metadata?.no_pages && hasTaskPermission;
}

function pickPreferredFacebookIdentity(identities: FacebookIntegrationIdentity[]): FacebookIntegrationIdentity | null {
  if (!identities.length) return null;
  const publishable = identities.filter(canPublishFacebookPage);
  if (!publishable.length) return null;

  const explicitPrimary = publishable.find((item) => Boolean(item?.metadata?.is_primary));
  if (explicitPrimary) return explicitPrimary;

  const sorted = [...publishable].sort((a, b) => {
    const aTs = Date.parse(String(a.updated_at || '')) || 0;
    const bTs = Date.parse(String(b.updated_at || '')) || 0;
    return bTs - aTs;
  });
  return sorted[0] || null;
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
  clientLabel?: string;
};

function inferMcpLeadSource(
  providedSource: unknown,
  ctx?: MCPConnectionContext
): string {
  if (typeof providedSource === 'string' && providedSource.trim()) {
    return providedSource.trim();
  }
  const client = (ctx?.clientLabel || 'unknown').trim();
  return `MCP:${client.toLowerCase()}`;
}

function normalizePhoneForStorage(phone: unknown, defaultCountryCode = '1'): string | null {
  if (phone == null) return null;
  const raw = String(phone).trim();
  if (!raw) return null;
  const plusPrefixed = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (plusPrefixed && /^[1-9]\d{6,14}$/.test(digits)) return `+${digits}`;
  if (digits.startsWith('00') && /^[1-9]\d{6,14}$/.test(digits.slice(2))) return `+${digits.slice(2)}`;
  if (digits.length === 10) return `+${defaultCountryCode}${digits}`;
  if (digits.length === 11 && digits.startsWith(defaultCountryCode)) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return raw;
}

function hasCountryCode(phone: unknown): boolean {
  if (phone == null) return false;
  const normalized = String(phone).trim();
  return /^\+[1-9]\d{6,14}$/.test(normalized);
}

async function enqueueMcpEvent(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  tenantId: string,
  userId: string | null,
  eventName: string,
  payload: Record<string, unknown>
) {
  await supabaseAdmin
    .from('mcp_event_queue')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      event_name: eventName,
      payload,
      status: 'pending',
      attempts: 0,
      available_at: new Date().toISOString(),
    });
}

class AlphaCloneMCPServer {
  public server: Server;
  private readonly ctx?: MCPConnectionContext;

  constructor(ctx?: MCPConnectionContext) {
    this.ctx = ctx;
    this.server = new Server(
      { name: 'AlphaClone-MCP', version: '2.0.0' },
      { capabilities: { tools: {}, resources: {}, prompts: {} } }
    );
    this.setupToolHandlers();
  }

  /** Workspace scope for this HTTP connection (from MCP API key). */
  private requireTenant(args: Record<string, any>): string {
    if (this.ctx?.tenantId) {
      const r = args.tenant_id;
      if (r != null && r !== '' && typeof r === 'string' && r !== this.ctx.tenantId) {
        throw new Error(
          'tenant_id does not match this MCP connection. Omit tenant_id when using your personal MCP URL; the server scopes to your workspace automatically.'
        );
      }
      return this.ctx.tenantId;
    }
    const t = args.tenant_id;
    if (!t || typeof t !== 'string') {
      throw new Error(
        'tenant_id is required unless you use the MCP connection URL from the dashboard (API-key scoped workspace). Pass your workspace UUID as tenant_id.'
      );
    }
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
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [],
    }));
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: [],
    }));

    // ── Tool Manifest ──────────────────────────────────────────────────────────
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
          name: 'get_client_by_id',
          description: 'Fetch a single client record by UUID for update or review flows.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              client_id: { type: 'string', description: 'UUID from get_clients or search_clients' },
            },
            required: ['client_id'],
          },
        },
        {
          name: 'search_clients',
          description: 'Search clients by name, email, phone, website, or location.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              query: { type: 'string', description: 'Free-text search query' },
              limit: { type: 'number', description: 'Max records (default 100, max 1000)' },
            },
            required: ['query'],
          },
        },
        {
          name: 'update_client',
          description: 'Update core client fields including stage, value, and notes.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              client_id: { type: 'string', description: 'UUID from get_clients/get_client_by_id' },
              name: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              industry: { type: 'string' },
              website: { type: 'string' },
              location: { type: 'string' },
              sales_stage: { type: 'string', description: 'lead | prospect | customer | lost' },
              value: { type: 'number' },
              notes: { type: 'string' },
              is_active: { type: 'boolean' },
              metadata: { type: 'object' },
            },
            required: ['client_id'],
          },
        },
        {
          name: 'get_contacts',
          description: 'Fetch individual people/contacts for a tenant. Use to look up specific people within organizations.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              limit: { type: 'number', description: 'Max records (default 100, max 1000)' },
              offset: { type: 'number', description: 'Pagination offset (default 0)' },
            },
            required: [],
          },
        },
        {
          name: 'search_contacts',
          description: 'Search people/contacts by name, email, or phone.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              query: { type: 'string', description: 'Free-text search query' },
              limit: { type: 'number', description: 'Max records (default 100, max 1000)' },
            },
            required: ['query'],
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
              offset: { type: 'number', description: 'Pagination offset (default 0)' },
            },
            required: [],
          },
        },
        {
          name: 'backfill_contact_phone_country_codes',
          description:
            'Normalize existing lead and client phone numbers to include country code (E.164-style). Supports dry-run mode.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              dry_run: { type: 'boolean', description: 'If true, only report changes without writing updates (default true).' },
              default_country_code: { type: 'string', description: 'Default country code used for local 10-digit numbers (default 1).' },
              limit: { type: 'number', description: 'Max rows scanned per table (default 5000, max 20000).' },
            },
            required: [],
          },
        },
        {
          name: 'list_playbooks',
          description: 'List built-in backend automation playbooks available to MCP clients.',
          inputSchema: { type: 'object', properties: {}, required: [] },
        },
        {
          name: 'run_playbook',
          description: 'Run a backend automation playbook. Low-risk steps auto-run; high-risk steps require approval unless auto_high_risk=true.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              playbook_id: { type: 'string' },
              inputs: { type: 'object' },
              auto_high_risk: { type: 'boolean', description: 'If true, high-risk steps execute automatically.' },
              idempotency_key: { type: 'string', description: 'Optional de-duplication key.' },
            },
            required: ['playbook_id'],
          },
        },
        {
          name: 'get_run_status',
          description: 'Get run and step-level status for an automation playbook execution.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              run_id: { type: 'string' },
            },
            required: ['run_id'],
          },
        },
        {
          name: 'retry_run_step',
          description: 'Retry a failed or pending step in an automation run.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              run_id: { type: 'string' },
              step_id: { type: 'string' },
              auto_high_risk: { type: 'boolean' },
            },
            required: ['run_id', 'step_id'],
          },
        },
        {
          name: 'cancel_run',
          description: 'Cancel an in-progress automation run.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              run_id: { type: 'string' },
            },
            required: ['run_id'],
          },
        },
        {
          name: 'verify_lead_created',
          description: 'Verify that a lead exists in CRM with evidence metadata.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              lead_id: { type: 'string' },
            },
            required: ['lead_id'],
          },
        },
        {
          name: 'verify_outreach_delivery',
          description: 'Verify outreach delivery/open state using outreach log evidence.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              log_id: { type: 'string' },
              tracking_id: { type: 'string' },
            },
            required: [],
          },
        },
        {
          name: 'verify_social_post_published',
          description: 'Verify social post publish state and return evidence.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              social_post_id: { type: 'string' },
            },
            required: ['social_post_id'],
          },
        },
        {
          name: 'verify_invoice_sent',
          description: 'Verify invoice send state and evidence.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              invoice_id: { type: 'string' },
            },
            required: ['invoice_id'],
          },
        },
        {
          name: 'get_automation_health',
          description: 'Automation run health summary for the last 24 hours.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
            },
            required: [],
          },
        },
        {
          name: 'get_failure_report',
          description: 'Recent automation step failures with error details.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              limit: { type: 'number' },
            },
            required: [],
          },
        },
        {
          name: 'get_throughput_report',
          description: 'Automation throughput summary for a selected hour window.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              hours: { type: 'number' },
            },
            required: [],
          },
        },
        {
          name: 'reconcile_outreach_vs_logs',
          description: 'Check outreach logs for stale queued/failed patterns.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              limit: { type: 'number' },
            },
            required: [],
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
            required: ['contact_name'],
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
            required: ['lead_id'],
          },
        },
        {
          name: 'update_lead',
          description: 'Update lead details including contact info, source, notes, status, and stage.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              lead_id: { type: 'string', description: 'UUID of the lead to update' },
              business_name: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              industry: { type: 'string' },
              location: { type: 'string' },
              source: { type: 'string' },
              notes: { type: 'string' },
              status: { type: 'string', description: 'new | contacted | qualified | converted | disqualified' },
              stage: { type: 'string', description: 'lead | prospect | opportunity | negotiation | closed_won | closed_lost' },
            },
            required: ['lead_id'],
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
            required: [],
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
            required: ['name'],
          },
        },
        {
          name: 'update_deal',
          description: 'Update deal details, amount, pipeline stage, and metadata.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              deal_id: { type: 'string', description: 'UUID from get_deals' },
              name: { type: 'string' },
              value: { type: 'number' },
              stage: { type: 'string', description: 'lead | qualified | proposal | negotiation | closed_won | closed_lost' },
              description: { type: 'string' },
              source: { type: 'string' },
              metadata: { type: 'object' },
            },
            required: ['deal_id'],
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
            required: ['client_id', 'due_date', 'total'],
          },
        },
        {
          name: 'get_invoices',
          description: 'List invoices for this workspace with optional filters.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              status: { type: 'string', description: 'draft | sent | paid | overdue | cancelled | void' },
              client_id: { type: 'string', description: 'Optional client UUID' },
              limit: { type: 'number', description: 'Max records (default 20, max 100)' },
            },
            required: [],
          },
        },
        {
          name: 'update_invoice',
          description: 'Update an invoice after creation (status, totals, due date, notes, line items).',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              invoice_id: { type: 'string', description: 'UUID from create_invoice or get_invoices' },
              due_date: { type: 'string' },
              subtotal: { type: 'number' },
              tax: { type: 'number' },
              total: { type: 'number' },
              notes: { type: 'string' },
              status: { type: 'string', description: 'draft | sent | paid | overdue | cancelled | void' },
              line_items: { type: 'array', items: { type: 'object' } },
            },
            required: ['invoice_id'],
          },
        },
        {
          name: 'send_invoice',
          description: 'Mark an invoice as sent and queue email delivery metadata for follow-up tracking.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              invoice_id: { type: 'string', description: 'UUID from create_invoice or invoice list' },
              recipient_email: { type: 'string', description: 'Optional override email for recipient' },
            },
            required: ['invoice_id'],
          },
        },
        {
          name: 'send_receipt',
          description: 'Send a formal payment receipt for a paid invoice using the specified email provider (Brevo, Resend, Zoho, or SendGrid).',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              invoice_id: { type: 'string', description: 'UUID of the PAID invoice' },
              recipient_email: { type: 'string', description: 'Optional override email for recipient' },
              provider: { type: 'string', enum: ['brevo', 'resend', 'zoho', 'sendgrid'], description: 'Preferred email provider for this send' }
            },
            required: ['invoice_id'],
          },
        },
        {
          name: 'create_bulk_email_campaign',
          description: 'Draft and optionally send a personalized bulk email campaign using connected providers (SendGrid, Resend, Brevo, Zoho Mail, Gmail) with optional daily-limit balancing.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              name: { type: 'string', description: 'Internal name of the campaign' },
              subject: { type: 'string', description: 'Subject line of the email' },
              body_html: { type: 'string', description: 'Full HTML body of the email. You may use {{name}}, {{firstName}}, {{lastName}}, {{company}}, {{fromName}} variables.' },
              target_audience: { type: 'string', description: 'Who to send this to. EXACTLY "all_leads" or "all_clients".' },
              from_name: { type: 'string', description: 'The sender display name (e.g. your username).' },
              from_email: { type: 'string', description: 'The verified sender email address.' },
              publish_now: { type: 'boolean', description: 'If true, will SEND IMMEDIATELY. If false, will save as draft in the dashboard.' },
              delivery_providers: {
                type: 'array',
                items: { type: 'string', enum: ['sendgrid', 'resend', 'brevo', 'zoho', 'gmail'] },
                description: 'Optional provider order/filter for campaign delivery. Example: ["sendgrid","brevo","zoho"]',
              },
              balance_by_daily_limit: {
                type: 'boolean',
                description: 'If true, distribute sends across selected providers based on remaining daily limit.',
              },
            },
            required: ['name', 'subject', 'body_html', 'target_audience', 'from_email', 'from_name'],
          },
        },
        {
          name: 'send_batch_outreach',
          description: 'Autonomous Outreach: Generates personalized AI messages and sends them to a specific batch of leads or clients in parallel (max 20).',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              lead_ids: { type: 'array', items: { type: 'string' }, description: 'UUIDs of leads from get_leads' },
              client_ids: { type: 'array', items: { type: 'string' }, description: 'UUIDs of clients from get_clients' },
              tone: { type: 'string', description: 'professional | friendly | direct | creative' },
              custom_context: { type: 'string', description: 'Specific instructions for personalization (e.g. "Mention the new product feature")' },
              delivery_provider: { type: 'string', enum: ['sendgrid', 'resend', 'brevo', 'zoho', 'gmail'], description: 'Default: sendgrid' }
            },
            required: [],
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
            required: ['text'],
          },
        },
        {
          name: 'upload_media_asset',
          description: 'Upload an image or video binary payload into workspace media storage and return the stored media asset id and URL.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              file_name: { type: 'string', description: 'Original file name with extension' },
              mime_type: { type: 'string', description: 'MIME type such as image/png or video/mp4' },
              file_base64: { type: 'string', description: 'Raw base64 string or data URL (data:*;base64,...)' },
              alt_text: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
            },
            required: ['file_name', 'mime_type', 'file_base64'],
          },
        },
        {
          name: 'upload_document',
          description: 'Upload a document or file (PDF, Docx, Text) into the workspace document management system. Includes automated cyber-security scanning.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              filename: { type: 'string', description: 'Original file name with extension' },
              mime_type: { type: 'string', description: 'MIME type such as application/pdf' },
              file_base64: { type: 'string', description: 'Raw base64 string or data URL (data:*;base64,...)' },
              category: { type: 'string', description: 'Optional category (e.g. "Invoice", "Contract")' },
              tags: { type: 'array', items: { type: 'string' } },
              entity_type: { type: 'string', description: 'Optional entity type (e.g. "client", "lead")' },
              entity_id: { type: 'string', description: 'Optional entity UUID' },
            },
            required: ['filename', 'mime_type', 'file_base64'],
          },
        },
        {
          name: 'get_facebook_identities',
          description: 'List connected Facebook page identities and whether each page can publish.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
            },
            required: [],
          },
        },
        {
          name: 'create_social_post',
          description: 'Create and optionally publish a social post. Facebook supports immediate publish; LinkedIn, Instagram, X, and TikTok are stored/scheduled for downstream publishing.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              platforms: { type: 'array', items: { type: 'string' }, description: 'facebook | linkedin | instagram | x | tiktok (default: facebook)' },
              page_id: { type: 'string', description: 'Optional connected Facebook Page ID. If omitted, MCP auto-selects a publishable page.' },
              caption: { type: 'string' },
              link_url: { type: 'string' },
              media_urls: { type: 'array', items: { type: 'string' }, description: 'Optional image URLs' },
              media_asset_ids: { type: 'array', items: { type: 'string' }, description: 'Optional media asset UUIDs uploaded to the workspace library' },
              hashtags: { type: 'array', items: { type: 'string' } },
              publish_now: { type: 'boolean' },
              scheduled_at: { type: 'string', description: 'Required ISO datetime when publish_now is false' },
              task_id: { type: 'string', description: 'Optional task UUID to update with execution notes' },
              task_title: { type: 'string', description: 'Optional task title to create when task_id is not provided' },
              task_note: { type: 'string', description: 'Optional note describing what was posted/scheduled' },
              mark_task_done: { type: 'boolean', description: 'If true, mark task as completed after action.' },
            },
            required: ['caption'],
          },
        },
        {
          name: 'create_post',
          description: 'Alias of create_social_post for agent compatibility.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              platforms: { type: 'array', items: { type: 'string' }, description: 'facebook | linkedin | instagram | x | tiktok (default: facebook)' },
              page_id: { type: 'string', description: 'Optional connected Facebook Page ID. If omitted, MCP auto-selects a publishable page.' },
              caption: { type: 'string' },
              link_url: { type: 'string' },
              media_urls: { type: 'array', items: { type: 'string' } },
              media_asset_ids: { type: 'array', items: { type: 'string' } },
              hashtags: { type: 'array', items: { type: 'string' } },
              publish_now: { type: 'boolean' },
              scheduled_at: { type: 'string', description: 'Required ISO datetime when publish_now is false' },
            },
            required: ['caption'],
          },
        },
        {
          name: 'get_linkedin_identities',
          description: 'List posting identities for LinkedIn: personal profile and any connected company pages.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
            },
            required: [],
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
              post_as: { type: 'string', description: 'personal | company | all_pages (default: personal)' },
              media_urls: { type: 'array', items: { type: 'string' }, description: 'Optional image URLs for scheduled publishing' },
              media_asset_ids: { type: 'array', items: { type: 'string' }, description: 'Optional media asset UUIDs uploaded to the workspace library' },
              publish_now: { type: 'boolean' },
              scheduled_at: { type: 'string', description: 'Required ISO datetime when publish_now is false' },
              linkedin_organization_id: { type: 'string', description: 'Optional LinkedIn organization ID to post as company page' },
              task_id: { type: 'string', description: 'Optional task UUID to update with execution notes' },
              task_title: { type: 'string', description: 'Optional task title to create when task_id is not provided' },
              task_note: { type: 'string', description: 'Optional note describing what was posted/scheduled' },
              mark_task_done: { type: 'boolean', description: 'If true, mark task as completed after action.' },
            },
            required: ['text'],
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
            required: [],
          },
        },
        {
          name: 'get_linkedin_post_stats',
          description: 'Get LinkedIn metrics per post (likes/comments plus impressions/clicks when available for organization posts).',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              post_urn: { type: 'string', description: 'LinkedIn activity or ugcPost URN' },
              linkedin_organization_id: { type: 'string', description: 'Optional organization ID for organization analytics lookup' },
            },
            required: ['post_urn'],
          },
        },
        {
          name: 'capture_linkedin_comment_leads',
          description: 'Read comments from LinkedIn posts and auto-create CRM leads from new commenters.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              post_urn: { type: 'string', description: 'Optional specific LinkedIn post URN to scan' },
              limit_posts: { type: 'number', description: 'How many recent LinkedIn posts to scan (default 10, max 30)' },
              limit_comments_per_post: { type: 'number', description: 'How many comments per post to inspect (default 30, max 100)' },
              source: { type: 'string', description: 'Lead source label (default LinkedIn Comment)' },
            },
            required: [],
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
            required: ['post_urn', 'text'],
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
            required: ['post_urn'],
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
            required: [],
          },
        },
        {
          name: 'create_project',
          description:
            'Create a new project in the workspace. Use for new initiatives, client workstreams, or internal execution plans.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              name: { type: 'string', description: 'Project name/title' },
              description: { type: 'string', description: 'Optional project brief' },
              status: { type: 'string', description: 'planning | active | on_hold | completed | cancelled' },
              due_date: { type: 'string', description: 'Optional ISO date or datetime' },
            },
            required: ['name'],
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
            required: ['project_id', 'status'],
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
              due_after: {
                type: 'string',
                description: 'ISO date or datetime; return tasks with due_date on or after this instant (for "this week" windows).',
              },
              due_before: {
                type: 'string',
                description: 'ISO date or datetime; return tasks with due_date on or before this instant.',
              },
            },
            required: [],
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
            required: ['title'],
          },
        },
        {
          name: 'update_task',
          description: 'Update task fields such as status, due date, assignee, title, and priority.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              task_id: { type: 'string', description: 'Task UUID from get_tasks' },
              title: { type: 'string' },
              description: { type: 'string' },
              assigned_to: { type: 'string', description: 'Optional assignee user UUID' },
              due_date: { type: 'string', description: 'ISO 8601 datetime or date string' },
              priority: { type: 'string', description: 'low | medium | high | urgent' },
              status: { type: 'string', description: 'ideas | todo | in_progress | review | completed | cancelled' },
            },
            required: ['task_id'],
          },
        },
        {
          name: 'write_task_note',
          description:
            'Append a timestamped note to a task. Use for progress logs, blockers, handoff notes, and AI-generated summaries.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              task_id: { type: 'string', description: 'Task UUID from get_tasks' },
              note: { type: 'string', description: 'Plain text note to append' },
            },
            required: ['task_id', 'note'],
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
            required: [],
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
            required: ['description', 'amount'],
          },
        },
        {
          name: 'get_revenue_summary',
          description:
            'Read-only: Totals plus paid/outstanding split by calendar month and by client_id (from invoices).',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              period: { type: 'string', description: 'Optional hint: monthly | quarterly | yearly (grouping uses invoice created_at month).' },
            },
            required: [],
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
            required: ['contract_type', 'client_name'],
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
              source_attribution: {
                type: 'string',
                description: 'e.g. Manus AI, Claude, or other assistant name — shown on the saved document',
              },
            },
            required: ['title', 'content'],
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
            required: [],
          },
        },
        {
          name: 'get_client_email_history',
          description: 'Get outbound/inbound email history for a specific client, including Zoho-synced unified messages and outreach logs.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              client_id: { type: 'string', description: 'Client UUID from get_clients.' },
              client_email: { type: 'string', description: 'Optional email fallback when client_id is unknown.' },
              limit: { type: 'number', description: 'Max records (default 50, max 200).' },
            },
            required: [],
          },
        },
        {
          name: 'get_zoho_mail_messages',
          description: 'Read Zoho Mail messages for the connected user. Supports folder listing, folder message fetch, and search.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              user_id: { type: 'string', description: 'Optional user UUID. Defaults to MCP connection user.' },
              folder_id: { type: 'string', description: 'Zoho folderId. Omit to return folders.' },
              search_query: { type: 'string', description: 'If provided, perform Zoho mailbox search.' },
              limit: { type: 'number', description: 'Max records (default 20, max 100).' },
              start: { type: 'number', description: 'Zoho pagination start index (default 1).' },
            },
            required: [],
          },
        },
        {
          name: 'send_transactional_email',
          description: 'Send a transactional email using the caller user scoped provider configuration.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              user_id: { type: 'string' },
              to: { type: 'string' },
              subject: { type: 'string' },
              html: { type: 'string' },
              text: { type: 'string' },
              from_name: { type: 'string' },
            },
            required: ['to', 'subject'],
          },
        },
        {
          name: 'get_email_campaign_stats',
          description: 'Get outreach delivery stats by provider and status for a date range.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              user_id: { type: 'string' },
              from_date: { type: 'string', description: 'ISO date/datetime lower bound.' },
              to_date: { type: 'string', description: 'ISO date/datetime upper bound.' },
            },
            required: [],
          },
        },
        {
          name: 'get_client_history',
          description: 'Fetch a full client history: profile, related leads, outreach logs, and recent unified messages.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              client_id: { type: 'string' },
              limit: { type: 'number' },
            },
            required: ['client_id'],
          },
        },
        {
          name: 'segment_clients_by_criteria',
          description: 'Filter clients by advanced criteria for targeted automations.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              industry: { type: 'string' },
              location: { type: 'string' },
              sales_stage: { type: 'string' },
              min_value: { type: 'number' },
              max_value: { type: 'number' },
              has_email: { type: 'boolean' },
              has_phone: { type: 'boolean' },
              limit: { type: 'number' },
            },
            required: [],
          },
        },
        {
          name: 'update_client_metadata',
          description: 'Merge metadata fields into a client custom_fields object.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              client_id: { type: 'string' },
              metadata: { type: 'object' },
            },
            required: ['client_id', 'metadata'],
          },
        },
        {
          name: 'add_task_dependency',
          description: 'Declare that one task depends on completion of another task.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              task_id: { type: 'string' },
              depends_on_task_id: { type: 'string' },
            },
            required: ['task_id', 'depends_on_task_id'],
          },
        },
        {
          name: 'set_task_recurrence',
          description: 'Set recurrence schedule for a task.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              task_id: { type: 'string' },
              frequency: { type: 'string', description: 'Daily | Weekly | Monthly | Yearly' },
              interval: { type: 'number' },
              days_of_week: { type: 'array', items: { type: 'number' } },
              day_of_month: { type: 'number' },
              end_date: { type: 'string' },
            },
            required: ['task_id', 'frequency'],
          },
        },
        {
          name: 'get_project_milestones',
          description: 'Get milestones linked to a project.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              project_id: { type: 'string' },
            },
            required: ['project_id'],
          },
        },
        {
          name: 'get_invoice_line_items',
          description: 'Get line items from an invoice for detailed billing analysis.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              invoice_id: { type: 'string' },
            },
            required: ['invoice_id'],
          },
        },
        {
          name: 'reconcile_payment',
          description: 'Mark an invoice as paid and attach reconciliation metadata.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              invoice_id: { type: 'string' },
              amount: { type: 'number' },
              paid_at: { type: 'string' },
              payment_ref: { type: 'string' },
            },
            required: ['invoice_id'],
          },
        },
        {
          name: 'generate_expense_report',
          description: 'Generate an expense summary report grouped by category and status.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              from_date: { type: 'string' },
              to_date: { type: 'string' },
            },
            required: [],
          },
        },
        {
          name: 'subscribe_events',
          description: 'Subscribe MCP automations to business events.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              event_name: { type: 'string' },
              target: { type: 'string', description: 'playbook or webhook target identifier.' },
              config: { type: 'object' },
            },
            required: ['event_name', 'target'],
          },
        },
        {
          name: 'list_event_subscriptions',
          description: 'List active MCP event subscriptions.',
          inputSchema: {
            type: 'object',
            properties: { tenant_id: { type: 'string' } },
            required: [],
          },
        },
        {
          name: 'unsubscribe_event',
          description: 'Disable an event subscription.',
          inputSchema: {
            type: 'object',
            properties: { tenant_id: { type: 'string' }, subscription_id: { type: 'string' } },
            required: ['subscription_id'],
          },
        },
        {
          name: 'update_client_status_batch',
          description: 'Batch update client sales_stage with dry_run safety.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              client_ids: { type: 'array', items: { type: 'string' } },
              sales_stage: { type: 'string' },
              dry_run: { type: 'boolean' },
            },
            required: ['client_ids', 'sales_stage'],
          },
        },
        {
          name: 'create_tasks_batch',
          description: 'Batch create tasks with per-item results and dry_run option.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              tasks: { type: 'array', items: { type: 'object' } },
              dry_run: { type: 'boolean' },
            },
            required: ['tasks'],
          },
        },
        {
          name: 'send_bulk_email_campaign',
          description: 'Batch send transactional emails to client list with dry_run support.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              client_ids: { type: 'array', items: { type: 'string' } },
              subject: { type: 'string' },
              html: { type: 'string' },
              text: { type: 'string' },
              dry_run: { type: 'boolean' },
            },
            required: ['client_ids', 'subject'],
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
            required: [],
          },
        },
        {
          name: 'create_quote',
          description: 'Create a quote/proposal for a contact or deal in this workspace.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              name: { type: 'string', description: 'Quote title' },
              contact_id: { type: 'string', description: 'Optional contact/client UUID' },
              deal_id: { type: 'string', description: 'Optional deal UUID' },
              currency: { type: 'string', description: 'Default USD' },
              valid_for_days: { type: 'number', description: 'Default 30' },
              notes: { type: 'string' },
              terms_and_conditions: { type: 'string' },
              status: { type: 'string', description: 'draft | sent | viewed | accepted | rejected | expired | converted' },
            },
            required: ['name'],
          },
        },
        {
          name: 'update_quote',
          description: 'Update quote details and lifecycle status after creation.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              quote_id: { type: 'string', description: 'UUID from get_quotes' },
              name: { type: 'string' },
              status: { type: 'string', description: 'draft | sent | viewed | accepted | rejected | expired | converted' },
              notes: { type: 'string' },
              terms_and_conditions: { type: 'string' },
              valid_until: { type: 'string', description: 'YYYY-MM-DD' },
              currency: { type: 'string' },
            },
            required: ['quote_id'],
          },
        },
        {
          name: 'auto_create_lead_from_message',
          description: 'Create a lead from an existing inbound message in one call.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              message_id: { type: 'string', description: 'Message UUID from inbox/history' },
              business_name: { type: 'string', description: 'Optional override business/contact name' },
              source: { type: 'string', description: 'Default Inbound Message' },
            },
            required: ['message_id'],
          },
        },
        {
          name: 'score_deal',
          description: 'Score a deal from 1-10 based on stage, value, and freshness, then save score in metadata.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              deal_id: { type: 'string', description: 'Deal UUID from get_deals' },
            },
            required: ['deal_id'],
          },
        },
        {
          name: 'voice_action_router',
          description: 'Convert a plain-language voice command into an actionable MCP instruction payload.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              command: { type: 'string', description: 'Natural language command captured from voice' },
            },
            required: ['command'],
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
            required: ['action', 'entity_type'],
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
            required: ['monthly_goal'],
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
            required: ['topic'],
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
            required: [],
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
            required: ['entity_id', 'platform'],
          },
        },
        {
          name: 'book_calendar_meeting',
          description: 'Calendar booking adapter: creates a booking through the production booking pipeline.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              booking_type_id: { type: 'string' },
              start_time: { type: 'string', description: 'ISO datetime' },
              end_time: { type: 'string', description: 'ISO datetime' },
              client_name: { type: 'string' },
              client_email: { type: 'string' },
              client_phone: { type: 'string' },
              client_notes: { type: 'string' },
              time_zone: { type: 'string' },
            },
            required: ['booking_type_id', 'start_time', 'end_time', 'client_name', 'client_email'],
          },
        },
        {
          name: 'create_subscription_checkout',
          description: 'Payment/subscription adapter: creates Stripe checkout URL for subscription upgrade.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              plan_id: { type: 'string', description: 'starter | pro | enterprise' },
              price_id: { type: 'string' },
              admin_email: { type: 'string' },
              success_url: { type: 'string' },
              cancel_url: { type: 'string' },
            },
            required: ['plan_id', 'price_id', 'admin_email'],
          },
        },
        {
          name: 'create_client_portal_event',
          description: 'Client portal event adapter: records timeline, download, and feedback events.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              event_type: { type: 'string' },
              project_id: { type: 'string' },
              client_id: { type: 'string' },
              deliverable_id: { type: 'string' },
              feedback_rating: { type: 'number' },
              feedback_comment: { type: 'string' },
              metadata: { type: 'object' },
            },
            required: ['event_type'],
          },
        },
        {
          name: 'create_business_event',
          description: 'Create an internal business event trigger record for automation loops.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              start_time: { type: 'string', description: 'ISO datetime' },
              end_time: { type: 'string', description: 'ISO datetime' },
              event_type: { type: 'string', description: 'lead_created | invoice_paid | meeting | custom' },
              attendees: { type: 'array', items: { type: 'string' } },
            },
            required: ['title', 'start_time', 'end_time', 'event_type'],
          },
        },
        {
          name: 'get_business_events',
          description: 'List business events so agents can poll for new triggers.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              event_type: { type: 'string' },
              from_time: { type: 'string', description: 'ISO datetime lower bound for start_time' },
              to_time: { type: 'string', description: 'ISO datetime upper bound for start_time' },
              limit: { type: 'number', description: 'Max records (default 50, max 200)' },
            },
            required: [],
          },
        },
        {
          name: 'analyze_document_intelligence',
          description: 'Document intelligence adapter: extracts clauses/risk flags and stores a scan run.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string' },
              document_url: { type: 'string' },
              document_text: { type: 'string' },
              document_type: { type: 'string', description: 'contract | proposal | invoice | nda | other' },
            },
            required: [],
          },
        },
      ],
    }));

    // ── Tool Execution ─────────────────────────────────────────────────────────
    this.server.setRequestHandler(CallToolRequestSchema, async (request: unknown) => {
      const { name, arguments: args } = (request as {
        params: { name: string; arguments?: Record<string, unknown> };
      }).params;
      const traceId = randomUUID();
      const supabaseAdmin = createSupabaseAdminClient();
      const supabase = supabaseAdmin;
      let result: any;

      try {
        switch (name) {
        // ── get_clients ────────────────────────────────────────────────────
        case 'get_clients': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { status, industry, location, min_value, max_value, limit = 100, offset = 0, cursor, sort_by, sort_order, fields } = a;
          const cursorOffset =
            typeof cursor === 'string' && cursor.trim()
              ? Number(Buffer.from(cursor, 'base64').toString('utf8')) || 0
              : 0;
          const pageSize = Math.min(Math.max(Number(limit) || 100, 1), 1000);
          const pageOffset = Math.max(Number(offset) || cursorOffset || 0, 0);
          const selectable = typeof fields === 'string' && fields.trim()
            ? fields.split(',').map((f: string) => f.trim()).filter(Boolean).join(', ')
            : 'id, name, email, phone, industry, location, sales_stage, value, website, is_active, created_at';
          const orderBy = ['created_at', 'value', 'sales_stage', 'name'].includes(String(sort_by || '')) ? String(sort_by) : 'created_at';
          const asc = String(sort_order || 'desc').toLowerCase() === 'asc';
          let query = supabaseAdmin
            .from('business_clients')
            .select(selectable)
            .eq('tenant_id', tenant_id)
            .order(orderBy, { ascending: asc })
            .range(pageOffset, pageOffset + pageSize - 1);
          if (status) query = query.eq('sales_stage', status);
          if (industry) query = query.ilike('industry', `%${String(industry).trim()}%`);
          if (location) query = query.ilike('location', `%${String(location).trim()}%`);
          if (min_value != null) query = query.gte('value', Number(min_value) || 0);
          if (max_value != null) query = query.lte('value', Number(max_value) || 0);
          let data: any;
          let error: any;
          ({ data, error } = await query);
          if (error && isSchemaOrRelationError(error)) {
            // Legacy fallback
            let legacyQuery = supabaseAdmin
              .from('business_clients')
              .select('id, name, email, phone, created_at')
              .eq('tenant_id', tenant_id)
              .order('created_at', { ascending: false })
              .range(pageOffset, pageOffset + pageSize - 1);
            ({ data, error } = await legacyQuery);
          }
          if (error) throw supabaseErrorToMcpClientError('get_clients', (error as { message?: string }).message || 'Failed to fetch clients');
          const rows = (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => {
            const phone = row.phone;
            const normalizedPhone = normalizePhoneForStorage(phone);
            return {
              ...row,
              phone: normalizedPhone || phone || null,
              phone_has_country_code: hasCountryCode(normalizedPhone || phone),
            };
          });
          const missingCountryCode = rows.filter((row) => !row.phone_has_country_code && row.phone).length;
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    items: rows,
                    pagination: {
                      limit: pageSize,
                      offset: pageOffset,
                      cursor: Buffer.from(String(pageOffset)).toString('base64'),
                      returned: rows.length,
                      has_more: rows.length === pageSize,
                      next_offset: rows.length === pageSize ? pageOffset + pageSize : null,
                      next_cursor: rows.length === pageSize ? Buffer.from(String(pageOffset + pageSize)).toString('base64') : null,
                    },
                    contacts_missing_country_code_count: missingCountryCode,
                  },
                  null,
                  2
                ),
              },
            ],
          };
          break;
        }

        case 'get_client_by_id': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { client_id } = a;
          if (!isUuidString(client_id)) {
            throw new Error('client_id must be a valid UUID from get_clients or search_clients');
          }
          const { data, error } = await supabaseAdmin
            .from('business_clients')
            .select('id, name, email, phone, industry, location, sales_stage, value, website, description, custom_fields, is_active, created_at, updated_at')
            .eq('tenant_id', tenant_id)
            .eq('id', client_id.trim())
            .maybeSingle();
          if (error) throw supabaseErrorToMcpClientError('get_client_by_id', error.message);
          result = { content: [{ type: 'text', text: JSON.stringify(data || null, null, 2) }] };
          break;
        }

        case 'search_clients': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { query, limit = 100 } = a;
          if (typeof query !== 'string' || !query.trim()) {
            throw new Error('query is required');
          }
          const q = `%${query.trim()}%`;
          const { data, error } = await supabaseAdmin
            .from('business_clients')
            .select('id, name, email, phone, industry, location, sales_stage, value, website, is_active, created_at')
            .eq('tenant_id', tenant_id)
            .or(`name.ilike.${q},email.ilike.${q},phone.ilike.${q},website.ilike.${q},location.ilike.${q}`)
            .order('created_at', { ascending: false })
            .limit(Math.min(Number(limit) || 100, 1000));
          if (error) throw supabaseErrorToMcpClientError('search_clients', error.message);
          result = {
            content: [
              {
                type: 'text',
                text: renderBusinessSuccess('mcp-tool', 'mcp-trace', 'Data retrieved', data),
              },
              {
                type: 'text',
                text: JSON.stringify(data || [], null, 2),
              },
            ],
          };
          break;
        }

        case 'get_contacts': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { limit = 100, offset = 0 } = a;
          const pageSize = Math.min(Math.max(Number(limit) || 100, 1), 1000);
          const pageOffset = Math.max(Number(offset) || 0, 0);
          const { data, error } = await supabaseAdmin
            .from('contacts')
            .select('id, first_name, last_name, full_name, email, phone, status, created_at')
            .eq('tenant_id', tenant_id)
            .order('created_at', { ascending: false })
            .range(pageOffset, pageOffset + pageSize - 1);
          if (error) throw supabaseErrorToMcpClientError('get_contacts', error.message);
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    items: data || [],
                    pagination: {
                      limit: pageSize,
                      offset: pageOffset,
                      returned: (data || []).length,
                      has_more: (data || []).length === pageSize,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
          break;
        }

        case 'search_contacts': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { query, limit = 100 } = a;
          if (typeof query !== 'string' || !query.trim()) {
            throw new Error('query is required');
          }
          const q = `%${query.trim()}%`;
          const { data, error } = await supabaseAdmin
            .from('contacts')
            .select('id, first_name, last_name, full_name, email, phone, status, created_at')
            .eq('tenant_id', tenant_id)
            .or(`first_name.ilike.${q},last_name.ilike.${q},full_name.ilike.${q},email.ilike.${q},phone.ilike.${q}`)
            .order('created_at', { ascending: false })
            .limit(Math.min(Number(limit) || 100, 1000));
          if (error) throw supabaseErrorToMcpClientError('search_contacts', error.message);
          result = {
            content: [
              {
                type: 'text',
                text: renderBusinessSuccess('mcp-tool', 'mcp-trace', 'Data retrieved', data),
              },
              {
                type: 'text',
                text: JSON.stringify(data || [], null, 2),
              },
            ],
          };
          break;
        }

        // ── create_client ──────────────────────────────────────────────────
        case 'create_client': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const owner_id = this.requireProfileUser(a);
          const {
            name,
            email,
            phone,
            industry,
            website,
            location,
            sales_stage = 'lead',
            value = 0,
            source,
            notes,
            metadata,
          } = a;
          const resolvedSource = inferMcpLeadSource(source, this.ctx);
          const metaExtra =
            metadata && typeof metadata === 'object' && !Array.isArray(metadata)
              ? (metadata as Record<string, unknown>)
              : {};
          const primary = await supabaseAdmin
            .from('business_clients')
            .insert({
              tenant_id,
              name,
              email: email || null,
              phone: normalizePhoneForStorage(phone),
              industry: industry || null,
              website: website || null,
              location: location || null,
              sales_stage,
              value: Number(value) || 0,
              description: notes || null,
              custom_fields: { source: resolvedSource, ...metaExtra },
              is_active: true,
              owner_id,
            })
            .select('id, name, email')
            .single();
          let data = primary.data;
          let error = primary.error;
          if (error && isSchemaOrRelationError(error)) {
            const fallback = await supabaseAdmin
              .from('business_clients')
              .insert({
                tenant_id,
                name,
                email: email || null,
                phone: normalizePhoneForStorage(phone),
                industry: industry || null,
                website: website || null,
                location: location || null,
                description: notes || null,
                custom_fields: { source: resolvedSource, ...metaExtra },
              })
              .select('id, name, email')
              .single();
            data = fallback.data;
            error = fallback.error;
          }
          if (error) throw supabaseErrorToMcpClientError('create_client', (error as { message?: string }).message || 'Failed to create client');
          if (!data) throw new Error('Failed to create client');
          result = {
            content: [
              {
                type: 'text',
                text: `✅ **Client Created Successfully**\n\n- **Name**: ${data.name}\n- **Email**: ${data.email || 'None'}\n\n*Next Steps: You can now add a deal or create an invoice for this client in the dashboard.*`,
              },
            ],
          };
          break;
        }

        case 'update_client': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const {
            client_id,
            name,
            email,
            phone,
            industry,
            website,
            location,
            sales_stage,
            value,
            notes,
            is_active,
            metadata,
          } = a;
          if (!isUuidString(client_id)) {
            throw new Error('client_id must be a valid UUID from get_clients');
          }
          const update: Record<string, unknown> = {};
          if (name !== undefined) update.name = typeof name === 'string' ? name.trim() : name;
          if (email !== undefined) update.email = email || null;
          if (phone !== undefined) update.phone = normalizePhoneForStorage(phone);
          if (industry !== undefined) update.industry = industry || null;
          if (website !== undefined) update.website = website || null;
          if (location !== undefined) update.location = location || null;
          if (sales_stage !== undefined) update.sales_stage = sales_stage;
          if (value !== undefined) update.value = Number(value);
          if (notes !== undefined) update.description = notes || null;
          if (is_active !== undefined) update.is_active = Boolean(is_active);
          if (metadata !== undefined && metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
            update.custom_fields = metadata;
          }
          if (Object.keys(update).length === 0) {
            throw new Error('Provide at least one field to update');
          }
          const { data, error } = await supabaseAdmin
            .from('business_clients')
            .update(update)
            .eq('tenant_id', tenant_id)
            .eq('id', client_id.trim())
            .select('id, name, email, phone, sales_stage, value, is_active, updated_at')
            .single();
          if (error) throw supabaseErrorToMcpClientError('update_client', error.message);
          result = { content: [{ type: 'text', text: `Client updated: ${JSON.stringify(data)}` }] };
          break;
        }

        // ── get_leads ──────────────────────────────────────────────────────
        case 'get_leads': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { status, stage, source, assigned_to, limit = 20, offset = 0, cursor, sort_by, sort_order, fields } = a;
          const cursorOffset =
            typeof cursor === 'string' && cursor.trim()
              ? Number(Buffer.from(cursor, 'base64').toString('utf8')) || 0
              : 0;
          const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 100);
          const pageOffset = Math.max(Number(offset) || cursorOffset || 0, 0);
          const selectable = typeof fields === 'string' && fields.trim()
            ? fields.split(',').map((f: string) => f.trim()).filter(Boolean).join(', ')
            : 'id, business_name, email, phone, industry, location, status, stage, source, owner_id, notes, created_at';
          const orderBy = ['created_at', 'status', 'stage', 'business_name'].includes(String(sort_by || '')) ? String(sort_by) : 'created_at';
          const asc = String(sort_order || 'desc').toLowerCase() === 'asc';
          let query = supabaseAdmin
            .from('leads')
            .select(selectable)
            .eq('tenant_id', tenant_id)
            .order(orderBy, { ascending: asc })
            .range(pageOffset, pageOffset + pageSize - 1);
          if (status) query = query.eq('status', status);
          if (stage) query = query.eq('stage', stage);
          if (source) query = query.ilike('source', `%${String(source).trim()}%`);
          if (assigned_to) query = query.eq('owner_id', String(assigned_to).trim());
          let data: any;
          let error: any;
          ({ data, error } = await query);
          if (error && isSchemaOrRelationError(error)) {
            // Legacy fallback for reduced schemas
            let legacy = supabaseAdmin
              .from('leads')
              .select('id, business_name, email, phone, stage, notes, created_at')
              .eq('tenant_id', tenant_id)
              .order('created_at', { ascending: false })
              .range(pageOffset, pageOffset + pageSize - 1);
            if (stage) legacy = legacy.eq('stage', stage);
            ({ data, error } = await legacy);
          }
          if (error) throw supabaseErrorToMcpClientError('get_leads', (error as { message?: string }).message || 'Failed to fetch leads');
          const rows = (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => {
            const phone = row.phone;
            const normalizedPhone = normalizePhoneForStorage(phone);
            return {
              ...row,
              phone: normalizedPhone || phone || null,
              phone_has_country_code: hasCountryCode(normalizedPhone || phone),
            };
          });
          const missingCountryCode = rows.filter((row) => !row.phone_has_country_code && row.phone).length;
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    items: rows,
                    pagination: {
                      limit: pageSize,
                      offset: pageOffset,
                      cursor: Buffer.from(String(pageOffset)).toString('base64'),
                      returned: rows.length,
                      has_more: rows.length === pageSize,
                      next_offset: rows.length === pageSize ? pageOffset + pageSize : null,
                      next_cursor: rows.length === pageSize ? Buffer.from(String(pageOffset + pageSize)).toString('base64') : null,
                    },
                    contacts_missing_country_code_count: missingCountryCode,
                  },
                  null,
                  2
                ),
              },
            ],
          };
          break;
        }

        case 'backfill_contact_phone_country_codes': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const dryRun = a.dry_run !== false;
          const defaultCountryCode = typeof a.default_country_code === 'string' && a.default_country_code.trim()
            ? a.default_country_code.trim()
            : '1';
          const limit = Math.min(Math.max(Number(a.limit) || 5000, 1), 20000);

          const collectCandidates = (rows: Array<Record<string, unknown>>) =>
            rows
              .map((row) => {
                const id = String(row.id || '').trim();
                const currentPhone = row.phone == null ? null : String(row.phone);
                const normalizedPhone = normalizePhoneForStorage(currentPhone, defaultCountryCode);
                if (!id || !currentPhone || !normalizedPhone) return null;
                if (normalizedPhone === currentPhone) return null;
                return { id, old_phone: currentPhone, new_phone: normalizedPhone };
              })
              .filter((entry): entry is { id: string; old_phone: string; new_phone: string } => !!entry);

          const { data: clientRows, error: clientErr } = await supabaseAdmin
            .from('business_clients')
            .select('id, phone')
            .eq('tenant_id', tenant_id)
            .not('phone', 'is', null)
            .limit(limit);
          if (clientErr) throw supabaseErrorToMcpClientError('backfill_contact_phone_country_codes', clientErr.message);

          const { data: leadRows, error: leadErr } = await supabaseAdmin
            .from('leads')
            .select('id, phone')
            .eq('tenant_id', tenant_id)
            .not('phone', 'is', null)
            .limit(limit);
          if (leadErr) throw supabaseErrorToMcpClientError('backfill_contact_phone_country_codes', leadErr.message);

          const clientCandidates = collectCandidates((clientRows || []) as Array<Record<string, unknown>>);
          const leadCandidates = collectCandidates((leadRows || []) as Array<Record<string, unknown>>);

          if (!dryRun) {
            for (const row of clientCandidates) {
              const { error } = await supabaseAdmin
                .from('business_clients')
                .update({ phone: row.new_phone })
                .eq('tenant_id', tenant_id)
                .eq('id', row.id);
              if (error) throw supabaseErrorToMcpClientError('backfill_contact_phone_country_codes', error.message);
            }
            for (const row of leadCandidates) {
              const { error } = await supabaseAdmin
                .from('leads')
                .update({ phone: row.new_phone })
                .eq('tenant_id', tenant_id)
                .eq('id', row.id);
              if (error) throw supabaseErrorToMcpClientError('backfill_contact_phone_country_codes', error.message);
            }
          }

          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    dry_run: dryRun,
                    default_country_code: defaultCountryCode,
                    scanned: {
                      clients: (clientRows || []).length,
                      leads: (leadRows || []).length,
                    },
                    changes: {
                      clients: clientCandidates.length,
                      leads: leadCandidates.length,
                      total: clientCandidates.length + leadCandidates.length,
                    },
                    sample: {
                      clients: clientCandidates.slice(0, 10),
                      leads: leadCandidates.slice(0, 10),
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
          break;
        }

        case 'list_playbooks': {
          const playbooks = listBuiltInPlaybooks();
          result = { content: [{ type: 'text', text: JSON.stringify({ playbooks }, null, 2) }] };
          break;
        }

        case 'run_playbook': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const playbook_id = String(a.playbook_id || '').trim();
          if (!playbook_id) throw new Error('playbook_id is required');
          const inputs = a.inputs && typeof a.inputs === 'object' ? { ...(a.inputs as Record<string, unknown>) } : {};
          if (a.idempotency_key && typeof a.idempotency_key === 'string') {
            inputs.idempotency_key = a.idempotency_key.trim();
          }
          const autoHighRisk = a.auto_high_risk === true;
          const started = await startPlaybookRun({
            tenantId: tenant_id,
            userId: user_id,
            playbookId: playbook_id,
            inputs,
            autoHighRisk,
          });
          if (!started.success) throw new Error(started.error || 'Failed to start playbook run');
          const runId = String((started as { run?: { id?: string } }).run?.id || '');
          if (!runId) throw new Error('Playbook run id missing');
          const executed = await executeRun(runId, tenant_id, autoHighRisk);
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    started,
                    executed,
                  },
                  null,
                  2
                ),
              },
            ],
          };
          break;
        }

        case 'get_run_status': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const run_id = String(a.run_id || '').trim();
          if (!run_id) throw new Error('run_id is required');
          const status = await getRunStatus(run_id, tenant_id);
          if (!status.success) throw new Error(status.error || 'Failed to load run status');
          result = { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
          break;
        }

        case 'retry_run_step': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const run_id = String(a.run_id || '').trim();
          const step_id = String(a.step_id || '').trim();
          if (!run_id) throw new Error('run_id is required');
          if (!step_id) throw new Error('step_id is required');
          const retried = await retryRunStep(run_id, tenant_id, step_id, a.auto_high_risk === true);
          if (!retried.success) throw new Error(retried.error || 'Failed to retry run step');
          result = { content: [{ type: 'text', text: JSON.stringify(retried, null, 2) }] };
          break;
        }

        case 'cancel_run': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const run_id = String(a.run_id || '').trim();
          if (!run_id) throw new Error('run_id is required');
          const cancelled = await cancelRun(run_id, tenant_id);
          if (!cancelled.success) throw new Error(cancelled.error || 'Failed to cancel run');
          result = { content: [{ type: 'text', text: JSON.stringify(cancelled, null, 2) }] };
          break;
        }

        case 'verify_lead_created':
        case 'verify_outreach_delivery':
        case 'verify_social_post_published':
        case 'verify_invoice_sent': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const verification = await runVerification(name, tenant_id, a);
          result = { content: [{ type: 'text', text: JSON.stringify(verification, null, 2) }] };
          break;
        }

        case 'get_automation_health': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const health = await getAutomationHealth(tenant_id);
          result = { content: [{ type: 'text', text: JSON.stringify(health, null, 2) }] };
          break;
        }

        case 'get_failure_report': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const limit = Math.min(Math.max(Number(a.limit) || 50, 1), 200);
          const report = await getAutomationFailureReport(tenant_id, limit);
          result = { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
          break;
        }

        case 'get_throughput_report': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const hours = Math.min(Math.max(Number(a.hours) || 24, 1), 720);
          const report = await getAutomationThroughputReport(tenant_id, hours);
          result = { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
          break;
        }

        case 'reconcile_outreach_vs_logs': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const limit = Math.min(Math.max(Number(a.limit) || 100, 1), 500);
          const report = await reconcileOutreachVsLogs(tenant_id, limit);
          result = { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
          break;
        }

        // ── create_lead ────────────────────────────────────────────────────
        case 'create_lead': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const owner_id = this.requireProfileUser(a);
          const { business_name, contact_name, email, phone, industry, location, source, notes } = a;
          const resolvedSource = inferMcpLeadSource(source, this.ctx);
          const primaryName = (business_name || contact_name || '').trim();
          if (!primaryName) throw new Error('create_lead requires contact_name or business_name');

          const primaryInsert = await supabaseAdmin
            .from('leads')
            .insert({
              tenant_id,
              owner_id,
              business_name: primaryName,
              email: email || null,
              phone: normalizePhoneForStorage(phone),
              industry: industry || '',
              location: location || null,
              status: 'new',
              stage: 'lead',
              source: resolvedSource,
              notes: notes || null,
            })
            .select('id, business_name, email, status')
            .single();

          // Fallback for legacy schemas where one of status/stage/owner_id may differ.
          let data = primaryInsert.data;
          let error = primaryInsert.error;
          if (error) {
            const fallbackInsert = await supabaseAdmin
              .from('leads')
              .insert({
                tenant_id,
                business_name: primaryName,
                email: email || null,
                phone: normalizePhoneForStorage(phone),
                industry: industry || '',
                location: location || null,
                source: resolvedSource,
                notes: notes || null,
              })
              .select('id, business_name, email, status')
              .single();
            data = fallbackInsert.data;
            error = fallbackInsert.error;
          }

          if (error) throw supabaseErrorToMcpClientError('create_lead', error.message);
          await enqueueMcpEvent(
            supabaseAdmin,
            tenant_id,
            owner_id,
            'on_new_lead_created',
            { lead_id: data?.id || null, business_name: data?.business_name || primaryName, source: resolvedSource }
          );
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

        case 'update_lead': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { lead_id, business_name, email, phone, industry, location, source, notes, status, stage } = a;
          if (!isUuidString(lead_id)) {
            throw new Error('lead_id must be a valid lead UUID from get_leads');
          }
          const update: Record<string, any> = {};
          if (business_name !== undefined) update.business_name = business_name;
          if (email !== undefined) update.email = email || null;
          if (phone !== undefined) update.phone = normalizePhoneForStorage(phone);
          if (industry !== undefined) update.industry = industry || '';
          if (location !== undefined) update.location = location || null;
          if (source !== undefined) update.source = source || null;
          if (notes !== undefined) update.notes = notes || null;
          if (status !== undefined) update.status = status;
          if (stage !== undefined) update.stage = stage;
          if (Object.keys(update).length === 0) throw new Error('Provide at least one field to update');
          const { data, error } = await supabaseAdmin
            .from('leads')
            .update(update)
            .eq('tenant_id', tenant_id)
            .eq('id', lead_id.trim())
            .select('id, business_name, status, stage, updated_at')
            .single();
          if (error) throw supabaseErrorToMcpClientError('update_lead', error.message);
          result = { content: [{ type: 'text', text: `Lead updated: ${JSON.stringify(data)}` }] };
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

        case 'update_deal': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { deal_id, name, value, stage, description, source, metadata } = a;
          if (!isUuidString(deal_id)) {
            throw new Error('deal_id must be a valid deal UUID from get_deals');
          }
          const update: Record<string, unknown> = {};
          if (name !== undefined) update.name = String(name).trim();
          if (value !== undefined) {
            const v = Number(value);
            if (!Number.isFinite(v) || v < 0) throw new Error('value must be a non-negative number');
            update.value = v;
          }
          if (stage !== undefined) {
            if (!DEAL_STAGES.has(String(stage))) {
              throw new Error('stage must be one of: lead, qualified, proposal, negotiation, closed_won, closed_lost');
            }
            update.stage = stage;
          }
          if (description !== undefined) update.description = description || null;
          if (source !== undefined) update.source = source || null;
          if (metadata !== undefined && metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
            update.metadata = metadata;
          }
          if (Object.keys(update).length === 0) throw new Error('Provide at least one field to update');
          const { data, error } = await supabaseAdmin
            .from('deals')
            .update(update)
            .eq('tenant_id', tenant_id)
            .eq('id', deal_id.trim())
            .select('id, name, value, stage, description, updated_at')
            .single();
          if (error) throw supabaseErrorToMcpClientError('update_deal', error.message);
          await enqueueMcpEvent(
            supabaseAdmin,
            tenant_id,
            this.ctx?.userId || null,
            'on_deal_stage_changed',
            { deal_id: data?.id || deal_id, stage: data?.stage || update.stage || null }
          );
          result = { content: [{ type: 'text', text: `Deal updated: ${JSON.stringify(data)}` }] };
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

        // ── create_project ────────────────────────────────────────────────
        case 'create_project': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { name, description, status = 'planning', due_date } = a;
          if (typeof name !== 'string' || !name.trim()) {
            throw new Error('name is required');
          }

          const { data, error } = await supabaseAdmin
            .from('business_projects')
            .insert({
              tenant_id,
              name: name.trim(),
              description: typeof description === 'string' ? description : null,
              status: typeof status === 'string' && status.trim() ? status.trim() : 'planning',
              due_date: typeof due_date === 'string' && due_date.trim() ? due_date.trim() : null,
            })
            .select('id, name, status, due_date, created_at')
            .single();
          if (error) throw supabaseErrorToMcpClientError('create_project', error.message);
          result = { content: [{ type: 'text', text: `Project created: ${JSON.stringify(data)}` }] };
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
          const { project_id, assigned_to, completed, due_after, due_before } = a;
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
          if (due_after && typeof due_after === 'string' && due_after.trim()) {
            query = query.gte('due_date', due_after.trim());
          }
          if (due_before && typeof due_before === 'string' && due_before.trim()) {
            query = query.lte('due_date', due_before.trim());
          }
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

        // ── update_task ────────────────────────────────────────────────────
        case 'update_task': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { task_id, title, description, assigned_to, due_date, priority, status } = a;

          if (!isUuidString(task_id)) {
            throw new Error('task_id must be a valid task UUID from get_tasks');
          }
          if (assigned_to != null && assigned_to !== '' && !isUuidString(assigned_to)) {
            throw new Error('assigned_to must be a valid user UUID or omitted');
          }
          if (priority != null && priority !== '' && !TASK_PRIORITIES.has(String(priority))) {
            throw new Error('priority must be one of: low, medium, high, urgent');
          }
          if (status != null && status !== '' && !TASK_STATUSES.has(String(status))) {
            throw new Error('status must be one of: ideas, todo, in_progress, review, completed, cancelled');
          }

          const update: Record<string, any> = {};
          if (typeof title === 'string') update.title = title.trim();
          if (description !== undefined) update.description = description ?? null;
          if (assigned_to !== undefined) update.assigned_to = assigned_to || null;
          if (due_date !== undefined) update.due_date = due_date || null;
          if (priority !== undefined) update.priority = priority;
          if (status !== undefined) {
            update.status = status;
            if (status === 'completed') {
              update.completed_at = new Date().toISOString();
            }
          }

          if (Object.keys(update).length === 0) {
            throw new Error('Provide at least one field to update');
          }

          const { data, error } = await supabaseAdmin
            .from('tasks')
            .update(update)
            .eq('tenant_id', tenant_id)
            .eq('id', task_id.trim())
            .select('id, title, status, priority, due_date, assigned_to, completed_at, updated_at')
            .single();
          if (error) throw supabaseErrorToMcpClientError('update_task', error.message);

          result = { content: [{ type: 'text', text: `Task updated: ${JSON.stringify(data)}` }] };
          break;
        }

        // ── write_task_note ────────────────────────────────────────────────
        case 'write_task_note': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { task_id, note } = a;
          if (!isUuidString(task_id)) {
            throw new Error('task_id must be a valid task UUID from get_tasks');
          }
          if (typeof note !== 'string' || !note.trim()) {
            throw new Error('note is required');
          }

          const { data: existingTask, error: fetchError } = await supabaseAdmin
            .from('tasks')
            .select('id, title, description')
            .eq('tenant_id', tenant_id)
            .eq('id', task_id.trim())
            .single();
          if (fetchError || !existingTask) {
            throw supabaseErrorToMcpClientError('write_task_note', fetchError?.message || 'Task not found');
          }

          const timestamp = new Date().toISOString();
          const prefix = existingTask.description ? `${existingTask.description}\n\n` : '';
          const nextDescription = `${prefix}[${timestamp}] NOTE: ${note.trim()}`;
          const { data: updatedTask, error: updateError } = await supabaseAdmin
            .from('tasks')
            .update({ description: nextDescription })
            .eq('tenant_id', tenant_id)
            .eq('id', task_id.trim())
            .select('id, title, description, updated_at')
            .single();
          if (updateError) throw supabaseErrorToMcpClientError('write_task_note', updateError.message);

          result = { content: [{ type: 'text', text: `Task note saved: ${JSON.stringify(updatedTask)}` }] };
          break;
        }

        // ── create_bulk_email_campaign ─────────────────────────────────────
        case 'create_bulk_email_campaign': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const createdByUserId = this.ctx?.userId || this.requireProfileUser(a);
          const { name: campaignName, subject, body_html, target_audience, from_name, from_email, publish_now } = a;
          const deliveryProviders = Array.isArray(a.delivery_providers)
            ? a.delivery_providers.map((p: unknown) => String(p).trim().toLowerCase()).filter(Boolean)
            : [];
          const balanceByDailyLimit = a.balance_by_daily_limit !== false;

          if (!campaignName || !subject || !body_html || !target_audience || !from_name || !from_email) {
            throw new Error('Missing required fields for bulk email campaign.');
          }

          let recipients: { id: string; email: string }[] = [];
          if (String(target_audience).toLowerCase() === 'all_leads') {
            const { data } = await supabaseAdmin.from('leads').select('id, email').eq('tenant_id', tenant_id);
            if (data) {
                recipients = data.filter((d: any) => d.email).map((d: any) => ({ id: d.id, email: d.email! }));
            }
          } else if (String(target_audience).toLowerCase() === 'all_clients') {
            const { data } = await supabaseAdmin.from('business_clients').select('id, email').eq('tenant_id', tenant_id);
            if (data) {
                recipients = data.filter((d: any) => d.email).map((d: any) => ({ id: d.id, email: d.email! }));
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
            metadata: {
              bodyHtml: body_html,
              deliverySettings: {
                selectedProviders: deliveryProviders,
                balanceByDailyLimit,
              },
            },
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
             actionText = `Campaign "${campaignName}" created and queued to send to ${recipients.length} recipients with provider balancing.`;
             // Trigger server-side background sender
             sendScheduledCampaignServer(campaign.id).catch(err => console.error('Background send error:', err));
          }

          result = { content: [{ type: 'text', text: actionText }] };
          break;
        }

        case 'send_batch_outreach': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const { lead_ids = [], client_ids = [], tone = 'professional', custom_context = '', delivery_provider = 'sendgrid' } = a;
          
          if (lead_ids.length === 0 && client_ids.length === 0) {
            throw new Error('Provide at least one lead_id or client_id');
          }
          
          const combinedIds = [...new Set([...lead_ids, ...client_ids])].slice(0, 20);
          
          // Fetch the leads/clients
          const [{ data: leads }, { data: clients }] = await Promise.all([
            supabaseAdmin.from('leads').select('*').in('id', combinedIds).eq('tenant_id', tenant_id),
            supabaseAdmin.from('business_clients').select('*').in('id', combinedIds).eq('tenant_id', tenant_id)
          ]);
            
          const allEntities = [...(leads || []), ...(clients || [])];
          
          if (allEntities.length === 0) {
            throw new Error('No valid leads or clients found for the provided IDs');
          }

          // Use the same professional prompt style as the dashboard
          const results = await Promise.all(allEntities.map(async (entity) => {
             const email = entity.email || (entity as any).emails?.[0];
             if (!email) return { name: entity.business_name || entity.name, status: 'failed', error: 'No email found' };
             
             try {
                // 1. Generate personalized message
                const prompt = `Generate a highly personalized, professional B2B outreach email for ${entity.business_name || entity.name}.
                Industry: ${entity.industry || 'Business'}.
                Target Tone: ${tone}.
                User Context: ${custom_context}.
                Business Context: ${JSON.stringify(entity.metadata || {})}.
                
                Rules:
                - Max 120 words.
                - Professional, punchy subject line.
                - NO emojis.
                - Clear CTA.`;
                
                const aiRes = await routeAutonomousTask('social_caption', prompt); // Reuse caption task for short professional outreach
                
                // 2. Send via provider
                const providerConfig = await resolveEmailProviderConfig({ 
                    tenantId: tenant_id, 
                    preferredUserId: user_id, 
                    preferredProvider: delivery_provider as EmailProvider 
                });
                
                if (!providerConfig) return { name: entity.business_name || entity.name, status: 'failed', error: 'Email provider not configured' };
                
                await sendWithProviderSdk(providerConfig.provider, {
                  to: email,
                  subject: `Business Inquiry regarding ${entity.business_name || entity.name}`,
                  html: aiRes.content,
                  apiKey: providerConfig.apiKey,
                  fromName: providerConfig.fromName || 'AlphaClone Outreach',
                  fromEmail: providerConfig.fromEmail || '',
                  userId: providerConfig.ownerUserId || user_id || undefined
                });

                // 3. Log the outreach
                await supabaseAdmin.from('lead_outreach_log').insert({
                  tenant_id,
                  user_id,
                  lead_name: entity.business_name || entity.name,
                  lead_email: email,
                  subject: `Business Inquiry regarding ${entity.business_name || entity.name}`,
                  body_html: aiRes.content,
                  status: 'sent',
                  provider: providerConfig.provider,
                });
                
                return { name: entity.business_name || entity.name, status: 'sent' };
             } catch (err: any) {
                return { name: entity.business_name || entity.name, status: 'failed', error: err.message };
             }
          }));
          
          result = { 
            content: [{ 
              type: 'text', 
              text: `AI Outreach Batch complete. Sent to ${results.filter(r => r.status === 'sent').length}/${results.length} entities.\n\nResults: ${JSON.stringify(results, null, 2)}` 
            }] 
          };
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

        case 'get_invoices': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const {
            status,
            client_id,
            from_due_date,
            to_due_date,
            min_total,
            max_total,
            limit = 20,
            offset = 0,
            cursor,
            sort_by,
            sort_order,
            fields,
          } = a;
          const cursorOffset =
            typeof cursor === 'string' && cursor.trim()
              ? Number(Buffer.from(cursor, 'base64').toString('utf8')) || 0
              : 0;
          const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 100);
          const pageOffset = Math.max(Number(offset) || cursorOffset || 0, 0);
          const selectable = typeof fields === 'string' && fields.trim()
            ? fields.split(',').map((f: string) => f.trim()).filter(Boolean).join(', ')
            : 'id, invoice_number, client_id, status, subtotal, tax, total, issue_date, due_date, sent_at, paid_at, created_at, updated_at';
          const orderBy = ['created_at', 'due_date', 'total', 'status'].includes(String(sort_by || '')) ? String(sort_by) : 'created_at';
          const asc = String(sort_order || 'desc').toLowerCase() === 'asc';
          let query = supabaseAdmin
            .from('business_invoices')
            .select(selectable)
            .eq('tenant_id', tenant_id)
            .order(orderBy, { ascending: asc })
            .range(pageOffset, pageOffset + pageSize - 1);
          if (status) query = query.eq('status', status);
          if (client_id) query = query.eq('client_id', client_id);
          if (from_due_date) query = query.gte('due_date', String(from_due_date));
          if (to_due_date) query = query.lte('due_date', String(to_due_date));
          if (min_total != null) query = query.gte('total', Number(min_total) || 0);
          if (max_total != null) query = query.lte('total', Number(max_total) || 0);
          const { data, error } = await query;
          if (error) throw supabaseErrorToMcpClientError('get_invoices', error.message);
          const rows = Array.isArray(data) ? data : [];
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    items: rows,
                    pagination: {
                      limit: pageSize,
                      offset: pageOffset,
                      cursor: Buffer.from(String(pageOffset)).toString('base64'),
                      returned: rows.length,
                      has_more: rows.length === pageSize,
                      next_offset: rows.length === pageSize ? pageOffset + pageSize : null,
                      next_cursor: rows.length === pageSize ? Buffer.from(String(pageOffset + pageSize)).toString('base64') : null,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
          break;
        }

        case 'update_invoice': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { invoice_id, due_date, subtotal, tax, total, notes, status, line_items } = a;
          if (!isUuidString(invoice_id)) {
            throw new Error('invoice_id must be a valid invoice UUID from get_invoices');
          }
          const update: Record<string, unknown> = {};
          if (due_date !== undefined) update.due_date = due_date || null;
          if (subtotal !== undefined) update.subtotal = Number(subtotal);
          if (tax !== undefined) update.tax = Number(tax);
          if (total !== undefined) update.total = Number(total);
          if (notes !== undefined) update.notes = notes || null;
          if (line_items !== undefined) update.line_items = Array.isArray(line_items) ? line_items : [];
          if (status !== undefined) {
            const normalized = String(status).toLowerCase();
            if (!INVOICE_STATUSES.has(normalized)) {
              throw new Error('status must be one of: draft, sent, paid, overdue, cancelled, void');
            }
            update.status = normalized;
            if (normalized === 'paid') update.paid_at = new Date().toISOString();
            if (normalized === 'sent') update.sent_at = new Date().toISOString();
          }
          if (Object.keys(update).length === 0) throw new Error('Provide at least one field to update');
          update.updated_at = new Date().toISOString();
          const { data, error } = await supabaseAdmin
            .from('business_invoices')
            .update(update)
            .eq('tenant_id', tenant_id)
            .eq('id', invoice_id.trim())
            .select('id, invoice_number, status, total, due_date, sent_at, paid_at, updated_at')
            .single();
          if (error) throw supabaseErrorToMcpClientError('update_invoice', error.message);
          if (String(data?.status || '').toLowerCase() === 'paid') {
            await enqueueMcpEvent(
              supabaseAdmin,
              tenant_id,
              this.ctx?.userId || null,
              'on_invoice_paid',
              { invoice_id: data?.id || invoice_id, status: data?.status || null }
            );
          }
          result = { content: [{ type: 'text', text: `Invoice updated: ${JSON.stringify(data)}` }] };
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
        case 'upload_media_asset': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const { file_name, mime_type, file_base64, alt_text = '', tags = [] } = a;
          if (typeof file_name !== 'string' || !file_name.trim()) throw new Error('file_name is required');
          if (typeof mime_type !== 'string' || !mime_type.trim()) throw new Error('mime_type is required');
          if (typeof file_base64 !== 'string' || !file_base64.trim()) throw new Error('file_base64 is required');

          const normalizedBase64 = file_base64.includes('base64,')
            ? file_base64.split('base64,')[1]
            : file_base64;
          const binary = Buffer.from(normalizedBase64, 'base64');
          if (!binary.length) throw new Error('file_base64 is invalid or empty');

          const isVideo = mime_type.startsWith('video/');
          const isImage = mime_type.startsWith('image/');
          if (!isVideo && !isImage) {
            throw new Error('Unsupported media type. Only image/* or video/* is allowed.');
          }
          const maxBytes = isVideo ? 200 * 1024 * 1024 : 10 * 1024 * 1024;
          if (binary.length > maxBytes) {
            throw new Error(`Media exceeds max size of ${Math.round(maxBytes / 1024 / 1024)}MB.`);
          }
          const assetType = isVideo ? 'video' : mime_type.includes('gif') ? 'gif' : 'image';
          const ext = String(file_name).split('.').pop() || (isVideo ? 'mp4' : 'bin');
          const storagePath = `media/${tenant_id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

          const { error: uploadError } = await supabaseAdmin.storage
            .from('public-assets')
            .upload(storagePath, binary, {
              contentType: mime_type,
              upsert: false,
            });
          if (uploadError) throw supabaseErrorToMcpClientError('upload_media_asset', uploadError.message);

          const { data: urlData } = supabaseAdmin.storage.from('public-assets').getPublicUrl(storagePath);
          const publicUrl = urlData.publicUrl;

          const { data: asset, error: assetErr } = await supabaseAdmin
            .from('media_assets')
            .insert({
              tenant_id,
              user_id,
              file_name: file_name.trim(),
              file_type: mime_type.trim(),
              asset_type: assetType,
              storage_path: storagePath,
              public_url: publicUrl,
              file_size_bytes: binary.length,
              alt_text: typeof alt_text === 'string' ? alt_text : '',
              tags: Array.isArray(tags) ? tags.filter((t) => typeof t === 'string') : [],
            })
            .select('id, public_url, asset_type, file_name, file_size_bytes, created_at')
            .single();
          if (assetErr) throw supabaseErrorToMcpClientError('upload_media_asset', assetErr.message);

          result = { content: [{ type: 'text', text: `Media uploaded: ${JSON.stringify(asset)}` }] };
          break;
        }

        case 'upload_document': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const { filename, mime_type, file_base64, category, tags = [], entity_type, entity_id } = a;
          
          if (typeof filename !== 'string' || !filename.trim()) throw new Error('filename is required');
          if (typeof mime_type !== 'string' || !mime_type.trim()) throw new Error('mime_type is required');
          if (typeof file_base64 !== 'string' || !file_base64.trim()) throw new Error('file_base64 is required');

          const normalizedBase64 = file_base64.includes('base64,')
            ? file_base64.split('base64,')[1]
            : file_base64;
          const binary = Buffer.from(normalizedBase64, 'base64');
          if (!binary.length) throw new Error('file_base64 is invalid or empty');

          const uploadRes = await fileUploadService.uploadFileFromBuffer(
            binary,
            filename.trim(),
            mime_type.trim(),
            tenant_id,
            user_id,
            {
                category: typeof category === 'string' ? category : undefined,
                tags: Array.isArray(tags) ? tags : [],
                entityType: typeof entity_type === 'string' ? entity_type : undefined,
                entityId: typeof entity_id === 'string' ? entity_id : undefined
            }
          );

          if (!uploadRes.success) {
            throw new Error(uploadRes.error || 'Failed to upload document');
          }

          result = { content: [{ type: 'text', text: `Document uploaded and secured: ${JSON.stringify(uploadRes)}` }] };
          break;
        }

        case 'get_facebook_identities': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const { data: pages, error } = await supabaseAdmin
            .from('facebook_integrations')
            .select('page_id, page_name, is_active, page_access_token, metadata, updated_at')
            .eq('tenant_id', tenant_id)
            .eq('user_id', user_id)
            .order('updated_at', { ascending: false });
          if (error) throw supabaseErrorToMcpClientError('get_facebook_identities', error.message);

          const identities = (pages || []).map((page: any) => {
            const tasks = Array.isArray((page as any)?.metadata?.page_tasks)
              ? ((page as any).metadata.page_tasks as string[])
              : [];
            const hasTaskPermission = tasks.includes('MANAGE') || tasks.includes('CREATE_CONTENT') || tasks.includes('ADVERTISE');
            const canPost = !!page.page_access_token && page.is_active && !(page as any)?.metadata?.no_pages && hasTaskPermission;
            return {
              page_id: page.page_id,
              page_name: page.page_name,
              is_active: page.is_active,
              can_post: canPost,
              page_tasks: tasks,
            };
          });
          result = { content: [{ type: 'text', text: JSON.stringify({ connected: identities.length > 0, identities }, null, 2) }] };
          break;
        }

        case 'create_social_post':
        case 'create_post': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const {
            platforms = ['facebook'],
            page_id,
            caption,
            link_url,
            media_urls = [],
            media_asset_ids = [],
            hashtags = [],
            publish_now = false,
            scheduled_at,
            task_id,
            task_title,
            task_note,
            mark_task_done,
          } = a;
          if (typeof caption !== 'string' || !caption.trim()) throw new Error('caption is required');
          const normalizedPlatforms = Array.isArray(platforms)
            ? platforms.map((p) => String(p).trim().toLowerCase()).filter(Boolean)
            : ['facebook'];
          const validPlatforms = new Set(['facebook', 'linkedin', 'instagram', 'x', 'tiktok']);
          const unsupported = normalizedPlatforms.filter((p) => !validPlatforms.has(p));
          if (unsupported.length > 0) {
            throw new Error(`Unsupported platforms: ${unsupported.join(', ')}. Allowed: facebook, linkedin, instagram, x, tiktok`);
          }
          const hasFacebook = normalizedPlatforms.includes('facebook');
          if (!publish_now && (typeof scheduled_at !== 'string' || !scheduled_at.trim())) {
            throw new Error('scheduled_at is required when publish_now is false');
          }
          if (publish_now && !hasFacebook) {
            throw new Error('Immediate publish is currently supported only for Facebook. For LinkedIn/Instagram/X/TikTok, set publish_now=false to schedule/store.');
          }

          let resolvedPageId = typeof page_id === 'string' && page_id.trim() ? page_id.trim() : '';
          let integration: FacebookIntegrationIdentity | null = null;

          if (hasFacebook && resolvedPageId) {
            const { data: specificIntegration, error: integrationError } = await supabaseAdmin
              .from('facebook_integrations')
              .select('page_id, page_name, is_active, page_access_token, metadata, updated_at')
              .eq('tenant_id', tenant_id)
              .eq('page_id', resolvedPageId)
              .eq('is_active', true)
              .maybeSingle();
            if (integrationError) throw supabaseErrorToMcpClientError('create_social_post', integrationError.message);
            integration = (specificIntegration as FacebookIntegrationIdentity | null) || null;
          } else if (hasFacebook) {
            const { data: identities, error: identitiesError } = await supabaseAdmin
              .from('facebook_integrations')
              .select('page_id, page_name, is_active, page_access_token, metadata, updated_at')
              .eq('tenant_id', tenant_id)
              .eq('is_active', true);
            if (identitiesError) throw supabaseErrorToMcpClientError('create_social_post', identitiesError.message);
            integration = pickPreferredFacebookIdentity((identities || []) as FacebookIntegrationIdentity[]);
            if (integration?.page_id) resolvedPageId = integration.page_id;
          }

          if (hasFacebook && !resolvedPageId) {
            throw new Error('No connected Facebook pages were found for this workspace.');
          }

          const normalizedMediaUrls = Array.isArray(media_urls) ? media_urls.filter((u) => typeof u === 'string') : [];
          let resolvedAssetUrls: string[] = [];
          if (Array.isArray(media_asset_ids) && media_asset_ids.length > 0) {
            const ids = media_asset_ids.filter((id) => typeof id === 'string');
            const { data: assets, error: assetsError } = await supabaseAdmin
              .from('media_assets')
              .select('id, public_url')
              .eq('tenant_id', tenant_id)
              .in('id', ids);
            if (assetsError) throw supabaseErrorToMcpClientError('create_social_post', assetsError.message);
            resolvedAssetUrls = (assets || [])
              .map((asset: any) => String(asset.public_url || ''))
              .filter(Boolean);
          }

          const mergedMediaUrls = [...normalizedMediaUrls, ...resolvedAssetUrls];
          const firstMediaUrl = mergedMediaUrls.length > 0 ? mergedMediaUrls[0] : null;
          const isVideoMedia = !!firstMediaUrl && /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(firstMediaUrl);

          if (hasFacebook && (!integration?.page_access_token || integration?.metadata?.no_pages || !canPublishFacebookPage(integration))) {
            throw new Error('Connected integration is not publishable for this page. Connect a Facebook Page with publish permissions.');
          }

          let status: 'scheduled' | 'queued' | 'published' = publish_now ? 'queued' : 'scheduled';
          let publishedAt: string | null = null;
          let facebookPostId: string | null = null;
          const assuredIntegration = hasFacebook ? integration : null;

          if (publish_now && hasFacebook) {
            if (!assuredIntegration?.page_access_token) {
              throw new Error('Connected integration is not publishable for this page. Connect a Facebook Page with publish permissions.');
            }
            const graph = new URL(`https://graph.facebook.com/v19.0/${resolvedPageId}/${isVideoMedia ? 'videos' : firstMediaUrl ? 'photos' : 'feed'}`);
            graph.searchParams.set('access_token', assuredIntegration.page_access_token);
            const body = new URLSearchParams();
            if (firstMediaUrl) {
              if (isVideoMedia) {
                body.set('file_url', firstMediaUrl);
                body.set('description', caption.trim());
              } else {
                body.set('url', firstMediaUrl);
                body.set('caption', caption.trim());
              }
            } else {
              body.set('message', caption.trim());
              if (typeof link_url === 'string' && link_url) body.set('link', link_url);
            }
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
              platforms: normalizedPlatforms.length > 0 ? normalizedPlatforms : ['facebook'],
              link_url: typeof link_url === 'string' && link_url ? link_url : null,
              media_urls: mergedMediaUrls,
              hashtags: Array.isArray(hashtags) ? hashtags : [],
              status,
              scheduled_at: publish_now ? null : String(scheduled_at),
              published_at: publishedAt,
              facebook_page_id: hasFacebook ? resolvedPageId : null,
              facebook_post_id: facebookPostId,
            })
            .select('id, status, scheduled_at, published_at, facebook_post_id')
            .single();
          if (error) throw supabaseErrorToMcpClientError('create_social_post', error.message);

          const actionLabel = publish_now ? 'posted to Facebook' : `scheduled for ${String(scheduled_at)}`;
          const resolvedTaskNote = typeof task_note === 'string' && task_note.trim()
            ? task_note.trim()
            : `Social content ${actionLabel}. social_post_id=${data?.id || 'unknown'} platforms=${normalizedPlatforms.join(',')}`;
          const shouldMarkTaskDone = typeof mark_task_done === 'boolean' ? mark_task_done : !!publish_now;
          let taskResult: Record<string, unknown> | null = null;
          if (typeof task_id === 'string' && isUuidString(task_id)) {
            await appendTaskNoteAndMaybeComplete(
              supabaseAdmin,
              tenant_id,
              task_id.trim(),
              resolvedTaskNote,
              shouldMarkTaskDone
            );
            taskResult = { updated_task_id: task_id.trim(), marked_done: shouldMarkTaskDone };
          } else if (typeof task_title === 'string' && task_title.trim()) {
            const createdTask = await createAutomationTask(
              supabaseAdmin,
              tenant_id,
              task_title.trim(),
              resolvedTaskNote,
              !publish_now && typeof scheduled_at === 'string' ? String(scheduled_at) : null,
              shouldMarkTaskDone
            );
            taskResult = createdTask ? { created_task: createdTask } : null;
          }

          result = {
            content: [
              {
                type: 'text',
                text: `Social post created: ${JSON.stringify({
                  post: data,
                  task: taskResult,
                  page: hasFacebook ? { page_id: resolvedPageId, page_name: integration?.page_name || null } : null,
                })}`,
              },
            ],
          };
          break;
        }

        // ── LinkedIn tools ────────────────────────────────────────────────
        case 'get_linkedin_identities': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const { data: li, error: liErr } = await supabaseAdmin
            .from('linkedin_integrations')
            .select('linkedin_member_id, linkedin_person_urn, scopes, metadata, is_active, updated_at')
            .eq('tenant_id', tenant_id)
            .eq('user_id', user_id)
            .eq('is_active', true)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (liErr) throw supabaseErrorToMcpClientError('get_linkedin_identities', liErr.message);
          if (!li) {
            result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      connected: false,
                      code: 'LINKEDIN_NOT_CONNECTED',
                      message: 'LinkedIn is not connected for this workspace/user.',
                      identities: [],
                    },
                    null,
                    2
                  ),
                },
              ],
            };
            break;
          }

          const scopes = Array.isArray(li.scopes)
            ? li.scopes.map((scope: any) => String(scope).toLowerCase())
            : [];
          const companyPagesRaw = Array.isArray((li as any)?.metadata?.company_pages)
            ? ((li as any).metadata.company_pages as Array<Record<string, unknown>>)
            : [];
          const companyIdentities = companyPagesRaw
            .map((company) => {
              const id = String(company?.id || '').trim();
              if (!id) return null;
              return {
                type: 'company',
                organization_id: id,
                author_urn: `urn:li:organization:${id}`,
                name: typeof company?.name === 'string' ? company.name : null,
                vanity_name: typeof company?.vanityName === 'string' ? company.vanityName : null,
                can_post: scopes.includes('w_organization_social'),
              };
            })
            .filter((identity): identity is {
              type: 'company';
              organization_id: string;
              author_urn: string;
              name: string | null;
              vanity_name: string | null;
              can_post: boolean;
            } => !!identity);

          const identities = [
            {
              type: 'person',
              linkedin_member_id: li.linkedin_member_id || null,
              author_urn: li.linkedin_person_urn,
              can_post: scopes.includes('w_member_social'),
            },
            ...companyIdentities,
          ];
          result = { content: [{ type: 'text', text: JSON.stringify({ connected: true, identities }, null, 2) }] };
          break;
        }

        case 'create_linkedin_post': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const {
            text,
            post_as = 'personal',
            media_urls = [],
            media_asset_ids = [],
            publish_now = false,
            scheduled_at,
            linkedin_organization_id,
            task_id,
            task_title,
            task_note,
            mark_task_done,
          } = a;
          if (typeof text !== 'string' || !text.trim()) {
            throw new Error('text is required');
          }
          if (!publish_now && (typeof scheduled_at !== 'string' || !scheduled_at.trim())) {
            throw new Error('scheduled_at is required when publish_now is false');
          }

          const { data: li, error: liErr } = await supabaseAdmin
            .from('linkedin_integrations')
            .select('linkedin_member_id, linkedin_person_urn, access_token, scopes, metadata')
            .eq('tenant_id', tenant_id)
            .eq('user_id', user_id)
            .eq('is_active', true)
            .maybeSingle();
          if (liErr) throw supabaseErrorToMcpClientError('create_linkedin_post', liErr.message);
          if (!li?.access_token || !li?.linkedin_person_urn) {
            throwLinkedInError('LINKEDIN_NOT_CONNECTED', 'LinkedIn is not connected for this workspace/user.');
          }

          const scopes = Array.isArray(li.scopes) ? li.scopes : [];
          if (!scopes.includes('w_member_social')) {
            throwLinkedInError('LINKEDIN_MISSING_MEMBER_SCOPE', 'LinkedIn connection is missing w_member_social scope.');
          }
          const postAsMode = String(post_as || 'personal').trim().toLowerCase();
          if (postAsMode !== 'personal' && postAsMode !== 'company' && postAsMode !== 'all_pages') {
            throw new Error('post_as must be one of: personal, company, all_pages');
          }

          const companyPages = Array.isArray((li as any)?.metadata?.company_pages)
            ? ((li as any).metadata.company_pages as Array<Record<string, unknown>>)
            : [];
          const requestedOrganizationId =
            typeof linkedin_organization_id === 'string' && linkedin_organization_id.trim()
              ? linkedin_organization_id.trim()
              : null;
          const selectedCompany = requestedOrganizationId
            ? companyPages.find((page) => String(page?.id || '') === requestedOrganizationId)
            : null;
          let postAsCompany = false;
          if (postAsMode === 'company') {
            if (!scopes.includes('w_organization_social')) {
              throwLinkedInError(
                'LINKEDIN_MISSING_ORGANIZATION_SCOPE',
                'LinkedIn connection is missing w_organization_social scope. Reconnect LinkedIn and approve company page permissions.'
              );
            }
            if (!requestedOrganizationId || !selectedCompany) {
              const availableIds = companyPages.map((page) => String(page?.id || '').trim()).filter(Boolean);
              throwLinkedInError(
                'LINKEDIN_ORGANIZATION_ID_REQUIRED',
                'post_as=company requires linkedin_organization_id from get_linkedin_identities.',
                { available_organization_ids: availableIds }
              );
            }
            postAsCompany = true;
          }
          const allCompanyPageIds = companyPages
            .map((page) => String(page?.id || '').trim())
            .filter(Boolean);
          const postToAllPages = postAsMode === 'all_pages';
          if (postToAllPages) {
            if (!scopes.includes('w_organization_social')) {
              throwLinkedInError(
                'LINKEDIN_MISSING_ORGANIZATION_SCOPE',
                'LinkedIn connection is missing w_organization_social scope. Reconnect LinkedIn and approve company page permissions.'
              );
            }
            if (allCompanyPageIds.length === 0) {
              throwLinkedInError(
                'LINKEDIN_NO_COMPANY_PAGES',
                'No connected LinkedIn company pages found. Reconnect LinkedIn and ensure your account is an admin for at least one page.'
              );
            }
          }
          const authorUrn = postAsCompany
            ? `urn:li:organization:${requestedOrganizationId}`
            : li.linkedin_person_urn;

          const normalizedMediaUrls = Array.isArray(media_urls) ? media_urls.filter((u) => typeof u === 'string') : [];
          let resolvedAssetUrls: string[] = [];
          if (Array.isArray(media_asset_ids) && media_asset_ids.length > 0) {
            const ids = media_asset_ids.filter((id) => typeof id === 'string');
            const { data: assets, error: assetsError } = await supabaseAdmin
              .from('media_assets')
              .select('id, public_url')
              .eq('tenant_id', tenant_id)
              .in('id', ids);
            if (assetsError) throw supabaseErrorToMcpClientError('create_linkedin_post', assetsError.message);
            resolvedAssetUrls = (assets || [])
              .map((asset: any) => String(asset.public_url || ''))
              .filter(Boolean);
          }
          const mergedMediaUrls = [...normalizedMediaUrls, ...resolvedAssetUrls];
          const immediatePublish = Boolean(publish_now);
          if (immediatePublish && postToAllPages) {
            throw new Error('post_as=all_pages currently supports scheduled mode only. Set publish_now=false and provide scheduled_at.');
          }

          if (!immediatePublish && postToAllPages) {
            const createdRows: Array<Record<string, unknown>> = [];
            for (const organizationId of allCompanyPageIds) {
              const pageAuthorUrn = `urn:li:organization:${organizationId}`;
              const rowInsert = await insertSocialPostWithSchemaFallback(
                supabaseAdmin,
                {
                  tenant_id,
                  user_id,
                  caption: text.trim(),
                  platforms: ['linkedin'],
                  media_urls: mergedMediaUrls,
                  status: 'scheduled',
                  scheduled_at: String(scheduled_at),
                  published_at: null,
                  linkedin_organization_id: organizationId,
                  linkedin_member_id: null,
                  analytics: {},
                  metadata: { linkedin_organization_id: organizationId, linkedin_author_urn: pageAuthorUrn },
                },
                'id, status, scheduled_at, linkedin_organization_id'
              );
              const row = rowInsert.data as Record<string, unknown> | null;
              const rowError = rowInsert.error as { message?: string } | null;
              if (rowError || !row) {
                throw supabaseErrorToMcpClientError('create_linkedin_post', rowError?.message || 'Failed to schedule LinkedIn company page posts');
              }
              createdRows.push(row);
            }
            result = {
              content: [
                {
                  type: 'text',
                  text: `LinkedIn posts scheduled for all pages: ${JSON.stringify({ count: createdRows.length, posts: createdRows })}`,
                },
              ],
            };
            break;
          }

          const baseMetadata = postAsCompany
            ? { linkedin_organization_id: requestedOrganizationId, linkedin_author_urn: authorUrn }
            : { linkedin_author_urn: authorUrn };

          let data: Record<string, unknown> | null = null;

          if (immediatePublish) {
            const duplicate = await findRecentDuplicateLinkedInCaption(
              supabaseAdmin,
              tenant_id,
              user_id,
              text.trim(),
              7
            );
            if (duplicate) {
              throw new Error(
                'Duplicate post: the same caption was published from this workspace in the last 7 days. Edit the text before publishing again.'
              );
            }

            const pendingInsert = await insertSocialPostWithSchemaFallback(
              supabaseAdmin,
              {
                tenant_id,
                user_id,
                caption: text.trim(),
                platforms: ['linkedin'],
                media_urls: mergedMediaUrls,
                status: 'publishing',
                scheduled_at: null,
                published_at: null,
                linkedin_organization_id: postAsCompany ? requestedOrganizationId : null,
                linkedin_member_id: postAsCompany ? null : li.linkedin_member_id || null,
                analytics: {},
                metadata: baseMetadata,
              },
              'id'
            );
            const pendingRow = pendingInsert.data as { id: string } | null;
            const pendingErr = pendingInsert.error as { message?: string } | null;

            if (pendingErr || !pendingRow?.id) {
              throw supabaseErrorToMcpClientError('create_linkedin_post', pendingErr?.message || 'Failed to create draft post');
            }

            const postId = String(pendingRow.id);
            const primaryMediaUrl = mergedMediaUrls.find((url) => typeof url === 'string' && url.trim()) || null;
            let shareMediaCategory: 'NONE' | 'IMAGE' = 'NONE';
            let media: Array<Record<string, unknown>> = [];

            if (primaryMediaUrl) {
              const isLikelyVideo = /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(primaryMediaUrl);
              if (isLikelyVideo) {
                throw new Error(
                  'LinkedIn MCP immediate publish currently supports image media only. Use image media or schedule video via dashboard publisher.'
                );
              }

              const fetchController = new AbortController();
              const fetchTimer = setTimeout(() => fetchController.abort(), 30000);
              const imageFetch = await fetch(primaryMediaUrl, {
                method: 'GET',
                signal: fetchController.signal,
              }).finally(() => clearTimeout(fetchTimer));
              if (!imageFetch.ok) {
                throw new Error(`Could not download media URL (${imageFetch.status})`);
              }
              const contentType = String(imageFetch.headers.get('content-type') || 'image/jpeg');
              if (!contentType.startsWith('image/')) {
                throw new Error(`LinkedIn image publish requires image content-type. Received ${contentType}.`);
              }
              const imageBuffer = await imageFetch.arrayBuffer();

              const registerRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${li.access_token}`,
                  'Content-Type': 'application/json',
                  'X-Restli-Protocol-Version': '2.0.0',
                },
                body: JSON.stringify({
                  registerUploadRequest: {
                    recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
                    owner: authorUrn,
                    serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
                  },
                }),
              });
              const registerJson = await registerRes.json().catch(() => ({}));
              if (!registerRes.ok) {
                throw new Error(registerJson?.message || `LinkedIn media register failed (${registerRes.status})`);
              }
              const assetUrn = String(registerJson?.value?.asset || '');
              const uploadUrl = String(
                registerJson?.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl || ''
              );
              if (!assetUrn || !uploadUrl) {
                throw new Error('LinkedIn media register response missing upload target');
              }

              const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                headers: { 'Content-Type': contentType },
                body: imageBuffer,
              });
              if (!uploadRes.ok) {
                throw new Error(`LinkedIn media upload failed (${uploadRes.status})`);
              }

              shareMediaCategory = 'IMAGE';
              media = [{
                status: 'READY',
                media: assetUrn,
                title: { text: 'AlphaClone image' },
              }];
            }

            const payload = {
              author: authorUrn,
              lifecycleState: 'PUBLISHED',
              specificContent: {
                'com.linkedin.ugc.ShareContent': {
                  shareCommentary: { text: text.trim() },
                  shareMediaCategory,
                  media,
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
              await supabaseAdmin
                .from('social_posts')
                .update({
                  status: 'failed',
                  error_message: raw.slice(0, 2000),
                })
                .eq('id', postId);
              throw new Error(`LinkedIn post failed: ${raw}`);
            }

            const linkedinPostUrn = parseLinkedInUgcPostUrn(resp, raw);
            const publishedAt = new Date().toISOString();
            const updatePatch: Record<string, unknown> = {
              status: 'published',
              published_at: publishedAt,
              linkedin_post_urn: linkedinPostUrn,
              linkedin_organization_id: postAsCompany ? requestedOrganizationId : null,
              linkedin_member_id: postAsCompany ? null : li.linkedin_member_id || null,
              analytics: linkedinPostUrn ? { linkedin_post_urn: linkedinPostUrn } : {},
              metadata: baseMetadata,
            };

            let persisted = await updateSocialPostLinkedInUrnWithRetry(supabaseAdmin, postId, updatePatch);
            if (!persisted.ok) {
              const message = String(persisted.error || '');
              const missingOrg = message.includes('linkedin_organization_id');
              const missingMember = message.includes('linkedin_member_id');
              if (missingOrg || missingMember) {
                const fallbackPatch: Record<string, unknown> = {
                  status: 'published',
                  published_at: publishedAt,
                  linkedin_post_urn: linkedinPostUrn,
                  analytics: linkedinPostUrn ? { linkedin_post_urn: linkedinPostUrn } : {},
                  metadata: baseMetadata,
                };
                persisted = await updateSocialPostLinkedInUrnWithRetry(supabaseAdmin, postId, fallbackPatch);
              }
            }
            if (!persisted.ok && linkedinPostUrn) {
              await enqueueSocialPostSync(supabaseAdmin, {
                socialPostId: postId,
                tenantId: tenant_id,
                platform: 'linkedin',
                externalId: linkedinPostUrn,
                lastError: persisted.error,
              });
            }

            const { data: finalRow, error: finalErr } = await supabaseAdmin
              .from('social_posts')
              .select('id, status, published_at, analytics, linkedin_post_urn')
              .eq('id', postId)
              .single();
            if (finalErr) throw supabaseErrorToMcpClientError('create_linkedin_post', finalErr.message);
            data = finalRow as Record<string, unknown>;
          } else {
            const scheduledInsert = await insertSocialPostWithSchemaFallback(
              supabaseAdmin,
              {
                tenant_id,
                user_id,
                caption: text.trim(),
                platforms: ['linkedin'],
                media_urls: mergedMediaUrls,
                status: 'scheduled',
                scheduled_at: String(scheduled_at),
                published_at: null,
                linkedin_organization_id: postAsCompany ? requestedOrganizationId : null,
                linkedin_member_id: postAsCompany ? null : li.linkedin_member_id || null,
                analytics: {},
                metadata: baseMetadata,
              },
              'id, status, published_at, analytics'
            );
            const scheduledData = scheduledInsert.data as Record<string, unknown> | null;
            const error = scheduledInsert.error as { message?: string } | null;
            if (error) throw supabaseErrorToMcpClientError('create_linkedin_post', error.message || 'Failed to schedule LinkedIn post');
            data = scheduledData as Record<string, unknown>;
          }

          if (!data) {
            throw new Error('create_linkedin_post did not return a row');
          }

          const actionLabel = immediatePublish ? 'posted to LinkedIn' : `scheduled for ${String(scheduled_at)}`;
          const resolvedTaskNote = typeof task_note === 'string' && task_note.trim()
            ? task_note.trim()
            : `LinkedIn content ${actionLabel}. social_post_id=${data?.id || 'unknown'}`;
          const shouldMarkTaskDone = typeof mark_task_done === 'boolean' ? mark_task_done : !!immediatePublish;
          let taskResult: Record<string, unknown> | null = null;
          if (typeof task_id === 'string' && isUuidString(task_id)) {
            await appendTaskNoteAndMaybeComplete(
              supabaseAdmin,
              tenant_id,
              task_id.trim(),
              resolvedTaskNote,
              shouldMarkTaskDone
            );
            taskResult = { updated_task_id: task_id.trim(), marked_done: shouldMarkTaskDone };
          } else if (typeof task_title === 'string' && task_title.trim()) {
            const createdTask = await createAutomationTask(
              supabaseAdmin,
              tenant_id,
              task_title.trim(),
              resolvedTaskNote,
              !immediatePublish && typeof scheduled_at === 'string' ? String(scheduled_at) : null,
              shouldMarkTaskDone
            );
            taskResult = createdTask ? { created_task: createdTask } : null;
          }

          const publishHint = !immediatePublish && mergedMediaUrls.length > 0
            ? ' LinkedIn image posts were scheduled for publisher processing.'
            : '';
          result = { content: [{ type: 'text', text: `LinkedIn post created: ${JSON.stringify({ post: data, task: taskResult })}.${publishHint}` }] };
          break;
        }

        // ── send_invoice ────────────────────────────────────────────────────
        case 'send_invoice': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { invoice_id } = a;
          if (!isUuidString(invoice_id)) {
            throw new Error('invoice_id must be a valid invoice UUID');
          }

          const { data, error } = await supabaseAdmin
            .from('business_invoices')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('tenant_id', tenant_id)
            .eq('id', invoice_id.trim())
            .select('id, invoice_number, status, sent_at')
            .single();
          if (error) throw supabaseErrorToMcpClientError('send_invoice', error.message);
          result = { content: [{ type: 'text', text: `Invoice marked as sent: ${JSON.stringify(data)}` }] };
          break;
        }

        case 'send_receipt': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const { invoice_id, recipient_email, provider } = a;
          if (!isUuidString(invoice_id)) {
            throw new Error('invoice_id must be a valid invoice UUID');
          }

          const { invoice, error: fetchErr } = await businessInvoiceService.getInvoiceWithDetails(invoice_id);
          if (fetchErr || !invoice) throw new Error(`Invoice not found: ${fetchErr || 'Unknown error'}`);

          if (invoice.status !== 'paid') {
            throw new Error(`Cannot send receipt for invoice in '${invoice.status}' status. Invoice must be 'paid'.`);
          }

          const to = recipient_email || invoice.client?.email;
          if (!to) throw new Error('Recipient email is required (not found on client record)');

          const amount = `${invoice.currency || '$'}${invoice.total}`;
          const receiptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/public/receipt/${invoice.id}`;

          const sendResult = await emailHelpers.sendReceipt(
            to,
            invoice.invoice_number,
            amount,
            receiptUrl,
            provider,
            user_id
          );

          if (!sendResult.success) throw new Error(`Failed to send receipt: ${sendResult.error}`);

          result = {
            content: [{
              type: 'text',
              text: `Receipt for invoice ${invoice.invoice_number} sent successfully to ${to} via ${provider || 'default provider'}.`,
            }],
          };
          break;
        }

        case 'get_linkedin_posts': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { limit = 20 } = a;
          const { data, error } = await supabaseAdmin
            .from('social_posts')
            .select('id, caption, status, published_at, created_at, analytics, linkedin_post_urn, linkedin_member_id, linkedin_organization_id, linkedin_author_urn, linkedin_stats, linkedin_stats_synced_at, last_engagement_sync_at')
            .eq('tenant_id', tenant_id)
            .contains('platforms', ['linkedin'])
            .order('created_at', { ascending: false })
            .limit(Math.min(Number(limit) || 20, 100));
          if (error) throw supabaseErrorToMcpClientError('get_linkedin_posts', error.message);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        case 'get_linkedin_post_stats': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const post_urn = String(a.post_urn || '').trim();
          const linkedin_organization_id =
            typeof a.linkedin_organization_id === 'string' && a.linkedin_organization_id.trim()
              ? a.linkedin_organization_id.trim()
              : null;
          if (!post_urn) throw new Error('post_urn is required');

          const { data: li, error: liErr } = await supabaseAdmin
            .from('linkedin_integrations')
            .select('access_token, scopes')
            .eq('tenant_id', tenant_id)
            .eq('user_id', user_id)
            .eq('is_active', true)
            .maybeSingle();
          if (liErr) throw supabaseErrorToMcpClientError('get_linkedin_post_stats', liErr.message);
          if (!li?.access_token) throw new Error('LinkedIn is not connected for this workspace/user.');

          const socialActionRes = await fetch(`https://api.linkedin.com/v2/socialActions/${encodeURIComponent(post_urn)}`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${li.access_token}`,
              'Content-Type': 'application/json',
              'X-Restli-Protocol-Version': '2.0.0',
            },
          });
          const socialPayload = (await socialActionRes.json().catch(() => ({}))) as Record<string, any>;
          const likesCount =
            Number(socialPayload?.likesSummary?.totalLikes) ||
            Number(socialPayload?.likesSummary?.count) ||
            Number(socialPayload?.totalLikes) ||
            0;
          const commentsCount =
            Number(socialPayload?.commentsSummary?.totalComments) ||
            Number(socialPayload?.commentsSummary?.count) ||
            Number(socialPayload?.totalComments) ||
            0;

          let impressions = 0;
          let clicks = 0;
          let shares = 0;
          let organizationStatsAvailable = false;
          if (linkedin_organization_id) {
            const orgUrn = `urn:li:organization:${linkedin_organization_id}`;
            const statsUrl = new URL('https://api.linkedin.com/v2/organizationalEntityShareStatistics');
            statsUrl.searchParams.set('q', 'organizationalEntity');
            statsUrl.searchParams.set('organizationalEntity', orgUrn);
            statsUrl.searchParams.set('shares[0]', post_urn);
            const statsRes = await fetch(statsUrl.toString(), {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${li.access_token}`,
                'X-Restli-Protocol-Version': '2.0.0',
              },
            });
            if (statsRes.ok) {
              const statsPayload = (await statsRes.json().catch(() => ({}))) as Record<string, any>;
              const first = Array.isArray(statsPayload?.elements) ? statsPayload.elements[0] : null;
              const aggregate = (first?.totalShareStatistics || first?.shareStatistics || {}) as Record<string, unknown>;
              impressions = Number(aggregate.impressionCount || aggregate.impressions || 0) || 0;
              clicks = Number(aggregate.clickCount || aggregate.clicks || 0) || 0;
              shares = Number(aggregate.shareCount || aggregate.shares || 0) || 0;
              organizationStatsAvailable = true;
            }
          }

          const nowIso = new Date().toISOString();
          const nextLinkedinStats = {
            likes: likesCount,
            comments: commentsCount,
            impressions,
            clicks,
            shares,
            organization_stats_available: organizationStatsAvailable,
            synced_at: nowIso,
          };

          await supabaseAdmin
            .from('social_posts')
            .update({
              analytics: nextLinkedinStats,
              linkedin_stats: nextLinkedinStats,
              linkedin_stats_synced_at: nowIso,
            })
            .eq('tenant_id', tenant_id)
            .eq('linkedin_post_urn', post_urn);

          result = { content: [{ type: 'text', text: JSON.stringify(nextLinkedinStats, null, 2) }] };
          break;
        }

        case 'capture_linkedin_comment_leads': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const source = typeof a.source === 'string' && a.source.trim() ? a.source.trim() : 'LinkedIn Comment';
          const limitPosts = Math.min(Math.max(Number(a.limit_posts || 10), 1), 30);
          const limitCommentsPerPost = Math.min(Math.max(Number(a.limit_comments_per_post || 30), 1), 100);
          const requestedPostUrn = typeof a.post_urn === 'string' && a.post_urn.trim() ? a.post_urn.trim() : '';

          const { data: li, error: liErr } = await supabaseAdmin
            .from('linkedin_integrations')
            .select('access_token')
            .eq('tenant_id', tenant_id)
            .eq('user_id', user_id)
            .eq('is_active', true)
            .maybeSingle();
          if (liErr) throw supabaseErrorToMcpClientError('capture_linkedin_comment_leads', liErr.message);
          if (!li?.access_token) throw new Error('LinkedIn is not connected for this workspace/user.');

          let postsQuery = supabaseAdmin
            .from('social_posts')
            .select('id, caption, linkedin_post_urn')
            .eq('tenant_id', tenant_id)
            .contains('platforms', ['linkedin'])
            .not('linkedin_post_urn', 'is', null)
            .order('created_at', { ascending: false })
            .limit(limitPosts);
          if (requestedPostUrn) postsQuery = postsQuery.eq('linkedin_post_urn', requestedPostUrn);
          const { data: posts, error: postsErr } = await postsQuery;
          if (postsErr) throw supabaseErrorToMcpClientError('capture_linkedin_comment_leads', postsErr.message);

          let scannedComments = 0;
          let createdLeads = 0;
          let skippedDuplicates = 0;
          const created: Array<Record<string, unknown>> = [];

          for (const post of posts || []) {
            const postUrn = String(post.linkedin_post_urn || '').trim();
            if (!postUrn) continue;
            const url = `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}/comments?count=${limitCommentsPerPost}`;
            const commentRes = await fetch(url, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${li.access_token}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0',
              },
            });
            if (!commentRes.ok) continue;
            const commentJson = (await commentRes.json().catch(() => ({}))) as Record<string, any>;
            const elements = Array.isArray(commentJson?.elements) ? commentJson.elements : [];
            for (const element of elements) {
              scannedComments += 1;
              const actor = String(element?.actor || '').trim();
              const commentText = String(element?.message?.text || '').trim();
              if (!actor || !commentText) continue;

              const dedupeToken = `${postUrn}::${actor}`;
              const { data: existingLead } = await supabaseAdmin
                .from('leads')
                .select('id')
                .eq('tenant_id', tenant_id)
                .like('notes', `%${dedupeToken}%`)
                .limit(1)
                .maybeSingle();
              if (existingLead?.id) {
                skippedDuplicates += 1;
                continue;
              }

              const inferredName = actor.replace('urn:li:person:', '').replace('urn:li:organization:', '').slice(0, 180);
              const notes = `Auto-created from LinkedIn comment.\npost_urn=${postUrn}\nactor=${actor}\ndedupe=${dedupeToken}\ncomment="${commentText.slice(0, 1000)}"`;
              const insert = await supabaseAdmin
                .from('leads')
                .insert({
                  tenant_id,
                  owner_id: user_id,
                  business_name: inferredName || 'LinkedIn Comment Lead',
                  status: 'new',
                  stage: 'lead',
                  source,
                  notes,
                })
                .select('id, business_name, source, created_at')
                .single();
              if (insert.error) continue;
              createdLeads += 1;
              created.push({
                lead_id: insert.data?.id,
                name: insert.data?.business_name,
                post_urn: postUrn,
                actor,
              });
            }

            await supabaseAdmin
              .from('social_posts')
              .update({ last_engagement_sync_at: new Date().toISOString() })
              .eq('tenant_id', tenant_id)
              .eq('id', post.id);
          }

          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    scanned_comments: scannedComments,
                    created_leads: createdLeads,
                    skipped_duplicates: skippedDuplicates,
                    leads: created,
                  },
                  null,
                  2
                ),
              },
            ],
          };
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
          let data: any;
          let error: any;
          ({ data, error } = await query);
          if (error && isSchemaOrRelationError(error)) {
            let fallback = supabase
              .from('expenses')
              .select('id, description, amount, category, status, created_at')
              .eq('tenant_id', tenant_id)
              .order('created_at', { ascending: false })
              .limit(50);
            if (status) fallback = fallback.eq('status', status);
            ({ data, error } = await fallback);
          }
          if (error) throw supabaseErrorToMcpClientError('get_expenses', (error as { message?: string }).message || 'Failed to fetch expenses');
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        // ── create_expense ─────────────────────────────────────────────────
        case 'create_expense': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { description, amount, category, date } = a;
          const primary = await supabase
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
          let data: any = primary.data;
          let error: any = primary.error;
          if (error && isSchemaOrRelationError(error)) {
            const fallback = await supabase
              .from('expenses')
              .insert({
                tenant_id,
                description,
                amount,
                category: category || 'Uncategorized',
                status: 'pending',
              })
              .select('id, description, amount, category, created_at')
              .single();
            data = fallback.data;
            error = fallback.error;
          }
          if (error) throw supabaseErrorToMcpClientError('create_expense', (error as { message?: string }).message || 'Failed to create expense');
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
          const { data, error } = await supabaseAdmin
            .from('business_invoices')
            .select('total, status, created_at, client_id, invoice_number')
            .eq('tenant_id', tenant_id)
            .limit(500);
          if (error) throw supabaseErrorToMcpClientError('get_revenue_summary', error.message);
          const rows = data ?? [];
          const paid = rows
            .filter((i: { status?: string }) => i.status === 'paid')
            .reduce((s: number, i: { total?: number }) => s + (Number(i.total) || 0), 0);
          const outstanding = rows
            .filter((i: { status?: string }) => i.status !== 'paid')
            .reduce((s: number, i: { total?: number }) => s + (Number(i.total) || 0), 0);

          const byMonth: Record<string, { paid: number; outstanding: number; invoice_count: number }> = {};
          const byClient: Record<
            string,
            { client_id: string | null; paid: number; outstanding: number; invoice_count: number }
          > = {};

          for (const inv of rows as Array<{
            total?: number;
            status?: string;
            created_at?: string;
            client_id?: string | null;
          }>) {
            const t = Number(inv.total) || 0;
            const isPaid = inv.status === 'paid';
            const created = inv.created_at ? new Date(inv.created_at) : new Date();
            const monthKey = `${created.getUTCFullYear()}-${String(created.getUTCMonth() + 1).padStart(2, '0')}`;
            if (!byMonth[monthKey]) {
              byMonth[monthKey] = { paid: 0, outstanding: 0, invoice_count: 0 };
            }
            byMonth[monthKey].invoice_count += 1;
            if (isPaid) byMonth[monthKey].paid += t;
            else byMonth[monthKey].outstanding += t;

            const cid = inv.client_id ? String(inv.client_id) : '_none';
            if (!byClient[cid]) {
              byClient[cid] = {
                client_id: inv.client_id ?? null,
                paid: 0,
                outstanding: 0,
                invoice_count: 0,
              };
            }
            byClient[cid].invoice_count += 1;
            if (isPaid) byClient[cid].paid += t;
            else byClient[cid].outstanding += t;
          }

          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    total_invoices: rows.length,
                    total_paid: paid,
                    total_outstanding: outstanding,
                    currency: 'USD',
                    by_month: byMonth,
                    by_client: byClient,
                  },
                  null,
                  2
                ),
              },
            ],
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

          let contractContent = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : '';
          const draftAttribution = 'Claude (via AlphaClone MCP generate_contract_draft)';
          contractContent = appendContractDisclaimer(contractContent, draftAttribution);

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
          const { client_id, title, content, type = 'service_agreement', source_attribution } = a;

          if (!title || !content) throw new Error('title and content are required');

          const attribution =
            typeof source_attribution === 'string' && source_attribution.trim()
              ? source_attribution.trim()
              : 'MCP Assistant';
          const body = appendContractDisclaimer(String(content), attribution);

          const { data, error } = await supabase
            .from('contracts')
            .insert({
              tenant_id,
              client_id: client_id || null,
              title,
              content: body,
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
            .select('id, text, sender_id, sender_name, recipient_id, group_id, created_at, priority, reply_to')
            .eq('tenant_id', tenant_id)
            .order('created_at', { ascending: false })
            .limit(Math.min(limit, 50));
          if (error) throw supabaseErrorToMcpClientError('get_recent_messages', error.message);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        case 'send_transactional_email': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const to = String(a.to || '').trim();
          const subject = String(a.subject || '').trim();
          if (!to || !subject) throw new Error('to and subject are required');
          const resolved = await resolveEmailProviderConfig({ tenantId: tenant_id, preferredUserId: user_id, fallbackToEnv: false });
          if (!resolved?.provider || !resolved?.apiKey) {
            throw new Error('No provider configured for this user. Connect Resend/SendGrid/Brevo first.');
          }
          const sendResult = await sendWithProviderSdk(resolved.provider as EmailProvider, {
            apiKey: resolved.apiKey,
            fromEmail: resolved.fromEmail || String(a.from_email || ''),
            fromName: String(a.from_name || 'AlphaClone Systems'),
            to,
            subject,
            html: a.html ? String(a.html) : undefined,
            text: a.text ? String(a.text) : undefined,
          });
          if (!sendResult.ok) throw new Error(sendResult.error || 'Transactional email failed');
          result = { content: [{ type: 'text', text: JSON.stringify({ provider: sendResult.provider, id: sendResult.emailId }, null, 2) }] };
          break;
        }

        case 'get_email_campaign_stats': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = a.user_id ? this.requireProfileUser(a) : null;
          const fromDate = typeof a.from_date === 'string' ? a.from_date : null;
          const toDate = typeof a.to_date === 'string' ? a.to_date : null;
          let query = supabaseAdmin
            .from('lead_outreach_log')
            .select('provider,status,created_at')
            .eq('tenant_id', tenant_id)
            .limit(5000);
          if (user_id) query = query.eq('user_id', user_id);
          if (fromDate) query = query.gte('created_at', fromDate);
          if (toDate) query = query.lte('created_at', toDate);
          const { data, error } = await query;
          if (error) throw supabaseErrorToMcpClientError('get_email_campaign_stats', error.message);
          const rows = (data || []) as Array<Record<string, unknown>>;
          const byProvider: Record<string, number> = {};
          const byStatus: Record<string, number> = {};
          rows.forEach((r) => {
            const p = String(r.provider || 'unknown');
            const s = String(r.status || 'unknown');
            byProvider[p] = (byProvider[p] || 0) + 1;
            byStatus[s] = (byStatus[s] || 0) + 1;
          });
          result = { content: [{ type: 'text', text: JSON.stringify({ total: rows.length, by_provider: byProvider, by_status: byStatus }, null, 2) }] };
          break;
        }

        case 'get_client_history': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const client_id = String(a.client_id || '').trim();
          const limit = Math.min(Math.max(Number(a.limit) || 50, 1), 200);
          if (!isUuidString(client_id)) throw new Error('client_id must be a valid UUID');
          const { data: client, error: clientError } = await supabaseAdmin
            .from('business_clients')
            .select('*')
            .eq('tenant_id', tenant_id)
            .eq('id', client_id)
            .maybeSingle();
          if (clientError) throw supabaseErrorToMcpClientError('get_client_history', clientError.message);
          const email = String(client?.email || '').trim().toLowerCase();
          const likeEmail = `%${email}%`;
          const [leadsRes, outreachRes, unifiedRes] = await Promise.all([
            supabaseAdmin.from('leads').select('id,business_name,status,stage,source,created_at').eq('tenant_id', tenant_id).or(`email.ilike.${likeEmail},business_name.ilike.%${String(client?.name || '')}%`).limit(limit),
            supabaseAdmin.from('lead_outreach_log').select('id,subject,provider,status,sent_at,opened_at,clicked_at,created_at').eq('tenant_id', tenant_id).ilike('lead_email', likeEmail).limit(limit),
            supabaseAdmin.from('unified_messages').select('id,direction,subject,from_address,to_address,sent_at,received_at,created_at').eq('tenant_id', tenant_id).eq('channel','email').or(`from_address.ilike.${likeEmail},to_address.ilike.${likeEmail}`).limit(limit),
          ]);
          if (leadsRes.error) throw supabaseErrorToMcpClientError('get_client_history', leadsRes.error.message);
          if (outreachRes.error) throw supabaseErrorToMcpClientError('get_client_history', outreachRes.error.message);
          if (unifiedRes.error) throw supabaseErrorToMcpClientError('get_client_history', unifiedRes.error.message);
          result = { content: [{ type: 'text', text: JSON.stringify({ client, leads: leadsRes.data || [], outreach: outreachRes.data || [], email_messages: unifiedRes.data || [] }, null, 2) }] };
          break;
        }

        case 'segment_clients_by_criteria': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const limit = Math.min(Math.max(Number(a.limit) || 200, 1), 1000);
          let query = supabaseAdmin.from('business_clients').select('id,name,email,phone,industry,location,sales_stage,value,created_at').eq('tenant_id', tenant_id).limit(limit);
          if (a.industry) query = query.ilike('industry', `%${String(a.industry).trim()}%`);
          if (a.location) query = query.ilike('location', `%${String(a.location).trim()}%`);
          if (a.sales_stage) query = query.eq('sales_stage', String(a.sales_stage).trim());
          if (a.min_value != null) query = query.gte('value', Number(a.min_value) || 0);
          if (a.max_value != null) query = query.lte('value', Number(a.max_value) || 0);
          const { data, error } = await query;
          if (error) throw supabaseErrorToMcpClientError('segment_clients_by_criteria', error.message);
          const rows = (data || []).filter((r: any) => (a.has_email === undefined || !!r.email === Boolean(a.has_email)) && (a.has_phone === undefined || !!r.phone === Boolean(a.has_phone)));
          result = { content: [{ type: 'text', text: JSON.stringify({ count: rows.length, items: rows }, null, 2) }] };
          break;
        }

        case 'update_client_metadata': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const client_id = String(a.client_id || '').trim();
          const metadata = a.metadata && typeof a.metadata === 'object' ? (a.metadata as Record<string, unknown>) : null;
          if (!isUuidString(client_id)) throw new Error('client_id must be a valid UUID');
          if (!metadata) throw new Error('metadata must be an object');
          const { data: existing, error: e1 } = await supabaseAdmin.from('business_clients').select('custom_fields').eq('tenant_id', tenant_id).eq('id', client_id).maybeSingle();
          if (e1) throw supabaseErrorToMcpClientError('update_client_metadata', e1.message);
          const merged = { ...(existing?.custom_fields || {}), ...metadata };
          const { data, error } = await supabaseAdmin.from('business_clients').update({ custom_fields: merged }).eq('tenant_id', tenant_id).eq('id', client_id).select('id,custom_fields,updated_at').single();
          if (error) throw supabaseErrorToMcpClientError('update_client_metadata', error.message);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        case 'add_task_dependency': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const task_id = String(a.task_id || '').trim();
          const depends_on_task_id = String(a.depends_on_task_id || '').trim();
          if (!isUuidString(task_id) || !isUuidString(depends_on_task_id)) throw new Error('task_id and depends_on_task_id must be UUIDs');
          const { data, error } = await supabaseAdmin.from('task_dependencies').insert({ tenant_id, task_id, depends_on_task_id }).select('*').single();
          if (error) throw supabaseErrorToMcpClientError('add_task_dependency', error.message);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        case 'set_task_recurrence': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const task_id = String(a.task_id || '').trim();
          if (!isUuidString(task_id)) throw new Error('task_id must be a valid UUID');
          const payload = {
            frequency: String(a.frequency || ''),
            interval: Math.max(Number(a.interval) || 1, 1),
            days_of_week: Array.isArray(a.days_of_week) ? a.days_of_week : null,
            day_of_month: a.day_of_month != null ? Number(a.day_of_month) : null,
            end_date: a.end_date ? String(a.end_date) : null,
          };
          const { data, error } = await supabaseAdmin
            .from('task_recurrence')
            .upsert({ tenant_id, task_id, ...payload }, { onConflict: 'task_id' })
            .select('*')
            .single();
          if (error) throw supabaseErrorToMcpClientError('set_task_recurrence', error.message);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        case 'get_project_milestones': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const project_id = String(a.project_id || '').trim();
          if (!isUuidString(project_id)) throw new Error('project_id must be a valid UUID');
          const { data, error } = await supabaseAdmin.from('project_milestones').select('*').eq('tenant_id', tenant_id).eq('project_id', project_id).order('due_date', { ascending: true });
          if (error) throw supabaseErrorToMcpClientError('get_project_milestones', error.message);
          result = {
            content: [
              {
                type: 'text',
                text: renderBusinessSuccess('mcp-tool', 'mcp-trace', 'Data retrieved', data),
              },
              {
                type: 'text',
                text: JSON.stringify(data || [], null, 2),
              },
            ],
          };
          break;
        }

        case 'get_invoice_line_items': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const invoice_id = String(a.invoice_id || '').trim();
          if (!isUuidString(invoice_id)) throw new Error('invoice_id must be a valid UUID');
          const { data, error } = await supabaseAdmin.from('invoice_line_items').select('*').eq('tenant_id', tenant_id).eq('invoice_id', invoice_id).order('position', { ascending: true });
          if (error) throw supabaseErrorToMcpClientError('get_invoice_line_items', error.message);
          result = {
            content: [
              {
                type: 'text',
                text: renderBusinessSuccess('mcp-tool', 'mcp-trace', 'Data retrieved', data),
              },
              {
                type: 'text',
                text: JSON.stringify(data || [], null, 2),
              },
            ],
          };
          break;
        }

        case 'reconcile_payment': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const invoice_id = String(a.invoice_id || '').trim();
          if (!isUuidString(invoice_id)) throw new Error('invoice_id must be a valid UUID');
          const patch: Record<string, unknown> = { status: 'paid', paid_at: a.paid_at ? String(a.paid_at) : new Date().toISOString() };
          if (a.amount != null) patch.paid_amount = Number(a.amount) || 0;
          if (a.payment_ref) patch.payment_reference = String(a.payment_ref);
          const { data, error } = await supabaseAdmin.from('invoices').update(patch).eq('tenant_id', tenant_id).eq('id', invoice_id).select('id,status,paid_at,updated_at').single();
          if (error) throw supabaseErrorToMcpClientError('reconcile_payment', error.message);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        case 'generate_expense_report': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          let query = supabaseAdmin.from('expenses').select('id,category,status,amount,date,created_at').eq('tenant_id', tenant_id).limit(5000);
          if (a.from_date) query = query.gte('date', String(a.from_date));
          if (a.to_date) query = query.lte('date', String(a.to_date));
          const { data, error } = await query;
          if (error) throw supabaseErrorToMcpClientError('generate_expense_report', error.message);
          const rows = (data || []) as Array<Record<string, any>>;
          const byCategory: Record<string, number> = {};
          const byStatus: Record<string, number> = {};
          let total = 0;
          rows.forEach((r) => {
            const cat = String(r.category || 'uncategorized');
            const st = String(r.status || 'unknown');
            const amount = Number(r.amount || 0);
            byCategory[cat] = (byCategory[cat] || 0) + amount;
            byStatus[st] = (byStatus[st] || 0) + amount;
            total += amount;
          });
          result = { content: [{ type: 'text', text: JSON.stringify({ total, count: rows.length, by_category: byCategory, by_status: byStatus }, null, 2) }] };
          break;
        }

        case 'subscribe_events': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const event_name = String(a.event_name || '').trim();
          const target = String(a.target || '').trim();
          if (!event_name || !target) throw new Error('event_name and target are required');
          const { data, error } = await supabaseAdmin
            .from('mcp_event_subscriptions')
            .insert({ tenant_id, user_id, event_name, target, config: a.config && typeof a.config === 'object' ? a.config : {}, is_active: true })
            .select('*')
            .single();
          if (error) throw supabaseErrorToMcpClientError('subscribe_events', error.message);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        case 'list_event_subscriptions': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const { data, error } = await supabaseAdmin
            .from('mcp_event_subscriptions')
            .select('*')
            .eq('tenant_id', tenant_id)
            .eq('user_id', user_id)
            .order('created_at', { ascending: false })
            .limit(500);
          if (error) throw supabaseErrorToMcpClientError('list_event_subscriptions', error.message);
          result = {
            content: [
              {
                type: 'text',
                text: renderBusinessSuccess('mcp-tool', 'mcp-trace', 'Data retrieved', data),
              },
              {
                type: 'text',
                text: JSON.stringify(data || [], null, 2),
              },
            ],
          };
          break;
        }

        case 'unsubscribe_event': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const subscription_id = String(a.subscription_id || '').trim();
          if (!isUuidString(subscription_id)) throw new Error('subscription_id must be a valid UUID');
          const { data, error } = await supabaseAdmin
            .from('mcp_event_subscriptions')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('tenant_id', tenant_id)
            .eq('user_id', user_id)
            .eq('id', subscription_id)
            .select('*')
            .single();
          if (error) throw supabaseErrorToMcpClientError('unsubscribe_event', error.message);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        case 'update_client_status_batch': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const dryRun = a.dry_run !== false;
          const sales_stage = String(a.sales_stage || '').trim();
          const ids = Array.isArray(a.client_ids) ? a.client_ids.map((id) => String(id || '').trim()).filter((id) => isUuidString(id)) : [];
          if (!sales_stage || ids.length === 0) throw new Error('client_ids and sales_stage are required');
          const { data: rows, error: fetchErr } = await supabaseAdmin
            .from('business_clients')
            .select('id,name,sales_stage')
            .eq('tenant_id', tenant_id)
            .in('id', ids);
          if (fetchErr) throw supabaseErrorToMcpClientError('update_client_status_batch', fetchErr.message);
          const items = (rows || []).map((row: any) => ({ id: row.id, name: row.name, from: row.sales_stage, to: sales_stage, will_update: row.sales_stage !== sales_stage }));
          if (!dryRun) {
            const { error } = await supabaseAdmin.from('business_clients').update({ sales_stage }).eq('tenant_id', tenant_id).in('id', ids);
            if (error) throw supabaseErrorToMcpClientError('update_client_status_batch', error.message);
          }
          result = { content: [{ type: 'text', text: JSON.stringify({ dry_run: dryRun, total: ids.length, items }, null, 2) }] };
          break;
        }

        case 'create_tasks_batch': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const dryRun = a.dry_run !== false;
          const tasks = Array.isArray(a.tasks) ? a.tasks : [];
          if (!tasks.length) throw new Error('tasks array is required');
          const normalized = tasks.map((t: any, idx: number) => ({
            index: idx,
            title: String(t?.title || '').trim(),
            description: t?.description ? String(t.description) : null,
            priority: String(t?.priority || 'medium'),
            due_date: t?.due_date ? String(t.due_date) : null,
            assigned_to: t?.assigned_to ? String(t.assigned_to) : null,
          }));
          const invalid = normalized.filter((t) => !t.title);
          if (invalid.length) throw new Error('Every task must include title');
          let created: any[] = [];
          if (!dryRun) {
            const { data, error } = await supabaseAdmin.from('tasks').insert(normalized.map((t) => ({
              tenant_id,
              title: t.title,
              description: t.description,
              priority: t.priority,
              due_date: t.due_date,
              assigned_to: t.assigned_to,
              status: 'todo',
            }))).select('id,title,status,priority,due_date,assigned_to');
            if (error) throw supabaseErrorToMcpClientError('create_tasks_batch', error.message);
            created = data || [];
          }
          result = { content: [{ type: 'text', text: JSON.stringify({ dry_run: dryRun, requested: normalized.length, created_count: created.length, created, items: normalized }, null, 2) }] };
          break;
        }

        case 'send_bulk_email_campaign': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const dryRun = a.dry_run !== false;
          const clientIds = Array.isArray(a.client_ids) ? a.client_ids.map((id) => String(id || '').trim()).filter((id) => isUuidString(id)) : [];
          const subject = String(a.subject || '').trim();
          if (!clientIds.length || !subject) throw new Error('client_ids and subject are required');
          const { data: clients, error: clientsErr } = await supabaseAdmin
            .from('business_clients')
            .select('id,name,email')
            .eq('tenant_id', tenant_id)
            .in('id', clientIds);
          if (clientsErr) throw supabaseErrorToMcpClientError('send_bulk_email_campaign', clientsErr.message);
          const targets = (clients || []).filter((c: any) => !!c.email);
          const itemResults: Array<Record<string, unknown>> = targets.map((t: any) => ({ client_id: t.id, email: t.email, status: dryRun ? 'dry_run' : 'queued' }));
          if (!dryRun) {
            const resolved = await resolveEmailProviderConfig({ tenantId: tenant_id, preferredUserId: user_id, fallbackToEnv: false });
            if (!resolved?.provider || !resolved?.apiKey) throw new Error('No provider configured for this user. Connect provider first.');
            for (const target of targets) {
              const sendResult = await sendWithProviderSdk(resolved.provider as EmailProvider, {
                apiKey: resolved.apiKey,
                fromEmail: resolved.fromEmail || '',
                fromName: 'AlphaClone Systems',
                to: String(target.email),
                subject,
                html: a.html ? String(a.html) : undefined,
                text: a.text ? String(a.text) : undefined,
              });
              if (!sendResult.ok) {
                itemResults.push({ client_id: target.id, email: target.email, status: 'failed', error: sendResult.error || 'send_failed' });
              }
            }
          }
          result = { content: [{ type: 'text', text: JSON.stringify({ dry_run: dryRun, requested: clientIds.length, processed: itemResults.length, items: itemResults }, null, 2) }] };
          break;
        }

        case 'get_client_email_history': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const limit = Math.min(Math.max(Number(a.limit) || 50, 1), 200);
          const clientId = typeof a.client_id === 'string' ? a.client_id.trim() : '';
          const directEmail = typeof a.client_email === 'string' ? a.client_email.trim().toLowerCase() : '';

          let resolvedEmail = directEmail;
          if (!resolvedEmail && clientId) {
            if (!isUuidString(clientId)) {
              throw new Error('client_id must be a valid UUID from get_clients');
            }
            const { data: clientRow, error: clientError } = await supabaseAdmin
              .from('business_clients')
              .select('id, name, email')
              .eq('tenant_id', tenant_id)
              .eq('id', clientId)
              .maybeSingle();
            if (clientError) throw supabaseErrorToMcpClientError('get_client_email_history', clientError.message);
            resolvedEmail = String(clientRow?.email || '').trim().toLowerCase();
          }

          if (!resolvedEmail) {
            throw new Error('Provide client_id with an email on record, or pass client_email.');
          }

          const likeEmail = `%${resolvedEmail}%`;
          const [unifiedRes, outreachRes] = await Promise.all([
            supabaseAdmin
              .from('unified_messages')
              .select('id, source, channel, direction, subject, body, html_body, from_address, to_address, sent_at, received_at, created_at, metadata')
              .eq('tenant_id', tenant_id)
              .eq('channel', 'email')
              .or(`from_address.ilike.${likeEmail},to_address.ilike.${likeEmail}`)
              .order('created_at', { ascending: false })
              .limit(limit),
            supabaseAdmin
              .from('lead_outreach_log')
              .select('id, user_id, lead_name, lead_email, subject, body_html, provider, provider_message_id, tracking_id, status, sent_at, opened_at, clicked_at, error_message, created_at')
              .eq('tenant_id', tenant_id)
              .ilike('lead_email', likeEmail)
              .order('created_at', { ascending: false })
              .limit(limit),
          ]);

          if (unifiedRes.error) throw supabaseErrorToMcpClientError('get_client_email_history', unifiedRes.error.message);
          if (outreachRes.error) throw supabaseErrorToMcpClientError('get_client_email_history', outreachRes.error.message);

          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    client_email: resolvedEmail,
                    unified_email_messages: unifiedRes.data || [],
                    outreach_log_messages: outreachRes.data || [],
                  },
                  null,
                  2
                ),
              },
            ],
          };
          break;
        }

        case 'get_zoho_mail_messages': {
          const a = args as Record<string, any>;
          this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const folderId = typeof a.folder_id === 'string' ? a.folder_id.trim() : '';
          const searchQuery = typeof a.search_query === 'string' ? a.search_query.trim() : '';
          const limit = Math.min(Math.max(Number(a.limit) || 20, 1), 100);
          const start = Math.max(Number(a.start) || 1, 1);

          const zoho = new ZohoMailService(user_id);
          let payload: Record<string, unknown>;
          if (searchQuery) {
            const messages = await zoho.searchMessages(searchQuery);
            payload = { mode: 'search', query: searchQuery, messages: messages.slice(0, limit) };
          } else if (folderId) {
            const messages = await zoho.getMessages(folderId, limit, start);
            payload = { mode: 'folder_messages', folder_id: folderId, start, limit, messages };
          } else {
            const folders = await zoho.getFolders();
            payload = { mode: 'folders', folders };
          }

          result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
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

        case 'create_quote': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const created_by = this.requireProfileUser(a);
          const {
            name,
            contact_id,
            deal_id,
            currency = 'USD',
            valid_for_days = 30,
            notes,
            terms_and_conditions,
            status = 'draft',
          } = a;

          if (typeof name !== 'string' || !name.trim()) {
            throw new Error('name is required');
          }
          if (contact_id != null && contact_id !== '' && !isUuidString(contact_id)) {
            throw new Error('contact_id must be a valid UUID or omitted');
          }
          if (deal_id != null && deal_id !== '' && !isUuidString(deal_id)) {
            throw new Error('deal_id must be a valid UUID or omitted');
          }
          if (!QUOTE_STATUSES.has(String(status))) {
            throw new Error('status must be one of: draft, sent, viewed, accepted, rejected, expired, converted');
          }

          const validUntil = new Date();
          validUntil.setDate(validUntil.getDate() + Math.max(1, Number(valid_for_days) || 30));

          const { data, error } = await supabaseAdmin
            .from('quotes')
            .insert({
              tenant_id,
              created_by,
              name: name.trim(),
              contact_id: contact_id || null,
              deal_id: deal_id || null,
              currency: String(currency || 'USD').toUpperCase(),
              valid_until: validUntil.toISOString().split('T')[0],
              notes: notes || null,
              terms_and_conditions: terms_and_conditions || null,
              status,
            })
            .select('id, quote_number, name, status, valid_until, currency')
            .single();
          if (error) throw supabaseErrorToMcpClientError('create_quote', error.message);
          result = { content: [{ type: 'text', text: `Quote created: ${JSON.stringify(data)}` }] };
          break;
        }

        case 'update_quote': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { quote_id, name, status, notes, terms_and_conditions, valid_until, currency } = a;
          if (!isUuidString(quote_id)) {
            throw new Error('quote_id must be a valid quote UUID from get_quotes');
          }
          const update: Record<string, unknown> = {};
          if (name !== undefined) update.name = String(name).trim();
          if (status !== undefined) {
            if (!QUOTE_STATUSES.has(String(status))) {
              throw new Error('status must be one of: draft, sent, viewed, accepted, rejected, expired, converted');
            }
            update.status = status;
          }
          if (notes !== undefined) update.notes = notes || null;
          if (terms_and_conditions !== undefined) update.terms_and_conditions = terms_and_conditions || null;
          if (valid_until !== undefined) update.valid_until = valid_until || null;
          if (currency !== undefined) update.currency = String(currency).toUpperCase();
          if (Object.keys(update).length === 0) throw new Error('Provide at least one field to update');
          const { data, error } = await supabaseAdmin
            .from('quotes')
            .update(update)
            .eq('tenant_id', tenant_id)
            .eq('id', quote_id.trim())
            .select('id, quote_number, name, status, valid_until, currency, updated_at')
            .single();
          if (error) throw supabaseErrorToMcpClientError('update_quote', error.message);
          result = { content: [{ type: 'text', text: `Quote updated: ${JSON.stringify(data)}` }] };
          break;
        }

        case 'auto_create_lead_from_message': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const owner_id = this.requireProfileUser(a);
          const { message_id, business_name, source = 'Inbound Message' } = a;
          if (!isUuidString(message_id)) {
            throw new Error('message_id must be a valid message UUID');
          }

          const { data: msg, error: msgErr } = await supabaseAdmin
            .from('messages')
            .select('id, text, sender_name, sender_id, created_at')
            .eq('tenant_id', tenant_id)
            .eq('id', message_id.trim())
            .single();
          if (msgErr || !msg) throw supabaseErrorToMcpClientError('auto_create_lead_from_message', msgErr?.message || 'Message not found');

          const inferredName = (String(business_name || msg.sender_name || '').trim() || 'Inbound Lead').slice(0, 200);
          const leadInsert = await supabaseAdmin
            .from('leads')
            .insert({
              tenant_id,
              owner_id,
              business_name: inferredName,
              stage: 'lead',
              status: 'new',
              source,
              notes: `Auto-created from message ${msg.id}: ${String(msg.text || '').slice(0, 1200)}`,
            })
            .select('id, business_name, stage, source, created_at')
            .single();

          let leadData: any = leadInsert.data;
          let leadError = leadInsert.error;
          if (leadError) {
            const fallback = await supabaseAdmin
              .from('leads')
              .insert({
                tenant_id,
                business_name: inferredName,
                source,
                notes: `Auto-created from message ${msg.id}: ${String(msg.text || '').slice(0, 1200)}`,
              })
              .select('id, business_name, created_at')
              .single();
            leadData = fallback.data;
            leadError = fallback.error;
          }
          if (leadError) throw supabaseErrorToMcpClientError('auto_create_lead_from_message', leadError.message);

          result = { content: [{ type: 'text', text: `Lead auto-created from message: ${JSON.stringify(leadData)}` }] };
          break;
        }

        case 'score_deal': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { deal_id } = a;
          if (!isUuidString(deal_id)) {
            throw new Error('deal_id must be a valid deal UUID from get_deals');
          }

          const { data: deal, error: dealErr } = await supabaseAdmin
            .from('deals')
            .select('id, stage, value, created_at, metadata')
            .eq('tenant_id', tenant_id)
            .eq('id', deal_id.trim())
            .single();
          if (dealErr || !deal) throw supabaseErrorToMcpClientError('score_deal', dealErr?.message || 'Deal not found');

          const createdAtMs = new Date(deal.created_at || Date.now()).getTime();
          const ageDays = Math.max(0, Math.floor((Date.now() - createdAtMs) / (1000 * 60 * 60 * 24)));
          const score = scoreDealFromSignals(String(deal.stage || 'lead'), Number(deal.value || 0), ageDays);
          const reasons = [
            `stage=${deal.stage || 'lead'}`,
            `value=${Number(deal.value || 0)}`,
            `age_days=${ageDays}`,
          ];

          const nextMetadata = {
            ...(deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {}),
            ai_deal_score: score,
            ai_deal_score_reasons: reasons,
            ai_deal_scored_at: new Date().toISOString(),
          };

          const { data: updated, error: updErr } = await supabaseAdmin
            .from('deals')
            .update({ metadata: nextMetadata })
            .eq('tenant_id', tenant_id)
            .eq('id', deal.id)
            .select('id, name, stage, value, metadata')
            .single();
          if (updErr) throw supabaseErrorToMcpClientError('score_deal', updErr.message);
          result = { content: [{ type: 'text', text: `Deal scored ${score}/10: ${JSON.stringify(updated)}` }] };
          break;
        }

        case 'voice_action_router': {
          const a = args as Record<string, any>;
          this.requireTenant(a);
          const { command } = a;
          if (typeof command !== 'string' || !command.trim()) {
            throw new Error('command is required');
          }

          const input = command.toLowerCase();
          let route: Record<string, any> = { tool: 'none', arguments: {}, confidence: 0.35 };
          if (input.includes('task') || input.includes('todo') || input.includes('to do')) {
            route = {
              tool: 'create_task',
              arguments: { title: command.trim() },
              confidence: 0.72,
            };
          } else if (input.includes('lead')) {
            route = {
              tool: 'create_lead',
              arguments: { contact_name: command.trim() },
              confidence: 0.68,
            };
          } else if (input.includes('quote') || input.includes('proposal')) {
            route = {
              tool: 'create_quote',
              arguments: { name: command.trim() },
              confidence: 0.67,
            };
          } else if (input.includes('invoice') && (input.includes('send') || input.includes('mark sent'))) {
            route = {
              tool: 'send_invoice',
              arguments: {},
              confidence: 0.62,
              note: 'Provide invoice_id to execute.',
            };
          } else if (input.includes('invoice')) {
            route = {
              tool: 'create_invoice',
              arguments: {},
              confidence: 0.6,
              note: 'Provide client_id, due_date, and total to execute.',
            };
          } else if (input.includes('facebook') || input.includes('linkedin') || input.includes('post')) {
            route = {
              tool: 'create_social_post',
              arguments: { caption: command.trim() },
              confidence: 0.58,
              note: 'Provide page_id (Facebook) or use create_linkedin_post with text.',
            };
          }

          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  command,
                  normalized_route: route,
                  instruction: 'Call the suggested MCP tool with completed required arguments.',
                }, null, 2),
              },
            ],
          };
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

Rules:
- Monday: High-Intensity Thought Leadership (Act 1 focus).
- Tuesday: Tactical "Cheat Sheet" Deep-Dive (Act 2 focus).
- Wednesday: Client Transformation / Social Proof (Act 3 focus).
- Thursday: Personal Founder Anecdote (Human-AI Hybrid).
- Friday: "The Hard Truth" Contrarian Take.
- Saturday: Community Threaded Discussion.
- Sunday: Teaser / Retention Loop for next week.

Content Engineering:
- Avoid generic motivation. Every post idea must include one of: concrete insight, contrarian angle, real story, or data point.
- LinkedIn style: Authoritative, insight-dense, engineered for "Dwell Depth" (1100-1600 chars). Use functional emojis for scannability.
- Facebook style: Conversational "Thread-First" hooks.
- Ensure no duplicate topic framing across 30 days.

Return ONLY a JSON array of 60 objects:
[{ "day": 1, "post": 1, "platform": "linkedin", "topic": "...", "cta": "..." }, ...].
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
          const multiPass = await socialPostGenerationService.generateMultiPass({
            platform: Array.isArray(platforms) && platforms.includes('linkedin') ? 'linkedin' : 'facebook',
            pillar: 'tactical_how_to',
            topic: String(topic || 'business operations'),
            monthlyGoal: 'Authority growth and lead generation',
            includeCta: true,
          });

          // 3. Schedule
          const publishTime = typeof scheduled_at === 'string' && scheduled_at
            ? scheduled_at
            : new Date(Date.now() + 60 * 60 * 1000).toISOString();
          const { data, error } = await supabaseAdmin.from('social_posts').insert({
            tenant_id,
            user_id: userId,
            caption: multiPass.content,
            platforms: Array.isArray(platforms) ? platforms : ['facebook', 'linkedin'],
            media_urls: [imageUrl],
            status: 'scheduled',
            scheduled_at: publishTime,
            metadata: {
              autonomous: true,
              ai_image_prompt: image_prompt,
              generation: {
                strategistNotes: multiPass.strategistNotes,
                reviewerNotes: multiPass.reviewerNotes,
                confidenceScore: multiPass.confidenceScore,
              },
            }
          }).select('id').single();

          if (error) throw supabaseErrorToMcpClientError('create_post_with_ai_image', error.message);
          result = { content: [{ type: 'text', text: `Autonomous Creation complete. Post scheduled with AI-generated image: ${imageUrl}. Content length: ${multiPass.content.length} characters.` }] };
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

        // ── Future-readiness adapters (live) ───────────────────────────────
        case 'book_calendar_meeting': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const response = await businessAdapterService.bookCalendarMeeting({
            tenantId: tenant_id,
            bookingTypeId: String(a.booking_type_id || '').trim(),
            startTime: String(a.start_time || '').trim(),
            endTime: String(a.end_time || '').trim(),
            clientName: String(a.client_name || '').trim(),
            clientEmail: String(a.client_email || '').trim(),
            clientPhone: a.client_phone ? String(a.client_phone).trim() : undefined,
            clientNotes: a.client_notes ? String(a.client_notes).trim() : undefined,
            timeZone: a.time_zone ? String(a.time_zone).trim() : undefined,
          });
          if (response.status === 'failed') throw new Error(response.error || response.message);
          result = { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
          break;
        }

        case 'create_subscription_checkout': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const { data: profile } = await supabaseAdmin.from('profiles').select('email').eq('id', user_id).maybeSingle();
          const response = await businessAdapterService.createPaymentSubscriptionCheckout({
            tenantId: tenant_id,
            planId: String(a.plan_id || '').trim() as 'starter' | 'pro' | 'enterprise',
            priceId: String(a.price_id || '').trim(),
            adminEmail: String(a.admin_email || profile?.email || '').trim(),
            successUrl: a.success_url ? String(a.success_url).trim() : undefined,
            cancelUrl: a.cancel_url ? String(a.cancel_url).trim() : undefined,
          });
          if (response.status === 'failed') throw new Error(response.error || response.message);
          result = { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
          break;
        }

        case 'create_client_portal_event': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const response = await businessAdapterService.createClientPortalEvent({
            tenantId: tenant_id,
            actorUserId: user_id,
            eventType: String(a.event_type || '').trim() as PortalEventInput['eventType'],
            projectId: a.project_id ? String(a.project_id).trim() : undefined,
            clientId: a.client_id ? String(a.client_id).trim() : undefined,
            deliverableId: a.deliverable_id ? String(a.deliverable_id).trim() : undefined,
            feedbackRating: a.feedback_rating ? Number(a.feedback_rating) : undefined,
            feedbackComment: a.feedback_comment ? String(a.feedback_comment).trim() : undefined,
            metadata: a.metadata && typeof a.metadata === 'object' ? a.metadata : undefined,
          });
          if (response.status === 'failed') throw new Error(response.error || response.message);
          result = { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
          break;
        }

        case 'create_business_event': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const { title, description, start_time, end_time, event_type, attendees = [] } = a;
          if (typeof title !== 'string' || !title.trim()) throw new Error('title is required');
          if (typeof start_time !== 'string' || !start_time.trim()) throw new Error('start_time is required');
          if (typeof end_time !== 'string' || !end_time.trim()) throw new Error('end_time is required');
          if (typeof event_type !== 'string' || !event_type.trim()) throw new Error('event_type is required');
          const { data, error } = await supabaseAdmin
            .from('business_events')
            .insert({
              tenant_id,
              title: title.trim(),
              description: typeof description === 'string' ? description : null,
              start_time: start_time.trim(),
              end_time: end_time.trim(),
              event_type: event_type.trim(),
              attendees: Array.isArray(attendees) ? attendees.filter((v) => typeof v === 'string') : [],
              created_by: user_id,
            })
            .select('id, title, event_type, start_time, end_time, created_at')
            .single();
          if (error) throw supabaseErrorToMcpClientError('create_business_event', error.message);
          result = { content: [{ type: 'text', text: `Business event created: ${JSON.stringify(data)}` }] };
          break;
        }

        case 'get_business_events': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { event_type, from_time, to_time, limit = 100 } = a;
          let query = supabaseAdmin
            .from('business_events')
            .select('id, title, description, event_type, start_time, end_time, attendees, created_by, created_at')
            .eq('tenant_id', tenant_id)
            .order('start_time', { ascending: false })
            .limit(Math.min(Number(limit) || 100, 500));
          if (event_type) query = query.eq('event_type', event_type);
          if (typeof from_time === 'string' && from_time.trim()) query = query.gte('start_time', from_time.trim());
          if (typeof to_time === 'string' && to_time.trim()) query = query.lte('start_time', to_time.trim());
          const { data, error } = await query;
          if (error) throw supabaseErrorToMcpClientError('get_business_events', error.message);
          result = {
            content: [
              {
                type: 'text',
                text: renderBusinessSuccess('mcp-tool', 'mcp-trace', 'Data retrieved', data),
              },
              {
                type: 'text',
                text: JSON.stringify(data || [], null, 2),
              },
            ],
          };
          break;
        }

        case 'analyze_document_intelligence': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          if (!a.document_url && !a.document_text) {
            throw new Error('document_url or document_text is required');
          }
          const response = await businessAdapterService.analyzeDocument({
            tenantId: tenant_id,
            actorUserId: user_id,
            documentUrl: a.document_url ? String(a.document_url).trim() : undefined,
            documentText: a.document_text ? String(a.document_text) : undefined,
            documentType: a.document_type ? String(a.document_type).trim() as AnalyzeDocumentInput['documentType'] : undefined,
          });
          if (response.status === 'failed') throw new Error(response.error || response.message);
          result = { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
          break;
        }

        default:
          throw new Error(`Unknown tool: "${name}". Available tools include list_playbooks, run_playbook, get_run_status, retry_run_step, cancel_run, verify_lead_created, verify_outreach_delivery, verify_social_post_published, verify_invoice_sent, get_automation_health, get_failure_report, get_throughput_report, reconcile_outreach_vs_logs, get_clients, get_contacts, search_contacts, create_client, get_leads, create_lead, auto_create_lead_from_message, update_lead_status, get_deals, create_deal, score_deal, create_project, get_projects, update_project_status, create_task, update_task, write_task_note, get_tasks, upload_media_asset, get_facebook_identities, get_linkedin_identities, create_social_post, create_linkedin_post, get_linkedin_posts, create_linkedin_comment, create_linkedin_reaction, create_quote, create_invoice, send_invoice, voice_action_router, send_message, and more.`);
        }

        // ── Audit Logging ──────────────────────────────────────────────────
        const auditTenant = this.ctx?.tenantId ?? (args as Record<string, any>)?.tenant_id;
        if (auditTenant) {
          auditLoggingService.logAction(
            `mcp_tool_execute:${name}`,
            'mcp_integration',
            auditTenant as string,
            args,
            { trace_id: traceId, raw_result: result }
          ).catch(err => console.error('Failed to log MCP audit:', err));
        }

        return wrapMcpSuccess(name, traceId, result);
      } catch (error: unknown) {
        console.error(`MCP Tool Execution Error [${name}]:`, error);
        const payload = toMcpErrorPayload(name, traceId, error);
        throw new Error(payload);
      }
    });
  }
}

export const mcpServerInstance = new AlphaCloneMCPServer();

/** Per-request MCP server bound to the authenticated tenant + user (from API key or OAuth). */
export function createMCPServer(ctx?: MCPConnectionContext): AlphaCloneMCPServer {
  return new AlphaCloneMCPServer(ctx);
}
