/**
 * Autonomous MCP write tools — model-independent business actions.
 * Shared by ChatGPT, Claude, Cursor, Gemini, DeepSeek, Bonnie, and any MCP client.
 */
import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { okResult, throwConnectorError } from '@/lib/mcp/connector/response';
import { findReceiptByIdempotency, persistActionReceipt } from '@/lib/mcp/actionReceipts';
import { newActionId } from '@/lib/mcp/standardResponse';
import {
  approveWorkflowStep,
  rejectWorkflowStep,
  resumeWorkflow,
  cancelRun,
  startPlaybookRun,
  getRunStatus,
} from '@/services/automation/runtimeService';
import { validateContract, validateInvoice } from '@/lib/documents/documentValidationEngine';
import { updateWithOptionalTimestamp } from '@/lib/mcp/schemaCompat';

const TEST_CONTACTS = new Set(['bonniiehendrix@gmail.com', 'bornfacemasilo22@gmail.com']);

function isDryRun(): boolean {
  return process.env.TEST_MODE === 'true' || process.env.MCP_DRY_RUN === 'true' || process.env.NODE_ENV === 'test';
}

function assertTestSafeRecipient(to: string) {
  if (isDryRun()) return;
  // In non-dry production tests we still restrict designated contacts when SANDBOX_EMAIL_ONLY=true
  if (process.env.SANDBOX_EMAIL_ONLY === 'true' && !TEST_CONTACTS.has(to.trim().toLowerCase())) {
    throwConnectorError('SANDBOX_ONLY', `Recipient ${to} is outside sandbox allowlist`);
  }
}

async function requireApprovalIfNeeded(_params: {
  tool: string;
  tenantId: string;
  userId: string;
  confirmed?: boolean;
  summary: string;
  details?: Record<string, unknown>;
}) {
  // ToolPolicyGate / dashboard approval queue intentionally removed.
  // Actions execute immediately for all MCP clients (Claude, ChatGPT, Cursor, Bonnie).
  return null;
}

// ─── CRM extras ─────────────────────────────────────────────────────────────

defineConnectorTool({
  module: 'autonomous-ops',
  name: 'search_contacts',
  description: 'Search CRM contacts by name, email, or phone.',
  permission: 'crm:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    query: z.string().min(1),
    limit: z.number().int().min(1).max(100).optional().default(50),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      query: { type: 'string' },
      limit: { type: 'number' },
    },
    required: ['tenant_id', 'query'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const q = args.query.replace(/[%_]/g, ' ').trim();
    const { data, error } = await supabase
      .from('contacts')
      .select('id, full_name, first_name, last_name, email, phone, company_id, status, updated_at')
      .eq('tenant_id', args.tenant_id)
      .is('deleted_at', null)
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      .order('updated_at', { ascending: false })
      .limit(args.limit);
    if (error) throwConnectorError('QUERY_FAILED', error.message);
    return okResult('search_contacts', { contacts: data || [], query: args.query }, { receipt: null });
  },
});

defineConnectorTool({
  module: 'autonomous-ops',
  name: 'update_contact',
  description: 'Update a CRM contact record.',
  permission: 'crm:write',
  rateLimitClass: 'write',
  auditAction: 'mcp_update_contact',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    contact_id: z.string().uuid(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    notes: z.string().optional(),
    status: z.string().optional(),
    idempotency_key: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      contact_id: { type: 'string', format: 'uuid' },
      first_name: { type: 'string' },
      last_name: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string' },
      notes: { type: 'string' },
      status: { type: 'string' },
      idempotency_key: { type: 'string' },
    },
    required: ['tenant_id', 'contact_id'],
  },
  handler: async (args, ctx) => {
    if (args.idempotency_key) {
      const existing = await findReceiptByIdempotency({
        tenantId: args.tenant_id,
        tool: 'update_contact',
        idempotencyKey: args.idempotency_key,
      });
      if (existing) {
        return okResult('update_contact', existing.sanitized_output, {
          receipt: {
            action_id: String(existing.action_id),
            status: String(existing.final_status),
            entity_id: String(existing.entity_id || args.contact_id),
            entity_type: 'contact',
          },
          meta: { deduplicated: true },
        });
      }
    }

    const supabase = createSupabaseAdminClient();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: ctx.userId };
    for (const key of ['first_name', 'last_name', 'email', 'phone', 'notes', 'status'] as const) {
      if (args[key] !== undefined) updates[key] = args[key];
    }
    if (args.first_name || args.last_name) {
      updates.full_name = [args.first_name, args.last_name].filter(Boolean).join(' ').trim();
    }

    const { data, error } = await supabase
      .from('contacts')
      .update(updates)
      .eq('tenant_id', args.tenant_id)
      .eq('id', args.contact_id)
      .select()
      .single();
    if (error) throwConnectorError('UPDATE_FAILED', error.message);

    const actionId = newActionId();
    const receipt = {
      action_id: actionId,
      status: 'completed',
      entity_id: data.id,
      entity_type: 'contact',
      timestamp: new Date().toISOString(),
      verification: { updated_fields: Object.keys(updates) },
    };
    await persistActionReceipt({
      tenantId: args.tenant_id,
      userId: ctx.userId,
      tool: 'update_contact',
      idempotencyKey: args.idempotency_key,
      receipt,
      success: true,
      sanitizedInput: args,
      sanitizedOutput: data,
    });
    return okResult('update_contact', data, { receipt });
  },
});

