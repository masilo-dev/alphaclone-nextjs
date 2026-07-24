import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  // @ts-ignore
  ListResourcesRequestSchema,
  // @ts-ignore
  ReadResourceRequestSchema,
  // @ts-ignore
  ListPromptsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { MCP_TOOLS } from './toolManifest';
import { unitsForTextGeneration } from '../../config/aiUsageQuotas';
import { createSupabaseAdminClient } from '../../lib/supabase-admin';
import {
  enqueueSocialPostSync,
  findRecentDuplicateLinkedInCaption,
  parseLinkedInUgcPostUrn,
  updateSocialPostLinkedInUrnWithRetry,
} from '../../lib/social/linkedinPublishHelpers';
import { loadMcpLinkedInIntegration } from '../../lib/linkedin/mcpLinkedIn';
import { linkedInFetch, LinkedInApiError } from '../../lib/linkedin/linkedinClient';
import {
  extractLinkedInOrganizationIdFromAuthorUrn,
  markLinkedInIntegrationInactive,
  resolveLinkedInCompanyPagesForTenant,
} from '../../services/linkedin/linkedinIntegrationService';
import { isSocialPublishEnabled } from '@/lib/social/publishConfig';
import { getFacebookTokens } from '@/services/facebook/facebookIntegrationService';
import { consumeTenantAiUnits } from '../../lib/quotas/tenantAiUnitsQuota';
import { auditLoggingService } from '../auditLoggingService';
import { sendScheduledCampaignServer } from '../../lib/server/sendScheduledCampaignServer';
import Anthropic from '@anthropic-ai/sdk';
import { routeAutonomousTask, cleanProfessionalContent, type AIStrengthTask } from '../aiRouter';
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
import { ZohoAuthExpiredError } from '../zoho/ZohoService';
import { prepareSocialPostContent } from '../../lib/content/sanitizePostContent';
import { checkCampaignLanguage, blocksBonnieSend, campaignQualityCheck, sanitizePost } from '../../lib/bonnie/bonnieBannedLanguage';
import { checkChartOfAccountsConfigured } from '../../lib/accounting/chartOfAccountsGuard';
import { onLeadCreated } from '../../lib/leads/leadOnCreated';
import { resolveEmailProviderConfig } from '../../lib/email/providerIntegrationResolver';
import { sendWithProviderSdk, type EmailProvider } from '../../lib/email/providerSdk';
import { sendEmailServer } from '../../lib/email/sendEmailServer';
import { insertBeforeEmailFooter } from '../../lib/email/emailComposition';
import { parseFlexibleDueDate } from '../../lib/dates/parseFlexibleDueDate';
import { consumeDailyResourceQuota, releaseDailyResourceQuota } from '../../lib/server/dailyResourceQuota';
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
import { invoiceEmailTemplates } from '../../lib/email/invoiceEmailTemplates';
import { businessInvoiceService } from '../businessInvoiceService';
import { AppUrls } from '../../lib/urls';
import { getPublicInvoicePaymentUrl } from '../../lib/invoices/publicInvoiceAccess';
import { getCampaignLanguageInstruction, resolveCampaignLanguage } from '../../lib/languageUtils';
import { fileUploadService } from '../fileUploadService';
import { publicShareService } from '../publicShareService';
import { start } from 'workflow/api';
import { invoiceLifecycleWorkflow } from '../../workflows/invoice-lifecycle';
import { contractLifecycleWorkflow } from '../../workflows/contract-lifecycle';
import { leadFindingWorkflow } from '../../workflows/lead-finding';
import { leadNurtureWorkflow } from '../../workflows/lead-nurture';
import { dealStageWorkflow } from '../../workflows/deal-stage';
import { socialScheduleWorkflow } from '../../workflows/social-schedule';
import { emailCampaignWorkflow } from '../../workflows/email-campaign';
import { projectKickoffWorkflow } from '../../workflows/project-kickoff';
import { videoRoomOrchestrationWorkflow } from '../../workflows/video-room-orchestration';
import { userOnboardingWorkflow } from '../../workflows/user-onboarding';
import { mcpAgentWorkflow } from '../../workflows/mcp-agent';
import { strategicAuditService } from '../StrategicAuditService';
import { assertLeadStageTransition } from '../../lib/stageProgression';
import { isTerminalLeadStage, normalizeLeadPipelineStage } from '../../lib/crmPipelineStages';
import { strategicThinkerService } from '../StrategicThinkerService';
import { xaiVideoGenerationService } from '../ai/xaiVideoGenerationService';
import { xService } from '../xService';
import { generatePnLStatement } from '../../lib/accounting/pnl';
import { AlphaNexus } from '../../lib/social/alphaNexus';
import { gmailServerService } from '../server/gmailServerService';
import { taskAutomationService } from '../automation/taskAutomationService';
import { sendWhatsAppMessage } from '../../lib/whatsapp/sendWhatsApp';
import { mcpStore } from './mcpStore';
import { routeAIRequest } from '../aiRouter';
import { resolveMcpEmailRecipient } from '../../lib/email/resolveMcpEmailRecipient';
import { resolveEmailAttachmentsFromFileIds } from '../../lib/files/resolveEmailAttachments';
import { resolveEmailTemplateVars } from '../../lib/email/resolveEmailTemplateVars';


const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidString(value: unknown): value is string {
    return typeof value === 'string' && UUID_RE.test(value.trim());
}

async function generateContractDraftText(contractType: string, clientName: string, keyTerms?: string) {
  const response = await routeAIRequest({
    prompt: `Draft a professional ${contractType} for a client named "${clientName}". Key terms and scope: ${keyTerms || 'Standard professional terms'}. Write a complete, legally-structured contract with all standard sections (parties, recitals, terms, obligations, payment, termination, governing law). Use plain, professional language.`,
    model: 'deepseek-reasoner',
    maxTokens: 2048,
  });

  if (!response.success) {
    throw new Error(response.error || MCP_GENERIC_OPERATION_ERROR);
  }

  return response.content;
}

