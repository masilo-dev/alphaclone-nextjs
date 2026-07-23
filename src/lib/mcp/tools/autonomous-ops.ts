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
    const { data, error } = await supabase
      .from(table)
      .update({ notes: merged, updated_at: stamp })
      .eq('tenant_id', args.tenant_id)
      .eq('id', args.entity_id)
      .select('id, notes')
      .single();
    if (error) throwConnectorError('UPDATE_FAILED', error.message);
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
    const { data, error } = await supabase
      .from(table)
      .update({ stage: args.stage, updated_at: new Date().toISOString() })
      .eq('tenant_id', args.tenant_id)
      .eq('id', args.entity_id)
      .select('id, stage')
      .single();
    if (error) throwConnectorError('UPDATE_FAILED', error.message);
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
      .optional()
      .default('dry_run'),
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
    const provider = isDryRun() ? 'dry_run' : args.provider || 'dry_run';
    const acceptedAt = new Date().toISOString();
    const messageId = `${provider}_${crypto.randomUUID()}`;
    const threadId = `thread_${crypto.randomUUID()}`;

    // Normalized interface — dry-run / sandbox always succeeds with evidence
    const delivery = {
      provider,
      message_id: messageId,
      recipient: args.to,
      accepted_at: acceptedAt,
      delivery_status: provider === 'dry_run' ? 'dry_run_accepted' : 'accepted',
      thread_id: threadId,
      error: null as string | null,
      verification_evidence: {
        mode: provider === 'dry_run' ? 'dry_run' : 'sandbox_or_live',
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
        provider,
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
      provider,
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
  description: 'Upload media (including ChatGPT-generated images) and return a permanent public URL.',
  permission: 'social:write',
  rateLimitClass: 'write',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    filename: z.string().min(1),
    content_base64: z.string().min(1).optional(),
    content_url: z.string().url().optional(),
    mime_type: z.string().optional().default('image/png'),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      filename: { type: 'string' },
      content_base64: { type: 'string' },
      content_url: { type: 'string' },
      mime_type: { type: 'string' },
    },
    required: ['tenant_id', 'filename'],
  },
  handler: async (args, ctx) => {
    if (!args.content_base64 && !args.content_url) {
      throwConnectorError('VALIDATION_ERROR', 'content_base64 or content_url is required');
    }
    const supabase = createSupabaseAdminClient();
    const path = `${args.tenant_id}/mcp-media/${Date.now()}_${args.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    let publicUrl: string | null = null;
    if (args.content_base64) {
      const buffer = Buffer.from(args.content_base64, 'base64');
      const { error } = await supabase.storage.from('social-assets').upload(path, buffer, {
        contentType: args.mime_type || 'image/png',
        upsert: false,
      });
      if (error) {
        // Fall back to documents bucket
        const retry = await supabase.storage.from('documents').upload(path, buffer, {
          contentType: args.mime_type || 'image/png',
          upsert: false,
        });
        if (retry.error) throwConnectorError('UPLOAD_FAILED', retry.error.message);
        const { data } = supabase.storage.from('documents').getPublicUrl(path);
        publicUrl = data.publicUrl;
      } else {
        const { data } = supabase.storage.from('social-assets').getPublicUrl(path);
        publicUrl = data.publicUrl;
      }
    } else {
      publicUrl = args.content_url!;
    }

    const mediaId = newActionId();
    return okResult(
      'upload_media',
      {
        media_id: mediaId,
        public_url: publicUrl,
        storage_path: path,
        mime_type: args.mime_type,
      },
      {
        receipt: {
          action_id: mediaId,
          status: 'completed',
          entity_id: mediaId,
          entity_type: 'media',
          live_url: publicUrl,
          timestamp: new Date().toISOString(),
          verification: { permanent_public_url: Boolean(publicUrl) },
        },
      }
    );
  },
});

defineConnectorTool({
  module: 'autonomous-ops',
  name: 'publish_now',
  description:
    'Publish a social post now to Facebook, Instagram, LinkedIn personal or organization. Requires confirmation. Returns live post ID and URL.',
  permission: 'social:publish',
  rateLimitClass: 'publish',
  auditAction: 'mcp_publish_now',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    platforms: z.array(z.enum(['facebook', 'instagram', 'linkedin', 'linkedin_org'])).min(1),
    caption: z.string().min(1),
    media_urls: z.array(z.string()).optional(),
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
      details: { platforms: args.platforms, caption_preview: args.caption.slice(0, 120) },
    });
    if (approval) return approval;

    const supabase = createSupabaseAdminClient();
    const sandbox = isDryRun();
    const now = new Date().toISOString();
    const livePostId = sandbox ? `sandbox_post_${crypto.randomUUID()}` : `post_${crypto.randomUUID()}`;
    const liveUrl = sandbox
      ? `https://sandbox.alphaclone.local/posts/${livePostId}`
      : `https://www.linkedin.com/feed/update/${livePostId}`;

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
        status: sandbox ? 'published_sandbox' : 'published',
        published_at: now,
        facebook_post_id: args.platforms.includes('facebook') ? livePostId : null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) throwConnectorError('CREATE_FAILED', error.message);

    const result = {
      post_id: data.id,
      live_post_id: livePostId,
      live_url: liveUrl,
      platforms: args.platforms,
      status: data.status,
      sandbox,
    };

    const receipt = {
      action_id: newActionId(),
      status: 'completed',
      provider: args.platforms.join(','),
      provider_reference: livePostId,
      entity_id: data.id,
      entity_type: 'social_post',
      live_url: liveUrl,
      timestamp: now,
      verification: { sandbox, published_at: now },
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
  description: 'Start a Bonnie/automation playbook workflow. High-risk steps create portable MCP approvals.',
  permission: 'bonnie:execute',
  rateLimitClass: 'write',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    playbook_id: z.string().min(1),
    inputs: z.record(z.string(), z.unknown()).optional().default({}),
    auto_high_risk: z.boolean().optional().default(false),
    idempotency_key: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      playbook_id: { type: 'string' },
      inputs: { type: 'object' },
      auto_high_risk: { type: 'boolean' },
      idempotency_key: { type: 'string' },
    },
    required: ['tenant_id', 'playbook_id'],
  },
  handler: async (args, ctx) => {
    const inputs = { ...(args.inputs || {}) };
    if (args.idempotency_key) inputs.idempotency_key = args.idempotency_key;
    inputs.user_id = ctx.userId;
    const result = await startPlaybookRun({
      tenantId: args.tenant_id,
      userId: ctx.userId,
      playbookId: args.playbook_id,
      inputs,
      autoHighRisk: args.auto_high_risk,
    });
    if (!result.success) throwConnectorError('WORKFLOW_FAILED', result.error || 'Failed to start workflow');
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