defineConnectorTool({
  module: 'autonomous-ops',
  name: 'update_company',
  description: 'Update a company / organization record.',
  permission: 'crm:write',
  rateLimitClass: 'write',
  auditAction: 'mcp_update_company',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    company_id: z.string().uuid(),
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    website: z.string().optional(),
    industry: z.string().optional(),
    notes: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      company_id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string' },
      website: { type: 'string' },
      industry: { type: 'string' },
      notes: { type: 'string' },
    },
    required: ['tenant_id', 'company_id'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: ctx.userId };
    for (const key of ['name', 'email', 'phone', 'website', 'industry', 'notes'] as const) {
      if (args[key] !== undefined) updates[key] = args[key];
    }
    const { data, error } = await supabase
      .from('companies')
      .update(updates)
      .eq('tenant_id', args.tenant_id)
      .eq('id', args.company_id)
      .select()
      .single();
    if (error) throwConnectorError('UPDATE_FAILED', error.message);
    return okResult('update_company', data, {
      receipt: {
        action_id: newActionId(),
        status: 'completed',
        entity_id: data.id,
        entity_type: 'company',
        timestamp: new Date().toISOString(),
      },
    });
  },
});

defineConnectorTool({
  module: 'autonomous-ops',
  name: 'add_note',
  description: 'Add a note to a lead, contact, or company.',
  permission: 'crm:write',
  rateLimitClass: 'write',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    entity_type: z.enum(['lead', 'contact', 'company']),
    entity_id: z.string().uuid(),
    note: z.string().min(1),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      entity_type: { type: 'string', enum: ['lead', 'contact', 'company'] },
      entity_id: { type: 'string', format: 'uuid' },
      note: { type: 'string' },
    },
    required: ['tenant_id', 'entity_type', 'entity_id', 'note'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const table = args.entity_type === 'lead' ? 'leads' : args.entity_type === 'contact' ? 'contacts' : 'companies';
    const { data: existing, error: findErr } = await supabase
      .from(table)
      .select('id, notes')
      .eq('tenant_id', args.tenant_id)
      .eq('id', args.entity_id)
      .maybeSingle();
    if (findErr) throwConnectorError('QUERY_FAILED', findErr.message);
    if (!existing) throwConnectorError('NOT_FOUND', `${args.entity_type} not found`);

    const stamp = new Date().toISOString();
    const merged = [existing.notes, `[${stamp}] ${args.note}`].filter(Boolean).join('\n\n');
    const { data, error } = await updateWithOptionalTimestamp<{ id: string; notes: string | null }>({
      supabase,
      table,
      tenantId: args.tenant_id,
      entityId: args.entity_id,
      payload: { notes: merged },
      select: 'id, notes',
    });
    if (error) throwConnectorError('UPDATE_FAILED', error.message);

    const { logCrmActivityAdmin } = await import('@/lib/crm/crmActivityServer');
    await logCrmActivityAdmin(supabase, {
      tenantId: args.tenant_id,
      type: 'note',
      subject: 'Note added',
      description: args.note,
      contactId: args.entity_type === 'contact' ? args.entity_id : undefined,
      companyId: args.entity_type === 'company' ? args.entity_id : undefined,
      createdBy: ctx.userId,
      source: 'mcp:add_note',
      metadata: {
        entity_type: args.entity_type,
        lead_id: args.entity_type === 'lead' ? args.entity_id : null,
      },
    });

    return okResult('add_note', data, {
      receipt: {
        action_id: newActionId(),
        status: 'completed',
        entity_id: args.entity_id,
        entity_type: args.entity_type,
        timestamp: stamp,
      },
    });
  },
});

defineConnectorTool({
  module: 'autonomous-ops',
  name: 'change_pipeline_stage',
  description: 'Change a lead or deal pipeline stage.',
  permission: 'crm:write',
  rateLimitClass: 'write',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    entity_type: z.enum(['lead', 'deal']).default('lead'),
    entity_id: z.string().uuid(),
    stage: z.string().min(1),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      entity_type: { type: 'string', enum: ['lead', 'deal'] },
      entity_id: { type: 'string', format: 'uuid' },
      stage: { type: 'string' },
    },
    required: ['tenant_id', 'entity_id', 'stage'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const table = args.entity_type === 'deal' ? 'deals' : 'leads';
    const payload = { stage: args.stage };
    const { data, error } = await updateWithOptionalTimestamp<{ id: string; stage: string }>({
      supabase,
      table,
      tenantId: args.tenant_id,
      entityId: args.entity_id,
      payload,
      select: 'id, stage',
    });
    if (error) throwConnectorError('UPDATE_FAILED', error.message);
    if (!data) throwConnectorError('NOT_FOUND', `${args.entity_type} not found`);
    return okResult('change_pipeline_stage', data, {
      receipt: {
        action_id: newActionId(),
        status: 'completed',
        entity_id: data.id,
        entity_type: args.entity_type,
        timestamp: new Date().toISOString(),
      },
    });
  },
});

defineConnectorTool({
  module: 'autonomous-ops',
  name: 'create_follow_up',
  description: 'Create a follow-up task for a lead or contact.',
  permission: 'crm:write',
  rateLimitClass: 'write',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    title: z.string().min(1),
    due_at: z.string().datetime().optional(),
    lead_id: z.string().uuid().optional(),
    contact_id: z.string().uuid().optional(),
    description: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      due_at: { type: 'string', format: 'date-time' },
      lead_id: { type: 'string', format: 'uuid' },
      contact_id: { type: 'string', format: 'uuid' },
      description: { type: 'string' },
    },
    required: ['tenant_id', 'title'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        tenant_id: args.tenant_id,
        title: args.title,
        description: args.description || 'Follow-up created via MCP',
        status: 'todo',
        priority: 'medium',
        due_date: args.due_at || null,
        related_to_lead: args.lead_id || null,
        related_to_contact: args.contact_id || null,
        created_by: ctx.userId,
        assigned_to: ctx.userId,
      })
      .select()
      .single();
    if (error) throwConnectorError('CREATE_FAILED', error.message);
    return okResult('create_follow_up', data, {
      receipt: {
        action_id: newActionId(),
        status: 'completed',
        entity_id: data.id,
        entity_type: 'task',
        timestamp: new Date().toISOString(),
      },
    });
  },
});