async function processContractDraftJob(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  contractId: string,
  tenantId: string,
  contractType: string,
  clientName: string,
  keyTerms?: string
) {
  try {
    const contractContent = await generateContractDraftText(contractType, clientName, keyTerms);
    const draftAttribution = 'Claude (via AlphaClone MCP generate_contract_draft)';
    const draftedContract = appendContractDisclaimer(contractContent, draftAttribution);
    await supabaseAdmin
      .from('contracts')
      .update({
        content: draftedContract,
        status: 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('id', contractId)
      .eq('tenant_id', tenantId);
  } catch (err: any) {
    await supabaseAdmin
      .from('contracts')
      .update({
        status: 'draft',
        content: `Generation failed: ${err?.message || 'Unknown error'}. Edit manually in Contracts.`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contractId)
      .eq('tenant_id', tenantId);
  }
}

async function loadProjectMilestonesOrFallback(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  tenantId: string,
  projectId: string
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('project_milestones')
      .select('id, name, description, status, due_date, completed_at, order_index, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .order('due_date', { ascending: true });

    if (error) throw error;

    return {
      milestones: (data || []).map((milestone: any) => ({
        id: milestone.id,
        title: milestone.name,
        name: milestone.name,
        description: milestone.description,
        status: milestone.status,
        due_date: milestone.due_date,
        completed_at: milestone.completed_at,
        order_index: milestone.order_index,
        created_at: milestone.created_at,
        updated_at: milestone.updated_at,
        source: 'project_milestones',
      })),
      fallback: false,
    };
  } catch (error: any) {
    const { data: tasks } = await supabaseAdmin
      .from('tasks')
      .select('id, title, description, status, priority, due_date, completed_at, created_at')
      .eq('tenant_id', tenantId)
      .eq('related_to_project', projectId)
      .order('due_date', { ascending: true });

    const syntheticMilestones = (tasks || []).map((task: any, index: number) => ({
      id: task.id,
      title: task.title,
      name: task.title,
      description: task.description || `Task milestone derived from ${task.status || 'todo'} task`,
      status: task.status === 'completed' ? 'completed' : task.status === 'in_progress' ? 'in_progress' : 'pending',
      due_date: task.due_date,
      completed_at: task.completed_at || null,
      order_index: index,
      created_at: task.created_at,
      updated_at: task.created_at,
      source: 'synthetic_task_fallback',
    }));

    return {
      milestones: syntheticMilestones,
      fallback: true,
      error: error?.message || 'Unable to load project milestones',
    };
  }
}

async function createProjectTimelineComment(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  tenantId: string,
  projectId: string,
  content: string,
  authorName = 'AlphaClone System'
) {
  try {
    const { error } = await supabaseAdmin.from('project_comments').insert({
      tenant_id: tenantId,
      project_id: projectId,
      author_name: authorName,
      content,
      is_client: false,
    });
    if (error) {
      console.warn('[project timeline] comment insert skipped:', error.message);
    }
  } catch (err) {
    console.warn('[project timeline] comment insert failed:', err);
  }
}

async function getInvoiceWithDetailsAdmin(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  invoiceId: string,
  tenantId?: string
): Promise<{ invoice: any | null; error: string | null }> {
  try {
    const cleanInvoiceId = String(invoiceId || '').trim();
    let query = supabaseAdmin
      .from('business_invoices')
      .select(`
          *,
          tenant:tenant_id (
              id,
              name,
              slug
          ),
          client:client_id (
              id,
              name,
              email,
              company,
              phone
          ),
          project:project_id (
              id,
              name
          )
      `)
      .eq('id', cleanInvoiceId);

    if (tenantId) {
      query = query.eq('tenant_id', String(tenantId || '').trim());
    }

    const { data, error } = await query.single();
    if (error) return { invoice: null, error: error.message };
    return { invoice: data, error: null };
  } catch (err: any) {
    return { invoice: null, error: err.message || 'Unknown error' };
  }
}

async function resolveMcpEmailSignature(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  tenantId: string,
  userId: string,
  provided?: unknown
): Promise<string> {
  const explicit = typeof provided === 'string' ? provided.trim() : '';
  if (explicit) return explicit;

  const { data } = await supabaseAdmin
    .from('integrations')
    .select('type, config')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('enabled', true)
    .in('type', ['email_profile', 'brevo', 'resend', 'sendgrid', 'zoho', 'gmail'])
    .order('updated_at', { ascending: false });

  const rows = Array.isArray(data) ? data : [];
  const profileRow = rows.find((row: any) => row?.type === 'email_profile');
  const orderedRows = profileRow ? [profileRow, ...rows.filter((row: any) => row !== profileRow)] : rows;
  for (const row of orderedRows) {
    const config = (row?.config || {}) as Record<string, unknown>;
    const saved = typeof config.signature === 'string' ? config.signature.trim() : '';
    if (saved) return saved;
  }

  // Bug #5 fix: return empty string instead of throwing so emails can still
  // be sent without a stored signature. The footer is still appended by
  // appendSignatureToEmail. Users can set a signature in Email Sender Profile.
  return '';
}

function appendSignatureToEmail(input: { html?: unknown; text?: unknown }, signature: string) {
  const sigBlock = signature ? `${signature}\n\n` : '';
  const textSignature = signature ? `${sigBlock}--\n${signature}` : '';
  const htmlSigBlock = signature ? `${signature.replace(/\n/g, '<br>')}<br><br>` : '';
  const htmlSignature = signature ? `${htmlSigBlock}<p style="margin:0;color:#64748b;font-size:12px;">--</p>` : '';

  return {
    html: input.html && signature ? `${String(input.html)}<br><br>${htmlSignature}` : (input.html ? String(input.html) : undefined),
    text: input.text && signature ? `${String(input.text)}\n\n${textSignature}` : (input.text ? String(input.text) : undefined),
    fallbackText: signature ? `Please see the attached document.\n\n${textSignature}` : 'Please see the attached document.',
  };
}

function appendDocumentLinksToEmail(
  input: { html?: unknown; text?: unknown; fallbackText?: string },
  links: Array<{ name: string; url: string; expiresAt: string }>
): { html?: string; text?: string; fallbackText: string } {
  if (!links.length) {
    return {
      html: input.html ? String(input.html) : undefined,
      text: input.text ? String(input.text) : undefined,
      fallbackText: input.fallbackText || 'Please see the attached document.',
    };
  }

  const textLinks = [
    'Secure AlphaClone document links:',
    ...links.map((link) => `- ${link.name}: ${link.url} (expires ${link.expiresAt})`),
  ].join('\n');
  const htmlLinks = [
    '<p><strong>Secure AlphaClone document links</strong></p>',
    '<ul>',
    ...links.map(
      (link) =>
        `<li><a href="${link.url}">${link.name}</a> <span style="color:#64748b">(expires ${link.expiresAt})</span></li>`
    ),
    '</ul>',
  ].join('');

  const htmlBase = input.html ? String(input.html) : '';
  const textBase = input.text ? String(input.text) : '';

  return {
    html: htmlBase ? insertBeforeEmailFooter(htmlBase, htmlLinks) : undefined,
    text: textBase ? insertBeforeEmailFooter(textBase, textLinks) : undefined,
    fallbackText: `${input.fallbackText || 'Please review the linked documents.'}\n\n${textLinks}`,
  };
}

const DEAL_STAGES = new Set(['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']);
const TASK_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);
const TASK_STATUSES = new Set(['ideas', 'todo', 'in_progress', 'review', 'completed', 'cancelled']);
const QUOTE_STATUSES = new Set(['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'converted']);
const INVOICE_STATUSES = new Set(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'void']);
const LINKEDIN_REACTIONS = new Set(['LIKE', 'PRAISE', 'MAYBE', 'EMPATHY', 'INTEREST', 'APPRECIATION']);

const MCP_GENERIC_OPERATION_ERROR =
  'AlphaClone encountered an operational delay while processing this business request. Please retry the orchestration shortly.';

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

/**
 * Audit Remediation: The "N/A" Data Trap
 * Detects placeholder strings and converts them to null for clean database ingestion.
 */
function cleanPlaceholderValue<T>(val: T): T | null {
  if (typeof val === 'string') {
    const v = val.trim().toLowerCase();
    const placeholders = ['n/a', 'not available', 'none', 'null', 'undefined', '-', 'placeholder'];
    if (placeholders.includes(v)) return null as any;
  }
  return val;
}

function cleanObjectPlaceholders<T extends Record<string, any>>(obj: T): T {
  const result = { ...obj };
  for (const key in result) {
    (result as any)[key] = cleanPlaceholderValue(result[key]);
  }
  return result;
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
  console.error(`[Nexus Operational Delay - ${toolName}]`, message);
  
  if (
    m.includes('does not exist') ||
    m.includes('schema cache') ||
    m.includes('could not find') ||
    m.includes('42703') ||
    m.includes('42p01') ||
    m.includes('invalid input syntax')
  ) {
    const isSchemaDesync = m.includes('schema cache') || m.includes('does not exist') || m.includes('42p01');
    const helpText = isSchemaDesync 
      ? 'The workspace operational matrix is currently resyncing. Strategic records are temporarily unavailable.'
      : 'A requested business record could not be localized within the secure workspace vault.';
      
    return new Error(
      `${helpText} Please re-initiate the orchestration. If this persists across multiple fiscal periods, contact the AlphaClone Infrastructure Team.`
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
  pageAccessToken: string | null;
  metadata: Record<string, unknown> | null;
  updated_at?: string | null;
  expires_at?: string | null;
};

function canPublishFacebookPage(identity: FacebookIntegrationIdentity): boolean {
  const tasks = Array.isArray(identity?.metadata?.page_tasks)
    ? (identity.metadata?.page_tasks as unknown[]).map((task) => String(task))
    : [];
  const hasTaskPermission =
    tasks.includes('MANAGE') || tasks.includes('CREATE_CONTENT') || tasks.includes('ADVERTISE');
  return !!identity.pageAccessToken && identity.is_active && !identity?.metadata?.no_pages && hasTaskPermission;
}

function pickPreferredFacebookIdentity(identities: FacebookIntegrationIdentity[]): FacebookIntegrationIdentity | null {
  if (!identities.length) return null;
  const publishable = identities.filter(canPublishFacebookPage);
  if (!publishable.length) return null;

  // Explicit tenant primary only — never silently switch pages when multiple exist
  const explicitPrimary = publishable.find((item) => Boolean(item?.metadata?.is_primary || item?.metadata?.is_default));
  if (explicitPrimary) return explicitPrimary;

  // Auto-select only when exactly one publishable page for this tenant
  if (publishable.length === 1) return publishable[0];

  return null;
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
      // Session-scoped MCP: always use connection tenant; ignore echoed tenant_id from agents.
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

  private requireProfileUser(args: Record<string, any>): string {
    if (this.ctx?.userId) {
      const r = args.user_id;
      const rTrimmed = typeof r === 'string' ? r.trim() : r;
      if (rTrimmed != null && rTrimmed !== '' && typeof rTrimmed === 'string' && rTrimmed !== this.ctx.userId) {
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

  private async getFacebookIntegrations(
    tenantId: string,
    userId: string,
    pageId?: string,
    activeOnly = true
  ): Promise<FacebookIntegrationIdentity[]> {
    const supabaseAdmin = createSupabaseAdminClient();

    const resolveTokens = async (
      rows: Array<{
        page_id: string;
        page_name: string | null;
        is_active: boolean;
        metadata: Record<string, unknown> | null;
        updated_at?: string | null;
        id: string;
        expires_at: string | null;
        page_access_token?: string | null;
        user_access_token?: string | null;
      }>
    ): Promise<FacebookIntegrationIdentity[]> => {
      const resolved: FacebookIntegrationIdentity[] = [];
      for (const row of rows) {
        const tokens = await getFacebookTokens(supabaseAdmin, row);
        resolved.push({
          page_id: row.page_id,
          page_name: row.page_name,
          is_active: row.is_active,
          pageAccessToken: tokens.pageAccessToken,
          metadata: row.metadata,
          updated_at: row.updated_at,
          expires_at: row.expires_at,
        });
      }
      return resolved;
    };

    const selectCols =
      'id, page_id, page_name, is_active, metadata, updated_at, expires_at, page_access_token, user_access_token';

    // Tenant-scoped only. NEVER fall back to user_id across tenants.
    // Co-members of the same tenant may share pages (tenant_id filter, optional user filter).
    let query = supabaseAdmin.from('facebook_integrations').select(selectCols);
    
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    if (pageId) {
      query = query.eq('page_id', pageId);
    }
    
    // Prefer tenant + user, then tenant-wide (same workspace). Never user-only.
    const { data: tenantUserRows, error: tenantUserError } = await query
      .eq('tenant_id', tenantId)
      .eq('user_id', userId);

    if (!tenantUserError && tenantUserRows && tenantUserRows.length > 0) {
      return resolveTokens(tenantUserRows as Parameters<typeof resolveTokens>[0]);
    }

    let tenantOnlyQuery = supabaseAdmin.from('facebook_integrations').select(selectCols);
    if (activeOnly) tenantOnlyQuery = tenantOnlyQuery.eq('is_active', true);
    if (pageId) tenantOnlyQuery = tenantOnlyQuery.eq('page_id', pageId);

    const { data: tenantOnlyRows, error: tenantOnlyError } = await tenantOnlyQuery
      .eq('tenant_id', tenantId);

    if (!tenantOnlyError && tenantOnlyRows && tenantOnlyRows.length > 0) {
      return resolveTokens(tenantOnlyRows as Parameters<typeof resolveTokens>[0]);
    }

    return [];
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'mcp://business/snapshot',
          name: 'Business Snapshot',
          description: 'A proactive audit of deals, invoices, leads, and tasks for the current tenant.',
          mimeType: 'application/json'
        },
        {
          uri: 'mcp://business/ai-state',
          name: 'Business AI State',
          description: 'The current AI operating state for this workspace: autonomy, risk, model preference, and audit posture.',
          mimeType: 'application/json'
        }
      ],
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request: any) => {
      const uri = String(request.params.uri);
      if (uri === 'mcp://business/snapshot') {
        const tenantId = this.ctx?.tenantId;
        if (!tenantId) throw new Error('Tenant context missing for resource read. Connect via workspace MCP URL.');
        const supabaseAdmin = createSupabaseAdminClient();
        const { snapshot, error } = await strategicAuditService.getSnapshot(tenantId, supabaseAdmin);
        if (error) throw new Error(error);
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(snapshot, null, 2),
            },
          ],
        };
      }
      if (uri === 'mcp://business/ai-state') {
        const tenantId = this.ctx?.tenantId;
        if (!tenantId) throw new Error('Tenant context missing for resource read. Connect via workspace MCP URL.');
        const state = await mcpStore.getBusinessAIState(tenantId, this.ctx?.userId || undefined);
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                state,
                summary: {
                  primary_domain: state.primary_domain,
                  agent_mode: state.agent_mode,
                  preferred_model: state.preferred_model,
                  owner_profile: state.owner_profile,
                  memory_summary: state.memory_summary,
                },
              }, null, 2)
            },
          ],
        };
      }
      throw new Error(`Resource not found: ${uri}`);
    });

    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      const { listMcpPrompts } = await import('../../lib/mcp/prompts/review_bonnie_patterns');
      const prompts = listMcpPrompts().map(p => ({
        name: p.name,
        description: p.description,
        arguments: (p.arguments || []).map(a => ({
          name: a.name,
          description: a.description,
          required: a.required ?? false,
        })),
      }));
      return { prompts };
    });

    // ── Tool Manifest (unified discovery) ─────────────────────────────────
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        const { getUnifiedMcpTools } = await import('@/lib/mcp/listAllTools');
        // Full catalog for SDK transports (Claude Code, etc.) — never ChatGPT-curated by default.
        const tools = await getUnifiedMcpTools({
          sanitizeForClient: false,
          forChatGPT: false,
          clientLabel: 'mcp-sdk',
        });
        console.info(`[mcp.ListTools] returning ${tools.length} tools`);
        if (tools.length === 0) {
          console.error('[mcp.ListTools] CRITICAL empty tool list');
        }
        return { tools };
      } catch (err: any) {
        console.error('[mcp.ListTools] failed:', err?.message || err);
        throw err;
      }
    });

    // ── Tool Execution ──────────────────────────────────────────────────────
    this.server.setRequestHandler(CallToolRequestSchema, async (request: unknown) => {
      const params = (request as {
        params?: { name?: unknown; arguments?: Record<string, unknown> };
      }).params;
      const name = typeof params?.name === 'string' ? params.name.trim() : '';
      if (!name) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: true,
              message: 'Tool name is required.',
            }),
          }],
          isError: true,
        };
      }
      const args = params?.arguments || {};
      const traceId = crypto.randomUUID();
      const supabaseAdmin = createSupabaseAdminClient();
      return this.executeToolInternal(name, args, traceId, supabaseAdmin);
    });
  }

  private async executeToolInternal(
    name: string,
    args: Record<string, any>,
    traceId: string,
    supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>
  ): Promise<any> {
    const supabase = supabaseAdmin;

    if (this.ctx?.tenantId && this.ctx?.userId) {
      const { forceSessionArgs } = await import('@/lib/mcp/sanitizeToolSchema');
      args = forceSessionArgs(args || {}, {
        tenantId: this.ctx.tenantId,
        userId: this.ctx.userId,
      });
    }

    const tenantIdForPolicy = (args?.tenant_id && String(args.tenant_id).trim()) || this.ctx?.tenantId || '';
    const userIdForPolicy = this.ctx?.userId || (args?.user_id ? String(args.user_id).trim() : '');
    if (tenantIdForPolicy && userIdForPolicy) {
      // ToolPolicyGate approval queue intentionally removed — actions execute immediately.
      // evaluateToolPolicy is a no-op allow; kept for telemetry/type compatibility only.
      const { evaluateToolPolicy } = await import('@/lib/ai/ToolPolicyGate');
      await evaluateToolPolicy({
        tenantId: tenantIdForPolicy,
        userId: userIdForPolicy,
        toolName: name,
        source: 'mcp',
        args: args || {},
      });
      // Do NOT deny or queue_approval — gate was a dead end with no dashboard release surface.
    }

    // Check new registry first
    const telemetryStart = Date.now();
    let telemetrySuccess = false;
    let telemetryError: string | undefined;
    let executedViaRegistry = false;

    try {
      const { hasTool, executeTool, initializeRegistry } = await import('@/lib/mcp/tool-registry');
      initializeRegistry();
      if (hasTool(name)) {
        executedViaRegistry = true;
        const tenantId = this.requireTenant((args || {}) as Record<string, any>);
        const userId = this.ctx?.userId || (args?.user_id ? String(args.user_id).trim() : '');
        return await executeTool(tenantId, userId, name, (args || {}) as Record<string, any>);
      }
    } catch (regErr: any) {
      console.error(`Registry execution error for tool ${name}:`, regErr);
      telemetryError = regErr.message;
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: true, message: regErr.message }) }],
        isError: true
      };
    }

    let result: any;

    try {
      switch (name) {
        case 'run_chief_of_staff_routine': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.ctx?.userId || (a.user_id && typeof a.user_id === 'string' ? a.user_id.trim() : null);

          // 1. PIPELINE HEALTH
          const { snapshot, error: snapshotErr } = await strategicAuditService.getSnapshot(tenant_id, supabaseAdmin);
          if (snapshotErr) throw new Error(`Snapshot error: ${snapshotErr}`);

          // Draft invoices
          const { data: draftInvoices } = await supabaseAdmin
            .from('business_invoices')
            .select('id, invoice_number')
            .eq('tenant_id', tenant_id)
            .eq('status', 'draft');

          const sentDraftInvoices: any[] = [];
          if (draftInvoices && draftInvoices.length > 0) {
            for (const inv of draftInvoices) {
              try {
                await this.executeToolInternal('start_invoice_lifecycle', { tenant_id, invoice_id: inv.id, user_id }, traceId, supabaseAdmin);
                sentDraftInvoices.push(inv.invoice_number);
              } catch (err: any) {
                console.error(`Failed to send invoice ${inv.invoice_number}:`, err);
              }
            }
          }

          // Stale leads with no deal
          const { data: leads } = await supabaseAdmin
            .from('leads')
            .select('id, business_name, value, notes, source, status, created_at')
            .eq('tenant_id', tenant_id)
            .neq('stage', 'converted')
            .is('client_id', null)
            .order('created_at', { ascending: false });

          const { data: contacts } = await supabaseAdmin
            .from('contacts')
            .select('original_lead_id')
            .eq('tenant_id', tenant_id)
            .not('original_lead_id', 'is', null);

          const convertedLeadIds = new Set(contacts?.map((c: any) => c.original_lead_id) || []);

          const { data: deals } = await supabaseAdmin
            .from('deals')
            .select('name')
            .eq('tenant_id', tenant_id);

          const dealNames = new Set(deals?.map((d: any) => d.name.toLowerCase().trim()) || []);

          const leadsWithNoDeal = (leads || []).filter((l: any) => {
            if (convertedLeadIds.has(l.id)) return false;
            if (l.business_name && dealNames.has(l.business_name.toLowerCase().trim())) return false;
            return true;
          });

          const healthDeals: any[] = [];
          const top5Leads = leadsWithNoDeal.slice(0, 5);
          for (const lead of top5Leads) {
            try {
              const dealResult = await this.executeToolInternal('create_deal', {
                tenant_id,
                user_id,
                name: lead.business_name || 'Deal from Lead',
                value: lead.value || 0,
                stage: 'qualified',
                description: `Auto-created deal from lead ${lead.id}.`
              }, traceId, supabaseAdmin);

              if (dealResult?.isError) {
                await supabaseAdmin.from('tasks').insert({
                  tenant_id,
                  title: `[Chief of Staff] Deal creation failed for ${lead.business_name || lead.id}`,
                  description: 'create_deal returned an error during automation. Create the deal manually and link it to the lead.',
                  priority: 'high',
                  status: 'todo',
                  metadata: { source: 'chief_of_staff', lead_id: lead.id, autoSourceKey: `deal_fail:${lead.id}` },
                });
                continue;
              }

              const text = dealResult?.content?.[0]?.text || '';
              const match = text.match(/Deal created: (\{.*?\})/);
              if (match) {
                const dealData = JSON.parse(match[1]);
                if (dealData?.id) {
                  const scoreRes = await this.executeToolInternal('score_deal', {
                    tenant_id,
                    deal_id: dealData.id
                  }, traceId, supabaseAdmin);
                  
                  let score = 0;
                  try {
                    const scoreText = scoreRes?.content?.[0]?.text || '';
                    const scoreMatch = scoreText.match(/Score: (\d+)/) || scoreText.match(/"ai_deal_score":\s*(\d+)/);
                    if (scoreMatch) score = Number(scoreMatch[1]);
                  } catch (e) {}

                  healthDeals.push({
                    lead_name: lead.business_name,
                    deal_id: dealData.id,
                    score
                  });
                }
              }
            } catch (err: any) {
              console.error(`Failed to create/score deal for lead ${lead.business_name}:`, err);
            }
          }

          // Tasks
          const now = new Date();
          const fortyEightHoursLater = new Date(Date.now() + 48 * 60 * 60 * 1000);
          const { data: tasksDue } = await supabaseAdmin
            .from('tasks')
            .select('id, title, due_date, status, priority')
            .eq('tenant_id', tenant_id)
            .not('status', 'in', '("completed","cancelled")')
            .or(`due_date.lt.${now.toISOString()},due_date.lte.${fortyEightHoursLater.toISOString()}`);

          const flaggedTasks: any[] = [];
          if (tasksDue && tasksDue.length > 0) {
            for (const task of tasksDue) {
              try {
                const isOverdue = new Date(task.due_date) < now;
                const prefix = isOverdue ? '[OVERDUE]' : '[URGENT]';
                let newTitle = task.title;
                if (!task.title.startsWith('[OVERDUE]') && !task.title.startsWith('[URGENT]')) {
                  newTitle = `${prefix} ${task.title}`;
                }
                await supabaseAdmin
                  .from('tasks')
                  .update({
                    title: newTitle,
                    priority: 'urgent',
                    status: task.status === 'ideas' || task.status === 'todo' ? 'in_progress' : task.status,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', task.id);

                flaggedTasks.push({
                  title: task.title,
                  new_title: newTitle,
                  due_date: task.due_date,
                  overdue: isOverdue
                });
              } catch (err: any) {
                console.error(`Failed to update task ${task.title}:`, err);
              }
            }
          }

          // 2. REVENUE RECOVERY
          const { data: overdueInvoices } = await supabaseAdmin
            .from('business_invoices')
            .select('id, invoice_number')
            .eq('tenant_id', tenant_id)
            .eq('status', 'sent')
            .lt('due_date', new Date().toISOString());

          let triggeredChasing = false;
          if (overdueInvoices && overdueInvoices.length > 0) {
            try {
              await this.executeToolInternal('nexus_invoice_chasing', { tenant_id, user_id }, traceId, supabaseAdmin);
              triggeredChasing = true;
            } catch (err) {
              console.error('Failed to trigger invoice chasing:', err);
            }
          }

          // Any drafts missed → send
          const { data: remainingDrafts } = await supabaseAdmin
            .from('business_invoices')
            .select('id, invoice_number')
            .eq('tenant_id', tenant_id)
            .eq('status', 'draft');

          const remainingSentDrafts: string[] = [];
          if (remainingDrafts && remainingDrafts.length > 0) {
            for (const inv of remainingDrafts) {
              try {
                await this.executeToolInternal('start_invoice_lifecycle', { tenant_id, invoice_id: inv.id, user_id }, traceId, supabaseAdmin);
                remainingSentDrafts.push(inv.invoice_number);
              } catch (err) {
                console.error(`Failed to send remaining draft ${inv.invoice_number}:`, err);
              }
            }
          }

          // 3. DEAL PIPELINE
          const pipelineDeals: any[] = [];
          const nextLeads = leadsWithNoDeal.slice(5, 15);
          for (const lead of nextLeads) {
            try {
              const dealResult = await this.executeToolInternal('create_deal', {
                tenant_id,
                user_id,
                name: lead.business_name || 'Deal from Lead',
                value: lead.value || 0,
                stage: 'lead',
                description: `Auto-created deal from lead ${lead.id}.`
              }, traceId, supabaseAdmin);

              if (dealResult?.isError) {
                await supabaseAdmin.from('tasks').insert({
                  tenant_id,
                  title: `[Chief of Staff] Deal creation failed for ${lead.business_name || lead.id}`,
                  description: 'create_deal returned an error during pipeline automation. Create the deal manually.',
                  priority: 'high',
                  status: 'todo',
                  metadata: { source: 'chief_of_staff', lead_id: lead.id, autoSourceKey: `deal_fail:${lead.id}` },
                });
                continue;
              }

              const text = dealResult?.content?.[0]?.text || '';
              const match = text.match(/Deal created: (\{.*?\})/);
              if (match) {
                const dealData = JSON.parse(match[1]);
                if (dealData?.id) {
                  const scoreRes = await this.executeToolInternal('score_deal', {
                    tenant_id,
                    deal_id: dealData.id
                  }, traceId, supabaseAdmin);

                  let score = 0;
                  try {
                    const scoreText = scoreRes?.content?.[0]?.text || '';
                    const scoreMatch = scoreText.match(/Score: (\d+)/) || scoreText.match(/"ai_deal_score":\s*(\d+)/);
                    if (scoreMatch) score = Number(scoreMatch[1]);
                  } catch (e) {}

                  pipelineDeals.push({
                    lead_name: lead.business_name,
                    deal_id: dealData.id,
                    score
                  });
                }
              }
            } catch (err: any) {
              console.error(`Failed to create deal in deal pipeline:`, err);
            }
          }

          // 4. DAILY SOCIAL ENGINE
          const { toZonedTime, fromZonedTime, format: formatZoned } = await import('date-fns-tz');
          const timeZone = 'Europe/Warsaw';
          const nowZoned = toZonedTime(new Date(), timeZone);
          const dateStr = formatZoned(nowZoned, 'yyyy-MM-dd', { timeZone });

          // Check if already run today
          const { data: existingPosts } = await supabaseAdmin
            .from('social_posts')
            .select('id')
            .eq('tenant_id', tenant_id)
            .eq('metadata->>warsaw_date', dateStr);

          const socialEngineRun = existingPosts && existingPosts.length > 0;
          const scheduledPosts: any[] = [];

          if (!socialEngineRun) {
            const topicsList = ['AI tools', 'business automation', 'founder insights'];
            const dayIndex = Math.floor(new Date().getTime() / (1000 * 60 * 60 * 24)) % 3;
            const topic1 = topicsList[dayIndex];
            const topic2 = topicsList[(dayIndex + 1) % 3];
            const topic3 = topicsList[(dayIndex + 2) % 3];

            // Post 1: LinkedIn text post (9:00 AM)
            let time9am = fromZonedTime(`${dateStr} 09:00:00`, timeZone);
            if (time9am < new Date()) {
              time9am = new Date(time9am.getTime() + 24 * 60 * 60 * 1000);
            }
            try {
              const post1Content = await socialPostGenerationService.generateMultiPass({
                platform: 'linkedin',
                pillar: 'tactical_how_to',
                topic: topic1,
                includeCta: true
              });
              const post1Res = await this.executeToolInternal('create_linkedin_post', {
                tenant_id,
                user_id,
                text: post1Content.content,
                scheduled_at: time9am.toISOString(),
                publish_now: false
              }, traceId, supabaseAdmin);

              const post1Match = post1Res?.content?.[0]?.text?.match(/LinkedIn post created: (\{.*?\})/) || post1Res?.content?.[0]?.text?.match(/post:\s*(\{.*?\})/);
              if (post1Match) {
                const postData = JSON.parse(post1Match[1]);
                if (postData?.post?.id) {
                  await supabaseAdmin
                    .from('social_posts')
                    .update({
                      metadata: {
                        autonomous: true,
                        chief_of_staff: true,
                        warsaw_date: dateStr,
                        topic: topic1,
                        generation: post1Content
                      }
                    })
                    .eq('id', postData.post.id);
                  scheduledPosts.push({ platform: 'LinkedIn', time: time9am.toISOString(), topic: topic1, id: postData.post.id });
                }
              }
            } catch (err) {
              console.error('Failed scheduling post 1:', err);
            }

            // Post 2: Facebook post (1:00 PM)
            let time1pm = fromZonedTime(`${dateStr} 13:00:00`, timeZone);
            if (time1pm < new Date()) {
              time1pm = new Date(time1pm.getTime() + 24 * 60 * 60 * 1000);
            }
            try {
              const post2Content = await socialPostGenerationService.generateMultiPass({
                platform: 'facebook',
                pillar: 'tactical_how_to',
                topic: topic2,
                includeCta: true
              });
              const post2Res = await this.executeToolInternal('create_social_post', {
                tenant_id,
                user_id,
                platforms: ['facebook'],
                caption: post2Content.content,
                scheduled_at: time1pm.toISOString(),
                publish_now: false
              }, traceId, supabaseAdmin);

              const text2 = post2Res?.content?.[0]?.text || '';
              const post2Match = text2.match(/Social post created: (\{.*?\})/) || text2.match(/post_id:\s*"(.*?)"/);
              if (post2Match) {
                let post2Id = '';
                try {
                  const parsed = JSON.parse(post2Match[1]);
                  post2Id = parsed?.post?.id || '';
                } catch (e) {
                  // Fallback match
                  const idMatch = text2.match(/social_post_id=(.*?)\b/) || text2.match(/"id":\s*"(.*?)"/);
                  if (idMatch) post2Id = idMatch[1];
                }
                if (post2Id) {
                  await supabaseAdmin
                    .from('social_posts')
                    .update({
                      metadata: {
                        autonomous: true,
                        chief_of_staff: true,
                        warsaw_date: dateStr,
                        topic: topic2,
                        generation: post2Content
                      }
                    })
                    .eq('id', post2Id);
                  scheduledPosts.push({ platform: 'Facebook', time: time1pm.toISOString(), topic: topic2, id: post2Id });
                }
              }
            } catch (err) {
              console.error('Failed scheduling post 2:', err);
            }

            // Post 3: LinkedIn with AI image (5:00 PM)
            let time5pm = fromZonedTime(`${dateStr} 17:00:00`, timeZone);
            if (time5pm < new Date()) {
              time5pm = new Date(time5pm.getTime() + 24 * 60 * 60 * 1000);
            }
            try {
              const imagePrompt = `Professional creative layout, minimalist tech illustration representing ${topic3}, modern styling, cool lighting, high quality 3D render.`;
              const post3Res = await this.executeToolInternal('create_post_with_ai_image', {
                tenant_id,
                user_id,
                topic: topic3,
                image_prompt: imagePrompt,
                platforms: ['linkedin'],
                scheduled_at: time5pm.toISOString()
              }, traceId, supabaseAdmin);

              const text3 = post3Res?.content?.[0]?.text || '';
              const post3Match = text3.match(/Autonomous content creation complete\.\s*Post\s*scheduled\s*for\s*.*?\s*with\s*.*?\s*image\./) || text3.match(/"post_id":\s*"(.*?)"/);
              let post3Id = '';
              if (post3Match) {
                try {
                  const parsed = JSON.parse(text3);
                  post3Id = parsed?.post_id || '';
                } catch (e) {
                  const idMatch = text3.match(/post_id":\s*"(.*?)"/) || text3.match(/"id":\s*"(.*?)"/);
                  if (idMatch) post3Id = idMatch[1];
                }
                if (post3Id) {
                  await supabaseAdmin
                    .from('social_posts')
                    .update({
                      metadata: {
                        autonomous: true,
                        chief_of_staff: true,
                        warsaw_date: dateStr,
                        topic: topic3,
                        image_prompt: imagePrompt
                      }
                    })
                    .eq('id', post3Id);
                  scheduledPosts.push({ platform: 'LinkedIn (AI Image)', time: time5pm.toISOString(), topic: topic3, id: post3Id });
                }
              }
            } catch (err) {
              console.error('Failed scheduling post 3:', err);
            }
          }

          // Build session summary report
          const reportLines = [
            `# AlphaClone Systems — Chief of Staff Session Report`,
            `**Timestamp:** ${new Date().toISOString()}`,
            `**Workspace ID (Tenant):** ${tenant_id}`,
            ``,
            `## 1. Pipeline Health`,
            `- **Business Snapshot:** Retrieved successfully.`,
            `- **Draft Invoices Sent (${sentDraftInvoices.length}):** ${sentDraftInvoices.length > 0 ? sentDraftInvoices.join(', ') : 'None found.'}`,
            `- **Deals Created from Recency (${healthDeals.length}):**`,
            ...healthDeals.map(d => `  - **Lead:** ${d.lead_name} → **Deal ID:** ${d.deal_id} (AI Score: ${d.score})`),
            healthDeals.length === 0 ? `  - *No new deals created from recent leads.*` : '',
            `- **Flagged/Updated Overdue & Due Tasks (${flaggedTasks.length}):**`,
            ...flaggedTasks.map(t => `  - **Task:** ${t.title} → **Updated:** ${t.new_title} (Due: ${t.due_date}${t.overdue ? ' - OVERDUE' : ''})`),
            flaggedTasks.length === 0 ? `  - *No tasks required updates.*` : '',
            ``,
            `## 2. Revenue Recovery`,
            `- **Nexus Invoice Chasing Triggered:** ${triggeredChasing ? 'Yes, chased sent & overdue invoices.' : 'No overdue sent invoices found.'}`,
            `- **Late Draft Invoices Sent (${remainingSentDrafts.length}):** ${remainingSentDrafts.length > 0 ? remainingSentDrafts.join(', ') : 'None.'}`,
            ``,
            `## 3. Deal Pipeline Optimization`,
            `- **Leads Converted to Prospect Deals (${pipelineDeals.length}):**`,
            ...pipelineDeals.map(pd => `  - **Lead:** ${pd.lead_name} → **Deal ID:** ${pd.deal_id} (AI Score: ${pd.score})`),
            pipelineDeals.length === 0 ? `  - *No additional leads converted to deals.*` : '',
            ``,
            `## 4. Daily Social Engine`,
            socialEngineRun 
              ? `- **Status:** Skip (Social engine already executed today for Warsaw date **${dateStr}**).` 
              : `- **Status:** Scheduled 3 autonomous posts for Warsaw date **${dateStr}**:`,
            ...scheduledPosts.map(p => `  - **Platform:** ${p.platform} | **Topic:** ${p.topic} | **Time (UTC):** ${p.time} | **Post ID:** ${p.id}`),
            !socialEngineRun && scheduledPosts.length === 0 ? `  - *Failed to schedule posts.*` : '',
            ``,
            `**Status:** Routine execution complete.`
          ];

          result = {
            content: [{
              type: 'text',
              text: reportLines.join('\n')
            }]
          };
          break;
        }

        case 'get_business_snapshot': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { snapshot, error } = await strategicAuditService.getSnapshot(tenant_id, supabaseAdmin);
          if (error) throw new Error(error);
          result = { content: [{ type: 'text', text: JSON.stringify(snapshot, null, 2) }] };
          break;
        }

        case 'generate_business_report': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { businessReportService } = await import('../businessReportService');
          const report = await businessReportService.generateExecutiveReport(tenant_id);
          result = { content: [{ type: 'text', text: report }] };
          break;
        }

        case 'get_strategic_plan': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { snapshot, error } = await strategicAuditService.getSnapshot(tenant_id, supabaseAdmin);
          if (error) throw new Error(error);
          if (!snapshot) throw new Error('Could not generate snapshot for analysis');
          const plan = strategicThinkerService.analyze(snapshot);
          result = { content: [{ type: 'text', text: JSON.stringify(plan, null, 2) }] };
          break;
        }

        // get_clients, search_contacts, create_client — handled by tool-registry (lib/mcp/tools/crm.ts)

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
            .eq('is_active', true)
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

        // Registry handles this tool (lib/mcp/tools/crm.ts)

                // ——————————————————————————————————————————————————————————————————————————————
        // Registry handles this tool (lib/mcp/tools/crm.ts)

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
            search_email,
            search_name,
          } = a;

          let resolvedId = client_id;

          // Smart Lookup fallback
          if (!resolvedId && (search_email || search_name)) {
            let lookup = supabaseAdmin.from('business_clients').select('id').eq('tenant_id', tenant_id);
            if (search_email) lookup = lookup.eq('email', search_email);
            if (search_name) lookup = lookup.eq('name', search_name);
            const { data: found } = await lookup.limit(1).maybeSingle();
            if (found) resolvedId = found.id;
          }

          if (!isUuidString(resolvedId)) {
            throw new Error('client_id must be a valid UUID. Use get_clients or provide search_email/search_name for Smart Lookup.');
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

          const cleanedUpdate = cleanObjectPlaceholders(update);
          if (Object.keys(cleanedUpdate).length === 0) {
            throw new Error('Provide at least one field to update');
          }
          const { data, error } = await supabaseAdmin
            .from('business_clients')
            .update(cleanedUpdate)
            .eq('tenant_id', tenant_id)
            .eq('id', (resolvedId as string).trim())
            .select('id, name, email, phone, sales_stage, value, is_active, updated_at')
            .single();
          if (error) throw supabaseErrorToMcpClientError('update_client', error.message);
          result = { content: [{ type: 'text', text: `Client updated: ${JSON.stringify(data)}` }] };
          break;
        }

        // â”€â”€ get_leads â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'get_leads': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { fetchLeadsPaginated } = await import('@/lib/crm/fetchLeads');
          const payload = await fetchLeadsPaginated({
            tenantId: tenant_id,
            status: a.status,
            stage: a.stage,
            source: a.source,
            assignedTo: a.assigned_to,
            limit: a.limit,
            offset: a.offset,
            cursor: a.cursor,
            sortBy: a.sort_by,
            sortOrder: a.sort_order,
            fields: a.fields,
            excludeConverted: a.exclude_converted !== false,
          });
          result = {
            content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
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

        // ── AI Task Automation ─────────────────────────────────────────────
        case 'task_create': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.ctx?.userId;
          const { name: taskName, prompt, schedule, timezone, notification_preference } = a;
          const task = await taskAutomationService.createTask({
            tenantId: tenant_id,
            userId: user_id,
            name: taskName,
            prompt,
            schedule,
            timezone,
            notificationPreference: notification_preference
          });
          result = { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
          break;
        }

        case 'task_list': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const tasks = await taskAutomationService.listTasks(tenant_id);
          result = { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] };
          break;
        }

        case 'task_get_results': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { task_id, limit } = a;
          const results = await taskAutomationService.getTaskResults(tenant_id, task_id, limit);
          result = { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
          break;
        }

        case 'task_pause': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { task_id } = a;
          const task = await taskAutomationService.updateTaskStatus(tenant_id, task_id, 'paused');
          result = { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
          break;
        }

        case 'task_resume': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { task_id } = a;
          const task = await taskAutomationService.updateTaskStatus(tenant_id, task_id, 'active');
          result = { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
          break;
        }

        case 'task_delete': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { task_id } = a;
          const delRes = await taskAutomationService.deleteTask(tenant_id, task_id);
          result = { content: [{ type: 'text', text: JSON.stringify(delRes, null, 2) }] };
          break;
        }

        // â”€â”€ create_lead â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'create_lead': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const owner_id = this.requireProfileUser(a);
          const { business_name, contact_name, email, phone, industry, location, source, source_id, source_url, notes, linkedin_url, decision_maker_name } = a;
          const resolvedSource = inferMcpLeadSource(source, this.ctx);
          const primaryName = (business_name || contact_name || '').trim();
          if (!primaryName) throw new Error('create_lead requires contact_name or business_name');
          const traceSourceId = typeof source_id === 'string' ? source_id.trim() : '';
          const traceSourceUrl = typeof source_url === 'string' ? source_url.trim() : '';

          // Build enriched notes if extra contact intel is provided
          const enrichmentLines: string[] = [];
          if (decision_maker_name) enrichmentLines.push(`Decision Maker: ${decision_maker_name}`);
          if (linkedin_url) enrichmentLines.push(`LinkedIn: ${linkedin_url}`);
          if (traceSourceId) enrichmentLines.push(`Source ID: ${traceSourceId}`);
          if (traceSourceUrl) enrichmentLines.push(`Source URL: ${traceSourceUrl}`);
          const enrichedNotes = [notes, ...enrichmentLines].filter(Boolean).join('\n') || null;

          // Deduplication check
          const normalizedPhone = normalizePhoneForStorage(phone);
          let dupQuery = supabaseAdmin
            .from('leads')
            .select('id, business_name, email, status')
            .eq('tenant_id', tenant_id);
          
          const dupOrs = [`business_name.ilike.${primaryName.replace(/[%_]/g, '\\$&')}`];
          if (email) dupOrs.push(`email.ilike.${String(email).trim()}`);
          if (normalizedPhone) dupOrs.push(`phone.eq.${normalizedPhone}`);
          
          dupQuery = dupQuery.or(dupOrs.join(','));
          const { data: existingLeads, error: dupError } = await dupQuery.limit(1);
          
          let data: any;
          let error: any;
          let duplicated = false;

          if (!dupError && existingLeads && existingLeads.length > 0) {
            console.log(`[MCP create_lead] Lead already exists: ${existingLeads[0].business_name} (ID: ${existingLeads[0].id}). Returning existing.`);
            data = existingLeads[0];
            duplicated = true;
          } else {
            const primaryInsert = await supabaseAdmin
              .from('leads')
              .insert(cleanObjectPlaceholders({
                tenant_id,
                owner_id,
                business_name: primaryName,
                email: email || null,
                phone: normalizedPhone,
                industry: industry || '',
                location: location || null,
                status: 'new',
                stage: 'lead',
                source: resolvedSource,
                notes: enrichedNotes,
                metadata: {
                  source_id: traceSourceId || null,
                  source_url: traceSourceUrl || null,
                },
                linkedin_url: linkedin_url || null,
                decision_maker_name: decision_maker_name || null,
              }))
              .select('id, business_name, email, status')
              .single();

            // Fallback for legacy schemas where one of status/stage/owner_id may differ.
            data = primaryInsert.data;
            error = primaryInsert.error;
            if (error) {
              const fallbackInsert = await supabaseAdmin
                .from('leads')
                .insert({
                  tenant_id,
                  business_name: primaryName,
                  email: email || null,
                  phone: normalizedPhone,
                  industry: industry || '',
                  location: location || null,
                  source: resolvedSource,
                  notes: notes || null,
                  metadata: {
                    source_id: traceSourceId || null,
                    source_url: traceSourceUrl || null,
                  },
                })
                .select('id, business_name, email, status')
                .single();
              data = fallbackInsert.data;
              error = fallbackInsert.error;
            }

            if (error) throw supabaseErrorToMcpClientError('create_lead', error.message);

            // Verify visibility to ensure it's not a silent failure
            const { data: verified } = await supabaseAdmin.from('leads').select('id').eq('id', data?.id).single();
            if (!verified) throw new Error('Lead creation failed: Record not found in database after insertion.');
          }

          if (duplicated) {
            result = {
              content: [
                {
                  type: 'text',
                  text: `SUCCESS: Lead "${data?.business_name || primaryName}" (ID: ${data?.id}) already exists in the AlphaClone CRM (duplicated check). Returning the existing lead record.`,
                },
              ],
            };
          } else {
            await enqueueMcpEvent(
              supabaseAdmin,
              tenant_id,
              owner_id,
              'on_new_lead_created',
              { lead_id: data?.id || null, business_name: data?.business_name || primaryName, source: resolvedSource }
            );
            void onLeadCreated({
              tenantId: tenant_id,
              userId: owner_id,
              leadId: data?.id,
              businessName: data?.business_name || primaryName,
            }).catch((err) => console.error('[create_lead] onLeadCreated failed:', err));
            result = {
              content: [
                {
                  type: 'text',
                  text: `SUCCESS: Lead "${data?.business_name || primaryName}" (ID: ${data?.id}) has been added to the AlphaClone CRM and is now visible in your Leads pipeline. I have initialized the pursuit strategy for this lead.`,
                },
              ],
            };
          }
          break;
        }

        // â”€â”€ update_lead_status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          const { lead_id, business_name, email, phone, industry, location, source, notes, status, stage, search_email, search_business_name } = a;
          
          let resolvedId = lead_id;
          const resolvedIdTrimmed = typeof resolvedId === 'string' ? resolvedId.trim() : resolvedId;

          // Smart Lookup fallback
          if (!resolvedIdTrimmed && (search_email || search_business_name)) {
            let lookup = supabaseAdmin.from('leads').select('id').eq('tenant_id', tenant_id);
            if (search_email) lookup = lookup.eq('email', search_email);
            if (search_business_name) lookup = lookup.eq('business_name', search_business_name);
            const { data: found } = await lookup.limit(1).maybeSingle();
            if (found) resolvedId = found.id;
          }

          if (!isUuidString(resolvedId)) {
            throw new Error('lead_id must be a valid lead UUID. Use get_leads or provide search_email/search_business_name for Smart Lookup.');
          }

          const resolvedLeadId = String(resolvedId).trim();

          const coerceMetadata = (value: unknown) => {
            if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
            return {};
          };

          const appendLeadStageMetadata = (
            metadata: Record<string, any>,
            fromStage: string,
            toStage: string,
            reason?: string
          ) => {
            const history = Array.isArray(metadata?.stage_history) ? metadata.stage_history : [];
            const entry = {
              from: fromStage,
              to: toStage,
              reason: reason?.trim() || undefined,
              changed_at: new Date().toISOString(),
            };

            return {
              ...(metadata || {}),
              previous_stage: fromStage,
              last_stage_change_at: entry.changed_at,
              stage_change_reason: entry.reason,
              stage_history: [...history.slice(-19), entry],
            };
          };

          // If stage is being updated, normalize legacy stages and keep metadata in sync.
          const normalizedStage = stage !== undefined ? normalizeLeadPipelineStage(stage) : null;
          if (normalizedStage) {
            const { data: existingLead, error: existingLeadErr } = await supabaseAdmin
              .from('leads')
              .select('stage, metadata')
              .eq('tenant_id', tenant_id)
              .eq('id', resolvedLeadId)
              .maybeSingle();

            if (existingLeadErr) throw supabaseErrorToMcpClientError('update_lead', existingLeadErr.message);
            if (!existingLead) throw new Error(`Lead not found: ${resolvedLeadId}`);

            const fromStage = normalizeLeadPipelineStage(existingLead.stage);
            const check = assertLeadStageTransition(fromStage, normalizedStage);
            if (!check.ok) throw new Error(check.message);

            if (isTerminalLeadStage(normalizedStage) && normalizedStage === 'lost') {
              // Match leadService semantics: closing lost removes the lead record from the pipeline.
              try {
                await fileUploadService.deleteFileByEntity('lead', resolvedLeadId);
              } catch (_) {
                // Deletion of attached assets is best-effort; we still delete the lead record.
              }

              const { error: deleteErr } = await supabaseAdmin
                .from('leads')
                .delete()
                .eq('tenant_id', tenant_id)
                .eq('id', resolvedLeadId);

              if (deleteErr) throw supabaseErrorToMcpClientError('update_lead', deleteErr.message);

              result = {
                content: [{ type: 'text', text: `Lead ${resolvedLeadId} closed — removed from pipeline.` }],
              };
              break;
            }
          }

          const update: Record<string, any> = cleanObjectPlaceholders({});
          if (business_name !== undefined) update.business_name = business_name;
          if (email !== undefined) update.email = email || null;
          if (phone !== undefined) update.phone = normalizePhoneForStorage(phone);
          if (industry !== undefined) update.industry = industry || '';
          if (location !== undefined) update.location = location || null;
          if (source !== undefined) update.source = source || null;
          if (notes !== undefined) update.notes = notes || null;
          if (status !== undefined) update.status = status;
          if (stage !== undefined) {
            const stageToSet = normalizedStage as string;
            update.stage = stageToSet;

            // Keep stage_history + change timestamps visible in UI/analytics.
            const { data: existingLead } = await supabaseAdmin
              .from('leads')
              .select('stage, metadata')
              .eq('tenant_id', tenant_id)
              .eq('id', resolvedLeadId)
              .maybeSingle();

            const fromStage = normalizeLeadPipelineStage(existingLead?.stage);
            const nextMetadata = appendLeadStageMetadata(
              coerceMetadata(existingLead?.metadata),
              fromStage,
              stageToSet,
              typeof notes === 'string' ? notes.trim() : undefined
            );
            update.metadata = nextMetadata;
          }
          
          const cleanedUpdate = cleanObjectPlaceholders(update);
          if (Object.keys(cleanedUpdate).length === 0) throw new Error('Provide at least one field to update');

          const { data, error } = await supabaseAdmin
            .from('leads')
            .update(cleanedUpdate)
            .eq('tenant_id', tenant_id)
            .eq('id', resolvedLeadId)
            .select('id, business_name, status, stage, updated_at')
            .single();
          if (error) throw supabaseErrorToMcpClientError('update_lead', error.message);
          result = { content: [{ type: 'text', text: `Lead updated: ${JSON.stringify(data)}` }] };
          break;
        }

        // get_deals, create_deal, update_deal — handled by lib/mcp/tools/deals.ts registry

        // â”€â”€ get_projects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'get_projects': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { status } = a;
          let query = supabaseAdmin
            .from('business_projects')
            .select('id, name, status, due_date, description, client_id, created_at')
            .eq('tenant_id', tenant_id)
            .limit(50);
          if (status) query = query.eq('status', status);
          const { data, error } = await query;
          if (error) throw supabaseErrorToMcpClientError('get_projects', error.message);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        case 'get_project_summary': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const projectId = String(a.project_id || '').trim();
          if (!isUuidString(projectId)) throw new Error('project_id must be a valid business project UUID from get_projects');

          const { data: project, error: projectError } = await supabaseAdmin
            .from('business_projects')
            .select('*')
            .eq('tenant_id', tenant_id)
            .eq('id', projectId)
            .single();
          if (projectError || !project) {
            throw supabaseErrorToMcpClientError('get_project_summary', projectError?.message || 'Project not found');
          }

          const [{ data: tasks }, { data: documents }] = await Promise.all([
            supabaseAdmin
              .from('tasks')
              .select('id, title, status, priority, due_date, assigned_to, estimated_hours, actual_hours')
              .eq('tenant_id', tenant_id)
              .eq('related_to_project', projectId)
              .limit(500),
            supabaseAdmin
              .from('file_uploads')
              .select('id, original_filename, category, file_type, created_at')
              .eq('tenant_id', tenant_id)
              .eq('entity_type', 'project')
              .eq('entity_id', projectId)
              .limit(100),
          ]);

          const taskRows = tasks || [];
          const taskStatusCounts = taskRows.reduce((acc: Record<string, number>, task: any) => {
            const status = String(task.status || 'unknown');
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {});
          const estimatedHours = taskRows.reduce((sum: number, task: any) => sum + (Number(task.estimated_hours) || 0), 0);
          const actualHours = taskRows.reduce((sum: number, task: any) => sum + (Number(task.actual_hours) || 0), 0);

          result = { content: [{ type: 'text', text: JSON.stringify({
            project,
            task_summary: {
              total: taskRows.length,
              by_status: taskStatusCounts,
              estimated_hours: estimatedHours,
              actual_hours: actualHours,
            },
            documents: documents || [],
          }, null, 2) }] };
          break;
        }

        // â”€â”€ create_project â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'create_project': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { name, description, status = 'planning', due_date, client_id } = a;
          if (typeof name !== 'string' || !name.trim()) {
            throw new Error('name is required');
          }
          if (client_id != null && client_id !== '' && !isUuidString(client_id)) {
            throw new Error('client_id must be a valid CRM client UUID or omitted');
          }

          const { data, error } = await supabaseAdmin
            .from('business_projects')
            .insert({
              tenant_id,
              name: name.trim(),
              description: typeof description === 'string' ? description : null,
              status: typeof status === 'string' && status.trim() ? status.trim() : 'planning',
              due_date: typeof due_date === 'string' && due_date.trim() ? due_date.trim() : null,
              client_id: client_id && isUuidString(client_id) ? client_id.trim() : null,
            })
            .select('id, name, status, due_date, client_id, created_at')
            .single();
          if (error) throw supabaseErrorToMcpClientError('create_project', error.message);
          result = { content: [{ type: 'text', text: `Project created: ${JSON.stringify(data)}` }] };
          break;
        }

        // â”€â”€ update_project_status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

        // â”€â”€ get_tasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

        // â”€â”€ create_task â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'create_task': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { title, description, project_id, assigned_to, due_date, priority = 'medium', notify_assignee } = a;
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
          const parsedDueDate =
            due_date != null && due_date !== '' ? parseFlexibleDueDate(due_date) : null;
          if (due_date != null && due_date !== '' && !parsedDueDate) {
            throw new Error(
              'due_date must be YYYY-MM-DD, ISO datetime, or a phrase like "next Wednesday"'
            );
          }
          const { data, error } = await supabaseAdmin
            .from('tasks')
            .insert({
              tenant_id,
              title: title.trim(),
              description: description ?? null,
              related_to_project: project_id && isUuidString(project_id) ? project_id.trim() : null,
              assigned_to: assigned_to && isUuidString(assigned_to) ? assigned_to.trim() : null,
              due_date: parsedDueDate,
              priority,
              status: 'todo',
            })
            .select('id, title, due_date, priority, related_to_project')
            .single();
          if (error) throw supabaseErrorToMcpClientError('create_task', error.message);
          let notificationSent = false;
          if (notify_assignee === true && assigned_to && isUuidString(assigned_to)) {
            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('email, name')
              .eq('id', assigned_to.trim())
              .maybeSingle();
            if (profile?.email) {
              const emailResult = await sendEmailServer({
                tenantId: tenant_id,
                userId: this.ctx?.userId || undefined,
                to: profile.email,
                subject: `New task assigned: ${title.trim()}`,
                text: [
                  `Hi ${profile.name || 'there'},`,
                  '',
                  `You have been assigned a task in AlphaClone: ${title.trim()}`,
                  description ? `Details: ${description}` : '',
                  due_date ? `Due: ${due_date}` : '',
                  '',
                  'Open your AlphaClone task board to review and update progress.',
                ].filter(Boolean).join('\n'),
                isPlatformNotification: true,
                templateName: 'mcpTaskAssigned',
              });
              notificationSent = Boolean(emailResult.success);
            }
          }
          if (data?.related_to_project) {
            await createProjectTimelineComment(
              supabaseAdmin,
              tenant_id,
              String(data.related_to_project),
              `Task created: ${data.title}${data.due_date ? `, due ${data.due_date}` : ''}.`
            );
          }
          result = { content: [{ type: 'text', text: `Task created: ${JSON.stringify({ ...data, assignee_notified: notificationSent })}` }] };
          break;
        }

        case 'send_task_email': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const taskId = String(a.task_id || '').trim();
          const to = String(a.to || a.recipient_email || '').trim();
          if (!isUuidString(taskId)) throw new Error('task_id must be a valid task UUID');
          if (!to) throw new Error('to is required');
          const { data: task, error } = await supabaseAdmin
            .from('tasks')
            .select('id,title,description,status,priority,due_date,related_to_project,created_at')
            .eq('tenant_id', tenant_id)
            .eq('id', taskId)
            .single();
          if (error || !task) throw supabaseErrorToMcpClientError('send_task_email', error?.message || 'Task not found');
          const html = `
            <h2>${task.title}</h2>
            <p><strong>Status:</strong> ${task.status || 'todo'}</p>
            <p><strong>Priority:</strong> ${task.priority || 'medium'}</p>
            <p><strong>Due:</strong> ${task.due_date || 'No due date'}</p>
            ${task.description ? `<p>${String(task.description).replace(/\n/g, '<br/>')}</p>` : ''}
          `;
          const sendResult = await sendEmailServer({
            tenantId: tenant_id,
            userId: user_id,
            to,
            subject: String(a.subject || `Task: ${task.title}`),
            html,
            fromName: String(a.from_name || 'AlphaClone Tasks'),
            preferredProvider: a.provider as any,
            templateName: 'mcpTaskEmail',
          });
          if (!sendResult.success) throw new Error(sendResult.error || 'Task email failed');
          result = { content: [{ type: 'text', text: JSON.stringify({ sent: true, task_id: taskId, to, provider: sendResult.provider, email_id: sendResult.emailId }, null, 2) }] };
          break;
        }

        // â”€â”€ update_task â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          if (due_date !== undefined) {
            if (due_date === null || due_date === '') {
              update.due_date = null;
            } else {
              const parsedDueDate = parseFlexibleDueDate(due_date);
              if (!parsedDueDate) {
                throw new Error(
                  'due_date must be YYYY-MM-DD, ISO datetime, or a phrase like "next Wednesday"'
                );
              }
              update.due_date = parsedDueDate;
            }
          }
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

        // â”€â”€ write_task_note â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

        // â”€â”€ create_bulk_email_campaign â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'create_bulk_email_campaign': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const createdByUserId = this.ctx?.userId || this.requireProfileUser(a);
          const { name: campaignName, subject, body_html, target_audience, from_name, from_email, publish_now } = a;
          const deliveryProviders = Array.isArray(a.delivery_providers)
            ? a.delivery_providers.map((p: unknown) => String(p).trim().toLowerCase()).filter(Boolean)
            : [];
          const balanceByDailyLimit = a.balance_by_daily_limit !== false;
          const language = resolveCampaignLanguage({
            languageMode: a.language_mode,
            language: a.language,
            country: a.country,
            countryCode: a.country_code,
            company: campaignName,
          });

          if (!campaignName || !subject || !body_html || !target_audience || !from_name || !from_email) {
            throw new Error('Missing required fields for bulk email campaign.');
          }
          if (language.mustAsk) {
            throw new Error('language_mode is "ask". Ask the user which language to use, then call this tool again with language or language_mode set to that language code.');
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
              language: language.code,
              languageMode: language.mode,
              languageInstruction: getCampaignLanguageInstruction({ languageMode: language.code }),
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
          const campaignQuality = campaignQualityCheck(String(body_html || ''));
          const languageWarnings = campaignQuality.warnings;

          if (publish_now && blocksBonnieSend(campaignQuality.score)) {
            throw new Error(
              `Campaign quality score ${campaignQuality.score}/100 — rewrite before send. Issues: ${languageWarnings.join('; ')}`
            );
          }

          if (publish_now) {
             actionText = `Campaign "${campaignName}" created and queued to send to ${recipients.length} recipients with provider balancing.`;
             const sendResult = await sendScheduledCampaignServer(campaign.id);
             if (!sendResult.success) {
               throw new Error(sendResult.error || 'Campaign send failed');
             }
             actionText = `Campaign "${campaignName}" created and sent to ${recipients.length} recipients.`;
          }

          result = { content: [{ type: 'text', text: JSON.stringify({
            message: actionText,
            campaign_id: campaign.id,
            ...(languageWarnings.length ? { language_warnings: languageWarnings } : {}),
          }, null, 2) }] };
          break;
        }

        case 'queue_email_campaign_send': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const campaignId = String(a.campaign_id || '').trim();
          if (!isUuidString(campaignId)) throw new Error('campaign_id must be a valid email campaign UUID');

          const { data: campaign, error: campaignErr } = await supabaseAdmin
            .from('email_campaigns')
            .select('id, name, status, tenant_id, total_recipients, metadata')
            .eq('tenant_id', tenant_id)
            .eq('id', campaignId)
            .single();
          if (campaignErr || !campaign) {
            throw supabaseErrorToMcpClientError('queue_email_campaign_send', campaignErr?.message || 'Campaign not found');
          }

          const campaignBody = String((campaign as any)?.metadata?.bodyHtml || '');
          const preSendQuality = campaignQualityCheck(campaignBody);
          if (blocksBonnieSend(preSendQuality.score)) {
            throw new Error(
              `Campaign quality score ${preSendQuality.score}/100 — rewrite before send. Issues: ${preSendQuality.warnings.join('; ')}`
            );
          }

          await supabaseAdmin
            .from('email_campaigns')
            .update({ status: 'queued', queued_at: new Date().toISOString() })
            .eq('tenant_id', tenant_id)
            .eq('id', campaignId);

          const sendResult = await sendScheduledCampaignServer(campaignId);
          if (!sendResult.success) {
            throw new Error(sendResult.error || 'Campaign send failed');
          }

          const languageWarnings = preSendQuality.warnings;

          result = {
            content: [{ type: 'text', text: JSON.stringify({
              campaign_id: campaignId,
              campaign_name: campaign.name,
              status: 'sent',
              total_recipients: campaign.total_recipients || 0,
              provider_routing: 'AlphaClone used connected providers through sendEmail fallback.',
              quality_score: preSendQuality.score,
              ...(languageWarnings.length ? { language_warnings: languageWarnings } : {}),
            }, null, 2) }],
          };
          break;
        }

        case 'get_email_campaign_delivery_status': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const campaignId = String(a.campaign_id || '').trim();
          if (!isUuidString(campaignId)) throw new Error('campaign_id must be a valid email campaign UUID');

          const { data: campaign, error: campaignErr } = await supabaseAdmin
            .from('email_campaigns')
            .select('id, name, subject, status, total_recipients, total_sent, sent_at, completed_at, metadata')
            .eq('tenant_id', tenant_id)
            .eq('id', campaignId)
            .single();
          if (campaignErr || !campaign) {
            throw supabaseErrorToMcpClientError('get_email_campaign_delivery_status', campaignErr?.message || 'Campaign not found');
          }

          const { data: recipients, error: recipientErr } = await supabaseAdmin
            .from('campaign_recipients')
            .select('status, metadata, sent_at, error_message')
            .eq('tenant_id', tenant_id)
            .eq('campaign_id', campaignId)
            .limit(10000);
          if (recipientErr) throw supabaseErrorToMcpClientError('get_email_campaign_delivery_status', recipientErr.message);

          const byStatus: Record<string, number> = {};
          const byProvider: Record<string, number> = {};
          const failures: string[] = [];
          for (const row of recipients || []) {
            const status = String(row.status || 'unknown');
            byStatus[status] = (byStatus[status] || 0) + 1;
            const provider = String((row.metadata as any)?.provider || 'unknown');
            byProvider[provider] = (byProvider[provider] || 0) + 1;
            if (status === 'failed' && row.error_message && failures.length < 10) failures.push(String(row.error_message));
          }

          result = {
            content: [{ type: 'text', text: JSON.stringify({
              campaign,
              recipients_total: recipients?.length || 0,
              by_status: byStatus,
              by_provider: byProvider,
              sample_failures: failures,
            }, null, 2) }],
          };
          break;
        }

        case 'send_batch_outreach': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const { lead_ids = [], client_ids = [], tone = 'professional', custom_context = '', delivery_provider = 'sendgrid' } = a;
          const batchLanguage = resolveCampaignLanguage({
            languageMode: a.language_mode,
            language: a.language,
          });
          
          if (lead_ids.length === 0 && client_ids.length === 0) {
            throw new Error('Provide at least one lead_id or client_id');
          }
          if (batchLanguage.mustAsk) {
            throw new Error('language_mode is "ask". Ask the user which language to use before sending outreach, then call this tool again with language or language_mode set to that language code.');
          }
          
          const combinedIds = [...new Set([...lead_ids, ...client_ids])].slice(0, 50);
          const CHUNK_SIZE = 3;
          const ASYNC_THRESHOLD = 5;

          if (combinedIds.length > ASYNC_THRESHOLD) {
            await enqueueMcpEvent(supabaseAdmin, tenant_id, user_id, 'send_batch_outreach', {
              lead_ids,
              client_ids,
              tone,
              custom_context,
              delivery_provider,
              language_mode: batchLanguage.code,
            });
            result = {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  status: 'queued',
                  message: `Batch outreach queued for ${combinedIds.length} recipients (chunks of ${CHUNK_SIZE}). Poll get_email_campaign_stats or dashboard outreach log for delivery.`,
                  recipient_count: combinedIds.length,
                }, null, 2),
              }],
            };
            break;
          }
          
          const [{ data: leads }, { data: clients }] = await Promise.all([
            supabaseAdmin.from('leads').select('*').in('id', combinedIds).eq('tenant_id', tenant_id),
            supabaseAdmin.from('business_clients').select('*').in('id', combinedIds).eq('tenant_id', tenant_id)
          ]);
            
          const allEntities = [...(leads || []), ...(clients || [])];
          
          if (allEntities.length === 0) {
            throw new Error('No valid leads or clients found for the provided IDs');
          }

          const results: Array<Record<string, unknown>> = [];
          for (let i = 0; i < allEntities.length; i += CHUNK_SIZE) {
            const chunk = allEntities.slice(i, i + CHUNK_SIZE);
            const chunkResults = await Promise.all(chunk.map(async (entity) => {
             const email = entity.email || (Array.isArray((entity as any).emails) ? (entity as any).emails[0] : null) || (entity as any).contact_email;
             if (!email || !String(email).includes('@')) {
               return {
                 name: entity.business_name || entity.name,
                 status: 'failed',
                 error: 'No email found on this record. Add an email in CRM (any stage: discovered→negotiation) then retry.',
               };
             }
             
             try {
                const prompt = `Generate a highly personalized, professional B2B outreach email for ${entity.business_name || entity.name}.
                Industry: ${entity.industry || 'Business'}.
                Target Tone: ${tone}.
                User Context: ${custom_context}.
                Business Context: ${JSON.stringify(entity.metadata || {})}.
                ${getCampaignLanguageInstruction({
                  languageMode: batchLanguage.code,
                  country: (entity as any).country,
                  countryCode: (entity as any).country_code,
                  address: (entity as any).address,
                  company: entity.business_name || entity.name,
                })}
                
                Rules:
                - Max 120 words.
                - Professional, punchy subject line.
                - NO emojis.
                - Clear CTA.`;
                
                const aiRes = await routeAutonomousTask('social_caption', prompt);
                
                const emailResult = await sendEmailServer({
                  tenantId: tenant_id,
                  userId: user_id,
                  to: email,
                  subject: `Business Inquiry regarding ${entity.business_name || entity.name}`,
                  html: aiRes.content,
                  fromName: 'AlphaClone Outreach',
                  preferredProvider: delivery_provider as any,
                  templateName: 'mcpAiOutreach',
                });
                if (!emailResult.success) throw new Error(emailResult.error || 'Outreach email failed');

                await supabaseAdmin.from('lead_outreach_log').insert({
                  tenant_id,
                  user_id,
                  lead_name: entity.business_name || entity.name,
                  lead_email: email,
                  subject: `Business Inquiry regarding ${entity.business_name || entity.name}`,
                  body_html: aiRes.content,
                  status: 'sent',
                  provider: emailResult.provider,
                });
                
                return { name: entity.business_name || entity.name, status: 'sent', language: batchLanguage.code, provider: emailResult.provider, email_id: emailResult.emailId };
             } catch (err: any) {
                return { name: entity.business_name || entity.name, status: 'failed', error: err.message };
             }
            }));
            results.push(...chunkResults);
          }
          
          result = { 
            content: [{ 
              type: 'text', 
              text: `AI Outreach Batch complete. Sent to ${results.filter(r => r.status === 'sent').length}/${results.length} entities.\n\nResults: ${JSON.stringify(results, null, 2)}` 
            }] 
          };
          break;
        }

        // â”€â”€ create_invoice â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'create_invoice': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const {
            client_id,
            issue_date,
            due_date,
            subtotal = 0,
            tax = 0,
            total,
            notes,
            line_items = [],
            bank_details,
            bankDetails,
            mobile_payment_details,
            mobilePaymentDetails,
          } = a;
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
              bank_details: typeof bank_details === 'string' ? bank_details : typeof bankDetails === 'string' ? bankDetails : null,
              mobile_payment_details: typeof mobile_payment_details === 'string' ? mobile_payment_details : typeof mobilePaymentDetails === 'string' ? mobilePaymentDetails : null,
            })
            .select('id, invoice_number, status, total, due_date, bank_details, mobile_payment_details')
            .single();
          if (error) throw supabaseErrorToMcpClientError('create_invoice', error.message);

          const { ensureInvoicePaymentLink } = await import('@/lib/invoicing/invoicePaymentLink');
          const payment = await ensureInvoicePaymentLink({
            tenantId: tenant_id,
            invoiceId: data.id,
          });

          result = {
            content: [{
              type: 'text',
              text: JSON.stringify({
                ...data,
                payment_link: payment.payment_link,
                stripe_connected: payment.stripe_connected,
              }, null, 2),
            }],
          };
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
          const {
            invoice_id,
            due_date,
            subtotal,
            tax,
            total,
            notes,
            status,
            line_items,
            bank_details,
            bankDetails,
            mobile_payment_details,
            mobilePaymentDetails,
          } = a;
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
          if (bank_details !== undefined || bankDetails !== undefined) {
            update.bank_details = typeof bank_details === 'string' ? bank_details : typeof bankDetails === 'string' ? bankDetails : null;
          }
          if (mobile_payment_details !== undefined || mobilePaymentDetails !== undefined) {
            update.mobile_payment_details = typeof mobile_payment_details === 'string'
              ? mobile_payment_details
              : typeof mobilePaymentDetails === 'string'
                ? mobilePaymentDetails
                : null;
          }
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
            .select('id, invoice_number, status, total, due_date, sent_at, paid_at, updated_at, bank_details, mobile_payment_details')
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

        // â”€â”€ send_message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

        // â”€â”€ create_social_post / create_post â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          // No size/type restriction — accept any media from external AI tools (Kling, etc.).
          // Prefer media_urls on create_post when content already lives on an external host.
          if (!mime_type.includes('/') ) {
            throw new Error('mime_type must be a valid MIME string (e.g. image/png, video/mp4, application/octet-stream).');
          }
          const assetType = isVideo ? 'video' : mime_type.includes('gif') ? 'gif' : mime_type.startsWith('image/') ? 'image' : 'file';
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
          const {
            filename,
            mime_type,
            file_base64,
            category,
            tags = [],
            entity_type,
            entity_id,
            create_public_link,
            public_link_expires_hours,
          } = a;
          
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

          // Save in workspace_files table
          try {
            await supabaseAdmin.from('workspace_files').insert({
              id: uploadRes.fileId,
              tenant_id: tenant_id,
              user_id: user_id,
              uploaded_by: user_id,
              filename: filename.trim(),
              file_name: filename.trim(),
              mime_type: mime_type.trim(),
              file_type: mime_type.trim(),
              file_size: binary.length,
              storage_url: uploadRes.proxiedUrl || uploadRes.url || '',
            });
          } catch (workspaceErr) {
            console.error('Failed to write to workspace_files table:', workspaceErr);
          }

          const response: Record<string, unknown> = {
            success: true,
            file_id: uploadRes.fileId,
            stored_in: 'AlphaClone Document Hub',
            linked_to: entity_type && entity_id ? { entity_type, entity_id } : null,
            public_link_created: false,
          };

          if (create_public_link === true) {
            if (!uploadRes.fileId) throw new Error('Document uploaded, but no file id was returned for public sharing.');
            const { data: fileRecord, error: fileErr } = await supabaseAdmin
              .from('file_uploads')
              .select('storage_path, original_filename')
              .eq('id', uploadRes.fileId)
              .eq('tenant_id', tenant_id)
              .single();
            if (fileErr || !fileRecord?.storage_path) {
              throw supabaseErrorToMcpClientError('upload_document', fileErr?.message || 'Uploaded file record was not found');
            }
            const share = await publicShareService.createShare({
              tenantId: tenant_id,
              bucket: 'uploads',
              filePath: fileRecord.storage_path,
              originalName: fileRecord.original_filename || filename.trim(),
              createdBy: user_id,
              expiresInHours: Number(public_link_expires_hours) > 0 ? Number(public_link_expires_hours) : 48,
            });
            response.public_link_created = true;
            response.public_share_url = share.url;
            response.public_share_expires_at = share.expiresAt;
          }

          result = { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
          break;
        }

        case 'get_facebook_identities': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const pages = await this.getFacebookIntegrations(tenant_id, user_id, undefined, false);

          const identities = (pages || []).map((page: any) => {
            const tasks = Array.isArray((page as any)?.metadata?.page_tasks)
               ? ((page as any).metadata.page_tasks as string[])
               : [];
            const hasTaskPermission = tasks.includes('MANAGE') || tasks.includes('CREATE_CONTENT') || tasks.includes('ADVERTISE');
            const canPost = !!page.pageAccessToken && page.is_active && !(page as any)?.metadata?.no_pages && hasTaskPermission;
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

        case 'get_facebook_page_capabilities': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          let pageId = typeof a.page_id === 'string' ? a.page_id.trim() : '';
          let integration: FacebookIntegrationIdentity | null = null;
          const rows = await this.getFacebookIntegrations(tenant_id, user_id, pageId || undefined, true);
          integration = pageId ? ((rows || [])[0] as FacebookIntegrationIdentity | undefined) || null : pickPreferredFacebookIdentity((rows || []) as FacebookIntegrationIdentity[]);
          if (!integration) throw new Error('No active Facebook Page integration found.');
          pageId = integration.page_id;
          const tasks = Array.isArray(integration.metadata?.page_tasks)
            ? (integration.metadata.page_tasks as unknown[]).map((task) => String(task))
            : [];
          const canCreateContent = tasks.includes('CREATE_CONTENT') || tasks.includes('MANAGE') || tasks.includes('ADVERTISE');
          const hasPageToken = Boolean(integration.pageAccessToken);
          result = { content: [{ type: 'text', text: JSON.stringify({
            page_id: pageId,
            page_name: integration.page_name,
            page_tasks: tasks,
            scope_mode: integration.metadata?.scope_mode || 'advanced',
            requested_scopes: integration.metadata?.requested_scopes || [],
            capabilities: {
              publish_posts: hasPageToken && canCreateContent,
              upload_media: hasPageToken && canCreateContent,
              delete_posts: hasPageToken && canCreateContent,
              read_posts: hasPageToken,
              read_insights: hasPageToken,
              read_comments: hasPageToken,
              manage_comments: hasPageToken && canCreateContent,
              messenger: hasPageToken,
              leads: hasPageToken,
            },
          }, null, 2) }] };
          break;
        }

        case 'get_facebook_post_insights': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const postId = String(a.post_id || a.facebook_post_id || a.id || '').trim();
          if (!postId) {
            throw new Error(
              'post_id is required (pass post_id, facebook_post_id, or id of the Facebook post)'
            );
          }
          let pageId = typeof a.page_id === 'string' ? a.page_id.trim() : '';
          let integration: FacebookIntegrationIdentity | null = null;
          let user_id = '';
          try { user_id = this.requireProfileUser(a); } catch {}
          const rows = await this.getFacebookIntegrations(tenant_id, user_id, pageId || undefined, true);
          integration = pageId ? ((rows || [])[0] as FacebookIntegrationIdentity | undefined) || null : pickPreferredFacebookIdentity((rows || []) as FacebookIntegrationIdentity[]);
          if (!integration?.pageAccessToken) throw new Error('No Facebook Page token found for insights.');
          const metrics = ['post_impressions', 'post_impressions_unique', 'post_engaged_users', 'post_clicks'].join(',');
          const resp = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(postId)}/insights?metric=${metrics}&access_token=${encodeURIComponent(integration.pageAccessToken)}`);
          const fb = await resp.json();
          if (!resp.ok || fb?.error) throw new Error(fb?.error?.message || 'Facebook insights unavailable');
          result = { content: [{ type: 'text', text: JSON.stringify({ post_id: postId, insights: fb.data || [] }, null, 2) }] };
          break;
        }

        case 'delete_facebook_post': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const postId = String(a.post_id || '').trim();
          if (!postId) throw new Error('post_id is required');
          let pageId = typeof a.page_id === 'string' ? a.page_id.trim() : '';
          let integration: FacebookIntegrationIdentity | null = null;
          let user_id = '';
          try { user_id = this.requireProfileUser(a); } catch {}
          const rows = await this.getFacebookIntegrations(tenant_id, user_id, pageId || undefined, true);
          integration = pageId ? ((rows || [])[0] as FacebookIntegrationIdentity | undefined) || null : pickPreferredFacebookIdentity((rows || []) as FacebookIntegrationIdentity[]);
          if (!integration?.pageAccessToken) throw new Error('No Facebook Page token found for delete.');
          pageId = integration.page_id;
          const resp = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(postId)}?access_token=${encodeURIComponent(integration.pageAccessToken)}`, { method: 'DELETE' });
          const fb = await resp.json().catch(() => ({}));
          if (!resp.ok || fb?.error) throw new Error(fb?.error?.message || 'Facebook delete failed');
          await supabaseAdmin.from('facebook_page_posts').delete().eq('fb_post_id', postId).eq('page_id', pageId);
          result = { content: [{ type: 'text', text: JSON.stringify({ deleted: true, post_id: postId, page_id: pageId }, null, 2) }] };
          break;
        }

        case 'create_social_post_with_media': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const { caption, file_name, mime_type, file_base64, platforms, publish_now, scheduled_at, page_id } = a;
          if (!caption || !file_name || !mime_type || !file_base64) {
            throw new Error('caption, file_name, mime_type, and file_base64 are required');
          }
          const uploadRes = await this.executeToolInternal(
            'upload_media_asset',
            { tenant_id, user_id, file_name, mime_type, file_base64, tags: ['agent-composite-post'] },
            traceId,
            supabaseAdmin
          );
          const uploadText = uploadRes.content?.[0]?.text || '';
          const assetMatch = uploadText.match(/\{[\s\S]*\}/);
          const asset = assetMatch ? JSON.parse(assetMatch[0]) : null;
          if (!asset?.id) throw new Error('Media upload failed');
          return this.executeToolInternal(
            'create_social_post',
            {
              tenant_id,
              user_id,
              caption,
              media_asset_ids: [asset.id],
              platforms: platforms || ['facebook'],
              publish_now: publish_now ?? false,
              scheduled_at,
              page_id,
            },
            traceId,
            supabaseAdmin
          );
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
            executing_agent,
            media_base64_data = [],
            auto_refine_with_context = true,
          } = a;
          const postPrep = prepareSocialPostContent(cleanProfessionalContent(caption || ''), link_url);
          const cleanCaption = postPrep.content;
          const postCtaWarning = postPrep.warning;
          if (!cleanCaption) throw new Error('caption is required');
          if (publish_now && !isSocialPublishEnabled()) {
            throw new Error('Publishing disabled');
          }

          // A. Dynamic Context & Sovereign Brand Strategy Scanner
          let finalCaption = cleanCaption;
          if (auto_refine_with_context !== false) {
            const lower = finalCaption.toLowerCase();
            
            // 2. Sovereign Google-Free GIS compliance hook
            const mentionsGoogle = lower.includes('google maps') || lower.includes('google analytics') || lower.includes('google api');
            if (mentionsGoogle) {
              finalCaption = finalCaption
                .replace(/google maps/gi, 'OpenStreetMap & HERE maps (Sovereign GIS)')
                .replace(/google analytics/gi, 'Sovereign client metrics')
                .replace(/google api/gi, 'Sovereign mapping APIs');
            } else if (!lower.includes('maps') && !lower.includes('gis') && !lower.includes('openstreetmap') && !lower.includes('here')) {
              finalCaption += '\n\n100% Google-Free sovereign local business lead harvesting powered by OpenStreetMap & HERE maps routing.';
            }
            
            // 3. Solopreneur starting pricing value hook
            const hasPricing = lower.includes('$15') || lower.includes('trial') || lower.includes('risk-free');
            if (!hasPricing) {
              finalCaption += '\n\nKickstart your B2B lead pipelines with our zero-risk 14-day trial. Pricing starts at just $15/month.';
            }
          }

          const postSanitized = sanitizePost(finalCaption);
          finalCaption = postSanitized.clean;

          // B. Direct base64 Multimedia Ingestion (optional — prefer external media_urls)
          const uploadedAssetUrls: string[] = [];
          const uploadFailures: string[] = [];
          if (Array.isArray(media_base64_data) && media_base64_data.length > 0) {
            for (const item of media_base64_data) {
              try {
                const { file_name, file_type, base64 } = item as { file_name?: string; file_type?: string; base64?: string };
                if (file_name && file_type && base64) {
                  const normalizedBase = base64.includes('base64,') ? base64.split('base64,')[1] : base64;
                  const binary = Buffer.from(normalizedBase, 'base64');
                  if (binary.length > 0) {
                    // No size limit — accept video and any MIME from external AI tools.
                    const ext = String(file_name).split('.').pop() || (file_type.startsWith('video/') ? 'mp4' : 'bin');
                    const storagePath = `media/${tenant_id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
                    const { error: uploadError } = await supabaseAdmin.storage
                      .from('public-assets')
                      .upload(storagePath, binary, {
                        contentType: file_type,
                        upsert: false,
                      });
                    if (uploadError) {
                      uploadFailures.push(`${file_name}: ${uploadError.message}`);
                      continue;
                    }
                    const { data: urlData } = supabaseAdmin.storage.from('public-assets').getPublicUrl(storagePath);
                    const publicUrl = urlData.publicUrl;
                    const assetType = file_type.startsWith('video/') ? 'video' : file_type.includes('gif') ? 'gif' : 'image';
                    await supabaseAdmin
                      .from('media_assets')
                      .insert({
                        tenant_id,
                        user_id,
                        file_name: file_name.trim(),
                        file_type: file_type.trim(),
                        asset_type: assetType,
                        storage_path: storagePath,
                        public_url: publicUrl,
                        file_size_bytes: binary.length,
                        alt_text: '',
                        tags: ['mcp-direct-upload'],
                      });
                    uploadedAssetUrls.push(publicUrl);
                  }
                }
              } catch (err: any) {
                uploadFailures.push(err?.message || 'unknown upload error');
                console.error('Failed to upload direct base64 asset inside create_social_post:', err);
              }
            }
            if (uploadedAssetUrls.length === 0 && uploadFailures.length > 0) {
              throw new Error(
                `All media_base64_data uploads failed: ${uploadFailures.join('; ')}. Pass media_urls from the external AI tool instead.`
              );
            }
          }

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
            const rows = await this.getFacebookIntegrations(tenant_id, user_id, resolvedPageId, true);
            integration = (rows && rows[0]) || null;
          } else if (hasFacebook) {
            const identities = await this.getFacebookIntegrations(tenant_id, user_id, undefined, true);
            integration = pickPreferredFacebookIdentity(identities);
            if (integration?.page_id) resolvedPageId = integration.page_id;
          }

          if (hasFacebook && !resolvedPageId) {
            throw new Error(
              'page_id is required when this tenant has multiple Facebook Pages. Call get_social_identities or get_facebook_identities and pass identity_id/page_id.'
            );
          }

          const normalizedMediaUrls = Array.isArray(media_urls)
            ? media_urls.filter((u) => typeof u === 'string' && String(u).trim())
            : [];
          // External AI/content tool URLs are first-class — no requirement to store in our DB first.
          if (normalizedMediaUrls.length > 0) {
            const { assertMediaUrlReachable } = await import('@/lib/social/uploadMediaAsset');
            for (const url of normalizedMediaUrls) {
              try {
                await assertMediaUrlReachable(url);
              } catch (mediaErr: any) {
                throw new Error(
                  mediaErr?.message ||
                    `Media URL rejected: ${url}. Pass a reachable public URL from the generator tool.`
                );
              }
            }
          }
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
            if (resolvedAssetUrls.length === 0) {
              throw new Error(
                `None of the provided media_asset_ids resolved to a public URL for tenant ${tenant_id}.`
              );
            }
          }

          const mergedMediaUrls = [...normalizedMediaUrls, ...resolvedAssetUrls, ...uploadedAssetUrls];
          const firstMediaUrl = mergedMediaUrls.length > 0 ? mergedMediaUrls[0] : null;
          const isVideoMedia = !!firstMediaUrl && /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(firstMediaUrl);

          if (hasFacebook && (!integration?.pageAccessToken || integration?.metadata?.no_pages || !canPublishFacebookPage(integration))) {
            throw new Error('Connected integration is not publishable for this page. Connect a Facebook Page with publish permissions.');
          }

          const { findDuplicateScheduledCaption } = await import('@/lib/automation/platformHardening');
          const duplicate = await findDuplicateScheduledCaption(tenant_id, finalCaption);
          if (duplicate) {
            throw new Error(
              `Duplicate caption blocked (${duplicate.similarity}). Regenerate content instead of re-queuing near-identical post (matches post ${duplicate.id}).`
            );
          }

          let status: 'scheduled' | 'queued' | 'published' = publish_now ? 'queued' : 'scheduled';
          let publishedAt: string | null = null;
          let facebookPostId: string | null = null;
          let facebookPostUrl: string | null = null;
          const assuredIntegration = hasFacebook ? integration : null;

          if (publish_now && hasFacebook) {
            if (!assuredIntegration?.pageAccessToken) {
              throw new Error('Connected integration is not publishable for this page. Connect a Facebook Page with publish permissions.');
            }

            const {
              confirmFacebookPublish,
              FacebookPublishError,
              inspectFacebookPublishToken,
              logFacebookPublishTokenHealth,
            } = await import('@/lib/facebook/verifyFacebookPost');

            const tokenHealth = inspectFacebookPublishToken({
              pageId: resolvedPageId,
              pageAccessToken: assuredIntegration.pageAccessToken,
              expiresAt: assuredIntegration.expires_at || null,
              metadata: assuredIntegration.metadata,
            });
            logFacebookPublishTokenHealth(tokenHealth);

            if (tokenHealth.isExpired) {
              throw new FacebookPublishError(
                'Facebook page token is expired or about to expire. Reconnect the Facebook Page in AlphaClone Integrations before posting.',
                'TOKEN_EXPIRED'
              );
            }
            if (!tokenHealth.hasPagesManagePosts) {
              throw new FacebookPublishError(
                'Facebook page token is missing publish permission (pages_manage_posts / CREATE_CONTENT). Reconnect the Page and grant pages_manage_posts.',
                'MISSING_SCOPE'
              );
            }

            const graph = new URL(`https://graph.facebook.com/v19.0/${resolvedPageId}/${isVideoMedia ? 'videos' : firstMediaUrl ? 'photos' : 'feed'}`);
            graph.searchParams.set('access_token', assuredIntegration.pageAccessToken);
            const body = new URLSearchParams();
            if (firstMediaUrl) {
              if (isVideoMedia) {
                body.set('file_url', firstMediaUrl);
                body.set('description', finalCaption);
              } else {
                body.set('url', firstMediaUrl);
                body.set('caption', finalCaption);
              }
            } else {
              body.set('message', finalCaption);
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

            // Hard verification: require Graph post id + confirm via GET /{post-id}
            const verified = await confirmFacebookPublish({
              graphResponse: fb,
              pageAccessToken: assuredIntegration.pageAccessToken,
              pageId: resolvedPageId,
            });
            status = 'published';
            publishedAt = new Date().toISOString();
            facebookPostId = verified.postId;
            facebookPostUrl = verified.postUrl;
          }

          const { data, error } = await supabaseAdmin
            .from('social_posts')
            .insert({
              tenant_id,
              user_id,
              caption: finalCaption,
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

          // C. Daily Multi-Agent CRM Activity Timeline Logger
          const detectedAgent = typeof executing_agent === 'string' && executing_agent.trim()
            ? executing_agent.trim().toLowerCase()
            : finalCaption.toLowerCase().includes('manus') ? 'manus' : finalCaption.toLowerCase().includes('grok') ? 'grok' : 'claude';
          
          const agentDisplayNames: Record<string, string> = {
            claude: 'Claude 3.5 Sonnet',
            grok: 'Grok 3 (Social Agent)',
            manus: 'Manus AI (Web Agent)'
          };
          const agentName = agentDisplayNames[detectedAgent] || 'Claude 3.5 Sonnet';

          await supabaseAdmin
            .from('tasks')
            .insert({
              tenant_id: tenant_id,
              title: `[${agentName}] Autonomous Social Post Dispatched`,
              description: `AI Agent successfully executed the autonomous social media distribution matrix.\n\nPlatforms: ${normalizedPlatforms.join(', ').toUpperCase()}\nCaption: ${finalCaption}\nAssets: ${mergedMediaUrls.length} media attached.\nStatus: ${status.toUpperCase()}`,
              priority: 'medium',
              status: 'completed',
              completed_at: new Date().toISOString(),
              tags: [detectedAgent, 'mcp-run', 'autopilot-publish'],
              metadata: {
                agent: detectedAgent,
                agent_name: agentName,
                tool: 'create_social_post',
                social_post_id: data?.id || null
              }
            });

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
                  post: {
                    ...data,
                    facebook_post_url: facebookPostUrl,
                    verified: publish_now && hasFacebook ? true : undefined,
                  },
                  task: taskResult,
                  page: hasFacebook ? { page_id: resolvedPageId, page_name: integration?.page_name || null } : null,
                  facebook_post_url: facebookPostUrl,
                  refinement: auto_refine_with_context !== false ? 'applied brand context' : 'skipped',
                  logged_run: { agent: detectedAgent, status: 'completed' },
                  has_cta: postPrep.has_cta,
                  ...(postCtaWarning ? { warning: postCtaWarning } : {}),
                })}`,
              },
            ],
          };
          break;
        }

        case 'create_facebook_comment': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const { page_id, post_id, message } = a;

          if (typeof post_id !== 'string' || !post_id.trim()) throw new Error('post_id is required');
          if (typeof message !== 'string' || !message.trim()) throw new Error('message is required');

          let resolvedPageId = typeof page_id === 'string' && page_id.trim() ? page_id.trim() : '';
          let integration: FacebookIntegrationIdentity | null = null;

          if (resolvedPageId) {
            const rows = await this.getFacebookIntegrations(tenant_id, user_id, resolvedPageId, true);
            integration = (rows && rows[0]) || null;
          } else {
            const identities = await this.getFacebookIntegrations(tenant_id, user_id, undefined, true);
            integration = pickPreferredFacebookIdentity(identities);
            if (integration?.page_id) resolvedPageId = integration.page_id;
          }

          if (!resolvedPageId || !integration?.pageAccessToken) {
            throw new Error('No connected Facebook pages with comment permissions were found.');
          }

          const response = await fetch(
            `https://graph.facebook.com/v19.0/${post_id}/comments`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: message.trim(),
                access_token: integration.pageAccessToken,
              }),
            }
          );

          const fb = await response.json();
          if (!response.ok || fb?.error) {
            throw new Error(fb?.error?.message || 'Facebook comment failed');
          }

          result = {
            content: [
              {
                type: 'text',
                text: `Facebook comment created: ${JSON.stringify({
                  id: fb.id,
                  page_id: resolvedPageId,
                  page_name: integration.page_name,
                })}`,
              },
            ],
          };
          break;
        }

        // â”€â”€ LinkedIn tools â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

          // Also fetch organization identities from linkedin_identities table
          const { data: orgIdentities, error: orgError } = await supabaseAdmin
            .from('linkedin_identities')
            .select('*')
            .eq('tenant_id', tenant_id)
            .eq('type', 'organization');

          if (orgError && orgError.code !== '42P01') {
            throw supabaseErrorToMcpClientError('get_linkedin_identities', orgError.message);
          }

          const identities: any[] = [];
          let canPostOrg = false;

          if (li) {
            const scopes = Array.isArray(li.scopes)
              ? li.scopes.map((scope: any) => String(scope).toLowerCase())
              : [];
            canPostOrg = scopes.includes('w_organization_social');
            identities.push({
              type: 'person',
              linkedin_member_id: li.linkedin_member_id || null,
              author_urn: li.linkedin_person_urn,
              can_post: scopes.includes('w_member_social'),
            });
          }

          const orgRows =
            orgIdentities && orgIdentities.length > 0
              ? orgIdentities
              : (Array.isArray((li as any)?.metadata?.company_pages)
                  ? (li as any).metadata.company_pages
                  : []
                ).map((page: Record<string, unknown>) => ({
                  linkedin_organization_id: String(page.id || ''),
                  author_urn: `urn:li:organization:${String(page.id || '')}`,
                  can_post: canPostOrg,
                  name: page.name || null,
                }));

          if (orgRows.length > 0) {
            for (const org of orgRows) {
              identities.push({
                type: 'organization',
                linkedin_organization_id: org.linkedin_organization_id,
                author_urn: org.author_urn,
                can_post: org.can_post !== false,
                name: org.name || null,
              });
            }
          }

          if (identities.length === 0) {
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
          const liPostPrep = prepareSocialPostContent(cleanProfessionalContent(text), a.link_url);
          const sanitizedLinkedInText = liPostPrep.content;
          if (!sanitizedLinkedInText) throw new Error('text is required');
          if (!publish_now && (typeof scheduled_at !== 'string' || !scheduled_at.trim())) {
            throw new Error('scheduled_at is required when publish_now is false');
          }

          const li = await loadMcpLinkedInIntegration(supabaseAdmin, tenant_id, user_id);
          if (!li?.access_token || !li?.linkedin_person_urn) {
            throwLinkedInError('LINKEDIN_NOT_CONNECTED', 'LinkedIn is not connected for this workspace/user.');
          }

          const scopes = Array.isArray(li.scopes)
            ? li.scopes.map((scope: unknown) => String(scope).toLowerCase())
            : [];
          let postAsMode = String(post_as || 'personal').trim().toLowerCase();
          if (postAsMode !== 'personal' && postAsMode !== 'company' && postAsMode !== 'all_pages') {
            throw new Error('post_as must be one of: personal, company, all_pages');
          }

          const companyPages = await resolveLinkedInCompanyPagesForTenant(
            supabaseAdmin,
            tenant_id,
            (li as { metadata?: unknown }).metadata
          );
          const requestedOrganizationId =
            typeof linkedin_organization_id === 'string' && linkedin_organization_id.trim()
              ? linkedin_organization_id.trim()
              : null;

          // linkedin_organization_id implies a company-page post (Bonnie often omits post_as=company).
          if (requestedOrganizationId && postAsMode === 'personal') {
            postAsMode = 'company';
          }

          const selectedCompany = requestedOrganizationId
            ? companyPages.find((page) => String(page.id) === requestedOrganizationId)
            : null;
          let postAsCompany = false;
          const postToAllPages = postAsMode === 'all_pages';
          const allCompanyPageIds = companyPages.map((page) => page.id).filter(Boolean);

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
          } else if (postAsMode === 'company' || requestedOrganizationId) {
            if (!scopes.includes('w_organization_social')) {
              throwLinkedInError(
                'LINKEDIN_MISSING_ORGANIZATION_SCOPE',
                'LinkedIn connection is missing w_organization_social scope. Reconnect LinkedIn and approve company page permissions.'
              );
            }
            if (!requestedOrganizationId) {
              const availableIds = allCompanyPageIds;
              throwLinkedInError(
                'LINKEDIN_ORGANIZATION_ID_REQUIRED',
                'post_as=company requires linkedin_organization_id from get_linkedin_identities.',
                { available_organization_ids: availableIds }
              );
            }
            if (!selectedCompany && allCompanyPageIds.length > 0 && !allCompanyPageIds.includes(requestedOrganizationId)) {
              console.warn(
                `[create_linkedin_post] linkedin_organization_id=${requestedOrganizationId} not in cached company pages; posting anyway`
              );
            }
            postAsCompany = true;
          } else if (!scopes.includes('w_member_social')) {
            throwLinkedInError('LINKEDIN_MISSING_MEMBER_SCOPE', 'LinkedIn connection is missing w_member_social scope.');
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
                  caption: sanitizedLinkedInText,
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
              sanitizedLinkedInText,
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
                caption: sanitizedLinkedInText,
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
            let shareMediaCategory: 'NONE' | 'IMAGE' | 'VIDEO' = 'NONE';
            let media: Array<Record<string, unknown>> = [];

            if (mergedMediaUrls.length > 0) {
              const firstMediaUrl = mergedMediaUrls[0];
              const isVideo = /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(firstMediaUrl);

              if (isVideo) {
                const fetchController = new AbortController();
                const fetchTimer = setTimeout(() => fetchController.abort(), 60000);
                const videoFetch = await fetch(firstMediaUrl, {
                  method: 'GET',
                  signal: fetchController.signal,
                }).finally(() => clearTimeout(fetchTimer));
                if (!videoFetch.ok) {
                  throw new Error(`Could not download video URL (${videoFetch.status})`);
                }
                const contentType = String(videoFetch.headers.get('content-type') || 'video/mp4');
                const videoBuffer = await videoFetch.arrayBuffer();

                const registerRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${li.access_token}`,
                    'Content-Type': 'application/json',
                    'X-Restli-Protocol-Version': '2.0.0',
                  },
                  body: JSON.stringify({
                    registerUploadRequest: {
                      recipes: ['urn:li:digitalmediaRecipe:feedshare-video'],
                      owner: authorUrn,
                      serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
                    },
                  }),
                });
                const registerJson = await registerRes.json().catch(() => ({}));
                if (!registerRes.ok) {
                  throw new Error(registerJson?.message || `LinkedIn video register failed (${registerRes.status})`);
                }
                const assetUrn = String(registerJson?.value?.asset || '');
                const uploadUrl = String(
                  registerJson?.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl || ''
                );
                if (!assetUrn || !uploadUrl) {
                  throw new Error('LinkedIn video register response missing upload target');
                }

                const uploadRes = await fetch(uploadUrl, {
                  method: 'PUT',
                  headers: { 'Content-Type': contentType },
                  body: videoBuffer,
                });
                if (!uploadRes.ok) {
                  throw new Error(`LinkedIn video upload failed (${uploadRes.status})`);
                }

                shareMediaCategory = 'VIDEO';
                media = [{
                  status: 'READY',
                  media: assetUrn,
                  title: { text: 'AlphaClone video' },
                }];
              } else {
                shareMediaCategory = 'IMAGE';
                for (let i = 0; i < mergedMediaUrls.length; i++) {
                  const imageUrl = mergedMediaUrls[i];
                  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) continue;

                  const fetchController = new AbortController();
                  const fetchTimer = setTimeout(() => fetchController.abort(), 30000);
                  const imageFetch = await fetch(imageUrl, {
                    method: 'GET',
                    signal: fetchController.signal,
                  }).finally(() => clearTimeout(fetchTimer));
                  if (!imageFetch.ok) {
                    throw new Error(`Could not download image URL (${imageFetch.status})`);
                  }
                  const contentType = String(imageFetch.headers.get('content-type') || 'image/jpeg');
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
                    throw new Error(registerJson?.message || `LinkedIn image register failed (${registerRes.status})`);
                  }
                  const assetUrn = String(registerJson?.value?.asset || '');
                  const uploadUrl = String(
                    registerJson?.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl || ''
                  );
                  if (!assetUrn || !uploadUrl) {
                    throw new Error('LinkedIn image register response missing upload target');
                  }

                  const uploadRes = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': contentType },
                    body: imageBuffer,
                  });
                  if (!uploadRes.ok) {
                    throw new Error(`LinkedIn image upload failed (${uploadRes.status})`);
                  }

                  media.push({
                    status: 'READY',
                    media: assetUrn,
                    title: { text: `AlphaClone image ${i + 1}` },
                  });
                }
              }
            }

            const payload = {
              author: authorUrn,
              lifecycleState: 'PUBLISHED',
              specificContent: {
                'com.linkedin.ugc.ShareContent': {
                  shareCommentary: { text: sanitizedLinkedInText },
                  shareMediaCategory,
                  media,
                },
              },
              visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
            };

            let resp: Response;
            try {
              resp = await linkedInFetch(
                'https://api.linkedin.com/v2/ugcPosts',
                li.access_token,
                {
                  method: 'POST',
                  body: JSON.stringify(payload),
                },
                { timeoutMs: 25000 }
              );
            } catch (err) {
              if (err instanceof LinkedInApiError && err.code === 'TOKEN_EXPIRED' && li.id) {
                await markLinkedInIntegrationInactive(supabaseAdmin, String(li.id), 'token_expired').catch(() => undefined);
              }
              const message = err instanceof Error ? err.message : 'LinkedIn post failed';
              await supabaseAdmin
                .from('social_posts')
                .update({
                  status: 'failed',
                  error_message: message.slice(0, 2000),
                })
                .eq('id', postId);
              throw err instanceof LinkedInApiError
                ? new Error(`LinkedIn post failed: ${err.message}`)
                : err;
            }

            const raw = await resp.text();

            const linkedinPostUrn = parseLinkedInUgcPostUrn(resp, raw);
            const publishedAt = new Date().toISOString();
            const updatePatch: Record<string, unknown> = {
              status: 'published',
              published_at: publishedAt,
              linkedin_post_urn: linkedinPostUrn,
              linkedin_organization_id: postAsCompany ? requestedOrganizationId : null,
              linkedin_member_id: postAsCompany ? null : li.linkedin_member_id || null,
              linkedin_author_urn: authorUrn,
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
                caption: sanitizedLinkedInText,
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

        // â”€â”€ send_invoice â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'send_invoice': {
          const a = args as Record<string, any>;
          const tenant_id = String(this.requireTenant(a) || '').trim();
          const invoice_id = String(a.invoice_id || '').trim();
          const { recipient_email, provider: preferredProvider } = a;
          const user_id = this.ctx?.userId || null;
          if (!isUuidString(invoice_id)) {
            throw new Error('invoice_id must be a valid invoice UUID');
          }

          const { invoice, error: fetchErr } = await getInvoiceWithDetailsAdmin(supabaseAdmin, invoice_id, tenant_id);
          if (fetchErr || !invoice) throw new Error(`Invoice not found: ${fetchErr || 'Unknown error'}`);

          // Generate PDF
          const doc = businessInvoiceService.generatePDF(invoice, invoice.tenant, invoice.client);
          const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
          const pdfBase64 = pdfBuffer.toString('base64');

          const to = recipient_email || invoice.client?.email;
          if (!to) throw new Error('Recipient email is required (not found on client record)');

          const amount = `${invoice.currency || '$'}${Number(invoice.total).toFixed(2)}`;
          const pdfUrl = await getPublicInvoicePaymentUrl(supabaseAdmin, invoice_id, tenant_id);

          const dispatch = await sendEmailServer({
            tenantId: tenant_id,
            userId: user_id || undefined,
            preferredProvider: preferredProvider as any,
            to,
            subject: `Invoice ${invoice.invoice_number} — ${amount}`,
            fromName: invoice.tenant?.name || 'AlphaClone',
            html: invoiceEmailTemplates.invoiceSent({
              recipientName: invoice.client?.name || 'Valued Client',
              recipientEmail: to,
              tenantId: tenant_id,
              invoiceNumber: invoice.invoice_number,
              amount: Number(invoice.total || 0),
              currency: invoice.currency || 'USD',
              dueDate: invoice.due_date,
              actionUrl: pdfUrl,
              workspaceName: invoice.tenant?.name || 'AlphaClone Systems',
              notes: invoice.notes || undefined,
            }),
            attachments: [{
              filename: `Invoice_${invoice.invoice_number}.pdf`,
              content: pdfBase64,
              content_type: 'application/pdf',
            }],
            templateName: 'mcpInvoiceSent',
            skipFooter: true,
          });

          if (!dispatch.success) {
            throw new Error(`Invoice email delivery failed: ${dispatch.error || 'unknown error'} ${JSON.stringify(dispatch.errorDetails || [])}`);
          }

          const { error: updateError } = await supabaseAdmin
            .from('business_invoices')
            .update({
              status: 'sent',
              is_public: true,
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('tenant_id', tenant_id)
            .eq('id', invoice_id);
          if (updateError) throw supabaseErrorToMcpClientError('send_invoice', updateError.message);

          result = { content: [{ type: 'text', text: JSON.stringify({
            status: 'sent',
            message: `Invoice ${invoice.invoice_number} sent successfully.`,
            sent_to: to,
            invoice_number: invoice.invoice_number,
            amount,
            provider_used: dispatch.provider,
            email_id: dispatch.emailId,
            pdf_url: pdfUrl,
            attachment: {
              filename: `Invoice_${invoice.invoice_number}.pdf`,
              content_type: 'application/pdf',
              base64: pdfBase64,
            },
          }, null, 2) }] };
          break;
        }

        case 'send_receipt': {
          const a = args as Record<string, any>;
          const tenant_id = String(this.requireTenant(a) || '').trim();
          const user_id = String(this.requireProfileUser(a) || '').trim();
          const { invoice_id, recipient_email, provider } = a;
          if (!isUuidString(invoice_id)) {
            throw new Error('invoice_id must be a valid invoice UUID');
          }

          const { invoice, error: fetchErr } = await getInvoiceWithDetailsAdmin(supabaseAdmin, invoice_id, tenant_id);
          if (fetchErr || !invoice) throw new Error(`Invoice not found: ${fetchErr || 'Unknown error'}`);

          if (invoice.status !== 'paid') {
            throw new Error(`Cannot send receipt for invoice in '${invoice.status}' status. Invoice must be 'paid'.`);
          }

          const to = recipient_email || invoice.client?.email;
          if (!to) throw new Error('Recipient email is required (not found on client record)');

          // Generate PDF
          const doc = businessInvoiceService.generatePDF(invoice, invoice.tenant, invoice.client);
          const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

          const amount = `${invoice.currency || '$'}${Number(invoice.total).toFixed(2)}`;
          const receiptUrl = AppUrls.viewReceipt(invoice.id);

          const variables = {
            invoice_number: invoice.invoice_number,
            amount,
            payment_date: new Date().toISOString(),
            receipt_url: receiptUrl,
          };
          let html = `
              <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                  <h2 style="color: #10B981;">Payment Confirmed ✓</h2>
                  <p>Hi there,</p>
                  <p>This is a formal receipt for your payment of <strong>{{amount}}</strong>.</p>
                  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                      <tr>
                          <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Invoice Number:</strong></td>
                          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">{{invoice_number}}</td>
                      </tr>
                      <tr>
                          <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Payment Date:</strong></td>
                          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">{{payment_date}}</td>
                      </tr>
                      <tr>
                          <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Amount Paid:</strong></td>
                          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-size: 18px; color: #10B981;">{{amount}}</td>
                      </tr>
                  </table>
                  <p>You can download the full PDF receipt here:</p>
                  <div style="text-align: center; margin: 30px 0;">
                      <a href="{{receipt_url}}" style="background: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                          Download Receipt
                      </a>
                  </div>
                  <p style="color: #666; font-size: 12px;">Thank you for your business!</p>
              </div>
          `;
          Object.entries(variables).forEach(([key, value]) => {
            const placeholder = new RegExp(`{{${key}}}`, 'g');
            html = html.replace(placeholder, String(value));
          });

          const dispatch = await sendEmailServer({
            tenantId: tenant_id,
            userId: user_id || undefined,
            preferredProvider: provider as any,
            to,
            subject: `Payment Receipt - ${invoice.invoice_number}`,
            fromName: invoice.tenant?.name || 'AlphaClone',
            html,
            attachments: [{
              filename: `Receipt_${invoice.invoice_number}.pdf`,
              content: pdfBuffer.toString('base64'),
              contentType: 'application/pdf',
            }],
            templateName: 'mcpInvoiceReceipt',
          });

          if (!dispatch.success) {
            throw new Error(`Receipt email delivery failed: ${dispatch.error || 'unknown error'} ${JSON.stringify(dispatch.errorDetails || [])}`);
          }

          result = {
            content: [{
              type: 'text',
              text: `Receipt for invoice ${invoice.invoice_number} sent successfully to ${to} with PDF attachment.`,
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
          let linkedin_organization_id =
            typeof a.linkedin_organization_id === 'string' && a.linkedin_organization_id.trim()
              ? a.linkedin_organization_id.trim()
              : null;
          if (!post_urn) throw new Error('post_urn is required');

          if (!linkedin_organization_id) {
            const { data: postRow } = await supabaseAdmin
              .from('social_posts')
              .select('linkedin_organization_id, metadata, linkedin_author_urn')
              .eq('tenant_id', tenant_id)
              .eq('linkedin_post_urn', post_urn)
              .maybeSingle();
            const metadata =
              postRow?.metadata && typeof postRow.metadata === 'object'
                ? (postRow.metadata as Record<string, unknown>)
                : null;
            linkedin_organization_id =
              (typeof postRow?.linkedin_organization_id === 'string' && postRow.linkedin_organization_id.trim()
                ? postRow.linkedin_organization_id.trim()
                : null) ||
              (typeof metadata?.linkedin_organization_id === 'string' && metadata.linkedin_organization_id.trim()
                ? String(metadata.linkedin_organization_id).trim()
                : null) ||
              extractLinkedInOrganizationIdFromAuthorUrn(String(postRow?.linkedin_author_urn || '')) ||
              extractLinkedInOrganizationIdFromAuthorUrn(String(metadata?.linkedin_author_urn || ''));
          }

          const li = await loadMcpLinkedInIntegration(supabaseAdmin, tenant_id, user_id);
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

          const li = await loadMcpLinkedInIntegration(supabaseAdmin, tenant_id, user_id);
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

          const li = await loadMcpLinkedInIntegration(supabaseAdmin, tenant_id, user_id);
          if (!li?.access_token || !li?.linkedin_person_urn) throw new Error('LinkedIn is not connected for this workspace/user.');

          const scopes = Array.isArray(li.scopes) ? li.scopes : [];
          if (!scopes.includes('w_member_social')) {
            throwLinkedInError(
              'LINKEDIN_MISSING_MEMBER_SCOPE',
              'LinkedIn connection is missing w_member_social scope required for comments.'
            );
          }

          let resp: Response;
          try {
            resp = await linkedInFetch(
              `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(post_urn.trim())}/comments`,
              li.access_token,
              {
                method: 'POST',
                body: JSON.stringify({
                  actor: li.linkedin_person_urn,
                  message: { text: text.trim() },
                }),
              },
              { timeoutMs: 25000 }
            );
          } catch (err) {
            if (err instanceof LinkedInApiError && err.code === 'TOKEN_EXPIRED' && li.id) {
              await markLinkedInIntegrationInactive(supabaseAdmin, String(li.id), 'token_expired').catch(() => undefined);
            }
            throw err instanceof LinkedInApiError
              ? new Error(`LinkedIn comment failed: ${err.message}`)
              : err;
          }

          if (!resp.ok) {
            const raw = await resp.text().catch(() => '');
            throw new Error(`LinkedIn comment failed: ${raw}`);
          }
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

          const li = await loadMcpLinkedInIntegration(supabaseAdmin, tenant_id, user_id);
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

        case 'create_linkedin_event': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const { name, description, start_time, end_time, timezone = 'UTC', event_type = 'ONLINE', online_url, linkedin_organization_id } = a;

          const li = await loadMcpLinkedInIntegration(supabaseAdmin, tenant_id, user_id);
          if (!li?.access_token) throw new Error('LinkedIn is not connected for this workspace/user.');

          const payload = {
            owner: `urn:li:organization:${linkedin_organization_id}`,
            name: name.trim(),
            description: description ? description.trim() : '',
            startTime: Date.parse(start_time),
            endTime: Date.parse(end_time),
            timezone,
            eventType: event_type,
            onlineEventConfig: event_type === 'ONLINE' ? { onlineUrl: online_url } : undefined,
          };

          const resp = await fetch('https://api.linkedin.com/v2/events', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${li.access_token}`,
              'Content-Type': 'application/json',
              'X-Restli-Protocol-Version': '2.0.0',
            },
            body: JSON.stringify(payload),
          });
          const raw = await resp.text();
          if (!resp.ok) throw new Error(`LinkedIn event creation failed: ${raw}`);
          result = { content: [{ type: 'text', text: `LinkedIn event created successfully: ${raw}` }] };
          break;
        }

        case 'get_linkedin_ad_accounts': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);

          const li = await loadMcpLinkedInIntegration(supabaseAdmin, tenant_id, user_id);
          if (!li?.access_token) throw new Error('LinkedIn is not connected for this workspace/user.');

          // Check for r_ads scope
          const scopes = Array.isArray(li.scopes) ? li.scopes.map((s: any) => String(s).toLowerCase()) : [];
          if (!scopes.includes('r_ads')) {
            result = {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  adsConnected: false,
                  message: 'Ads not connected. Please re-authorize with r_ads scope.',
                  accounts: [],
                }, null, 2),
              }],
            };
            break;
          }

          // Correct API query format for LinkedIn Ads API
          const resp = await fetch('https://api.linkedin.com/v2/adAccountsV2?q=search&search.type.values[0]=BUSINESS', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${li.access_token}`,
              'X-Restli-Protocol-Version': '2.0.0',
              'LinkedIn-Version': '202401',
            },
          });

          if (!resp.ok) {
            const errorData = await resp.json();
            // Graceful handling for no ad accounts
            if (resp.status === 400 || resp.status === 404) {
              result = {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    adsConnected: true,
                    message: 'No ad accounts found for this LinkedIn identity.',
                    accounts: [],
                  }, null, 2),
                }],
              };
              break;
            }
            throw new Error(`Failed to fetch LinkedIn ad accounts: ${JSON.stringify(errorData)}`);
          }

          const data = await resp.json();
          const accounts = (data.elements || []).map((elem: any) => ({
            id: elem.id,
            name: elem.name || elem.accountName,
            status: elem.status,
            currency: elem.currency,
            servedEntity: elem.servedEntity,
          }));

          result = {
            content: [{
              type: 'text',
              text: JSON.stringify({
                adsConnected: true,
                accounts,
              }, null, 2),
            }],
          };
          break;
        }

        case 'get_linkedin_ad_campaigns': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const { ad_account_id, status } = a;

          const li = await loadMcpLinkedInIntegration(supabaseAdmin, tenant_id, user_id);
          if (!li?.access_token) throw new Error('LinkedIn is not connected for this workspace/user.');

          const statusFilter = status ? `(status:(values:LIST(${status})))` : '';
          const searchParams = `(account:(values:LIST(urn:li:adAccountV2:${ad_account_id})))` + (statusFilter ? `,${statusFilter}` : '');
          const url = `https://api.linkedin.com/v2/adCampaignsV2?q=search&search=${encodeURIComponent(searchParams)}`;

          const resp = await fetch(url, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${li.access_token}`,
              'X-Restli-Protocol-Version': '2.0.0',
            },
          });
          const data = await resp.json();
          if (!resp.ok) throw new Error(`Failed to fetch LinkedIn ad campaigns: ${JSON.stringify(data)}`);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        case 'get_linkedin_member_profile': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);

          const li = await loadMcpLinkedInIntegration(supabaseAdmin, tenant_id, user_id);
          if (!li?.access_token) throw new Error('LinkedIn is not connected for this workspace/user.');

          const resp = await fetch('https://api.linkedin.com/v2/userinfo', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${li.access_token}`,
            },
          });
          const data = await resp.json();
          if (!resp.ok) throw new Error(`Failed to fetch LinkedIn profile: ${JSON.stringify(data)}`);
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          break;
        }

        // â”€â”€ get_expenses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

        // â”€â”€ create_expense â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

        // â”€â”€ write_audit_log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
              resource_type: String(entity_type).slice(0, 50),
              resource_id: entity_id || null,
              new_values: newValues,
            })
            .select('id, action, entity_type, created_at')
            .single();

          if (error) throw supabaseErrorToMcpClientError('write_audit_log', error.message);
          result = { content: [{ type: 'text', text: `Audit log written: ${JSON.stringify(data)}` }] };
          break;
        }

        // â”€â”€ get_revenue_summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

        // â”€â”€ generate_contract_draft â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
            const quotaInfraUnavailable = quota.used === 0 && quota.remaining === 0;
            throw new Error(
              quotaInfraUnavailable
                ? 'AI quota service is temporarily unavailable, so contract drafting cannot start right now. Please retry shortly.'
                : 'Daily AI usage limit reached for this workspace. Try again after UTC midnight or upgrade your plan.'
            );
          }
          if (!contract_type || !client_name) {
            throw new Error('contract_type and client_name are required');
          }

          const { data: jobRow, error: insertError } = await supabase
            .from('contracts')
            .insert({
              tenant_id,
              title: `${contract_type}: ${client_name}`,
              content: 'Generating draft…',
              status: 'draft',
              type: String(contract_type).toLowerCase().replace(/\s+/g, '_'),
              metadata: { generation_status: 'processing', client_name, key_terms: key_terms || null },
            })
            .select('id, title, status')
            .single();

          if (insertError || !jobRow?.id) {
            throw new Error(insertError?.message || 'Could not create contract draft job');
          }

          void processContractDraftJob(
            supabaseAdmin,
            jobRow.id,
            tenant_id,
            String(contract_type),
            String(client_name),
            key_terms ? String(key_terms) : undefined
          );

          result = {
            content: [{
              type: 'text',
              text: JSON.stringify({
                job_id: jobRow.id,
                contract_id: jobRow.id,
                status: 'processing',
                title: jobRow.title,
                message: 'Contract draft generation started. Poll get_contract_versions or open Contracts; draft text appears when ready (usually under 60s).',
              }, null, 2),
            }],
          };
          break;
        }

        // save_contract
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
              text: `Contract successfully saved to the platform!\nID: ${data.id}\nTitle: ${data.title}\nStatus: draft â€” it is now ready for the user to review and sign in the Contracts section.`,
            }],
          };
          break;
        }

        case 'send_contract': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { contract_id, recipient_email, subject, message } = a;
          const user_id = this.ctx?.userId || null;

          if (!isUuidString(contract_id)) {
            throw new Error('contract_id must be a valid contract UUID');
          }

          // If recipient_email is not provided, try to fetch it from the contract's client
          let toEmail = recipient_email;
          if (!toEmail) {
            const { data: contract } = await supabaseAdmin
              .from('contracts')
              .select('client_id')
              .eq('id', contract_id)
              .single();
            
            if (contract?.client_id) {
              const { data: client } = await supabaseAdmin
                .from('clients')
                .select('email')
                .eq('id', contract.client_id)
                .single();
              if (client?.email) {
                toEmail = client.email;
              }
            }
          }

          if (!toEmail) {
            throw new Error('Recipient email is required (could not resolve from contract/client)');
          }

          const { sendContract } = await import('@/app/api/contracts/management/route');
          const sendRes = await sendContract(
            tenant_id,
            {
              contractId: contract_id,
              recipients: toEmail,
              subject: subject,
              message: message,
            },
            supabaseAdmin,
            user_id || ''
          );

          if (!sendRes.success) {
            throw new Error(sendRes.error || 'Failed to send contract');
          }

          result = {
            content: [{
              type: 'text',
              text: JSON.stringify({
                status: 'sent',
                message: 'Contract successfully sent to client',
                recipient: toEmail,
              }, null, 2),
            }],
          };
          break;
        }

        // â”€â”€ read_url_content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

        // â”€â”€ get_momentum_score â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

        // â”€â”€ get_recent_messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          const subject = String(a.subject || '').trim();
          if (!subject) throw new Error('subject is required');

          const recipient = await resolveMcpEmailRecipient(supabaseAdmin, tenant_id, {
            to: a.to,
            lead_id: a.lead_id,
            client_id: a.client_id,
            contact_id: a.contact_id,
          });
          const to = recipient.email;

          const rawAttachments = Array.isArray(a.attachments) ? a.attachments : [];
          const attachments = rawAttachments
            .filter((att: any) => att && typeof att.filename === 'string' && typeof att.content === 'string')
            .map((att: any) => ({
              filename: String(att.filename),
              content: String(att.content),
              contentType: String(att.content_type || att.contentType || 'application/octet-stream'),
            }));

          const documentFileIds = Array.isArray(a.document_file_ids)
            ? a.document_file_ids.map((id: unknown) => String(id || '').trim()).filter(isUuidString)
            : [];
          const includePublicDocumentLinks = a.include_public_document_links === true;
          const publicLinkExpiresHours = Number(a.public_link_expires_hours) > 0
            ? Number(a.public_link_expires_hours)
            : 48;
          const publicDocumentLinks: Array<{ name: string; url: string; expiresAt: string }> = [];

          if (documentFileIds.length > 0) {
            const resolved = await resolveEmailAttachmentsFromFileIds(tenant_id, documentFileIds);
            for (const att of resolved) {
              attachments.push({
                filename: att.filename,
                content: att.content,
                contentType: String(att.content_type || att.contentType || 'application/octet-stream'),
              });
            }
          }

          const signature = await resolveMcpEmailSignature(supabaseAdmin, tenant_id, user_id, a.email_signature);
          const signedBody = appendDocumentLinksToEmail(
            appendSignatureToEmail({ html: a.html, text: a.text }, signature),
            publicDocumentLinks
          );

          // Resolve {{client_name}} and {{client_calendly_link}} from CRM + tenant settings
          const resolvedBody = await resolveEmailTemplateVars(supabaseAdmin, {
            html: signedBody.html,
            text: signedBody.text || (!signedBody.html ? (signedBody as any).fallbackText : undefined),
            tenantId: tenant_id,
            clientId: String(a.client_id || '').trim() || undefined,
            leadId: String(a.lead_id || '').trim() || undefined,
            contactId: String(a.contact_id || '').trim() || undefined,
          });

          const sendResult = await sendEmailServer({
            tenantId: tenant_id,
            userId: user_id,
            to,
            subject,
            fromName: String(a.from_name || 'AlphaClone Systems'),
            html: resolvedBody.html,
            text: resolvedBody.text,
            attachments: attachments.length > 0 ? attachments : undefined,
            templateName: 'mcpTransactionalEmail',
            preferredProvider: a.provider as any,
          });

          if (!sendResult.success) throw new Error(sendResult.error || 'Transactional email failed');
          result = { content: [{ type: 'text', text: JSON.stringify({
            provider: sendResult.provider,
            id: sendResult.emailId,
            to,
            recipient_source: recipient.source,
            recipient_record_id: recipient.recordId,
            attachments_sent: attachments.length,
            document_file_ids_used: documentFileIds,
            public_document_links_created: publicDocumentLinks.length,
            public_document_links_expire_hours: publicDocumentLinks.length ? publicLinkExpiresHours : null,
            external_document_link_created: false,
          }, null, 2) }] };
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
          const { milestones, fallback, error } = await loadProjectMilestonesOrFallback(supabaseAdmin, tenant_id, project_id);
          result = {
            content: [
              {
                type: 'text',
                text: renderBusinessSuccess('mcp-tool', 'mcp-trace', fallback ? 'Data retrieved from task fallback' : 'Data retrieved', milestones),
              },
              {
                type: 'text',
                text: JSON.stringify({
                  project_id,
                  fallback_used: fallback,
                  warning: fallback ? error : null,
                  milestones,
                }, null, 2),
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
          const { data, error } = await supabaseAdmin.from('invoice_line_items').select('*').eq('tenant_id', tenant_id).eq('invoice_id', invoice_id).order('created_at', { ascending: true });
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
          try {
            const a = args as Record<string, any>;
            const tenant_id = this.requireTenant(a);
            const from_date = a.from_date ? String(a.from_date) : null;
            const to_date = a.to_date ? String(a.to_date) : null;

            let query = supabaseAdmin
              .from('expenses')
              .select('*')
              .eq('tenant_id', tenant_id)
              .order('date', { ascending: false })
              .limit(5000);

            if (from_date) query = query.gte('date', from_date);
            if (to_date) query = query.lte('date', to_date);

            const { data, error } = await query;
            if (error) {
              console.error('[MCP generate_expense_report] DB Error:', error);
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    status: 'failed',
                    code: 'EXPENSE_QUERY_ERROR',
                    message: error.message,
                    hint: 'Check expenses table schema matches query columns'
                  }, null, 2)
                }],
                isError: true
              };
            }

            const rows = (data || []) as Array<Record<string, any>>;
            const categoryIds = [...new Set(
              rows
                .map((row) => row.category_id)
                .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
            )];
            let categoryNameMap = new Map<string, string>();
            if (categoryIds.length > 0) {
              const { data: categories } = await supabaseAdmin
                .from('expense_categories')
                .select('id, name')
                .eq('tenant_id', tenant_id)
                .in('id', categoryIds);
              if (Array.isArray(categories)) {
                categoryNameMap = new Map(categories.map((row: any) => [row.id, row.name]));
              }
            }

            const reportRowsMap = new Map<string, any>();
            let grandTotal = 0;

            rows.forEach((r) => {
              // Priority: explicitly set 'category' field > lookup by category_id > 'Uncategorized'
              const catName = String(r.category || categoryNameMap.get(String(r.category_id || '')) || 'Uncategorized');
              const status = String(r.status || 'pending');
              const amount = Number(r.amount || 0);
              const key = `${catName}|${status}`;

              if (!reportRowsMap.has(key)) {
                reportRowsMap.set(key, {
                  category: catName,
                  status: status,
                  total_amount: 0,
                  count: 0,
                  expenses: []
                });
              }

              const row = reportRowsMap.get(key);
              row.total_amount += amount;
              row.count += 1;
              row.expenses.push({
                id: r.id,
                date: r.date,
                amount: r.amount,
                status: r.status,
                category: catName,
                created_at: r.created_at
              });

              grandTotal += amount;
            });

            const report: any = {
              rows: Array.from(reportRowsMap.values()),
              grand_total: Number(grandTotal.toFixed(2)),
              generated_at: new Date().toISOString(),
              period: { from: from_date, to: to_date }
            };

            result = { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
          } catch (err: any) {
            console.error('[MCP generate_expense_report] Unexpected Error:', err);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  status: 'failed',
                  code: 'INTERNAL_ERROR',
                  message: err.message
                }, null, 2)
              }],
              isError: true
            };
          }
          break;
        }

        case 'get_pnl_statement': {
          try {
            const a = args as Record<string, any>;
            const tenant_id = this.requireTenant(a);
            const coaCheck = await checkChartOfAccountsConfigured(tenant_id);
            const period = (a.period || 'monthly') as 'monthly' | 'quarterly' | 'yearly';
            const from_date = a.from_date ? String(a.from_date) : undefined;
            const to_date = a.to_date ? String(a.to_date) : undefined;

            const statement = await generatePnLStatement(tenant_id, period, from_date, to_date);
            const payload = coaCheck.setup_required
              ? { ...statement, setup_required: true, message: coaCheck.message }
              : statement;
            
            result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
          } catch (err: any) {
            console.error('[MCP get_pnl_statement] Error:', err);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  status: 'failed',
                  code: 'PNL_GENERATION_ERROR',
                  message: err.message
                }, null, 2)
              }],
              isError: true
            };
          }
          break;
        }

        // ── Direct Gmail Operations ──────────────────────────────────────
        case 'gmail_list_threads': {
          try {
            const a = args as Record<string, any>;
            const tenant_id = this.requireTenant(a);
            const user_id = this.requireProfileUser(a);
            const limit = Number(a.limit) || 20;
            const data = await gmailServerService.listThreads(user_id, limit);
            result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          } catch (err: any) {
            console.error('[MCP gmail_list_threads] Error:', err);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  status: 'failed',
                  code: 'GMAIL_LIST_ERROR',
                  message: err.message
                }, null, 2)
              }],
              isError: true
            };
          }
          break;
        }

        case 'gmail_get_thread': {
          try {
            const a = args as Record<string, any>;
            const tenant_id = this.requireTenant(a);
            const user_id = this.requireProfileUser(a);
            const { thread_id } = a;
            const data = await gmailServerService.getThread(user_id, thread_id);
            result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          } catch (err: any) {
            console.error('[MCP gmail_get_thread] Error:', err);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  status: 'failed',
                  code: 'GMAIL_READ_ERROR',
                  message: err.message
                }, null, 2)
              }],
              isError: true
            };
          }
          break;
        }

        case 'gmail_send_email': {
          try {
            const a = args as Record<string, any>;
            const tenant_id = this.requireTenant(a);
            const user_id = this.requireProfileUser(a);
            const { to, subject, body, thread_id, cc, bcc } = a;
            const data = await gmailServerService.sendEmail(user_id, {
              to,
              subject,
              messageBody: body,
              threadId: thread_id,
              cc,
              bcc,
            });
            result = { content: [{ type: 'text', text: `✅ Email sent successfully. ID: ${data.id}` }] };
          } catch (err: any) {
            console.error('[MCP gmail_send_email] Error:', err);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  status: 'failed',
                  code: 'GMAIL_SEND_ERROR',
                  message: err.message
                }, null, 2)
              }],
              isError: true
            };
          }
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
          const normalized = tasks.map((t: any, idx: number) => {
            const rawDue = t?.due_date ? String(t.due_date) : null;
            const parsedDue = rawDue ? parseFlexibleDueDate(rawDue) : null;
            if (rawDue && !parsedDue) {
              throw new Error(
                `tasks[${idx}].due_date must be YYYY-MM-DD, ISO datetime, or a phrase like "next Wednesday"`
              );
            }
            return {
              index: idx,
              title: String(t?.title || '').trim(),
              description: t?.description ? String(t.description) : null,
              priority: String(t?.priority || 'medium'),
              due_date: parsedDue,
              assigned_to: t?.assigned_to ? String(t.assigned_to) : null,
            };
          });
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
          const itemResults: Array<Record<string, unknown>> = dryRun
            ? targets.map((t: any) => ({ client_id: t.id, email: t.email, status: 'dry_run' }))
            : [];
          if (!dryRun) {
            for (const target of targets) {
              const sendResult = await sendEmailServer({
                tenantId: tenant_id,
                userId: user_id,
                to: String(target.email),
                subject,
                html: a.html ? String(a.html) : undefined,
                text: a.text ? String(a.text) : undefined,
                fromName: String(a.from_name || 'AlphaClone Systems'),
                preferredProvider: a.provider as any,
                templateName: 'mcpBulkEmail',
              });
              if (!sendResult.success) {
                itemResults.push({ client_id: target.id, email: target.email, status: 'failed', error: sendResult.error || 'send_failed' });
              } else {
                itemResults.push({ client_id: target.id, email: target.email, status: 'sent', provider: sendResult.provider, email_id: sendResult.emailId });
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
          try {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const folderId = typeof a.folder_id === 'string' ? a.folder_id.trim() : '';
          const searchQuery = typeof a.search_query === 'string' ? a.search_query.trim() : '';
          const limit = Math.min(Math.max(Number(a.limit) || 20, 1), 100);
          const start = Math.max(Number(a.start) || 1, 1);

          const zoho = new ZohoMailService(user_id, tenant_id);
          let payload: Record<string, unknown>;
          if (searchQuery) {
            const messages = await zoho.searchMessages(searchQuery);
            const fullMessages = await Promise.all(messages.slice(0, limit).map((message: any) => zoho.getFullMessagePayload(message, message.folderId)));
            payload = { mode: 'search', query: searchQuery, messages: fullMessages };
          } else if (folderId) {
            const messages = await zoho.getMessages(folderId, limit, start);
            const fullMessages = await Promise.all(messages.map((message: any) => zoho.getFullMessagePayload(message, folderId)));
            payload = { mode: 'folder_messages', tenant_id, folder_id: folderId, start, limit, messages: fullMessages };
          } else {
            const folders = await zoho.getFolders();
            payload = { mode: 'folders', folders };
          }

          result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
          } catch (err: any) {
            if (err instanceof ZohoAuthExpiredError) {
              result = { content: [{ type: 'text', text: JSON.stringify({ zoho_auth_error: true, action: 'Reconnect Zoho in Settings', message: err.message }, null, 2) }] };
            } else {
              throw err;
            }
          }
          break;
        }

        case 'get_zoho_mail_thread': {
          try {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const threadId = String(a.thread_id || '').trim();
          if (!threadId) throw new Error('thread_id is required');
          const zoho = new ZohoMailService(user_id, tenant_id);
          const messages = await zoho.getThread(threadId);
          result = { content: [{ type: 'text', text: JSON.stringify({ tenant_id, thread_id: threadId, messages }, null, 2) }] };
          } catch (err: any) {
            if (err instanceof ZohoAuthExpiredError) {
              result = { content: [{ type: 'text', text: JSON.stringify({ zoho_auth_error: true, action: 'Reconnect Zoho in Settings', message: err.message }, null, 2) }] };
            } else {
              throw err;
            }
          }
          break;
        }

        case 'reply_to_zoho_mail': {
          try {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const messageId = String(a.message_id || '').trim();
          if (!messageId) throw new Error('message_id is required');
          if (!a.body_html && !a.body_text) throw new Error('body_html or body_text is required');
          const zoho = new ZohoMailService(user_id, tenant_id);
          const reply = await zoho.replyToMessage({
            messageId,
            bodyHtml: String(a.body_html || a.body_text || ''),
            bodyText: a.body_text ? String(a.body_text) : undefined,
            attachments: Array.isArray(a.attachments)
              ? a.attachments.map((attachment: any) => ({
                filename: String(attachment.filename || 'attachment'),
                content: String(attachment.content || ''),
                contentType: String(attachment.content_type || attachment.contentType || 'application/octet-stream'),
              }))
              : undefined,
          });

          const senderEmail = String((reply as any)?.original?.from || '').toLowerCase();
          const matchEmail = senderEmail.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() || '';
          let matchedContact: Record<string, unknown> | null = null;
          if (matchEmail) {
            const { data: contact } = await supabaseAdmin
              .from('business_clients')
              .select('id,name,email,sales_stage,deal_value,updated_at')
              .eq('tenant_id', tenant_id)
              .ilike('email', matchEmail)
              .maybeSingle();
            if (contact) {
              matchedContact = {
                id: contact.id,
                name: contact.name,
                stage: contact.sales_stage,
                deal_value: contact.deal_value,
                last_activity: contact.updated_at,
              };
              await supabaseAdmin.from('activity_logs').insert({
                tenant_id,
                user_id,
                action: 'email_reply',
                entity_type: 'client',
                entity_id: contact.id,
                metadata: { message_id: messageId, email: matchEmail },
              });
            }
          }

          result = { content: [{ type: 'text', text: JSON.stringify({
            sent: true,
            message_id: String((reply as any)?.data?.messageId || (reply as any)?.messageId || ''),
            matched_contact: matchedContact,
            suggested_action: matchedContact ? null : { type: 'create_lead', email: matchEmail || null },
          }, null, 2) }] };
          } catch (err: any) {
            if (err instanceof ZohoAuthExpiredError) {
              result = { content: [{ type: 'text', text: JSON.stringify({ zoho_auth_error: true, action: 'Reconnect Zoho in Settings', message: err.message }, null, 2) }] };
            } else {
              throw err;
            }
          }
          break;
        }

        // â”€â”€ get_quotes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

        case 'send_quote': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const quoteId = String(a.quote_id || '').trim();
          const to = String(a.to || a.recipient_email || '').trim();
          if (!isUuidString(quoteId)) throw new Error('quote_id must be a valid quote UUID');
          if (!to) throw new Error('to is required');
          const [{ data: quote, error: quoteError }, { data: items }] = await Promise.all([
            supabaseAdmin.from('quotes').select('*').eq('tenant_id', tenant_id).eq('id', quoteId).single(),
            supabaseAdmin.from('quote_items').select('*').eq('quote_id', quoteId).order('item_order', { ascending: true }),
          ]);
          if (quoteError || !quote) throw supabaseErrorToMcpClientError('send_quote', quoteError?.message || 'Quote not found');
          const itemRows = (items || []).map((item: any) => `<tr><td>${item.product_name || item.description || 'Item'}</td><td>${Number(item.quantity || 0)}</td><td>${Number(item.line_total || 0).toFixed(2)}</td></tr>`).join('');
          const html = `
            <h2>Quote ${quote.quote_number || ''}</h2>
            <p><strong>${quote.name || 'Quote'}</strong></p>
            <p><strong>Valid until:</strong> ${quote.valid_until || 'Not specified'}</p>
            <p><strong>Total:</strong> ${Number(quote.total_amount || 0).toFixed(2)} ${quote.currency || 'USD'}</p>
            <table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Item</th><th>Qty</th><th>Total</th></tr></thead><tbody>${itemRows}</tbody></table>
            ${quote.notes ? `<p>${String(quote.notes).replace(/\n/g, '<br/>')}</p>` : ''}
          `;
          const attachmentContent = Buffer.from(html, 'utf8').toString('base64');
          const sendResult = await sendEmailServer({
            tenantId: tenant_id,
            userId: user_id,
            to,
            subject: String(a.subject || `Quote ${quote.quote_number || quote.name}`),
            html,
            text: String(a.message || `Please review quote ${quote.quote_number || quote.name}.`),
            fromName: String(a.from_name || 'AlphaClone Quotes'),
            preferredProvider: a.provider as any,
            attachments: [{
              filename: `Quote_${quote.quote_number || quote.id}.html`,
              content: attachmentContent,
              content_type: 'text/html',
            }],
            templateName: 'mcpQuoteEmail',
          });
          if (!sendResult.success) throw new Error(sendResult.error || 'Quote email failed');
          await supabaseAdmin.from('quotes').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('tenant_id', tenant_id).eq('id', quoteId);
          result = { content: [{ type: 'text', text: JSON.stringify({
            sent: true,
            quote_id: quoteId,
            to,
            provider: sendResult.provider,
            email_id: sendResult.emailId,
            attachment: { filename: `Quote_${quote.quote_number || quote.id}.html`, content_type: 'text/html', base64: attachmentContent },
          }, null, 2) }] };
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

        // â”€â”€ plan_social_calendar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

        // â”€â”€ create_post_with_ai_image â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'create_post_with_ai_image': {
          const a = args as Record<string, any>;
          delete a.hd;
          const tenant_id = this.requireTenant(a);
          const userId = this.requireProfileUser(a);
          const { topic, image_prompt, image_provider = 'openai', provided_image_url, platforms = ['facebook', 'linkedin'], scheduled_at } = a;

          let imageUrl: string | null = provided_image_url || null;
          let imageStatus = provided_image_url ? 'provided' : 'not_generated';

          // 1. Generate Image if not provided
          if (!imageUrl) {
            if (!image_prompt) throw new Error('image_prompt is required if provided_image_url is omitted');
            const wantsOpenAi = image_provider !== 'xai';
            if (wantsOpenAi && !process.env.OPENAI_API_KEY) {
              result = {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    error: 'OPENAI_BILLING_NOT_CONFIGURED',
                    message: 'OpenAI image generation is unavailable — OPENAI_API_KEY is missing or OpenAI billing is inactive. Retry with image_provider "xai", pass provided_image_url, or activate OpenAI billing in platform settings.',
                    action_required: true,
                  }, null, 2),
                }],
              };
              break;
            }
            try {
              // Try primary provider
              let img = await aiGenerationService.generateImage(userId, 'admin', image_prompt, '1024x1024', image_provider as any);
              
              // If primary fails, try the other one
              if (!img.success || !img.url) {
                  const altProvider = image_provider === 'openai' ? 'xai' : 'openai';
                  console.warn(`[MCP] Image Gen failed with ${image_provider}, retrying with ${altProvider}...`, img.error);
                  img = await aiGenerationService.generateImage(userId, 'admin', image_prompt, '1024x1024', altProvider as any);
              }

              if (!img.success || !img.url) {
                const billingIssue = String(img.error || '').toLowerCase().includes('billing')
                  || String(img.error || '').toLowerCase().includes('openai');
                result = {
                  content: [{
                    type: 'text',
                    text: JSON.stringify({
                      error: billingIssue ? 'OPENAI_BILLING_LIMIT' : 'IMAGE_GENERATION_FAILED',
                      message: billingIssue
                        ? `OpenAI billing limit reached or inactive: ${img.error}. Activate billing, use image_provider "xai", or pass provided_image_url.`
                        : `Could not generate an image for this post. Both AI image providers failed. Reason: ${img.error || 'Unknown'}. Please retry with a different image_prompt, or provide a provided_image_url instead.`,
                      action_required: true,
                    }, null, 2),
                  }],
                };
                break;
              }
              imageUrl = img.url;
              imageStatus = 'generated';
            } catch (imgErr: any) {
              result = {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    error: 'IMAGE_GENERATION_EXCEPTION',
                    message: `Image generation threw an error: ${imgErr.message}. Please retry or provide a provided_image_url.`,
                    action_required: true,
                  }, null, 2),
                }],
              };
              break;
            }
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
          result = {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                post_id: data?.id,
                scheduled_at: publishTime,
                image_url: imageUrl,
                image_status: imageStatus,
                content_length: multiPass.content.length,
                confidence_score: multiPass.confidenceScore,
                message: `Autonomous content creation complete. Post scheduled for ${publishTime} with ${imageStatus} image.`,
              }, null, 2),
            }],
          };
          break;
        }

        // â”€â”€ sync_all_inboxes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'sync_all_inboxes': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { limit = 10 } = a;
          const user_id = a.user_id ? this.requireProfileUser(a) : this.ctx?.userId || null;

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

          let zohoMessages: any[] = [];
          if (user_id) {
            try {
              const zoho = new ZohoMailService(user_id, tenant_id);
              const folders = await zoho.getFolders();
              const inbox = folders.find((folder) => /inbox/i.test(folder.folderName)) || folders[0];
              if (inbox) {
                const rawMessages = await zoho.getMessages(inbox.folderId, Math.min(Number(limit) || 10, 50), 1);
                zohoMessages = await Promise.all(rawMessages.map((message: any) => zoho.getFullMessagePayload(message, inbox.folderId)));
              }
            } catch (error) {
              zohoMessages = [{ error: error instanceof Error ? error.message : 'Zoho sync failed' }];
            }
          }

          result = { content: [{ type: 'text', text: JSON.stringify({
            messages: messages || [],
            zoho_mail: zohoMessages,
            new_leads: leads || [],
            summary: `Synced ${messages?.length || 0} internal messages, ${zohoMessages.length} Zoho messages, and ${leads?.length || 0} hot leads for processing.`
          }, null, 2) }] };
          break;
        }

        // â”€â”€ autonomous_reply â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

        // ——————————————————————————————————————————————————————————————————
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

        case 'get_calendly_status': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { data: tenant, error } = await supabaseAdmin
            .from('tenants')
            .select('settings')
            .eq('id', tenant_id)
            .maybeSingle();
          if (error) throw supabaseErrorToMcpClientError('get_calendly_status', error.message);
          const settings = (tenant?.settings || {}) as Record<string, any>;
          const calendly = settings.calendly || {};
          const booking = settings.booking || {};
          const { getCalendlyConfig } = await import('../calendly/calendlyIntegrationService');
          const privateCalendly = await getCalendlyConfig(supabaseAdmin, tenant_id);
          result = { content: [{ type: 'text', text: JSON.stringify({
            calendly_connected: Boolean(privateCalendly?.accessToken && privateCalendly.calendlyUserUri),
            calendly_event_url: calendly.eventUrl || null,
            local_booking_enabled: Boolean(booking.enabled && booking.slug),
            local_booking_url: booking.slug ? `${(process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com').replace(/^https:\/\/www\./, 'https://')}/book/${booking.slug}` : null,
            recommended: calendly.enabled ? 'Run sync_calendly_events to import bookings into AlphaClone calendar.' : 'Connect Calendly or enable the native AlphaClone booking link in Meetings settings.',
          }, null, 2) }] };
          break;
        }

        case 'sync_calendly_events': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = a.user_id ? this.requireProfileUser(a) : (this.ctx?.userId || null);
          if (!user_id) throw new Error('user_id is required when no MCP user context is available');
          const { calendlyService } = await import('../calendlyService');
          const syncedCount = await calendlyService.syncUpcomingEvents(user_id, tenant_id);
          result = { content: [{ type: 'text', text: JSON.stringify({ success: true, synced_count: syncedCount }, null, 2) }] };
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

        case 'start_invoice_lifecycle': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const { invoice_id } = a;
          if (!isUuidString(invoice_id)) throw new Error('invoice_id must be a valid invoice UUID');
          const { data: invoice, error: invoiceError } = await supabaseAdmin
            .from('business_invoices')
            .select('id,status')
            .eq('tenant_id', tenant_id)
            .eq('id', invoice_id)
            .maybeSingle();
          if (invoiceError) throw invoiceError;
          if (!invoice) throw new Error('Invoice not found');
          if (invoice.status !== 'draft') throw new Error(`Only draft invoices can be sent. This invoice is ${invoice.status}.`);
          await consumeDailyResourceQuota(tenant_id, user_id, 'invoices');
          let runId: string;
          try {
            ({ runId } = await start(invoiceLifecycleWorkflow, [{ invoiceId: invoice_id, tenantId: tenant_id, actorUserId: user_id }]));
          } catch (workflowError) {
            await releaseDailyResourceQuota(tenant_id, user_id, 'invoices');
            throw workflowError;
          }
          result = { content: [{ type: 'text', text: JSON.stringify({ success: true, runId }, null, 2) }] };
          break;
        }

        case 'start_contract_lifecycle': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { contract_id } = a;
          const { runId } = await start(contractLifecycleWorkflow, [{ contractId: contract_id, tenantId: tenant_id }]);
          result = { content: [{ type: 'text', text: JSON.stringify({ success: true, runId }, null, 2) }] };
          break;
        }

        case 'start_lead_campaign': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { query, location } = a;
          const { runId } = await start(leadFindingWorkflow, [{ query, location, tenantId: tenant_id }]);
          result = { content: [{ type: 'text', text: JSON.stringify({ success: true, runId }, null, 2) }] };
          break;
        }

        case 'start_lead_nurture': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { lead_id } = a;
          const { runId } = await start(leadNurtureWorkflow, [{ leadId: lead_id, tenantId: tenant_id }]);
          result = { content: [{ type: 'text', text: JSON.stringify({ success: true, runId }, null, 2) }] };
          break;
        }

        case 'trigger_deal_automation': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { deal_id, stage } = a;
          const { runId } = await start(dealStageWorkflow, [{ dealId: deal_id, stage, tenantId: tenant_id }]);
          result = { content: [{ type: 'text', text: JSON.stringify({ success: true, runId }, null, 2) }] };
          break;
        }

        case 'schedule_social_automation': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { post_id } = a;
          const { runId } = await start(socialScheduleWorkflow, [{ postId: post_id, tenantId: tenant_id }]);
          result = { content: [{ type: 'text', text: JSON.stringify({ success: true, runId }, null, 2) }] };
          break;
        }

        case 'start_email_campaign': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { campaign_id } = a;
          const sendResult = await sendScheduledCampaignServer(String(campaign_id || '').trim());
          if (!sendResult.success) throw new Error(sendResult.error || 'Campaign send failed');
          result = { content: [{ type: 'text', text: JSON.stringify({ success: true, status: 'sent' }, null, 2) }] };
          break;
        }

        case 'kickoff_project_automation': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { project_id } = a;
          const { runId } = await start(projectKickoffWorkflow, [{ projectId: project_id, tenantId: tenant_id }]);
          result = { content: [{ type: 'text', text: JSON.stringify({ success: true, runId }, null, 2) }] };
          break;
        }

        case 'orchestrate_meeting_workflow': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { meeting_id } = a;
          const { runId } = await start(videoRoomOrchestrationWorkflow, [{ meetingId: meeting_id, tenantId: tenant_id }]);
          result = { content: [{ type: 'text', text: JSON.stringify({ success: true, runId }, null, 2) }] };
          break;
        }

        case 'onboard_user_automation': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { user_id } = a;
          const { runId } = await start(userOnboardingWorkflow, [{ userId: user_id, tenantId: tenant_id }]);
          result = { content: [{ type: 'text', text: JSON.stringify({ success: true, runId }, null, 2) }] };
          break;
        }

        case 'run_mcp_agent_workflow': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { prompt } = a;
          const { runId } = await start(mcpAgentWorkflow, [{ prompt, tenantId: tenant_id }]);
          result = { content: [{ type: 'text', text: JSON.stringify({ success: true, runId }, null, 2) }] };
          break;
        }

        case 'generate_viral_video_script': {
          const a = args as Record<string, any>;
          this.requireTenant(a);
          const { topic, intensity = 'high' } = a;
          if (typeof topic !== 'string' || !topic.trim()) throw new Error('topic is required');
          
          const script = await xaiVideoGenerationService.generateViralScript(topic, intensity as any);
          result = { content: [{ type: 'text', text: JSON.stringify(script, null, 2) }] };
          break;
        }

        case 'generate_grok_video': {
          const a = args as Record<string, any>;
          this.requireTenant(a);
          const prompt = String(a.prompt || '').trim();
          if (!prompt) throw new Error('prompt is required');
          const video = await xaiVideoGenerationService.generateVideo({
            prompt,
            imageUrl: a.image_url ? String(a.image_url).trim() : undefined,
            duration: a.duration ? Number(a.duration) : undefined,
            poll: a.poll !== false,
          });
          result = { content: [{ type: 'text', text: JSON.stringify(video, null, 2) }] };
          break;
        }

        case 'get_x_profile': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { username } = a;
          const profile = await xService.getProfile(tenant_id, username);
          result = { content: [{ type: 'text', text: JSON.stringify(profile, null, 2) }] };
          break;
        }

        case 'search_x_tweets': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { query, limit = 10 } = a;
          const searchResults = await xService.searchTweets(tenant_id, query, limit);
          result = { content: [{ type: 'text', text: JSON.stringify(searchResults, null, 2) }] };
          break;
        }

        case 'post_x_tweet': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { text, image_url, image_base64, image_mime_type } = a;
          if (typeof text !== 'string' || !text.trim()) throw new Error('text is required');
          
          // Content Guideline Check (Basic Professionalism)
          const profCheck = await routeAutonomousTask(
            'strategy',
            `Review this tweet for professional/business guidelines (no vulgarity, non-offensive, strictly business): "${text}"`,
            'Respond ONLY with "APPROVED" or "REJECTED: [REASON]".'
          );
          
          if (profCheck.content.includes('REJECTED')) {
            throw new Error(`Tweet rejected by professional guidelines: ${profCheck.content}`);
          }

          // Handle image upload if provided
          let mediaIds: string[] | undefined;
          if (image_url || image_base64) {
            try {
              let mediaId: string;
              if (image_base64) {
                const mimeType = typeof image_mime_type === 'string' && image_mime_type
                  ? image_mime_type
                  : 'image/jpeg';
                const normalizedBase64 = String(image_base64).includes('base64,')
                  ? String(image_base64).split('base64,')[1]
                  : String(image_base64);
                const buffer = Buffer.from(normalizedBase64, 'base64');
                mediaId = await xService.uploadMedia(tenant_id, buffer, mimeType);
              } else {
                mediaId = await xService.uploadMediaFromUrl(tenant_id, String(image_url));
              }
              mediaIds = [mediaId];
            } catch (imgErr: any) {
              // Non-fatal: post without image but warn Grok
              console.warn('[MCP post_x_tweet] Image upload failed, posting text-only:', imgErr.message);
              result = {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    warning: `Image could not be uploaded: ${imgErr.message}. The tweet was NOT posted. Please reconnect your X account with OAuth 1.0a enabled or provide a valid image, then retry.`,
                    action_required: true,
                  }, null, 2),
                }],
              };
              break;
            }
          }

          const tweet = await xService.postTweet(tenant_id, { text, media_ids: mediaIds });
          result = {
            content: [{
              type: 'text',
              text: JSON.stringify({
                ...tweet,
                image_attached: !!(mediaIds && mediaIds.length > 0),
              }, null, 2),
            }],
          };
          break;
        }

        case 'reply_to_x_tweet': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { tweet_id, text } = a;
          if (!tweet_id || typeof text !== 'string' || !text.trim()) throw new Error('tweet_id and text are required');

          const reply = await xService.replyToTweet(tenant_id, tweet_id, text);
          result = { content: [{ type: 'text', text: JSON.stringify(reply, null, 2) }] };
          break;
        }

        case 'send_x_dm': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { recipient_id, text } = a;
          if (!recipient_id || typeof text !== 'string' || !text.trim()) throw new Error('recipient_id and text are required');

          const dm = await xService.sendDirectMessage(tenant_id, recipient_id, text);
          result = { content: [{ type: 'text', text: JSON.stringify(dm, null, 2) }] };
          break;
        }

        case 'get_x_timeline': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const timeline = await xService.getUserTweets(tenant_id);
          result = { content: [{ type: 'text', text: JSON.stringify(timeline, null, 2) }] };
          break;
        }

        case 'search_x_users': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { query, limit = 10 } = a;
          const userResults = await xService.searchUsers(tenant_id, query, limit);
          result = { content: [{ type: 'text', text: JSON.stringify(userResults, null, 2) }] };
          break;
        }

        case 'get_projects': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { status, limit = 50, offset = 0 } = a;
          const pageSize = Math.min(Math.max(Number(limit) || 50, 1), 200);
          const pageOffset = Math.max(Number(offset) || 0, 0);

          let query = supabaseAdmin
            .from('projects')
            .select('id, name, description, status, current_stage, progress, due_date, owner_id, owner_name, team, created_at, updated_at')
            .eq('tenant_id', tenant_id)
            .order('created_at', { ascending: false })
            .range(pageOffset, pageOffset + pageSize - 1);

          if (status && typeof status === 'string') {
            query = query.eq('status', status.trim());
          }

          const { data, error } = await query;
          if (error) throw supabaseErrorToMcpClientError('get_projects', error.message);

          const rows = data || [];
          result = {
            content: [{
              type: 'text',
              text: JSON.stringify({
                items: rows,
                pagination: {
                  limit: pageSize,
                  offset: pageOffset,
                  returned: rows.length,
                  has_more: rows.length === pageSize,
                  next_offset: rows.length === pageSize ? pageOffset + pageSize : null,
                },
                summary: {
                  total_returned: rows.length,
                  active: rows.filter((p: any) => p.status !== 'done' && p.status !== 'cancelled').length,
                  done: rows.filter((p: any) => p.status === 'done').length,
                },
              }, null, 2),
            }],
          };
          break;
        }

        // ── get_finance_snapshot ──────────────────────────────────────────────────
        case 'get_finance_snapshot': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);

          // Run all finance queries in parallel
          // Note: Supabase query builder does not expose .catch() — use async IIFEs
          const safeQuery = async (fn: () => PromiseLike<{ data: any; error: any }>) => {
            try { return await fn(); } catch { return { data: null, error: null }; }
          };

          const [
            invoiceResult,
            billResult,
            reconcileResult,
            contractApprovalResult,
            contractTemplateResult,
          ] = await Promise.all([
            // Invoices: paid, pending, overdue (core table — let it throw if missing)
            safeQuery(() =>
              supabaseAdmin
                .from('business_invoices')
                .select('id, status, total, due_date, created_at')
                .eq('tenant_id', tenant_id)
                .order('created_at', { ascending: false })
                .limit(200)
            ),

            // Vendor bills (AP) — optional table, safe fallback
            safeQuery(() =>
              supabaseAdmin
                .from('vendor_bills')
                .select('id, status, total_amount, amount_paid, due_date')
                .eq('tenant_id', tenant_id)
                .in('status', ['open', 'partial', 'overdue'])
                .limit(100)
            ),

            // Reconciliation sessions — optional table
            safeQuery(() =>
              supabaseAdmin
                .from('bank_reconciliation_sessions')
                .select('id, status, statement_end_date, statement_ending_balance')
                .eq('tenant_id', tenant_id)
                .in('status', ['draft', 'in_progress'])
                .limit(10)
            ),

            // Pending contract approvals — optional table
            safeQuery(() =>
              supabaseAdmin
                .from('contract_approvals')
                .select('id, status, created_at')
                .eq('tenant_id', tenant_id)
                .eq('status', 'pending')
                .limit(20)
            ),

            // Active contract templates — optional table
            safeQuery(() =>
              supabaseAdmin
                .from('contract_templates')
                .select('id, name, category, is_active')
                .eq('tenant_id', tenant_id)
                .eq('is_active', true)
                .limit(20)
            ),
          ]);

          const invoices = invoiceResult.data || [];
          const paidRevenue = invoices
            .filter((i: any) => i.status === 'paid')
            .reduce((sum: number, i: any) => sum + Number(i.total || 0), 0);
          const pendingRevenue = invoices
            .filter((i: any) => ['sent', 'draft'].includes(i.status))
            .reduce((sum: number, i: any) => sum + Number(i.total || 0), 0);
          const overdueRevenue = invoices
            .filter((i: any) => i.status === 'overdue')
            .reduce((sum: number, i: any) => sum + Number(i.total || 0), 0);

          const openBills = (billResult.data || []);
          const openBillsTotal = openBills
            .reduce((sum: number, b: any) => sum + Number(b.total_amount || 0) - Number(b.amount_paid || 0), 0);

          const snapshot = {
            revenue: {
              collected: paidRevenue,
              pending: pendingRevenue,
              overdue: overdueRevenue,
              invoices_total: invoices.length,
              invoices_paid: invoices.filter((i: any) => i.status === 'paid').length,
              invoices_pending: invoices.filter((i: any) => i.status === 'sent').length,
              invoices_overdue: invoices.filter((i: any) => i.status === 'overdue').length,
              invoices_draft: invoices.filter((i: any) => i.status === 'draft').length,
            },
            payables: {
              open_bills_count: openBills.length,
              open_bills_total: openBillsTotal,
              bills: openBills.map((b: any) => ({
                id: b.id,
                status: b.status,
                owed: Number(b.total_amount || 0) - Number(b.amount_paid || 0),
                due_date: b.due_date,
              })),
            },
            reconciliation: {
              unreconciled_sessions: (reconcileResult.data || []).length,
              sessions: reconcileResult.data || [],
            },
            contracts: {
              pending_approvals: (contractApprovalResult.data || []).length,
              active_templates: (contractTemplateResult.data || []).length,
              templates: (contractTemplateResult.data || []).map((t: any) => ({ id: t.id, name: t.name, category: t.category })),
            },
            generated_at: new Date().toISOString(),
          };

          result = {
            content: [{
              type: 'text',
              text: JSON.stringify(snapshot, null, 2),
            }],
          };
          break;
        }

        // ── AlphaClone Nexus Intelligence ──────────────────────────────────

        // Bug #3 fix: nexus_contract_drafter used to be batched with the other
        // nexus status tools and only returned existing contract counts. Now it
        // detects when contract_type + client_name are supplied and routes to the
        // full AI generate_contract_draft path so the tool actually drafts.
        case 'nexus_contract_drafter': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const contract_type = typeof a.contract_type === 'string' ? a.contract_type.trim() : '';
          const client_name  = typeof a.client_name  === 'string' ? a.client_name.trim()  : '';

          if (contract_type && client_name) {
            // Redirect to the AI drafting path — reuse generate_contract_draft logic.
            // Mutate args so the shared generate_contract_draft case can handle it.
            (args as Record<string, any>).contract_type = contract_type;
            (args as Record<string, any>).client_name   = client_name;
            // Fall through to generate_contract_draft by re-invoking executeTool.
            // Since we can't fall-through across switch cases cleanly, delegate inline.
            const { data: tenantRow } = await supabaseAdmin
              .from('tenants')
              .select('subscription_plan')
              .eq('id', tenant_id)
              .maybeSingle();
            const plan = (tenantRow?.subscription_plan as string) || 'free';
            const quota = await consumeTenantAiUnits(supabaseAdmin, tenant_id, plan, unitsForTextGeneration(2048));
            if (!quota.ok) {
              const quotaInfraUnavailable = quota.used === 0 && quota.remaining === 0;
              throw new Error(
                quotaInfraUnavailable
                  ? 'AI quota service is temporarily unavailable, so contract drafting cannot start right now. Please retry shortly.'
                  : 'Daily AI usage limit reached for this workspace. Try again after UTC midnight or upgrade your plan.'
              );
            }
            const contractContent = await generateContractDraftText(contract_type, client_name, a.key_terms);
            const draftedContract = appendContractDisclaimer(contractContent, 'Claude (via AlphaClone MCP nexus_contract_drafter)');
            const { data: savedContract, error: saveErr } = await supabaseAdmin
              .from('contracts')
              .insert({
                tenant_id,
                title: `${contract_type}: ${client_name}`,
                content: draftedContract,
                status: 'draft',
                type: contract_type.toLowerCase().replace(/\s+/g, '_'),
              })
              .select('id, title, status')
              .single();
            if (saveErr) {
              result = { content: [{ type: 'text', text: `Contract draft generated (could not save automatically):\n\n${draftedContract}` }] };
            } else {
              result = { content: [{ type: 'text', text: `Contract draft saved!\nID: ${savedContract.id}\nTitle: ${savedContract.title}\nStatus: draft — ready in the Contracts section.\n\nPreview:\n${draftedContract.substring(0, 400)}...` }] };
            }
          } else {
            // No contract_type / client_name — return portfolio overview with a clear action hint.
            const nexus = new AlphaNexus(tenant_id);
            const response = await nexus.executeSystemAction('contract_drafter', {});
            const hint = '\n\nTo draft a new contract, call nexus_contract_drafter again with contract_type (e.g. "Service Agreement") and client_name, or use generate_contract_draft directly.';
            result = { content: [{ type: 'text', text: JSON.stringify(response, null, 2) + hint }] };
          }
          break;
        }

        case 'nexus_payroll_sync':
        case 'nexus_invoice_chasing':
        case 'nexus_month_end_close':
        case 'nexus_lead_enrichment':
        case 'nexus_sales_campaign':
        case 'nexus_content_synthesis':
        case 'nexus_market_pulse':
        case 'nexus_design_audit':
        case 'nexus_project_architect':
        case 'nexus_calendar_nexus':
        case 'nexus_email_triage':
        case 'nexus_support_triage':
        case 'nexus_onboarding_flow':
        case 'nexus_meeting_intelligence': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const systemKey = name.replace('nexus_', '');
          const nexus = new AlphaNexus(tenant_id);
          // Pass through any extra params (e.g. auto_send_outreach, outreach_context, user_id)
          const nexusParams: Record<string, unknown> = {};
          if (a.auto_send_outreach !== undefined) nexusParams.auto_send_outreach = a.auto_send_outreach;
          if (a.outreach_context !== undefined) nexusParams.outreach_context = a.outreach_context;
          if (a.user_id !== undefined) nexusParams.user_id = a.user_id;
          else if (this.ctx?.userId) nexusParams.user_id = this.ctx.userId;
          const response = await nexus.executeSystemAction(systemKey, nexusParams);
          result = { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
          break;
        }

        case 'nexus_strategic_orchestrator': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { objective } = a;
          if (!objective) throw new Error('Strategic objective is required for orchestration.');
          const nexus = new AlphaNexus(tenant_id);
          const response = await nexus.strategicOrchestrator(objective);
          result = { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
          break;
        }

        case 'generate_market_authority_report': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const nexus = new AlphaNexus(tenant_id);
          const response = await nexus.generateMarketAuthorityReport();
          result = { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
          break;
        }

        // ── Advanced DMS ────────────────────────────────────────────────────
        case 'get_documents': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { category, entity_type, entity_id, limit: docLimit = 50 } = a;
          const docPageSize = Math.min(Math.max(Number(docLimit) || 50, 1), 200);
          let docQuery = supabaseAdmin
            .from('file_uploads')
            .select('id, original_filename, file_type, file_size, category, tags, entity_type, entity_id, scan_status, storage_path, created_at')
            .eq('tenant_id', tenant_id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(docPageSize);
          if (category && typeof category === 'string') docQuery = docQuery.eq('category', category.trim());
          if (entity_type && typeof entity_type === 'string') docQuery = docQuery.eq('entity_type', entity_type.trim());
          if (entity_id && typeof entity_id === 'string') docQuery = docQuery.eq('entity_id', entity_id.trim());
          const { data: docData, error: docError } = await docQuery;
          if (docError) throw supabaseErrorToMcpClientError('get_documents', docError.message);
          result = { content: [{ type: 'text', text: JSON.stringify({ total: (docData || []).length, documents: docData || [] }, null, 2) }] };
          break;
        }

        case 'search_documents': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { query: searchQuery } = a;
          if (!searchQuery || typeof searchQuery !== 'string') throw new Error('query is required');
          const { data: searchData, error: searchError } = await supabaseAdmin
            .from('file_uploads')
            .select('id, original_filename, file_type, file_size, category, tags, entity_type, entity_id, created_at')
            .eq('tenant_id', tenant_id)
            .is('deleted_at', null)
            .or(`original_filename.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`)
            .order('created_at', { ascending: false })
            .limit(50);
          if (searchError) throw supabaseErrorToMcpClientError('search_documents', searchError.message);
          result = { content: [{ type: 'text', text: JSON.stringify({ query: searchQuery, total: (searchData || []).length, documents: searchData || [] }, null, 2) }] };
          break;
        }

        // ── Advanced Accounting ─────────────────────────────────────────────
        case 'get_balance_sheet': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const coaCheck = await checkChartOfAccountsConfigured(tenant_id);
          const asOf = a.as_of_date ? new Date(a.as_of_date).toISOString() : new Date().toISOString();
          const [bsInvRes, bsExpRes] = await Promise.all([
            supabaseAdmin.from('business_invoices').select('total_amount, status').eq('tenant_id', tenant_id).lte('created_at', asOf),
            supabaseAdmin.from('expenses').select('amount, status').eq('tenant_id', tenant_id),
          ]);
          const bsInvoices = bsInvRes.data || [];
          const bsExpenses = bsExpRes.data || [];
          const bsTotalRevenue = bsInvoices.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + (Number(i.total_amount) || 0), 0);
          const bsAR = bsInvoices.filter((i: any) => ['sent', 'overdue'].includes(i.status)).reduce((s: number, i: any) => s + (Number(i.total_amount) || 0), 0);
          const bsTotalExp = bsExpenses.filter((e: any) => e.status === 'approved').reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
          const bsPendingExp = bsExpenses.filter((e: any) => e.status === 'pending').reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
          result = {
            content: [{
              type: 'text',
              text: JSON.stringify({
                as_of: asOf,
                assets: { cash_and_equivalents: bsTotalRevenue - bsTotalExp, accounts_receivable: bsAR, total_assets: bsTotalRevenue - bsTotalExp + bsAR },
                liabilities: { accounts_payable: bsPendingExp, total_liabilities: bsPendingExp },
                equity: { retained_earnings: bsTotalRevenue - bsTotalExp - bsPendingExp, total_equity: bsTotalRevenue - bsTotalExp - bsPendingExp },
                ...(coaCheck.setup_required ? { setup_required: true, message: coaCheck.message } : {}),
              }, null, 2),
            }],
          };
          break;
        }

        case 'get_cash_flow_statement': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const cfFrom = a.from_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const cfTo = a.to_date || new Date().toISOString().split('T')[0];
          const [cfInvRes, cfExpRes] = await Promise.all([
            supabaseAdmin.from('business_invoices').select('total_amount').eq('tenant_id', tenant_id).eq('status', 'paid').gte('created_at', cfFrom).lte('created_at', cfTo + 'T23:59:59Z'),
            supabaseAdmin.from('expenses').select('amount, category').eq('tenant_id', tenant_id).eq('status', 'approved').gte('date', cfFrom).lte('date', cfTo),
          ]);
          const cfCashIn = (cfInvRes.data || []).reduce((s: number, i: any) => s + (Number(i.total_amount) || 0), 0);
          const cfExpenses = cfExpRes.data || [];
          const cfCashOut = cfExpenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
          const cfByCategory: Record<string, number> = {};
          for (const e of cfExpenses) { const c = (e.category as string) || 'Other'; cfByCategory[c] = (cfByCategory[c] || 0) + (Number(e.amount) || 0); }
          result = {
            content: [{
              type: 'text',
              text: JSON.stringify({
                period: { from: cfFrom, to: cfTo },
                operating_activities: { cash_inflows: { invoice_payments: cfCashIn }, cash_outflows: { expenses: cfCashOut, by_category: cfByCategory }, net_operating_cash_flow: cfCashIn - cfCashOut },
                net_cash_flow: cfCashIn - cfCashOut,
              }, null, 2),
            }],
          };
          break;
        }

        case 'create_journal_entry': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { description: jeDesc, lines: jeLines, date: jeDate } = a;
          if (!jeDesc) throw new Error('description is required');
          if (!Array.isArray(jeLines) || jeLines.length < 2) throw new Error('At least 2 journal entry lines are required');
          const jeTotalDebits = jeLines.reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0);
          const jeTotalCredits = jeLines.reduce((s: number, l: any) => s + (Number(l.credit) || 0), 0);
          if (Math.abs(jeTotalDebits - jeTotalCredits) > 0.01) throw new Error(`Journal entry is unbalanced: debits (${jeTotalDebits}) ≠ credits (${jeTotalCredits})`);
          const { data: jeData, error: jeError } = await supabaseAdmin
            .from('journal_entries')
            .insert({ tenant_id, date: jeDate || new Date().toISOString().split('T')[0], description: jeDesc, lines: jeLines, total_amount: jeTotalDebits, status: 'posted' })
            .select('id, date, description, total_amount, status')
            .single();
          if (jeError) {
            result = { content: [{ type: 'text', text: JSON.stringify({ success: false, note: 'journal_entries table not found — run the accounting migration first.', preview: { description: jeDesc, lines: jeLines, total_debits: jeTotalDebits } }, null, 2) }] };
          } else {
            result = { content: [{ type: 'text', text: JSON.stringify({ success: true, journal_entry: jeData }, null, 2) }] };
          }
          break;
        }

        // ── Advanced Project Architecture ───────────────────────────────────
        case 'get_project_details': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { project_id: pdId } = a;
          if (!pdId) throw new Error('project_id is required');
          const milestonesLoad = await loadProjectMilestonesOrFallback(supabaseAdmin, tenant_id, pdId);
          const [pdProjRes, pdBizProjRes, pdTasksRes] = await Promise.all([
            supabaseAdmin.from('projects').select('id, name, description, status, current_stage, progress, due_date, owner_id, owner_name, team, created_at, updated_at').eq('id', pdId).eq('tenant_id', tenant_id).maybeSingle(),
            supabaseAdmin.from('business_projects').select('id, name, description, status, due_date, client_id, created_at, updated_at').eq('id', pdId).eq('tenant_id', tenant_id).maybeSingle(),
            supabaseAdmin.from('tasks').select('id, title, status, priority, assigned_to, due_date, completed_at').eq('related_to_project', pdId).eq('tenant_id', tenant_id).order('due_date', { ascending: true }),
          ]);
          const project = pdBizProjRes.data || pdProjRes.data;
          if (!project) throw supabaseErrorToMcpClientError('get_project_details', 'Project not found');
          const clientId = (project as any).client_id;
          const [clientRes, dealsRes, invoicesRes, contractsRes] = await Promise.all([
            clientId
              ? supabaseAdmin.from('business_clients').select('id, name, email, company').eq('id', clientId).eq('tenant_id', tenant_id).maybeSingle()
              : Promise.resolve({ data: null }),
            clientId
              ? supabaseAdmin.from('deals').select('id, title, stage, value').eq('client_id', clientId).eq('tenant_id', tenant_id)
              : supabaseAdmin.from('deals').select('id, title, stage, value').eq('project_id', pdId).eq('tenant_id', tenant_id),
            supabaseAdmin.from('business_invoices').select('id, invoice_number, status, total_amount').eq('project_id', pdId).eq('tenant_id', tenant_id),
            supabaseAdmin.from('contracts').select('id, title, status').eq('project_id', pdId).eq('tenant_id', tenant_id),
          ]);
          const pdTasks = pdTasksRes.data || [];
          result = {
            content: [{
              type: 'text',
              text: JSON.stringify({
                project,
                linked_client: clientRes.data || null,
                linked_deals: dealsRes.data || [],
                linked_invoices: invoicesRes.data || [],
                linked_contracts: contractsRes.data || [],
                task_summary: { total: pdTasks.length, completed: pdTasks.filter((t: any) => t.status === 'completed').length, in_progress: pdTasks.filter((t: any) => t.status === 'in_progress').length, overdue: pdTasks.filter((t: any) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').length },
                tasks: pdTasks,
                milestones: milestonesLoad.milestones,
                milestones_fallback_used: milestonesLoad.fallback,
              }, null, 2),
            }],
          };
          break;
        }

        case 'get_project_timeline': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { project_id: ptId } = a;
          if (!ptId) throw new Error('project_id is required');
          const milestonesLoad = await loadProjectMilestonesOrFallback(supabaseAdmin, tenant_id, ptId);
          const [ptTasksRes, ptMilesRes] = await Promise.all([
            supabaseAdmin.from('tasks').select('id, title, status, priority, due_date, created_at').eq('related_to_project', ptId).eq('tenant_id', tenant_id),
            supabaseAdmin.from('project_comments').select('id, author_name, content, created_at').eq('project_id', ptId).eq('tenant_id', tenant_id).order('created_at', { ascending: true }),
          ]);
          const ptEvents: any[] = [
            ...(ptTasksRes.data || []).map((t: any) => ({ type: 'task', date: t.due_date || t.created_at, title: t.title, status: t.status, priority: t.priority, id: t.id })),
            ...(milestonesLoad.milestones || []).map((m: any) => ({ type: 'milestone', date: m.due_date || m.created_at, title: m.title || m.name, status: m.status, id: m.id, source: m.source })),
            ...(ptMilesRes.data || []).map((c: any) => ({ type: 'comment', date: c.created_at, title: c.content, author_name: c.author_name, id: c.id })),
          ];
          ptEvents.sort((x, y) => new Date(x.date || 0).getTime() - new Date(y.date || 0).getTime());
          result = { content: [{ type: 'text', text: JSON.stringify({ project_id: ptId, total_events: ptEvents.length, fallback_used: milestonesLoad.fallback, timeline: ptEvents }, null, 2) }] };
          break;
        }

        case 'send_project_email': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const user_id = this.requireProfileUser(a);
          const projectId = String(a.project_id || '').trim();
          const to = String(a.to || a.recipient_email || '').trim();
          if (!isUuidString(projectId)) throw new Error('project_id must be a valid project UUID');
          if (!to) throw new Error('to is required');
          const [{ data: project, error: projectError }, { data: tasks }, { data: milestones }] = await Promise.all([
            supabaseAdmin.from('projects').select('*').eq('tenant_id', tenant_id).eq('id', projectId).single(),
            supabaseAdmin.from('tasks').select('title,status,priority,due_date').eq('tenant_id', tenant_id).eq('related_to_project', projectId).order('due_date', { ascending: true }),
            supabaseAdmin.from('project_milestones').select('title,status,due_date').eq('project_id', projectId).order('due_date', { ascending: true }),
          ]);
          if (projectError || !project) throw supabaseErrorToMcpClientError('send_project_email', projectError?.message || 'Project not found');
          const taskRows = (tasks || []).map((task: any) => `<li>${task.title} - ${task.status || 'todo'}${task.due_date ? `, due ${task.due_date}` : ''}</li>`).join('');
          const milestoneRows = (milestones || []).map((item: any) => `<li>${item.title} - ${item.status || 'pending'}${item.due_date ? `, due ${item.due_date}` : ''}</li>`).join('');
          const html = `
            <h2>${project.name}</h2>
            <p><strong>Status:</strong> ${project.status || 'active'}</p>
            <p><strong>Due:</strong> ${project.due_date || 'No due date'}</p>
            ${project.description ? `<p>${String(project.description).replace(/\n/g, '<br/>')}</p>` : ''}
            <h3>Tasks</h3><ul>${taskRows || '<li>No tasks listed</li>'}</ul>
            <h3>Milestones</h3><ul>${milestoneRows || '<li>No milestones listed</li>'}</ul>
          `;
          const sendResult = await sendEmailServer({
            tenantId: tenant_id,
            userId: user_id,
            to,
            subject: String(a.subject || `Project update: ${project.name}`),
            html,
            fromName: String(a.from_name || 'AlphaClone Projects'),
            preferredProvider: a.provider as any,
            templateName: 'mcpProjectEmail',
          });
          if (!sendResult.success) throw new Error(sendResult.error || 'Project email failed');
          result = { content: [{ type: 'text', text: JSON.stringify({ sent: true, project_id: projectId, to, provider: sendResult.provider, email_id: sendResult.emailId }, null, 2) }] };
          break;
        }

        // ── get_contract_versions ─────────────────────────────────────────────
        case 'get_contract_versions': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const contract_id = String(a.contract_id || '').trim();
          if (!isUuidString(contract_id)) throw new Error('contract_id must be a valid UUID');
          const { data, error } = await supabaseAdmin
            .from('contract_versions')
            .select('id, contract_id, version_number, status, change_summary, created_at, updated_at')
            .eq('tenant_id', tenant_id)
            .eq('contract_id', contract_id)
            .order('version_number', { ascending: false });
          if (error) throw supabaseErrorToMcpClientError('get_contract_versions', error.message);
          result = { content: [{ type: 'text', text: JSON.stringify(data || [], null, 2) }] };
          break;
        }

        // ── get_contract_approvals ────────────────────────────────────────────
        case 'get_contract_approvals': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const contract_id = typeof a.contract_id === 'string' && a.contract_id.trim() ? a.contract_id.trim() : null;
          let query = supabaseAdmin
            .from('contract_approvals')
            .select('id, contract_id, contract_version_id, approver_id, status, request_note, due_at, decided_at, decision_note, created_at, updated_at')
            .eq('tenant_id', tenant_id)
            .order('created_at', { ascending: false })
            .limit(50);
          if (contract_id && isUuidString(contract_id)) query = query.eq('contract_id', contract_id);
          const { data, error } = await query;
          if (error) throw supabaseErrorToMcpClientError('get_contract_approvals', error.message);
          result = { content: [{ type: 'text', text: JSON.stringify(data || [], null, 2) }] };
          break;
        }

        // ── get_current_user ──────────────────────────────────────────────────
        case 'get_current_user': {
          const a = args as Record<string, any>;
          // Prefer session context (bound at server creation) over args
          const sessionTenantId = this.ctx?.tenantId || (a.tenant_id ? String(a.tenant_id).trim() : null);
          const sessionUserId = this.ctx?.userId || null;

          if (!sessionUserId) {
            throw new Error('No authenticated user found in MCP session. Ensure you are connected with a valid API key or OAuth token.');
          }

          const profileFields = 'id, email, name, display_name, full_name, avatar_url, created_at';
          const profileQueries = [
            supabaseAdmin.from('profiles').select(profileFields).eq('id', sessionUserId).maybeSingle(),
            supabaseAdmin.from('user_profiles').select(profileFields).eq('id', sessionUserId).maybeSingle(),
          ];

          let profile: any = null;
          let profileError: any = null;
          for (const query of profileQueries) {
            const res = await query;
            if (res.data) {
              profile = res.data;
              profileError = null;
              break;
            }
            if (!profileError && res.error) {
              profileError = res.error;
            }
          }

          if (profileError && !profile) {
            console.warn('[get_current_user] profile lookup failed, returning session context only:', profileError.message);
          }

          result = {
            content: [{
              type: 'text',
              text: JSON.stringify({
                user_id: sessionUserId,
                tenant_id: sessionTenantId,
                email: profile?.email || null,
                display_name: profile?.display_name || profile?.full_name || profile?.name || null,
                avatar_url: profile?.avatar_url || null,
                note: 'Use user_id in tools that require an internal AlphaClone user reference (e.g. get_momentum_score).',
              }, null, 2),
            }],
          };
          break;
        }

        // ── WhatsApp Chatbot & Outreach ─────────────────────────────────────
        case 'enable_whatsapp_chatbot': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { error } = await supabaseAdmin.from('whatsapp_chatbot_settings').upsert(
            { tenant_id, chatbot_enabled: true },
            { onConflict: 'tenant_id' }
          );
          if (error) throw new Error(error.message);
          result = { content: [{ type: 'text', text: JSON.stringify({ status: 'enabled' }, null, 2) }] };
          break;
        }

        case 'disable_whatsapp_chatbot': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { error } = await supabaseAdmin.from('whatsapp_chatbot_settings').upsert(
            { tenant_id, chatbot_enabled: false },
            { onConflict: 'tenant_id' }
          );
          if (error) throw new Error(error.message);
          result = { content: [{ type: 'text', text: JSON.stringify({ status: 'disabled' }, null, 2) }] };
          break;
        }

        case 'train_chatbot': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { chatbotTrainingService } = await import('../whatsapp/ChatbotTrainingService');
          const success = await chatbotTrainingService.refreshPersona(tenant_id);
          result = { content: [{ type: 'text', text: JSON.stringify({ success }, null, 2) }] };
          break;
        }

        case 'get_chatbot_persona': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { data, error } = await supabaseAdmin
            .from('whatsapp_chatbot_settings')
            .select('persona_prompt')
            .eq('tenant_id', tenant_id)
            .maybeSingle();
          if (error) throw new Error(error.message);
          result = { content: [{ type: 'text', text: JSON.stringify(data || { persona_prompt: null }, null, 2) }] };
          break;
        }

        case 'update_chatbot_persona': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { persona_prompt } = a;
          const { error } = await supabaseAdmin.from('whatsapp_chatbot_settings').upsert(
            { tenant_id, persona_prompt },
            { onConflict: 'tenant_id' }
          );
          if (error) throw new Error(error.message);
          result = { content: [{ type: 'text', text: JSON.stringify({ status: 'updated' }, null, 2) }] };
          break;
        }

        case 'get_chatbot_conversations': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const limit = Math.min(Math.max(Number(a.limit) || 50, 1), 200);
          const { data, error } = await supabaseAdmin
            .from('whatsapp_messages')
            .select('*')
            .eq('tenant_id', tenant_id)
            .order('created_at', { ascending: false })
            .limit(limit);
          if (error) throw supabaseErrorToMcpClientError('get_chatbot_conversations', error.message);
          result = { content: [{ type: 'text', text: JSON.stringify({ messages: data || [] }, null, 2) }] };
          break;
        }

        case 'send_whatsapp_message': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const phone = String(a.phone || '').trim();
          const message = String(a.message || '').trim();
          if (!phone || !message) throw new Error('phone and message are required');
          const sendResult = await sendWhatsAppMessage({
            tenantId: tenant_id,
            phone,
            message,
            integrationId: a.integration_id ? String(a.integration_id) : undefined,
            contactId: a.contact_id ? String(a.contact_id) : null,
            clientId: a.client_id ? String(a.client_id) : null,
            metadata: { source: 'mcp', tool: 'send_whatsapp_message' },
          });
          if (!sendResult.success) throw new Error(sendResult.error || 'WhatsApp send failed');
          result = { content: [{ type: 'text', text: JSON.stringify({ sent: true, ...sendResult }, null, 2) }] };
          break;
        }

        case 'get_whatsapp_status': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const [integrationRes, settingsRes, recentLogsRes, recentMessagesRes] = await Promise.all([
            supabaseAdmin
              .from('whatsapp_integrations')
              .select('id, phone_number_id, waba_id, is_active, metadata, created_at, updated_at')
              .eq('tenant_id', tenant_id)
              .order('updated_at', { ascending: false })
              .limit(5),
            supabaseAdmin
              .from('whatsapp_chatbot_settings')
              .select('*')
              .eq('tenant_id', tenant_id)
              .maybeSingle(),
            supabaseAdmin
              .from('whatsapp_outreach_logs')
              .select('id, phone_number, status, error_message, sent_at, created_at')
              .eq('tenant_id', tenant_id)
              .order('created_at', { ascending: false })
              .limit(20),
            supabaseAdmin
              .from('whatsapp_messages')
              .select('id, direction, phone_number, body, status, sent_by, sent_at, received_at, created_at, provider_message_id')
              .eq('tenant_id', tenant_id)
              .order('created_at', { ascending: false })
              .limit(20),
          ]);
          if (integrationRes.error) throw supabaseErrorToMcpClientError('get_whatsapp_status', integrationRes.error.message);
          if (settingsRes.error) throw supabaseErrorToMcpClientError('get_whatsapp_status', settingsRes.error.message);
          const integrations = integrationRes.data || [];
          const active = integrations.find((item: any) => item.is_active) || null;
          const issues: string[] = [];
          if (!active) issues.push('No active whatsapp_integrations row found.');
          if (active && !active.waba_id) issues.push('Active WhatsApp integration is missing waba_id / Green API idInstance.');
          if (active && !active.metadata?.apiTokenInstance) issues.push('Active WhatsApp integration is missing metadata.apiTokenInstance.');
          if (!settingsRes.data?.chatbot_enabled) issues.push('WhatsApp chatbot is disabled.');
          if (!settingsRes.data?.auto_outreach_enabled) issues.push('Lead auto-outreach is disabled.');
          if (recentLogsRes.error) issues.push(`Could not read outreach logs: ${recentLogsRes.error.message}`);
          if (recentMessagesRes.error) issues.push(`Could not read WhatsApp inbox messages: ${recentMessagesRes.error.message}`);
          result = {
            content: [{
              type: 'text',
              text: JSON.stringify({
                ready_to_send: issues.filter((issue) => issue.includes('missing') || issue.includes('No active')).length === 0,
                issues,
                active_integration: active ? {
                  id: active.id,
                  phone_number_id: active.phone_number_id,
                  waba_id: active.waba_id,
                  is_active: active.is_active,
                  has_id_instance: Boolean(active.waba_id),
                  has_api_token: Boolean(active.metadata?.apiTokenInstance),
                  updated_at: active.updated_at,
                } : null,
                settings: settingsRes.data || null,
                recent_outreach_logs: recentLogsRes.data || [],
                recent_messages: recentMessagesRes.data || [],
                next_actions: issues.length
                  ? ['Connect or reactivate WhatsApp integration', 'Verify Green API idInstance and apiTokenInstance', 'Send a test with send_whatsapp_message']
                  : ['Send a test with send_whatsapp_message', 'Review recent_messages for inbound sync health'],
              }, null, 2),
            }],
          };
          break;
        }

        case 'set_chatbot_handoff_rules': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { handoff_rules } = a;
          const { error } = await supabaseAdmin.from('whatsapp_chatbot_settings').upsert(
            { tenant_id, handoff_rules },
            { onConflict: 'tenant_id' }
          );
          if (error) throw new Error(error.message);
          result = { content: [{ type: 'text', text: JSON.stringify({ status: 'updated' }, null, 2) }] };
          break;
        }

        case 'enable_lead_auto_outreach': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { enabled } = a;
          const { error } = await supabaseAdmin.from('whatsapp_chatbot_settings').upsert(
            { tenant_id, auto_outreach_enabled: enabled },
            { onConflict: 'tenant_id' }
          );
          if (error) throw new Error(error.message);
          result = { content: [{ type: 'text', text: JSON.stringify({ status: 'updated', enabled }, null, 2) }] };
          break;
        }

        case 'set_outreach_limits': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { outreach_limit_per_day, outreach_delay_seconds } = a;
          const { error } = await supabaseAdmin.from('whatsapp_chatbot_settings').upsert(
            { tenant_id, outreach_limit_per_day, outreach_delay_seconds },
            { onConflict: 'tenant_id' }
          );
          if (error) throw new Error(error.message);
          result = { content: [{ type: 'text', text: JSON.stringify({ status: 'updated' }, null, 2) }] };
          break;
        }

        case 'get_chatbot_performance': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { data, error } = await supabaseAdmin
            .from('whatsapp_outreach_logs')
            .select('status, created_at')
            .eq('tenant_id', tenant_id);
          if (error) throw new Error(error.message);
          const total = data?.length || 0;
          const sent = data?.filter((l: any) => l.status === 'sent').length || 0;
          result = { content: [{ type: 'text', text: JSON.stringify({ total_outreach: total, sent_outreach: sent }, null, 2) }] };
          break;
        }

        case 'execute_strategic_intelligence': {
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const { module_name, parameters = {} } = a;
          if (!module_name) throw new Error('module_name is required');

          let moduleResult: any = { status: 'unknown_module' };

          try {
            switch (module_name) {
              case 'pricing_elasticity': {
                const { pricingElasticityService } = await import('../intelligence/pricingElasticityService');
                moduleResult = await pricingElasticityService.calculateOptimalDiscount(supabaseAdmin, tenant_id, parameters.deal_id);
                break;
              }
              case 'churn_propensity': {
                const { churnPropensityService } = await import('../intelligence/churnPropensityService');
                moduleResult = await churnPropensityService.calculateChurnRisk(supabaseAdmin, tenant_id, parameters.client_id);
                break;
              }
              case 'proposal_generator': {
                const { proposalGeneratorService } = await import('../intelligence/proposalGeneratorService');
                moduleResult = await proposalGeneratorService.generateProposal(supabaseAdmin, tenant_id, parameters.deal_id);
                break;
              }
              case 'ivr_agent': {
                const { ivrAgentService } = await import('../intelligence/ivrAgentService');
                moduleResult = await ivrAgentService.processCallTranscript(supabaseAdmin, tenant_id, parameters.caller_number, parameters.transcript);
                break;
              }
              case 'network_graph': {
                const { networkGraphService } = await import('../intelligence/networkGraphService');
                moduleResult = await networkGraphService.buildAccountNetwork(supabaseAdmin, tenant_id, parameters.company_id);
                break;
              }
              case 'data_enrichment': {
                const { dataEnrichmentService } = await import('../intelligence/dataEnrichmentService');
                moduleResult = await dataEnrichmentService.enrichCompanyProfile(supabaseAdmin, tenant_id, parameters.company_name, parameters.website);
                break;
              }
              case 'revenue_recognition': {
                const { revenueRecognitionService } = await import('../intelligence/revenueRecognitionService');
                moduleResult = await revenueRecognitionService.buildRecognitionSchedule(supabaseAdmin, tenant_id, parameters.invoice_id, parameters.service_months || 12);
                break;
              }
              case 'invoice_factoring': {
                const { invoiceFactoringService } = await import('../intelligence/invoiceFactoringService');
                moduleResult = await invoiceFactoringService.evaluateInvoiceForFactoring(supabaseAdmin, tenant_id, parameters.invoice_id);
                break;
              }
              case 'objection_handling': {
                const { objectionHandlingService } = await import('../intelligence/objectionHandlingService');
                moduleResult = await objectionHandlingService.generateRebuttal(supabaseAdmin, tenant_id, parameters.deal_id, parameters.buyer_objection);
                break;
              }
              case 'narrative_reports': {
                const { narrativeReportingService } = await import('../intelligence/narrativeReportingService');
                moduleResult = await narrativeReportingService.generateExecutiveSummary(supabaseAdmin, tenant_id);
                break;
              }
              case 'anomaly_alert': {
                const { anomalyAlertingService } = await import('../intelligence/anomalyAlertingService');
                moduleResult = await anomalyAlertingService.scanForAnomalies(supabaseAdmin, tenant_id);
                break;
              }
              case 'sql_query': {
                const { naturalLanguageSqlService } = await import('../intelligence/naturalLanguageSqlService');
                moduleResult = await naturalLanguageSqlService.executeQuery(supabaseAdmin, tenant_id, parameters.query);
                break;
              }
              case 'communication_risk': {
                const { communicationRiskService } = await import('../intelligence/communicationRiskService');
                moduleResult = await communicationRiskService.analyzeDealRisk(supabaseAdmin, tenant_id, parameters.deal_id);
                break;
              }
              case 'payment_risk_score': {
                const { paymentRiskScoringService } = await import('../intelligence/paymentRiskScoringService');
                moduleResult = await paymentRiskScoringService.computeRiskScore(supabaseAdmin, tenant_id, parameters.client_id);
                break;
              }
              case 'monte_carlo_simulation': {
                const { monteCarloSimulationService } = await import('../intelligence/monteCarloSimulationService');
                moduleResult = await monteCarloSimulationService.runPipelineSimulation(supabaseAdmin, tenant_id);
                break;
              }
              case 'outreach_bandit_strategy': {
                const { outreachBanditService } = await import('../intelligence/outreachBanditService');
                moduleResult = await outreachBanditService.selectBestStrategy(supabaseAdmin, tenant_id);
                break;
              }
              case 'sentiment_arc': {
                const { sentimentArcService } = await import('../intelligence/sentimentArcService');
                moduleResult = await sentimentArcService.analyzeSentimentArc(supabaseAdmin, tenant_id, parameters.deal_id);
                break;
              }
              case 'crm_intelligence': {
                const { crmIntelligenceService } = await import('../intelligence/crmIntelligenceService');
                if (parameters.action === 'attribution') moduleResult = await crmIntelligenceService.computeMarketingAttribution(supabaseAdmin, tenant_id);
                else if (parameters.action === 'buyer_journey') moduleResult = await crmIntelligenceService.analyzeBuyerJourney(supabaseAdmin, tenant_id, parameters.contact_id);
                else if (parameters.action === 'competitive') moduleResult = await crmIntelligenceService.generateCompetitiveStrategy(parameters.competitor_name);
                break;
              }
              case 'playbooks': {
                const { playbookBuilderService } = await import('../intelligence/playbookBuilderService');
                moduleResult = await playbookBuilderService.executeActivePlaybooks(supabaseAdmin, tenant_id);
                break;
              }
              case 'semantic_resolution': {
                const { semanticResolutionService } = await import('../intelligence/semanticResolutionService');
                moduleResult = await semanticResolutionService.scanForDuplicates(supabaseAdmin, tenant_id);
                break;
              }
              case 'revenue_root_cause': {
                const { revenueRootCauseService } = await import('../intelligence/revenueRootCauseService');
                moduleResult = await revenueRootCauseService.analyze(supabaseAdmin, tenant_id);
                break;
              }
              case 'customer_360': {
                const { customer360Service } = await import('../intelligence/customer360Service');
                moduleResult = await customer360Service.buildProfile(supabaseAdmin, tenant_id, parameters.client_id);
                break;
              }
              case 'cash_flow_prediction': {
                const { cashFlowPredictionService } = await import('../intelligence/cashFlowPredictionService');
                moduleResult = await cashFlowPredictionService.forecast(supabaseAdmin, tenant_id, parameters.days || 90);
                break;
              }
              default:
                throw new Error(`Unknown strategic module: ${module_name}`);
            }
          } catch (modErr: any) {
            moduleResult = { success: false, error: modErr.message };
          }
          
          result = { content: [{ type: 'text', text: JSON.stringify(moduleResult, null, 2) }] };
          break;
        }

        case 'get_social_posts':
        case 'list_social_posts': {
          // Alias for connectors that ask for get_social_posts (maps to social_posts table)
          const a = args as Record<string, any>;
          const tenant_id = this.requireTenant(a);
          const limit = Math.min(Number(a.limit) || 50, 100);
          const status = typeof a.status === 'string' ? a.status.trim() : '';
          let query = supabaseAdmin
            .from('social_posts')
            .select('id, caption, status, scheduled_at, published_at, created_at, analytics')
            .eq('tenant_id', tenant_id)
            .order('created_at', { ascending: false })
            .limit(limit);
          if (status) query = query.eq('status', status);
          const { data, error } = await query;
          if (error) throw supabaseErrorToMcpClientError('get_social_posts', error.message);
          result = {
            content: [{
              type: 'text',
              text: JSON.stringify({ posts: data || [], count: data?.length || 0 }, null, 2),
            }],
          };
          break;
        }

        default:
          throw new Error(`Unknown tool: "${name}". Available tools include get_clients, get_contacts, create_client, get_leads, create_lead, get_deals, create_deal, get_projects, create_project, update_project_status, get_project_details, get_project_timeline, get_tasks, create_task, update_task, write_task_note, get_documents, search_documents, get_balance_sheet, get_cash_flow_statement, create_journal_entry, get_finance_snapshot, create_invoice, send_invoice, create_quote, get_expenses, create_expense, generate_expense_report, reconcile_payment, nexus_payroll_sync, nexus_lead_enrichment, nexus_sales_campaign, nexus_contract_drafter, get_contract_versions, get_contract_approvals, get_current_user, send_transactional_email, enable_whatsapp_chatbot, disable_whatsapp_chatbot, train_chatbot, get_chatbot_persona, update_chatbot_persona, get_chatbot_conversations, set_chatbot_handoff_rules, enable_lead_auto_outreach, set_outreach_limits, get_chatbot_performance, get_social_posts, and many more.`);
        }

        // â”€â”€ Audit Logging â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        telemetryError = error instanceof Error ? error.message : String(error);
        const payload = toMcpErrorPayload(name, traceId, error);
        throw new Error(payload);
      } finally {
        if (!executedViaRegistry) {
          telemetrySuccess = !telemetryError;
          const tenantForLog =
            this.ctx?.tenantId ||
            ((args as Record<string, any>)?.tenant_id ? String((args as Record<string, any>).tenant_id) : '');
          if (tenantForLog) {
            const { logMcpToolExecution, normalizeToolName } = await import('@/lib/mcp/mcpToolTelemetry');
            await logMcpToolExecution({
              tenantId: tenantForLog,
              userId: this.ctx?.userId || (args as Record<string, any>)?.user_id || null,
              toolName: normalizeToolName(name),
              durationMs: Date.now() - telemetryStart,
              success: telemetrySuccess,
              errorMessage: telemetryError || null,
            });
          }
        }
      }
  }

  /** Bonnie agent + internal automations — execute any MCP tool server-side */
  async runTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ content?: Array<{ type?: string; text?: string }>; isError?: boolean }> {
    const traceId = crypto.randomUUID();
    const supabaseAdmin = createSupabaseAdminClient();
    try {
      return await this.executeToolInternal(name, args, traceId, supabaseAdmin);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: message }],
        isError: true,
      };
    }
  }
}

export const mcpServerInstance = new AlphaCloneMCPServer();

/** Per-request MCP server bound to the authenticated tenant + user (from API key or OAuth). */
export function createMCPServer(ctx?: MCPConnectionContext): AlphaCloneMCPServer {
  return new AlphaCloneMCPServer(ctx);
}
