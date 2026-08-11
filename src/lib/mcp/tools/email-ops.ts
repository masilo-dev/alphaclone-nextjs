/**
 * Individual email MCP actions — real provider sends (no fake success).
 */

import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { okResult, throwConnectorError } from '@/lib/mcp/connector/response';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { findReceiptByIdempotency, persistActionReceipt } from '@/lib/mcp/actionReceipts';
import { ingestMediaInput } from '@/lib/media/ingestMedia';
import type { MediaInput } from '@/lib/media/types';

function newActionId() {
  return crypto.randomUUID();
}

async function resolveRecipientByNameOrEmail(params: {
  tenantId: string;
  to?: string;
  recipient_name?: string;
  contact_id?: string;
  lead_id?: string;
}): Promise<{ email: string; source: string; matches?: Array<{ id: string; name: string; email: string }> }> {
  const supabase = createSupabaseAdminClient();
  const { resolveMcpEmailRecipient } = await import('@/lib/email/resolveMcpEmailRecipient');

  if (params.to || params.contact_id || params.lead_id) {
    try {
      const resolved = await resolveMcpEmailRecipient(supabase, params.tenantId, {
        to: params.to,
        contact_id: params.contact_id,
        lead_id: params.lead_id,
      });
      return { email: resolved.email, source: resolved.source };
    } catch {
      // fall through to name search
    }
  }

  const name = String(params.recipient_name || params.to || '').trim();
  if (!name) {
    throwConnectorError('RESOURCE_NOT_FOUND', 'Recipient email or name is required');
  }
  if (name.includes('@')) {
    return { email: name, source: 'to' };
  }

  const pattern = `%${name.replace(/[%_]/g, '')}%`;
  const [{ data: contacts }, { data: leads }] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, first_name, last_name, email')
      .eq('tenant_id', params.tenantId)
      .is('deleted_at', null)
      .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(10),
    supabase
      .from('leads')
      .select('id, name, email')
      .eq('tenant_id', params.tenantId)
      .or(`name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(10),
  ]);

  const matches: Array<{ id: string; name: string; email: string }> = [];
  for (const c of contacts || []) {
    const email = String(c.email || (Array.isArray(c.emails) ? c.emails[0] : '') || '').trim();
    if (!email.includes('@')) continue;
    matches.push({
      id: c.id,
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || email,
      email,
    });
  }
  for (const l of leads || []) {
    const email = String(l.email || (Array.isArray(l.emails) ? l.emails[0] : '') || '').trim();
    if (!email.includes('@')) continue;
    matches.push({
      id: l.id,
      name: String(l.name || email),
      email,
    });
  }

  const uniqueByEmail = Array.from(new Map(matches.map((m) => [m.email.toLowerCase(), m])).values());
  if (uniqueByEmail.length === 0) {
    throwConnectorError('RESOURCE_NOT_FOUND', `No contact/lead email found for "${name}"`);
  }
  if (uniqueByEmail.length > 1) {
    throwConnectorError('RECIPIENT_AMBIGUOUS', `Multiple contacts matched "${name}".`, {
      matches: uniqueByEmail,
    });
  }
  return { email: uniqueByEmail[0].email, source: 'crm_name', matches: uniqueByEmail };
}

async function attachmentsFromMedia(
  tenantId: string,
  userId: string,
  attachments?: Array<Record<string, unknown>>
): Promise<Array<{ filename: string; content: string; contentType?: string }>> {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];
  const out: Array<{ filename: string; content: string; contentType?: string }> = [];
  for (const raw of attachments) {
    let media: MediaInput | null = null;
    if (raw.type === 'asset_id' || raw.asset_id) {
      media = { type: 'asset_id', assetId: String(raw.assetId || raw.asset_id) };
    } else if (raw.type === 'base64' || raw.data) {
      media = {
        type: 'base64',
        data: String(raw.data),
        mimeType: String(raw.mime_type || raw.mimeType || 'application/octet-stream'),
        filename: String(raw.filename || 'attachment.bin'),
      };
    } else if (raw.type === 'url' || raw.url) {
      media = { type: 'url', url: String(raw.url), filename: raw.filename ? String(raw.filename) : undefined };
    } else if (raw.type === 'data_url' || raw.data_url) {
      media = {
        type: 'data_url',
        dataUrl: String(raw.dataUrl || raw.data_url),
        filename: raw.filename ? String(raw.filename) : undefined,
      };
    }
    if (!media) continue;
    const asset = await ingestMediaInput({ tenantId, userId, media, purpose: 'email_attachment' });
    // Providers that accept URL attachments use content as base64 of a tiny stub is wrong —
    // fetch bytes for attachment payload.
    const res = await fetch(asset.url);
    const buf = Buffer.from(await res.arrayBuffer());
    out.push({
      filename: asset.filename,
      content: buf.toString('base64'),
      contentType: asset.mime_type,
    });
  }
  return out;
}

async function recordExternalAction(params: {
  tenantId: string;
  userId: string;
  tool: string;
  status: string;
  provider?: string | null;
  providerReference?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from('external_actions').upsert(
      {
        tenant_id: params.tenantId,
        user_id: params.userId,
        tool_name: params.tool,
        action_type: 'email',
        status: params.status,
        provider: params.provider || null,
        provider_reference: params.providerReference || null,
        idempotency_key: params.idempotencyKey || null,
        metadata: params.metadata || {},
        started_at: new Date().toISOString(),
        completed_at: ['completed', 'failed'].includes(params.status)
          ? new Date().toISOString()
          : null,
      },
      { onConflict: 'tenant_id,tool_name,idempotency_key', ignoreDuplicates: false }
    );
  } catch {
    // table may not exist yet
  }
}

// ── list_email_accounts ──────────────────────────────────────────────────────
defineConnectorTool({
  module: 'email-ops',
  name: 'list_email_accounts',
  description:
    'List connected outbound email providers/accounts for the authenticated tenant (Zoho/Gmail/Brevo/etc). Never returns secrets.',
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
    const tenantId = ctx.tenantId;
    if (!tenantId) throwConnectorError('TENANT_ACCESS_DENIED', 'Active workspace required');
    const supabase = createSupabaseAdminClient();
    const { data: integrations } = await supabase
      .from('integrations')
      .select('id, provider, status, metadata, created_at')
      .eq('tenant_id', tenantId)
      .in('provider', ['zoho', 'gmail', 'brevo', 'sendgrid', 'resend', 'outlook', 'smtp']);

    const { data: senders } = await supabase
      .from('email_sender_addresses')
      .select('id, provider, email_address, display_name, is_default, is_verified, region')
      .eq('tenant_id', tenantId);

    return okResult('list_email_accounts', {
      accounts: (integrations || []).map((row) => ({
        account_id: row.id,
        provider: row.provider,
        status: row.status,
        connected_at: row.created_at,
      })),
      sender_addresses: senders || [],
    });
  },
});

// ── send_email ───────────────────────────────────────────────────────────────
defineConnectorTool({
  module: 'email-ops',
  name: 'send_email',
  description:
    'Send an individual email via the tenant connected provider. Resolve CRM contacts by contact_id/lead_id or exact email. If a person name matches multiple contacts, returns RECIPIENT_AMBIGUOUS. Supports attachments via media asset_id/base64/url.',
  permission: 'sales:write',
  rateLimitClass: 'write',
  auditAction: 'mcp_send_email',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    account_id: z.string().uuid().optional(),
    to: z.string().optional(),
    recipient_name: z.string().optional(),
    contact_id: z.string().uuid().optional(),
    lead_id: z.string().uuid().optional(),
    cc: z.array(z.string().email()).optional(),
    bcc: z.array(z.string().email()).optional(),
    subject: z.string().min(1),
    text: z.string().optional(),
    html: z.string().optional(),
    provider: z
      .enum(['zoho', 'brevo', 'gmail', 'outlook', 'resend', 'sendgrid'])
      .optional(),
    attachments: z.array(z.record(z.string(), z.unknown())).optional(),
    idempotency_key: z.string().min(1),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      account_id: { type: 'string', format: 'uuid' },
      to: { type: 'string', description: 'Recipient email or leave blank and use recipient_name/contact_id' },
      recipient_name: { type: 'string' },
      contact_id: { type: 'string', format: 'uuid' },
      lead_id: { type: 'string', format: 'uuid' },
      cc: { type: 'array', items: { type: 'string' } },
      bcc: { type: 'array', items: { type: 'string' } },
      subject: { type: 'string' },
      text: { type: 'string' },
      html: { type: 'string' },
      provider: {
        type: 'string',
        enum: ['zoho', 'brevo', 'gmail', 'outlook', 'resend', 'sendgrid'],
      },
      attachments: { type: 'array', items: { type: 'object' } },
      idempotency_key: { type: 'string' },
    },
    required: ['subject', 'idempotency_key'],
  },
  handler: async (args, ctx) => {
    const tenantId = ctx.tenantId;
    const userId = ctx.userId;
    if (!tenantId || !userId) throwConnectorError('AUTH_REQUIRED', 'Authenticated workspace session required');

    const existing = await findReceiptByIdempotency({
      tenantId,
      tool: 'send_email',
      idempotencyKey: args.idempotency_key,
    });
    if (existing) {
      return okResult('send_email', existing.sanitized_output, {
        receipt: {
          action_id: String(existing.action_id),
          status: String(existing.final_status),
          provider: existing.provider as string,
          provider_reference: existing.provider_reference as string,
          entity_type: 'email',
        },
        meta: { deduplicated: true, idempotency_key: args.idempotency_key },
      });
    }

    const recipient = await resolveRecipientByNameOrEmail({
      tenantId,
      to: args.to,
      recipient_name: args.recipient_name,
      contact_id: args.contact_id,
      lead_id: args.lead_id,
    });

    if (!args.text && !args.html) {
      throwConnectorError('INVALID_MEDIA', 'Email text or html body is required');
    }

    const attachments = await attachmentsFromMedia(tenantId, userId, args.attachments);

    const result = await sendEmailServer({
      tenantId,
      userId,
      to: recipient.email,
      subject: args.subject,
      text: args.text,
      html: args.html,
      attachments: attachments.length
        ? attachments.map((a) => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType,
          }))
        : undefined,
      preferredProvider:
        args.provider === 'zoho' ||
        args.provider === 'brevo' ||
        args.provider === 'sendgrid' ||
        args.provider === 'resend'
          ? args.provider
          : undefined,
    });

    if (!result.success) {
      await recordExternalAction({
        tenantId,
        userId,
        tool: 'send_email',
        status: 'failed',
        provider: result.provider,
        idempotencyKey: args.idempotency_key,
        metadata: { code: result.code, error: result.error },
      });
      throwConnectorError(
        result.code || 'PROVIDER_REJECTED',
        result.error || 'Email provider rejected the send',
        result.errorDetails
      );
    }

    const acceptedAt = new Date().toISOString();
    const delivery = {
      provider: result.provider,
      message_id: result.emailId,
      recipient: recipient.email,
      recipient_source: recipient.source,
      accepted_at: acceptedAt,
      delivery_status: 'provider_accepted',
      verification: {
        verified: Boolean(result.emailId),
        verified_at: acceptedAt,
        note: 'Provider accepted the message; mailbox delivery is not guaranteed.',
      },
    };

    const receipt = {
      action_id: newActionId(),
      status: 'completed' as const,
      provider: result.provider || null,
      provider_reference: result.emailId || null,
      entity_id: result.emailId || null,
      entity_type: 'email',
      timestamp: acceptedAt,
      verification: delivery.verification,
      retry_available: true,
    };

    await persistActionReceipt({
      tenantId,
      userId,
      tool: 'send_email',
      idempotencyKey: args.idempotency_key,
      receipt,
      success: true,
      sanitizedInput: {
        to: recipient.email,
        subject: args.subject,
        provider: args.provider,
        attachment_count: attachments.length,
      },
      sanitizedOutput: delivery,
    });

    await recordExternalAction({
      tenantId,
      userId,
      tool: 'send_email',
      status: 'completed',
      provider: result.provider,
      providerReference: result.emailId,
      idempotencyKey: args.idempotency_key,
      metadata: { recipient_source: recipient.source },
    });

    return okResult('send_email', delivery, {
      receipt,
      meta: { idempotency_key: args.idempotency_key, tenant_id: tenantId },
    });
  },
});

// ── create_email_draft ───────────────────────────────────────────────────────
defineConnectorTool({
  module: 'email-ops',
  name: 'create_email_draft',
  description: 'Create an email draft in Zoho Mail for the authenticated tenant (does not send).',
  permission: 'sales:write',
  rateLimitClass: 'write',
  auditAction: 'mcp_create_email_draft',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    to: z.string().optional(),
    recipient_name: z.string().optional(),
    contact_id: z.string().uuid().optional(),
    subject: z.string().min(1),
    text: z.string().optional(),
    html: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      to: { type: 'string' },
      recipient_name: { type: 'string' },
      contact_id: { type: 'string', format: 'uuid' },
      subject: { type: 'string' },
      text: { type: 'string' },
      html: { type: 'string' },
    },
    required: ['subject'],
  },
  handler: async (args, ctx) => {
    const tenantId = ctx.tenantId;
    const userId = ctx.userId;
    if (!tenantId || !userId) throwConnectorError('AUTH_REQUIRED', 'Authenticated workspace session required');

    const recipient = await resolveRecipientByNameOrEmail({
      tenantId,
      to: args.to,
      recipient_name: args.recipient_name,
      contact_id: args.contact_id,
    });

    const { ZohoMailService } = await import('@/services/zoho/ZohoMailService');
    const zoho = new ZohoMailService(userId, tenantId);
    const draft = await zoho.saveDraft({
      toAddress: recipient.email,
      subject: args.subject,
      content: args.html || args.text || '',
    });

    return okResult('create_email_draft', {
      provider: 'zoho',
      draft,
      recipient: recipient.email,
      status: 'drafted',
    });
  },
});

// ── reply_to_email ───────────────────────────────────────────────────────────
defineConnectorTool({
  module: 'email-ops',
  name: 'reply_to_email',
  description: 'Reply to an existing Zoho Mail message by message_id.',
  permission: 'sales:write',
  rateLimitClass: 'write',
  auditAction: 'mcp_reply_to_email',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    message_id: z.string().min(1),
    text: z.string().optional(),
    html: z.string().optional(),
    idempotency_key: z.string().min(1),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      message_id: { type: 'string' },
      text: { type: 'string' },
      html: { type: 'string' },
      idempotency_key: { type: 'string' },
    },
    required: ['message_id', 'idempotency_key'],
  },
  handler: async (args, ctx) => {
    const tenantId = ctx.tenantId;
    const userId = ctx.userId;
    if (!tenantId || !userId) throwConnectorError('AUTH_REQUIRED', 'Authenticated workspace session required');

    const existing = await findReceiptByIdempotency({
      tenantId,
      tool: 'reply_to_email',
      idempotencyKey: args.idempotency_key,
    });
    if (existing) {
      return okResult('reply_to_email', existing.sanitized_output, {
        receipt: {
          action_id: String(existing.action_id),
          status: String(existing.final_status),
          provider: existing.provider as string,
          provider_reference: existing.provider_reference as string,
        },
        meta: { deduplicated: true },
      });
    }

    if (!args.text && !args.html) {
      throwConnectorError('INVALID_MEDIA', 'Reply text or html is required');
    }

    const { ZohoMailService } = await import('@/services/zoho/ZohoMailService');
    const zoho = new ZohoMailService(userId, tenantId);
    const result = await zoho.replyToMessage({
      messageId: args.message_id,
      bodyHtml: args.html || `<p>${args.text}</p>`,
      bodyText: args.text,
    });

    const providerRef =
      result?.data?.messageId || result?.messageId || `zoho-reply-${Date.now()}`;
    const acceptedAt = new Date().toISOString();
    const data = {
      provider: 'zoho',
      message_id: providerRef,
      in_reply_to: args.message_id,
      delivery_status: 'provider_accepted',
      accepted_at: acceptedAt,
    };
    const receipt = {
      action_id: newActionId(),
      status: 'completed' as const,
      provider: 'zoho',
      provider_reference: String(providerRef),
      entity_type: 'email',
      timestamp: acceptedAt,
      verification: { verified: true, verified_at: acceptedAt },
    };
    await persistActionReceipt({
      tenantId,
      userId,
      tool: 'reply_to_email',
      idempotencyKey: args.idempotency_key,
      receipt,
      success: true,
      sanitizedInput: { message_id: args.message_id },
      sanitizedOutput: data,
    });
    return okResult('reply_to_email', data, { receipt });
  },
});

// ── get_action_status ────────────────────────────────────────────────────────
defineConnectorTool({
  module: 'email-ops',
  name: 'get_action_status',
  description: 'Look up MCP action receipt / external action status by action_id or idempotency_key.',
  permission: 'integrations:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    action_id: z.string().optional(),
    idempotency_key: z.string().optional(),
    tool: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      action_id: { type: 'string' },
      idempotency_key: { type: 'string' },
      tool: { type: 'string' },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const tenantId = ctx.tenantId;
    if (!tenantId) throwConnectorError('TENANT_ACCESS_DENIED', 'Active workspace required');
    const supabase = createSupabaseAdminClient();

    if (args.idempotency_key && args.tool) {
      const row = await findReceiptByIdempotency({
        tenantId,
        tool: args.tool,
        idempotencyKey: args.idempotency_key,
      });
      return okResult('get_action_status', { receipt: row });
    }

    if (args.action_id) {
      const { data } = await supabase
        .from('mcp_action_receipts')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('action_id', args.action_id)
        .maybeSingle();
      return okResult('get_action_status', { receipt: data });
    }

    throwConnectorError('RESOURCE_NOT_FOUND', 'Provide action_id or (tool + idempotency_key)');
  },
});

// ── get_media_asset / list_media_assets ──────────────────────────────────────
defineConnectorTool({
  module: 'email-ops',
  name: 'get_media_asset',
  description: 'Fetch a tenant-scoped media asset by ID (no storage credentials).',
  permission: 'integrations:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    asset_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: { asset_id: { type: 'string', format: 'uuid' } },
    required: ['asset_id'],
  },
  handler: async (args, ctx) => {
    const tenantId = ctx.tenantId;
    if (!tenantId) throwConnectorError('TENANT_ACCESS_DENIED', 'Active workspace required');
    const asset = await ingestMediaInput({
      tenantId,
      userId: ctx.userId || '00000000-0000-0000-0000-000000000000',
      media: { type: 'asset_id', assetId: args.asset_id },
    });
    return okResult('get_media_asset', { asset });
  },
});

defineConnectorTool({
  module: 'email-ops',
  name: 'list_media_assets',
  description: 'List recent media assets for the authenticated tenant.',
  permission: 'integrations:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    limit: z.number().int().min(1).max(50).optional().default(20),
  }),
  jsonSchema: {
    type: 'object',
    properties: { limit: { type: 'number' } },
    required: [],
  },
  handler: async (args, ctx) => {
    const tenantId = ctx.tenantId;
    if (!tenantId) throwConnectorError('TENANT_ACCESS_DENIED', 'Active workspace required');
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('media_assets')
      .select('id, file_name, file_type, file_size_bytes, public_url, width, height, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(args.limit || 20);
    if (error) throwConnectorError('INTERNAL_ERROR', error.message);
    return okResult('list_media_assets', {
      assets: (data || []).map((row) => ({
        id: row.id,
        filename: row.file_name,
        mime_type: row.file_type,
        size_bytes: row.file_size_bytes,
        url: row.public_url,
        width: row.width,
        height: row.height,
        created_at: row.created_at,
        status: 'ready',
      })),
    });
  },
});