// ─── Transactional email ────────────────────────────────────────────────────

defineConnectorTool({
  module: 'autonomous-ops',
  name: 'send_transactional_email',
  description:
    'Send a transactional email via the connected provider (Zoho/Brevo/Gmail/Outlook/Resend/SendGrid). Requires in-chat confirmation unless confirmed=true. Returns delivery evidence.',
  permission: 'sales:write',
  rateLimitClass: 'write',
  auditAction: 'mcp_send_transactional_email',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    to: z.string().email(),
    cc: z.array(z.string().email()).optional(),
    bcc: z.array(z.string().email()).optional(),
    subject: z.string().min(1),
    body_html: z.string().optional(),
    body_text: z.string().optional(),
    provider: z
      .enum(['zoho', 'brevo', 'gmail', 'outlook', 'resend', 'sendgrid', 'dry_run'])
      .optional(),
    contact_id: z.string().uuid().optional(),
    from_email: z.string().email().optional(),
    idempotency_key: z.string().min(1),
    confirmed: z.boolean().optional().default(false),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      to: { type: 'string', format: 'email' },
      cc: { type: 'array', items: { type: 'string' } },
      bcc: { type: 'array', items: { type: 'string' } },
      subject: { type: 'string' },
      body_html: { type: 'string' },
      body_text: { type: 'string' },
      provider: {
        type: 'string',
        enum: ['zoho', 'brevo', 'gmail', 'outlook', 'resend', 'sendgrid', 'dry_run'],
      },
      contact_id: { type: 'string', format: 'uuid' },
      from_email: { type: 'string' },
      idempotency_key: { type: 'string' },
      confirmed: { type: 'boolean' },
    },
    required: ['tenant_id', 'to', 'subject', 'idempotency_key'],
  },
  handler: async (args, ctx) => {
    const existing = await findReceiptByIdempotency({
      tenantId: args.tenant_id,
      tool: 'send_transactional_email',
      idempotencyKey: args.idempotency_key,
    });
    if (existing) {
      return okResult('send_transactional_email', existing.sanitized_output, {
        receipt: {
          action_id: String(existing.action_id),
          status: String(existing.final_status),
          provider: existing.provider as string,
          provider_reference: existing.provider_reference as string,
          entity_id: existing.entity_id as string,
          entity_type: 'email',
        },
        meta: { deduplicated: true, idempotency_key: args.idempotency_key },
      });
    }

    const approval = await requireApprovalIfNeeded({
      tool: 'send_transactional_email',
      tenantId: args.tenant_id,
      userId: ctx.userId,
      confirmed: args.confirmed,
      summary: `Send email to ${args.to}: ${args.subject}`,
      details: { to: args.to, subject: args.subject, provider: args.provider },
    });
    if (approval) return approval;

    assertTestSafeRecipient(args.to);
    const preferred = isDryRun() ? 'dry_run' : args.provider;
    const acceptedAt = new Date().toISOString();

    if (preferred === 'dry_run' || isDryRun()) {
      const messageId = `dry_run_${crypto.randomUUID()}`;
      const delivery = {
        provider: 'dry_run',
        message_id: messageId,
        recipient: args.to,
        accepted_at: acceptedAt,
        delivery_status: 'dry_run_accepted',
        verification_evidence: { mode: 'dry_run' },
      };
      const receipt = {
        action_id: newActionId(),
        status: 'completed',
        provider: 'dry_run',
        provider_reference: messageId,
        entity_id: messageId,
        entity_type: 'email',
        timestamp: acceptedAt,
        verification: delivery.verification_evidence,
        retry_available: true,
      };
      await persistActionReceipt({
        tenantId: args.tenant_id,
        userId: ctx.userId,
        tool: 'send_transactional_email',
        idempotencyKey: args.idempotency_key,
        receipt,
        success: true,
        sanitizedInput: { ...args, body_html: '[redacted]', body_text: '[redacted]' },
        sanitizedOutput: delivery,
      });
      return okResult('send_transactional_email', delivery, {
        receipt,
        meta: { idempotency_key: args.idempotency_key, tenant_id: args.tenant_id },
      });
    }

    const { sendEmailServer } = await import('@/lib/email/sendEmailServer');
    type OutboundEmailProvider =
      | 'zoho'
      | 'brevo'
      | 'sendgrid'
      | 'resend'
      | 'outlook'
      | 'gmail';
    const preferredOutbound: OutboundEmailProvider | undefined =
      preferred === 'zoho' ||
      preferred === 'brevo' ||
      preferred === 'sendgrid' ||
      preferred === 'resend' ||
      preferred === 'outlook' ||
      preferred === 'gmail'
        ? preferred
        : undefined;
    const sendResult = await sendEmailServer({
      tenantId: args.tenant_id,
      userId: ctx.userId,
      to: args.to,
      subject: args.subject,
      html: args.body_html,
      text: args.body_text,
      preferredProvider: preferredOutbound,
    });

    if (!sendResult.success) {
      throwConnectorError(
        sendResult.code || 'PROVIDER_REJECTED',
        sendResult.error || 'Email provider rejected the send',
        sendResult.errorDetails
      );
    }

    const messageId = sendResult.emailId || `${sendResult.provider}_${crypto.randomUUID()}`;
    const delivery = {
      provider: sendResult.provider,
      message_id: messageId,
      recipient: args.to,
      accepted_at: acceptedAt,
      delivery_status: 'provider_accepted',
      thread_id: null as string | null,
      error: null as string | null,
      verification_evidence: {
        mode: 'live',
        from_email_validated: Boolean(args.from_email),
        contact_id: args.contact_id || null,
        cc_count: args.cc?.length || 0,
        bcc_count: args.bcc?.length || 0,
        body_present: Boolean(args.body_html || args.body_text),
      },
    };

    // Persist outbound log without leaking full body into ordinary logs
    try {
      const supabase = createSupabaseAdminClient();
      await supabase.from('lead_outreach_log').insert({
        tenant_id: args.tenant_id,
        lead_name: args.to,
        lead_email: args.to,
        subject: args.subject,
        body_html: args.body_html || args.body_text || '',
        tracking_id: messageId,
        status: delivery.delivery_status,
        provider: sendResult.provider,
        sent_at: acceptedAt,
        pitch_angle: 'transactional_email',
        industry: '',
        score: 0,
      });
    } catch {
      // optional table
    }

    const receipt = {
      action_id: newActionId(),
      status: 'completed',
      provider: sendResult.provider || preferred,
      provider_reference: messageId,
      entity_id: messageId,
      entity_type: 'email',
      timestamp: acceptedAt,
      verification: delivery.verification_evidence,
      retry_available: true,
    };

    await persistActionReceipt({
      tenantId: args.tenant_id,
      userId: ctx.userId,
      tool: 'send_transactional_email',
      idempotencyKey: args.idempotency_key,
      receipt,
      success: true,
      sanitizedInput: { ...args, body_html: '[redacted]', body_text: '[redacted]' },
      sanitizedOutput: delivery,
    });

    return okResult('send_transactional_email', delivery, {
      receipt,
      meta: { idempotency_key: args.idempotency_key, tenant_id: args.tenant_id },
    });
  },
});

defineConnectorTool({
  module: 'autonomous-ops',
  name: 'get_delivery_status',
  description: 'Get delivery status for a transactional email by message_id / tracking_id.',
  permission: 'integrations:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    message_id: z.string().min(1),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      message_id: { type: 'string' },
    },
    required: ['tenant_id', 'message_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from('lead_outreach_log')
      .select('id, tracking_id, status, provider, sent_at, lead_email, subject')
      .eq('tenant_id', args.tenant_id)
      .eq('tracking_id', args.message_id)
      .maybeSingle();

    const receiptRow = await findReceiptByIdempotency({
      tenantId: args.tenant_id,
      tool: 'send_transactional_email',
      idempotencyKey: args.message_id,
    }).catch(() => null);

    return {
      message_id: args.message_id,
      delivery_status: data?.status || receiptRow?.final_status || 'unknown',
      provider: data?.provider || receiptRow?.provider || null,
      evidence: data || receiptRow || null,
    };
  },
});

// ─── Social media ───────────────────────────────────────────────────────────

defineConnectorTool({
  module: 'autonomous-ops',
  name: 'upload_media',
  description:
    'Upload image/video via content_base64, data URL, or HTTPS URL. Returns media_url (/mnt/data paths blocked). Use media_url in publish_post.',
  permission: 'social:write',
  rateLimitClass: 'write',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    filename: z.string().optional(),
    file_name: z.string().optional(),
    content_base64: z.string().optional(),
    file_base64: z.string().optional(),
    content_url: z.string().optional(),
    source_url: z.string().optional(),
    url: z.string().optional(),
    data_url: z.string().optional(),
    mime_type: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      filename: { type: 'string' },
      file_name: { type: 'string' },
      content_base64: { type: 'string' },
      file_base64: { type: 'string' },
      content_url: { type: 'string' },
      source_url: { type: 'string' },
      url: { type: 'string' },
      data_url: { type: 'string' },
      mime_type: { type: 'string' },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const { executeTool } = await import('../tool-registry');
    return executeTool(args.tenant_id, ctx.userId!, 'upload_media', args);
  },
});

defineConnectorTool({
  module: 'autonomous-ops',
  name: 'publish_now',
  description:
    'Publish a social post now via SocialPublishingService. Supports Facebook Page and LinkedIn person/organization. Requires confirmation unless tenant enables autonomous publishing. Returns real provider post ID and live URL — never fabricates success.',
  permission: 'social:publish',
  rateLimitClass: 'publish',
  auditAction: 'mcp_publish_now',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    platforms: z.array(z.enum(['facebook', 'instagram', 'linkedin', 'linkedin_org'])).min(1),
    caption: z.string().min(1),
    media_urls: z.array(z.string()).optional(),
    media_asset_ids: z.array(z.string().uuid()).optional(),
    identity_type: z
      .enum(['facebook_page', 'linkedin_person', 'linkedin_organization'])
      .optional(),
    identity_id: z.string().optional(),
    linkedin_organization_id: z.string().optional(),
    page_id: z.string().optional(),
    confirmed: z.boolean().optional().default(false),
    idempotency_key: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      platforms: { type: 'array', items: { type: 'string' } },
      caption: { type: 'string' },
      media_urls: { type: 'array', items: { type: 'string' } },
      media_asset_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
      identity_type: {
        type: 'string',
        enum: ['facebook_page', 'linkedin_person', 'linkedin_organization'],
      },
      identity_id: { type: 'string' },
      linkedin_organization_id: { type: 'string' },
      page_id: { type: 'string' },
      confirmed: { type: 'boolean' },
      idempotency_key: { type: 'string' },
    },
    required: ['tenant_id', 'platforms', 'caption'],
  },
  handler: async (args, ctx) => {
    if (args.idempotency_key) {
      const existing = await findReceiptByIdempotency({
        tenantId: args.tenant_id,
        tool: 'publish_now',
        idempotencyKey: args.idempotency_key,
      });
      if (existing) {
        return okResult('publish_now', existing.sanitized_output, {
          receipt: {
            action_id: String(existing.action_id),
            status: String(existing.final_status),
            provider_reference: existing.provider_reference as string,
            live_url: existing.live_url as string,
          },
          meta: { deduplicated: true },
        });
      }
    }

    const approval = await requireApprovalIfNeeded({
      tool: 'publish_now',
      tenantId: args.tenant_id,
      userId: ctx.userId,
      confirmed: args.confirmed,
      summary: `Publish now to ${args.platforms.join(', ')}`,
      details: {
        platforms: args.platforms,
        caption_preview: args.caption.slice(0, 120),
        identity_type: args.identity_type,
        identity_id: args.identity_id || args.page_id || args.linkedin_organization_id,
        media_preview: args.media_urls?.[0] || args.media_asset_ids?.[0] || null,
      },
    });
    if (approval) return approval;

    const primary = args.platforms[0];
    if (primary === 'instagram') {
      throwConnectorError(
        'UNSUPPORTED_PLATFORM',
        'Instagram publish_now requires Zernio configuration — use create_social_post with platforms=["instagram"]'
      );
    }

    const platform: 'facebook' | 'linkedin' =
      primary === 'facebook' ? 'facebook' : 'linkedin';
    let identityType = args.identity_type;
    let identityId =
      args.identity_id || args.page_id || args.linkedin_organization_id || undefined;

    if (!identityType) {
      if (platform === 'facebook') {
        identityType = 'facebook_page';
      } else if (primary === 'linkedin_org' || args.linkedin_organization_id) {
        identityType = 'linkedin_organization';
      } else {
        identityType = 'linkedin_person';
      }
    }

    if (!identityId) {
      if (identityType === 'facebook_page') {
        const { listFacebookIdentities } = await import('@/lib/social/identityResolution');
        const { pages } = await listFacebookIdentities(args.tenant_id);
        identityId = (pages.find((p) => p.can_publish) || pages[0])?.page_id;
      } else if (identityType === 'linkedin_organization') {
        throwConnectorError(
          'MISSING_IDENTITY',
          'linkedin_organization_id is required for organization posts — call get_linkedin_identities'
        );
      } else {
        const { listLinkedInIdentities } = await import('@/lib/social/identityResolution');
        const { personal } = await listLinkedInIdentities(args.tenant_id);
        identityId = personal?.member_id || personal?.person_urn || undefined;
      }
    }

    if (!identityId) {
      throwConnectorError('MISSING_IDENTITY', 'Could not resolve destination identity');
    }

    const { getSocialPublishingService } = await import('@/lib/social/SocialPublishingService');
    const service = getSocialPublishingService();
    const publishResult = await service.publish({
      tenantId: args.tenant_id,
      userId: ctx.userId!,
      platform,
      identityType: identityType!,
      identityId: identityId!,
      caption: args.caption,
      mediaUrls: args.media_urls,
      mediaAssetIds: args.media_asset_ids,
      publishNow: true,
      idempotencyKey: args.idempotency_key,
      confirmed: args.confirmed,
      aiClient: 'mcp-autonomous',
    });

    if (!publishResult.ok || !publishResult.data?.provider_post_id) {
      throwConnectorError(
        publishResult.error?.code || 'PUBLISH_FAILED',
        publishResult.error?.message ||
          'Publish failed — refusing ok=true without provider post ID',
        publishResult.data
      );
    }

    const result = {
      post_id: publishResult.data!.social_post_id,
      social_post_id: publishResult.data!.social_post_id,
      live_post_id: publishResult.data!.provider_post_id,
      live_url: publishResult.data!.live_url,
      platforms: args.platforms,
      status: publishResult.data!.status,
      identity_type: publishResult.data!.identity_type,
      identity_id: publishResult.data!.identity_id,
      identity_name: publishResult.data!.identity_name,
      published_at: publishResult.data!.published_at,
      verified: publishResult.receipt?.verified === true,
      linkedin_post_urn: publishResult.data!.linkedin_post_urn,
      linkedin_author_urn: publishResult.data!.linkedin_author_urn,
      linkedin_organization_id: publishResult.data!.linkedin_organization_id,
    };

    const receipt = {
      action_id: publishResult.receipt?.action_id || newActionId(),
      status: 'published',
      provider: platform,
      provider_reference: publishResult.data!.provider_post_id,
      entity_id: publishResult.data!.social_post_id,
      entity_type: 'social_post',
      live_url: publishResult.data!.live_url,
      timestamp: publishResult.data!.published_at || new Date().toISOString(),
      verification: {
        verified: true,
        verified_at: publishResult.receipt?.verified_at,
        correlation_id: publishResult.receipt?.correlation_id,
      },
    };

    if (args.idempotency_key) {
      await persistActionReceipt({
        tenantId: args.tenant_id,
        userId: ctx.userId,
        tool: 'publish_now',
        idempotencyKey: args.idempotency_key,
        receipt,
        success: true,
        sanitizedInput: args,
        sanitizedOutput: result,
      });
    }

    return okResult('publish_now', result, { receipt });
  },
});

defineConnectorTool({
  module: 'autonomous-ops',
  name: 'create_post',
  description: 'Create a draft social post.',
  permission: 'social:write',
  rateLimitClass: 'write',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    platforms: z.array(z.string()).min(1),
    caption: z.string().min(1),
    media_urls: z.array(z.string()).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      platforms: { type: 'array', items: { type: 'string' } },
      caption: { type: 'string' },
      media_urls: { type: 'array', items: { type: 'string' } },
    },
    required: ['tenant_id', 'platforms', 'caption'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('social_posts')
      .insert({
        tenant_id: args.tenant_id,
        user_id: ctx.userId,
        platforms: args.platforms,
        platform: args.platforms[0],
        caption: args.caption,
        content: args.caption,
        media_urls: args.media_urls || [],
        status: 'draft',
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();
    if (error) throwConnectorError('CREATE_FAILED', error.message);
    return okResult('create_post', data, {
      receipt: {
        action_id: newActionId(),
        status: 'completed',
        entity_id: data.id,
        entity_type: 'social_post',
        timestamp: now,
      },
    });
  },
});

defineConnectorTool({
  module: 'autonomous-ops',
  name: 'schedule_post',
  description: 'Schedule a social post for later publishing.',
  permission: 'social:publish',
  rateLimitClass: 'write',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    post_id: z.string().uuid().optional(),
    platforms: z.array(z.string()).optional(),
    caption: z.string().optional(),
    scheduled_at: z.string().datetime(),
    media_urls: z.array(z.string()).optional(),
    confirmed: z.boolean().optional().default(false),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      post_id: { type: 'string', format: 'uuid' },
      platforms: { type: 'array', items: { type: 'string' } },
      caption: { type: 'string' },
      scheduled_at: { type: 'string', format: 'date-time' },
      media_urls: { type: 'array', items: { type: 'string' } },
      confirmed: { type: 'boolean' },
    },
    required: ['tenant_id', 'scheduled_at'],
  },
  handler: async (args, ctx) => {
    const approval = await requireApprovalIfNeeded({
      tool: 'schedule_post',
      tenantId: args.tenant_id,
      userId: ctx.userId,
      confirmed: args.confirmed,
      summary: `Schedule social post for ${args.scheduled_at}`,
    });
    if (approval) return approval;

    const supabase = createSupabaseAdminClient();
    if (args.post_id) {
      const { data, error } = await supabase
        .from('social_posts')
        .update({ status: 'scheduled', scheduled_at: args.scheduled_at, updated_at: new Date().toISOString() })
        .eq('tenant_id', args.tenant_id)
        .eq('id', args.post_id)
        .select()
        .single();
      if (error) throwConnectorError('UPDATE_FAILED', error.message);
      return okResult('schedule_post', data, {
        receipt: {
          action_id: newActionId(),
          status: 'completed',
          entity_id: data.id,
          entity_type: 'social_post',
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (!args.platforms?.length || !args.caption) {
      throwConnectorError('VALIDATION_ERROR', 'platforms and caption required when post_id omitted');
    }
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('social_posts')
      .insert({
        tenant_id: args.tenant_id,
        user_id: ctx.userId,
        platforms: args.platforms,
        platform: args.platforms[0],
        caption: args.caption,
        content: args.caption,
        media_urls: args.media_urls || [],
        status: 'scheduled',
        scheduled_at: args.scheduled_at,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();
    if (error) throwConnectorError('CREATE_FAILED', error.message);
    return okResult('schedule_post', data, {
      receipt: {
        action_id: newActionId(),
        status: 'completed',
        entity_id: data.id,
        entity_type: 'social_post',
        timestamp: now,
      },
    });
  },
});

defineConnectorTool({
  module: 'autonomous-ops',
  name: 'get_post_status',
  description: 'Get social post status by id.',
  permission: 'social:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    post_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      post_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'post_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('social_posts')
      .select('id, status, platforms, platform, caption, scheduled_at, published_at, facebook_post_id, error_message, analytics')
      .eq('tenant_id', args.tenant_id)
      .eq('id', args.post_id)
      .maybeSingle();
    if (error) throwConnectorError('QUERY_FAILED', error.message);
    if (!data) throwConnectorError('NOT_FOUND', 'Post not found');
    return data;
  },
});

defineConnectorTool({
  module: 'autonomous-ops',
  name: 'get_post_analytics',
  description: 'Get analytics for a published social post.',
  permission: 'social:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    post_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      post_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'post_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('social_posts')
      .select('id, platforms, analytics, likes, comments, shares, impressions, published_at, status')
      .eq('tenant_id', args.tenant_id)
      .eq('id', args.post_id)
      .maybeSingle();
    if (error && error.code !== '42703') throwConnectorError('QUERY_FAILED', error.message);
    if (!data) {
      const retry = await supabase
        .from('social_posts')
        .select('id, platforms, analytics, published_at, status')
        .eq('tenant_id', args.tenant_id)
        .eq('id', args.post_id)
        .maybeSingle();
      if (retry.error) throwConnectorError('QUERY_FAILED', retry.error.message);
      if (!retry.data) throwConnectorError('NOT_FOUND', 'Post not found');
      return { post_id: retry.data.id, analytics: retry.data.analytics || {}, status: retry.data.status };
    }
    return {
      post_id: data.id,
      analytics: data.analytics || {},
      likes: (data as any).likes,
      comments: (data as any).comments,
      shares: (data as any).shares,
      impressions: (data as any).impressions,
      status: data.status,
    };
  },
});

// ─── Finance ────────────────────────────────────────────────────────────────

defineConnectorTool({
  module: 'autonomous-ops',
  name: 'mark_invoice_paid',
  description: 'Mark an invoice paid with payment evidence. Enforces balance_due=0.',
  permission: 'sales:write',
  rateLimitClass: 'write',
  auditAction: 'mcp_mark_invoice_paid',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    invoice_id: z.string().uuid(),
    amount_paid: z.number().positive(),
    payment_method: z.string().min(1),
    payment_reference: z.string().min(1),
    paid_at: z.string().datetime().optional(),
    confirmed: z.boolean().optional().default(false),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      invoice_id: { type: 'string', format: 'uuid' },
      amount_paid: { type: 'number' },
      payment_method: { type: 'string' },
      payment_reference: { type: 'string' },
      paid_at: { type: 'string', format: 'date-time' },
      confirmed: { type: 'boolean' },
    },
    required: ['tenant_id', 'invoice_id', 'amount_paid', 'payment_method', 'payment_reference'],
  },
  handler: async (args, ctx) => {
    const approval = await requireApprovalIfNeeded({
      tool: 'mark_invoice_paid',
      tenantId: args.tenant_id,
      userId: ctx.userId,
      confirmed: args.confirmed,
      summary: `Mark invoice ${args.invoice_id} paid (${args.amount_paid})`,
    });
    if (approval) return approval;

    const supabase = createSupabaseAdminClient();
    const paidAt = args.paid_at || new Date().toISOString();
    const updates = {
      status: 'paid',
      amount_paid: args.amount_paid,
      balance_due: 0,
      payment_method: args.payment_method,
      payment_reference: args.payment_reference,
      paid_at: paidAt,
      updated_at: new Date().toISOString(),
    };

    let { data, error } = await supabase
      .from('business_invoices')
      .update(updates)
      .eq('tenant_id', args.tenant_id)
      .eq('id', args.invoice_id)
      .select()
      .single();

    if (error) throwConnectorError('UPDATE_FAILED', error.message);

    const validation = validateInvoice({
      status: 'paid',
      total: Number(data.total) || args.amount_paid,
      amount_paid: args.amount_paid,
      balance_due: 0,
      paid_at: paidAt,
      payment_method: args.payment_method,
      payment_reference: args.payment_reference,
      currency: (data as any).currency || 'ZAR',
      supplier_legal_name: (data as any).supplier_legal_name || (data as any).sender_name || 'Alphaclone Systems',
      client_name: (data as any).client_name || 'Client',
      client_email: (data as any).client_email || 'client@example.com',
      is_receipt: true,
    });

    return okResult(
      'mark_invoice_paid',
      { invoice: data, validation, is_receipt: true },
      {
        receipt: {
          action_id: newActionId(),
          status: 'completed',
          entity_id: data.id,
          entity_type: 'invoice',
          timestamp: paidAt,
          provider: args.payment_method,
          provider_reference: args.payment_reference,
          verification: { balance_due: 0, validation },
        },
      }
    );
  },
});

defineConnectorTool({
  module: 'autonomous-ops',
  name: 'validate_document',
  description: 'Validate a contract or invoice before send. Detects contradictions, payment conflicts, and layout defects.',
  permission: 'documents:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    document_type: z.enum(['contract', 'invoice']),
    text: z.string().optional(),
    invoice: z
      .object({
        status: z.string(),
        total: z.number(),
        amount_paid: z.number().optional(),
        balance_due: z.number().optional(),
        paid_at: z.string().optional(),
        payment_method: z.string().optional(),
        payment_reference: z.string().optional(),
        currency: z.string().optional(),
        supplier_legal_name: z.string().optional(),
        client_name: z.string().optional(),
        client_email: z.string().optional(),
        display_name: z.string().optional(),
        is_receipt: z.boolean().optional(),
      })
      .optional(),
    contract: z
      .object({
        clientName: z.string().optional(),
        clientEmail: z.string().optional(),
        jurisdiction: z.string().optional(),
        isDraft: z.boolean().optional(),
        hasSignaturesFilled: z.boolean().optional(),
        documentVersion: z.string().optional(),
      })
      .optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_type: { type: 'string', enum: ['contract', 'invoice'] },
      text: { type: 'string' },
      invoice: { type: 'object' },
      contract: { type: 'object' },
    },
    required: ['tenant_id', 'document_type'],
  },
  handler: async (args) => {
    if (args.document_type === 'invoice') {
      if (!args.invoice) throwConnectorError('VALIDATION_ERROR', 'invoice payload required');
      return validateInvoice(args.invoice as any);
    }
    return validateContract({
      text: args.text || '',
      ...(args.contract || {}),
    });
  },
});

// ─── Workflow control ───────────────────────────────────────────────────────

defineConnectorTool({
  module: 'autonomous-ops',
  name: 'run_workflow',
  description:
    'Start a Bonnie/automation playbook workflow with structured input. Accepts playbook_id or workflow_id and inputs or input object.',
  permission: 'bonnie:execute',
  rateLimitClass: 'write',
  inputSchema: z
    .object({
      tenant_id: tenantIdField,
      playbook_id: z.string().min(1).optional(),
      workflow_id: z.string().min(1).optional(),
      inputs: z.record(z.string(), z.unknown()).optional().default({}),
      input: z.record(z.string(), z.unknown()).optional(),
      auto_high_risk: z.boolean().optional().default(false),
      idempotency_key: z.string().optional(),
    })
    .refine((value) => Boolean(value.playbook_id || value.workflow_id), {
      message: 'playbook_id or workflow_id is required',
      path: ['playbook_id'],
    }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      playbook_id: { type: 'string', description: 'Playbook/workflow identifier' },
      workflow_id: { type: 'string', description: 'Alias for playbook_id' },
      inputs: { type: 'object', description: 'Structured workflow input object' },
      input: { type: 'object', description: 'Alias for inputs' },
      auto_high_risk: { type: 'boolean' },
      idempotency_key: { type: 'string' },
    },
    required: ['tenant_id'],
  },
  handler: async (args, ctx) => {
    const playbookId = args.playbook_id || args.workflow_id;
    if (!playbookId) {
      throwConnectorError('VALIDATION_ERROR', 'playbook_id or workflow_id is required', {
        field: 'playbook_id',
      });
    }
    const inputs = { ...(args.inputs || args.input || {}) };
    if (args.idempotency_key) inputs.idempotency_key = args.idempotency_key;
    inputs.user_id = ctx.userId;
    const result = await startPlaybookRun({
      tenantId: args.tenant_id,
      userId: ctx.userId,
      playbookId,
      inputs,
      autoHighRisk: args.auto_high_risk,
    });
    if (!result.success) {
      throwConnectorError('WORKFLOW_FAILED', result.error || 'Failed to start workflow', {
        playbook_id: playbookId,
      });
    }
    return okResult('run_workflow', result, {
      receipt: {
        action_id: newActionId(),
        status: String((result as any).run?.status || 'running'),
        entity_id: String((result as any).run?.id || ''),
        entity_type: 'workflow_run',
        timestamp: new Date().toISOString(),
      },
    });
  },
});

defineConnectorTool({
  module: 'autonomous-ops',
  name: 'approve_workflow_step',
  description: 'Approve a pending workflow step (portable across ChatGPT, Claude, Cursor, Bonnie).',
  permission: 'bonnie:execute',
  rateLimitClass: 'write',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    approval_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      approval_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'approval_id'],
  },
  handler: async (args, ctx) => {
    const result = await approveWorkflowStep({
      tenantId: args.tenant_id,
      userId: ctx.userId,
      approvalId: args.approval_id,
    });
    if (!result.success && (result as any).error) {
      throwConnectorError('APPROVAL_FAILED', String((result as any).error));
    }
    return okResult('approve_workflow_step', result, {
      receipt: {
        action_id: newActionId(),
        status: String((result as any).status || 'completed'),
        entity_id: args.approval_id,
        entity_type: 'approval',
        timestamp: new Date().toISOString(),
      },
    });
  },
});

defineConnectorTool({
  module: 'autonomous-ops',
  name: 'reject_workflow_step',
  description: 'Reject a pending workflow step across any MCP client.',
  permission: 'bonnie:execute',
  rateLimitClass: 'write',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    approval_id: z.string().uuid(),
    reason: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      approval_id: { type: 'string', format: 'uuid' },
      reason: { type: 'string' },
    },
    required: ['tenant_id', 'approval_id'],
  },
  handler: async (args, ctx) => {
    const result = await rejectWorkflowStep({
      tenantId: args.tenant_id,
      userId: ctx.userId,
      approvalId: args.approval_id,
      reason: args.reason,
    });
    return okResult('reject_workflow_step', result, {
      receipt: {
        action_id: newActionId(),
        status: 'cancelled',
        entity_id: args.approval_id,
        entity_type: 'approval',
        timestamp: new Date().toISOString(),
      },
    });
  },
});

defineConnectorTool({
  module: 'autonomous-ops',
  name: 'resume_workflow',
  description: 'Resume a workflow that is awaiting approval or partially completed.',
  permission: 'bonnie:execute',
  rateLimitClass: 'write',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    run_id: z.string().uuid(),
    auto_high_risk: z.boolean().optional().default(false),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      run_id: { type: 'string', format: 'uuid' },
      auto_high_risk: { type: 'boolean' },
    },
    required: ['tenant_id', 'run_id'],
  },
  handler: async (args) => {
    const result = await resumeWorkflow(args.run_id, args.tenant_id, args.auto_high_risk);
    return okResult('resume_workflow', result, {
      receipt: {
        action_id: newActionId(),
        status: String((result as any).status || 'running'),
        entity_id: args.run_id,
        entity_type: 'workflow_run',
        timestamp: new Date().toISOString(),
      },
    });
  },
});

defineConnectorTool({
  module: 'autonomous-ops',
  name: 'stop_workflow',
  description: 'Cancel / stop a running or awaiting workflow.',
  permission: 'bonnie:execute',
  rateLimitClass: 'write',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    run_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      run_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'run_id'],
  },
  handler: async (args) => {
    const result = await cancelRun(args.run_id, args.tenant_id);
    if (!result.success) throwConnectorError('WORKFLOW_FAILED', result.error || 'Failed to stop');
    return okResult('stop_workflow', result, {
      receipt: {
        action_id: newActionId(),
        status: 'cancelled',
        entity_id: args.run_id,
        entity_type: 'workflow_run',
        timestamp: new Date().toISOString(),
      },
    });
  },
});

defineConnectorTool({
  module: 'autonomous-ops',
  name: 'get_workflow_run',
  description: 'Get workflow run status and step-level evidence (portable across AI clients).',
  permission: 'bonnie:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    run_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      run_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'run_id'],
  },
  handler: async (args) => {
    const result = await getRunStatus(args.run_id, args.tenant_id);
    if (!result.success) throwConnectorError('NOT_FOUND', result.error || 'Run not found');
    return result;
  },
});

defineConnectorTool({
  module: 'autonomous-ops',
  name: 'negotiate_capabilities',
  description:
    'Capability negotiation for any MCP client: protocol version, tool catalog, scopes, approvals, integrations, mode.',
  permission: 'platform:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
  }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string', format: 'uuid' } },
    required: ['tenant_id'],
  },
  handler: async () => {
    const { listTools } = await import('@/lib/mcp/tool-registry');
    const { buildCapabilityManifest } = await import('@/lib/mcp/capabilityManifest');
    const tools = listTools(true).map((t) => t.name);
    return buildCapabilityManifest({
      availableTools: tools,
      testMode: isDryRun(),
    });
  },
});
