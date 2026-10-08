import { createHash } from 'node:crypto';
import {
  emailOperationStore,
  runEmailOperation,
} from '@/lib/email/emailOperation';
import { MailboxService } from '@/lib/email/mailboxService';
import { explicitRecipients } from '@/lib/email/mailboxNormalization';
import { emailReceiptEvidence } from '@/lib/email/emailReceiptEvidence';
import { renderOutboundEmail } from '@/lib/email/emailRendering';
/**
 * Individual email MCP actions — real provider sends (no fake success).
 */

import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { okResult, throwConnectorError } from '@/lib/mcp/connector/response';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import type { OutboundEmailProvider } from '@/lib/email/sendEmail';
import {
  findReceiptByIdempotency,
  persistActionReceipt,
} from '@/lib/mcp/actionReceipts';
import { executeMcpWrite } from '@/lib/mcp/executionGateway';
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
}): Promise<{
  email: string;
  source: string;
  matches?: Array<{ id: string; name: string; email: string }>;
}> {
  const supabase = createSupabaseAdminClient();
  const { resolveMcpEmailRecipient } =
    await import('@/lib/email/resolveMcpEmailRecipient');

  if (params.to || params.contact_id || params.lead_id) {
    try {
      const resolved = await resolveMcpEmailRecipient(
        supabase,
        params.tenantId,
        {
          to: params.to,
          contact_id: params.contact_id,
          lead_id: params.lead_id,
        },
      );
      return { email: resolved.email, source: resolved.source };
    } catch {
      // fall through to name search
    }
  }

  const name = String(params.recipient_name || params.to || '').trim();
  if (!name) {
    throwConnectorError(
      'RESOURCE_NOT_FOUND',
      'Recipient email or name is required',
    );
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
      .or(
        `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`,
      )
      .limit(10),
    supabase
      .from('leads')
      .select('id, business_name, contact_name, email')
      .eq('tenant_id', params.tenantId)
      .or(
        `business_name.ilike.${pattern},contact_name.ilike.${pattern},email.ilike.${pattern}`,
      )
      .limit(10),
  ]);

  const matches: Array<{ id: string; name: string; email: string }> = [];
  for (const c of contacts || []) {
    const legacyEmails = (c as { emails?: unknown }).emails;
    const email = String(
      c.email || (Array.isArray(legacyEmails) ? legacyEmails[0] : '') || '',
    ).trim();
    if (!email.includes('@')) continue;
    matches.push({
      id: c.id,
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || email,
      email,
    });
  }
  for (const l of leads || []) {
    const legacyEmails = (l as { emails?: unknown }).emails;
    const email = String(
      l.email || (Array.isArray(legacyEmails) ? legacyEmails[0] : '') || '',
    ).trim();
    if (!email.includes('@')) continue;
    matches.push({
      id: l.id,
      name: String(l.contact_name || l.business_name || email),
      email,
    });
  }

  const uniqueByEmail = Array.from(
    new Map(matches.map((m) => [m.email.toLowerCase(), m])).values(),
  );
  if (uniqueByEmail.length === 0) {
    throwConnectorError(
      'RESOURCE_NOT_FOUND',
      `No contact/lead email found for "${name}"`,
    );
  }
  if (uniqueByEmail.length > 1) {
    throwConnectorError(
      'RECIPIENT_AMBIGUOUS',
      `Multiple contacts matched "${name}".`,
      {
        matches: uniqueByEmail,
      },
    );
  }
  return {
    email: uniqueByEmail[0].email,
    source: 'crm_name',
    matches: uniqueByEmail,
  };
}

async function attachmentsFromMedia(
  tenantId: string,
  userId: string,
  attachments?: Array<Record<string, unknown>>,
): Promise<Array<{ filename: string; content: string; contentType?: string }>> {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];
  const out: Array<{
    filename: string;
    content: string;
    contentType?: string;
  }> = [];
  for (const raw of attachments) {
    // 1. Direct base64 content / data payload
    if (raw.content && typeof raw.content === 'string') {
      out.push({
        filename: String(raw.filename || 'attachment.bin'),
        content: String(raw.content),
        contentType: String(
          raw.contentType ||
            raw.mime_type ||
            raw.mimeType ||
            'application/octet-stream',
        ),
      });
      continue;
    }
    if (raw.data && typeof raw.data === 'string') {
      out.push({
        filename: String(raw.filename || 'attachment.bin'),
        content: String(raw.data),
        contentType: String(
          raw.contentType ||
            raw.mime_type ||
            raw.mimeType ||
            'application/octet-stream',
        ),
      });
      continue;
    }
    if (typeof raw.data_url === 'string' || typeof raw.dataUrl === 'string') {
      const du = String(raw.data_url || raw.dataUrl);
      const match = du.match(/^data:([^;,]+);base64,([\s\S]*)$/i);
      if (match) {
        out.push({
          filename: String(raw.filename || 'attachment.bin'),
          content: match[2].trim(),
          contentType: match[1] || 'application/octet-stream',
        });
        continue;
      }
    }

    // 2. Fallback to media resolution for asset_id or remote url
    let media: MediaInput | null = null;
    if (raw.type === 'asset_id' || raw.asset_id) {
      media = {
        type: 'asset_id',
        assetId: String(raw.assetId || raw.asset_id),
      };
    } else if (raw.type === 'base64') {
      media = {
        type: 'base64',
        data: String(raw.data || raw.content),
        mimeType: String(
          raw.mime_type || raw.mimeType || 'application/octet-stream',
        ),
        filename: String(raw.filename || 'attachment.bin'),
      };
    } else if (raw.type === 'url' || raw.url) {
      media = {
        type: 'url',
        url: String(raw.url),
        filename: raw.filename ? String(raw.filename) : undefined,
      };
    }
    if (!media) throw new Error('EMAIL_ATTACHMENT_INVALID');

    try {
      const asset = await ingestMediaInput({
        tenantId,
        userId,
        media,
        purpose: 'email_attachment',
      });
      const res = await fetch(asset.url);
      if (!res.ok) throw new Error('EMAIL_ATTACHMENT_DOWNLOAD_FAILED');
      const buf = Buffer.from(await res.arrayBuffer());
      out.push({
        filename: asset.filename,
        content: buf.toString('base64'),
        contentType: asset.mime_type,
      });
    } catch (err: any) {
      throw new Error(`EMAIL_ATTACHMENT_FAILED: ${err?.message || err}`);
    }
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
      {
        onConflict: 'tenant_id,tool_name,idempotency_key',
        ignoreDuplicates: false,
      },
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
    const mailbox = new MailboxService(ctx.tenantId, ctx.userId);
    return okResult(
      'list_email_accounts',
      {
        accounts: await mailbox.discover(),
        limitation:
          'Read verification calls the provider. Send scope/identity availability is separate from a successful send or delivery.',
      },
      {
        receipt: {
          status: 'completed',
          verification: { scope: 'mailbox_discovery' },
        },
      },
    );
  },
});

// ── send_email ───────────────────────────────────────────────────────────────
defineConnectorTool({
  module: 'email-ops',
  name: 'send_email',
  description:
    'Start an email conversation with explicit to/cc/bcc email addresses; CRM records are optional and are never auto-created. Supports verified mailbox selection, exact text/HTML content, attachments, durable receipts and duplicate-safe retries.',
  permission: 'sales:write',
  rateLimitClass: 'write',
  auditAction: 'mcp_send_email',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    account_id: z.string().uuid().optional(),
    to: z
      .union([z.string(), z.array(z.string().email()).min(1).max(100)])
      .optional(),
    recipient_name: z.string().optional(),
    contact_id: z.string().uuid().optional(),
    lead_id: z.string().uuid().optional(),
    cc: z.array(z.string().email()).optional(),
    bcc: z.array(z.string().email()).optional(),
    subject: z.string().min(1),
    text: z.string().optional(),
    html: z.string().optional(),
    category: z
      .enum([
        'marketing',
        'outreach',
        'transactional',
        'account_security',
        'invoice_payment',
        'contract_document',
        'booking_calendar',
        'internal_notification',
      ])
      .optional(),
    headline: z.string().optional(),
    cta_label: z.string().optional(),
    cta_url: z.string().url().optional(),
    related_record_type: z.string().optional(),
    related_record_id: z.string().optional(),
    campaign_id: z.string().optional(),
    workflow_id: z.string().optional(),
    provider: z
      .enum(['zoho', 'brevo', 'gmail', 'outlook', 'resend', 'sendgrid'])
      .optional(),
    attachments: z.array(z.record(z.string(), z.unknown())).optional(),
    idempotency_key: z.string().min(1).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      account_id: { type: 'string', format: 'uuid' },
      to: {
        anyOf: [
          { type: 'string' },
          { type: 'array', items: { type: 'string' } },
        ],
        description: 'Explicit recipient addresses; CRM record optional',
      },
      recipient_name: { type: 'string' },
      contact_id: { type: 'string', format: 'uuid' },
      lead_id: { type: 'string', format: 'uuid' },
      cc: { type: 'array', items: { type: 'string' } },
      bcc: { type: 'array', items: { type: 'string' } },
      subject: { type: 'string' },
      text: {
        type: 'string',
        description: 'Plain text message body (gateway renders branded HTML)',
      },
      html: { type: 'string', description: 'Optional HTML body' },
      category: {
        type: 'string',
        enum: [
          'marketing',
          'outreach',
          'transactional',
          'account_security',
          'invoice_payment',
          'contract_document',
          'booking_calendar',
          'internal_notification',
        ],
      },
      headline: { type: 'string' },
      cta_label: { type: 'string' },
      cta_url: { type: 'string' },
      provider: {
        type: 'string',
        enum: ['zoho', 'brevo', 'gmail', 'outlook', 'resend', 'sendgrid'],
      },
      attachments: { type: 'array', items: { type: 'object' } },
      idempotency_key: { type: 'string' },
    },
    required: ['subject'],
  },
  handler: async (args, ctx) => {
    const tenantId = ctx.tenantId;
    const userId = ctx.userId;
    if (!tenantId || !userId)
      throwConnectorError(
        'AUTH_REQUIRED',
        'Authenticated workspace session required',
      );

    const idempotencyKey =
      args.idempotency_key?.trim() ||
      `mcp-send_email-${createHash('sha256')
        .update(
          JSON.stringify({ tenantId, userId, ...args, tenant_id: undefined }),
        )
        .digest('hex')}`;

    const existing = await findReceiptByIdempotency({
      tenantId,
      tool: 'send_email',
      idempotencyKey,
    });
    if (existing) {
      const evidence = await emailReceiptEvidence(tenantId, userId, existing);
      const replay = okResult(
        'send_email',
        {
          ...(existing.sanitized_output as Record<string, unknown>),
          ...evidence,
          idempotent_replay: true,
        },
        {
          receipt: {
            action_id: String(existing.action_id),
            status: String(existing.final_status),
            provider: existing.provider as string,
            provider_reference: existing.provider_reference as string,
            entity_type: 'email',
          },
          meta: { deduplicated: true, idempotency_key: idempotencyKey },
        },
      );
      if (
        !existing.success ||
        evidence.delivery_evidence?.status === 'failed'
      ) {
        return {
          ...replay,
          ok: false as const,
          error: {
            code: String(
              existing.error_code || 'PREVIOUS_EMAIL_EXECUTION_FAILED',
            ),
            message:
              'The previous email attempt was not successful. Review its persisted outcome; no new send was made.',
            retryable: false,
          },
        };
      }
      return replay;
    }

    const directTo = args.to ? explicitRecipients(args.to) : null;
    const recipient = directTo
      ? { email: directTo[0], source: 'to', matches: undefined }
      : await resolveRecipientByNameOrEmail({
          tenantId,
          to: typeof args.to === 'string' ? args.to : undefined,
          recipient_name: args.recipient_name,
          contact_id: args.contact_id,
          lead_id: args.lead_id,
        });

    if (!args.text && !args.html) {
      throwConnectorError(
        'INVALID_MEDIA',
        'Email text or HTML body is required.',
      );
    }

    const attachments = await attachmentsFromMedia(
      tenantId,
      userId,
      args.attachments,
    );

    const { resolveMcpActionReadiness } =
      await import('@/lib/mcp/actionReadiness');
    const readiness = await resolveMcpActionReadiness({
      tenantId,
      userId,
      action: 'email_send',
    });
    if (!readiness.email_send?.executable) {
      throwConnectorError(
        'PROVIDER_MISSING',
        readiness.email_send?.setup_hint ||
          'Connect Zoho, Gmail, Brevo, or another email provider in Settings → Integrations before sending.',
        { missing: readiness.email_send?.missing },
      );
    }

    const mailboxSvc = new MailboxService(tenantId, userId);
    const sendingMailbox =
      !args.provider || args.provider === 'zoho'
        ? await mailboxSvc.verify(
            await mailboxSvc.account(args.account_id),
          ).catch(() => null)
        : null;
    const sentFolder = sendingMailbox
      ? (await mailboxSvc.provider(sendingMailbox).getFolders().catch(() => []))
          .find((f: any) => String(f.folderName || '').toLowerCase().includes('sent') || String(f.folderType || '').toLowerCase() === 'sent')
      : null;
    const preferredOutbound: OutboundEmailProvider | undefined =
      args.provider === 'zoho' ||
      args.provider === 'brevo' ||
      args.provider === 'sendgrid' ||
      args.provider === 'resend' ||
      args.provider === 'outlook' ||
      args.provider === 'gmail'
        ? args.provider
        : sendingMailbox
          ? 'zoho'
          : undefined;

    const gatewayResult = await executeMcpWrite({
      tenantId,
      userId,
      tool: 'send_email',
      action: 'email.send',
      mode: 'execute_now',
      idempotencyKey,
      target: {
        workspace_id: tenantId,
        integration: preferredOutbound || 'email',
        resource_type: 'email_message',
        resource_id: recipient.email,
      },
      payload: {
        subject: args.subject,
        to: directTo || recipient.email,
        cc: args.cc,
        bcc: args.bcc,
        text: args.text,
        html: args.html,
        attachments: args.attachments,
        account_id: args.account_id,
        provider: preferredOutbound,
      },
      execute: async ({ actionId }) => {
        const directRecipientEmail = directTo?.[0] || recipient.email;
        const { buildUnsubscribeUrl } = await import('@/lib/email/unsubscribeToken');
        const unsubUrl = buildUnsubscribeUrl(directRecipientEmail, tenantId);

        return sendEmailServer({
          tenantId,
          userId,
          to: directTo || recipient.email,
          cc: args.cc,
          bcc: args.bcc,
          subject: args.subject,
          message: args.text,
          html: args.html || (args.text ? renderOutboundEmail({ text: args.text, unsubscribeUrl: unsubUrl }).html : undefined),
          preserveContent: true,
          listUnsubscribeUrl: unsubUrl,
          skipFooter: false,
          skipRecipientGate: Boolean(directTo),
          recipientName: args.recipient_name || recipient.matches?.[0]?.name,
          headline: args.headline,
          category: args.category || 'transactional',
          cta:
            args.cta_label && args.cta_url
              ? { label: args.cta_label, url: args.cta_url }
              : undefined,
          relatedRecord:
            args.related_record_type && args.related_record_id
              ? { type: args.related_record_type, id: args.related_record_id }
              : undefined,
          campaignId: args.campaign_id,
          workflowId: args.workflow_id,
          initiationSource: 'mcp.send_email',
          idempotencyKey,
          auditMetadata: {
            action_id: actionId,
            mcp_tool: 'send_email',
            folder_id: sentFolder?.folderId || (preferredOutbound === 'zoho' || sendingMailbox ? '8563655000000002022' : undefined),
            folder_name: 'sent',
          },
          attachments: attachments.length
            ? attachments.map((a) => ({
                filename: a.filename,
                content: a.content,
                contentType: a.contentType,
              }))
            : undefined,
          preferredProvider: preferredOutbound,
          providerAccountId: sendingMailbox?.id || args.account_id,
        });
      },
      isSuccess: (result) => result.success,
      mapError: (result) => ({
        code: result.code || 'PROVIDER_REJECTED',
        message: result.error || 'Email provider rejected the send',
        details: result.errorDetails,
      }),
      buildReceipt: (result) => ({
        action_id: '',
        status: 'provider_accepted',
        provider: result.provider || null,
        provider_reference: result.emailId || null,
        entity_id: result.emailId || null,
        entity_type: 'email',
        timestamp: new Date().toISOString(),
      }),
    });

    if (!gatewayResult.ok) {
      const result = gatewayResult.result;
      await recordExternalAction({
        tenantId,
        userId,
        tool: 'send_email',
        status: 'failed',
        provider: result?.provider,
        idempotencyKey,
        metadata: {
          code: gatewayResult.error?.code,
          error: gatewayResult.error?.message,
        },
      });
      return {
        ...okResult('send_email', {
          ...result,
          action_id: gatewayResult.actionId,
          delivery_status: result?.deliveryStatus || 'failed',
          provider_message_id: result?.emailId || null,
        }),
        ok: false as const,
        error: {
          code: gatewayResult.error?.code || 'PROVIDER_REJECTED',
          message:
            gatewayResult.error?.message || 'Email provider rejected the send',
          retryable: false,
        },
      };
    }

    const result = gatewayResult.result!;
    const acceptedAt = new Date().toISOString();
    const delivery = {
      provider: result.provider,
      message_id: result.emailId,
      recipients: directTo || [recipient.email],
      cc: args.cc || [],
      bcc: args.bcc || [],
      canonical_message_id: result.canonicalMessageId,
      account_id: result.providerAccountId,
      recipient: recipient.email,
      recipient_source: recipient.source,
      accepted_at: acceptedAt,
      delivery_status: 'provider_accepted',
      action_id: gatewayResult.actionId,
      audit_log_id: gatewayResult.auditLogId,
      verification: {
        verified: Boolean(result.emailId),
        verified_at: acceptedAt,
        note: 'Provider accepted the message; mailbox delivery is not guaranteed.',
      },
    };

    const receipt = gatewayResult.receipt || {
      action_id: gatewayResult.actionId,
      status: 'provider_accepted' as const,
      provider: result.provider || null,
      provider_reference: result.emailId || null,
      entity_id: result.emailId || null,
      entity_type: 'email',
      timestamp: acceptedAt,
      verification: delivery.verification,
      retry_available: true,
    };

    await recordExternalAction({
      tenantId,
      userId,
      tool: 'send_email',
      status: 'provider_accepted',
      provider: result.provider,
      providerReference: result.emailId,
      idempotencyKey,
      metadata: {
        recipient_source: recipient.source,
        action_id: gatewayResult.actionId,
      },
    });

    if (sendingMailbox)
      await createSupabaseAdminClient()
        .from('email_provider_accounts')
        .update({
          capabilities: {
            ...sendingMailbox.capabilities,
            send: true,
            send_verified: true,
            send_verified_at: acceptedAt,
          },
          last_successful_send_at: acceptedAt,
        })
        .eq('tenant_id', tenantId)
        .eq('id', sendingMailbox.id);
    return okResult('send_email', delivery, {
      receipt,
      meta: { idempotency_key: idempotencyKey, tenant_id: tenantId },
    });
  },
});

// ── create_email_draft ───────────────────────────────────────────────────────
defineConnectorTool({
  module: 'email-ops',
  name: 'create_email_draft',
  description:
    'Create an email draft in Zoho Mail for the authenticated tenant (does not send).',
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
    if (!tenantId || !userId)
      throwConnectorError(
        'AUTH_REQUIRED',
        'Authenticated workspace session required',
      );

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
    account_id: z.string().uuid().optional(),
    message_id: z.string().min(1),
    text: z.string().optional(),
    html: z.string().optional(),
    reply_all: z.boolean().default(false),
    attachments: z.array(z.record(z.string(), z.unknown())).optional(),
    idempotency_key: z.string().min(1),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      account_id: { type: 'string' },
      message_id: { type: 'string' },
      text: { type: 'string' },
      html: { type: 'string' },
      reply_all: { type: 'boolean' },
      attachments: { type: 'array', items: { type: 'object' } },
      idempotency_key: { type: 'string' },
    },
    required: ['message_id', 'idempotency_key'],
  },
  handler: async (args, ctx) => {
    if (!args.text && !args.html)
      throwConnectorError(
        'EMAIL_BODY_REQUIRED',
        'Reply text or HTML is required',
      );
    const mailbox = new MailboxService(ctx.tenantId, ctx.userId);
    const existing = await findReceiptByIdempotency({
      tenantId: ctx.tenantId,
      tool: 'reply_to_email',
      idempotencyKey: args.idempotency_key,
    });
    if (existing) {
      const replay = okResult('reply_to_email', existing.sanitized_output, {
        receipt: {
          action_id: String(existing.action_id),
          status: String(existing.final_status),
          provider: String(
            (existing.sanitized_output as any)?.provider ||
              existing.provider ||
              'zoho',
          ),
          provider_reference: existing.provider_reference as string,
        },
        meta: { deduplicated: true },
      });
      return existing.success
        ? replay
        : {
            ...replay,
            ok: false,
            error: {
              code: String(
                existing.error_code || 'EMAIL_PREVIOUS_ATTEMPT_PENDING',
              ),
              message:
                'Previous reply is pending or failed; reconcile get_action_status before retrying.',
              retryable: false,
            },
          };
    }
    const original = await mailbox.content(args.message_id, args.account_id);
    const account = await mailbox.verify(
      await mailbox.account(original.account_id),
    );
    const attachments = await attachmentsFromMedia(
      ctx.tenantId,
      ctx.userId,
      args.attachments,
    );
    const renderedReply = renderOutboundEmail({
      html: args.html,
      text: args.text,
    });
    const textHtml = renderedReply.html || (args.text ? `<p>${args.text}</p>` : '');
    const result = await executeMcpWrite({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      tool: 'reply_to_email',
      action: 'email.reply',
      mode: 'execute_now',
      idempotencyKey: args.idempotency_key,
      target: {
        workspace_id: ctx.tenantId,
        integration: account.provider,
        identity_id: account.id,
        resource_type: 'email_message',
        resource_id: original.provider_message_id,
      },
      payload: { ...args, account_id: account.id },
      execute: async () =>
        runEmailOperation({
          store: emailOperationStore(
            ctx.tenantId,
            'canonical_email_reply',
            args.idempotency_key,
          ),
          execute: async (_actionId, checkpoint) => {
            const response = await mailbox.provider(account).replyToMessage({
              messageId: original.provider_message_id,
              original: original as any,
              bodyHtml: args.html || textHtml,
              bodyText: args.text,
              replyAll: args.reply_all,
              attachments,
            });
            const reference = String(
              response.data?.messageId || response.messageId,
            );
            // Provider acceptance is persisted before any follow-up read, so a read
            // failure cannot trigger another external send.
            const data = {
              success: true,
              emailId: reference,
              deliveryStatus: 'provider_accepted',
              provider: account.provider,
              message_id: reference,
              account_id: account.id,
              thread_id: original.thread_id,
              in_reply_to: original.provider_message_id,
              threading: 'provider_native_reply',
              recipients: response.recipients,
              delivery_status: 'provider_accepted',
              accepted_at: new Date().toISOString(),
            };
            await checkpoint(data);
            const sentFolder = (await mailbox.provider(account).getFolders().catch(() => []))
              .find((f: any) => String(f.folderName || '').toLowerCase().includes('sent') || String(f.folderType || '').toLowerCase() === 'sent');
            await mailbox.ingest(
              account,
              {
                id: reference,
                application_status: 'provider_accepted',
                thread_id: original.thread_id,
                subject: response.original.subject,
                from: account.email_address,
                to: response.recipients.to,
                cc: response.recipients.cc,
                date: data.accepted_at,
                is_read: true,
                body_html: args.html || textHtml,
                body_text: renderedReply.text || args.text || '',
                attachments: attachments.map((item) => ({
                  filename: item.filename,
                })),
                headers: { native_reply_to: original.provider_message_id },
              },
              'sent',
              sentFolder?.folderId,
            );
            return data;
          },
        }),
      isSuccess: (data) => data.success === true,
      mapError: (data) => ({
        code: String(
          (data as Record<string, unknown>).code || 'OUTCOME_UNKNOWN',
        ),
        message: String(
          (data as Record<string, unknown>).error ||
            'Reply outcome must be reconciled',
        ),
      }),
      buildReceipt: (data) => ({
        action_id: '',
        status: 'provider_accepted',
        provider: account.provider,
        provider_reference: data.message_id,
        timestamp: data.accepted_at,
        entity_type: 'email',
        verification: { scope: 'provider_acceptance', delivered: false },
      }),
    });
    if (!result.ok)
      return {
        ...okResult(
          'reply_to_email',
          { action_id: result.actionId },
          {
            receipt: {
              action_id: result.actionId,
              status:
                result.error?.code === 'UNKNOWN_EXECUTION_STATE' ||
                result.error?.code === 'OUTCOME_UNKNOWN'
                  ? 'unknown_execution_state'
                  : 'failed',
            },
          },
        ),
        ok: false,
        error: result.error || {
          code: 'EMAIL_REPLY_FAILED',
          message: 'Reply failed',
          retryable: false,
        },
      };
    return okResult(
      'reply_to_email',
      { ...result.result, action_id: result.actionId },
      { receipt: result.receipt },
    );
  },
});

// ── get_action_status ────────────────────────────────────────────────────────
defineConnectorTool({
  module: 'email-ops',
  name: 'get_action_status',
  description:
    'Look up execution receipt and live provider outcome by action_id, idempotency_key, or provider reference across email and social publishing operations.',
  permission: 'integrations:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    action_id: z.string().optional(),
    idempotency_key: z.string().optional(),
    tool: z.string().optional(),
    provider_reference: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      action_id: { type: 'string' },
      idempotency_key: { type: 'string' },
      tool: { type: 'string' },
      provider_reference: { type: 'string' },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const tenantId = ctx.tenantId;
    if (!tenantId)
      throwConnectorError('TENANT_ACCESS_DENIED', 'Active workspace required');
    const supabase = createSupabaseAdminClient();

    const actionId = args.action_id?.trim();
    const idempotencyKey = args.idempotency_key?.trim();
    const tool = args.tool?.trim();
    const providerRef = args.provider_reference?.trim();

    if (!actionId && !idempotencyKey && !providerRef) {
      throwConnectorError(
        'RESOURCE_NOT_FOUND',
        'Provide action_id, idempotency_key, or provider_reference',
      );
    }

    // 1. Check mcp_action_receipts by idempotency_key (with tool or general)
    if (idempotencyKey && tool) {
      const row = await findReceiptByIdempotency({
        tenantId,
        tool,
        idempotencyKey,
      });
      if (row)
        return okResult(
          'get_action_status',
          await emailReceiptEvidence(tenantId, ctx.userId, row),
        );
    }

    if (idempotencyKey) {
      const { data: byIdemp } = await supabase
        .from('mcp_action_receipts')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('idempotency_key', idempotencyKey)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byIdemp)
        return okResult(
          'get_action_status',
          await emailReceiptEvidence(tenantId, ctx.userId, byIdemp),
        );
    }

    // 2. Check mcp_action_receipts by action_id
    if (actionId) {
      const { data: byAction } = await supabase
        .from('mcp_action_receipts')
        .select('*')
        .eq('tenant_id', tenantId)
        .or(`action_id.eq.${actionId},id.eq.${actionId}`)
        .maybeSingle();
      if (byAction)
        return okResult(
          'get_action_status',
          await emailReceiptEvidence(tenantId, ctx.userId, byAction),
        );
    }

    // 3. Check social_publish_operations (handles Instagram, Facebook, LinkedIn operations)
    if (actionId || idempotencyKey || providerRef) {
      let query = supabase
        .from('social_publish_operations')
        .select('*')
        .eq('tenant_id', tenantId);

      const orConditions: string[] = [];
      if (actionId) {
        orConditions.push(`id.eq.${actionId}`, `social_post_id.eq.${actionId}`);
      }
      if (idempotencyKey) {
        orConditions.push(`idempotency_key.eq.${idempotencyKey}`);
      }
      if (providerRef) {
        orConditions.push(
          `provider_post_id.eq.${providerRef}`,
          `provider_container_id.eq.${providerRef}`,
        );
      }

      if (orConditions.length > 0) {
        const { data: socialOp } = await query
          .or(orConditions.join(','))
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (socialOp) {
          // If operation is in in-flight/reconcilable state, reconcile on demand
          let currentOp = socialOp;
          if (
            [
              'provider_processing',
              'verifying',
              'reconciliation_required',
            ].includes(socialOp.state) &&
            socialOp.platform === 'instagram'
          ) {
            try {
              const { reconcileInstagramPublishOperation } =
                await import('@/lib/social/providerAssetPublishers');
              const reconciled = await reconcileInstagramPublishOperation(
                socialOp.id,
              );
              if (reconciled) {
                const { data: refreshed } = await supabase
                  .from('social_publish_operations')
                  .select('*')
                  .eq('tenant_id', tenantId)
                  .eq('id', socialOp.id)
                  .single();
                if (refreshed) currentOp = refreshed;
              }
            } catch (err) {
              console.warn(
                '[get_action_status] live instagram reconciliation attempt:',
                err,
              );
            }
          }

          const receipt = {
            id: currentOp.id,
            action_id: currentOp.id,
            tenant_id: currentOp.tenant_id,
            tool: `publish_${currentOp.platform}_post`,
            provider: currentOp.platform,
            final_status: currentOp.state,
            provider_reference:
              currentOp.provider_post_id || currentOp.provider_container_id,
            live_url: currentOp.provider_permalink,
            entity_id: currentOp.social_post_id,
            entity_type: 'social_post',
            success: currentOp.state === 'published',
            created_at: currentOp.created_at,
            updated_at: currentOp.updated_at,
            published_at: currentOp.published_at,
            verification: {
              verified: Boolean(currentOp.provider_identity_verified),
              verified_at: currentOp.verification_timestamp,
            },
          };
          return okResult('get_action_status', { receipt });
        }
      }
    }

    // 4. Check external_actions table
    if (actionId || idempotencyKey || providerRef) {
      const orConditions: string[] = [];
      if (actionId)
        orConditions.push(`action_id.eq.${actionId}`, `id.eq.${actionId}`);
      if (idempotencyKey)
        orConditions.push(`idempotency_key.eq.${idempotencyKey}`);
      if (providerRef)
        orConditions.push(`provider_reference.eq.${providerRef}`);

      if (orConditions.length > 0) {
        const { data: extAction } = await supabase
          .from('external_actions')
          .select('*')
          .eq('tenant_id', tenantId)
          .or(orConditions.join(','))
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (extAction) {
          const receipt = {
            id: extAction.id,
            action_id: extAction.action_id || extAction.id,
            tenant_id: extAction.tenant_id,
            tool: extAction.tool_name,
            provider: extAction.provider,
            final_status: extAction.status,
            provider_reference: extAction.provider_reference,
            live_url: extAction.live_url,
            entity_type: extAction.action_type,
            success:
              extAction.status === 'completed' ||
              extAction.status === 'published',
            created_at: extAction.created_at,
            completed_at: extAction.completed_at,
            failure_reason: extAction.failure_reason,
          };
          return okResult('get_action_status', { receipt });
        }
      }
    }

    // 5. Check email_logs table
    if (providerRef || actionId) {
      const orConditions: string[] = [];
      if (providerRef) orConditions.push(`email_id.eq.${providerRef}`);
      if (actionId) orConditions.push(`id.eq.${actionId}`);

      if (orConditions.length > 0) {
        const { data: emailLog } = await supabase
          .from('email_logs')
          .select('*')
          .eq('tenant_id', tenantId)
          .or(orConditions.join(','))
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (emailLog) {
          const receipt = {
            id: emailLog.id,
            action_id: emailLog.id,
            tenant_id: emailLog.tenant_id,
            tool: 'send_email',
            provider: emailLog.provider,
            final_status:
              emailLog.status === 'sent'
                ? 'provider_accepted'
                : emailLog.status,
            provider_reference: emailLog.email_id,
            recipient: emailLog.to_email,
            subject: emailLog.subject,
            entity_type: 'email',
            success: emailLog.status === 'sent',
            created_at: emailLog.created_at,
          };
          return okResult('get_action_status', { receipt });
        }
      }
    }

    return okResult('get_action_status', {
      receipt: null,
      message: 'No record found matching the provided identifier(s).',
    });
  },
});

// ── get_media_asset / list_media_assets ──────────────────────────────────────
defineConnectorTool({
  module: 'email-ops',
  name: 'get_media_asset',
  description:
    'Fetch a tenant-scoped media asset by ID (no storage credentials).',
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
    if (!tenantId)
      throwConnectorError('TENANT_ACCESS_DENIED', 'Active workspace required');
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
    if (!tenantId)
      throwConnectorError('TENANT_ACCESS_DENIED', 'Active workspace required');
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('media_assets')
      .select(
        'id, file_name, file_type, file_size_bytes, public_url, width, height, created_at',
      )
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

// Canonical mailbox operations; project notification logs are not an inbox.
const mailboxFields = {
  tenant_id: tenantIdField.optional(),
  account_id: z.string().uuid().optional(),
  folder: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  start: z.coerce.number().int().min(1).default(1),
};
const mailboxJson = {
  account_id: { type: 'string', format: 'uuid' },
  folder: { type: 'string' },
  limit: { type: 'number' },
  start: { type: 'number' },
};
for (const name of ['read_emails', 'search_emails'] as const) {
  defineConnectorTool({
    module: 'email-ops',
    name,
    description:
      name === 'read_emails'
        ? 'Read connected mailbox folders with bounded provider pagination and freshness; does not mark emails read.'
        : 'Search the actual connected mailbox. Supports provider query syntax, subject, sender, recipients and content.',
    permission: 'integrations:read',
    inputSchema: z.object({
      ...mailboxFields,
      query:
        name === 'search_emails' ? z.string().min(1) : z.string().optional(),
    }),
    jsonSchema: {
      type: 'object',
      properties: { ...mailboxJson, query: { type: 'string' } },
      required: name === 'search_emails' ? ['query'] : [],
    },
    handler: async (args, ctx) => {
      const mailbox = new MailboxService(ctx.tenantId, ctx.userId);
      const result = await new MailboxService(ctx.tenantId, ctx.userId).list(args);
      const account = await mailbox.account(result.account_id);
      return okResult(name, result, {
        receipt: {
          status: 'completed',
          provider: account.provider,
          verification: { scope: 'mailbox_read' },
        },
      });
    },
  });
}

defineConnectorTool({
  module: 'email-ops',
  name: 'read_email_content',
  description:
    'Read full text/HTML, safe headers and attachment metadata from the original mailbox. No read flag mutation.',
  permission: 'integrations:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    account_id: z.string().uuid().optional(),
    message_id: z.string().min(1),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      account_id: { type: 'string' },
      message_id: { type: 'string' },
    },
    required: ['message_id'],
  },
  handler: async (args, ctx) =>
    okResult(
      'read_email_content',
      await new MailboxService(ctx.tenantId, ctx.userId).content(
        args.message_id,
        args.account_id,
      ),
      {
        receipt: {
          status: 'completed',
          verification: { scope: 'mailbox_content' },
        },
      },
    ),
});

defineConnectorTool({
  module: 'email-ops',
  name: 'read_email_conversation',
  description:
    'Read synced conversation messages in chronological order with pagination and explicit cache completeness.',
  permission: 'integrations:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    account_id: z.string().uuid().optional(),
    thread_id: z.string().min(1),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      account_id: { type: 'string' },
      thread_id: { type: 'string' },
      limit: { type: 'number' },
      offset: { type: 'number' },
    },
    required: ['thread_id'],
  },
  handler: async (args, ctx) =>
    okResult(
      'read_email_conversation',
      await new MailboxService(ctx.tenantId, ctx.userId).conversation(
        args.thread_id,
        args.account_id,
        args.limit,
        args.offset,
      ),
      {
        receipt: {
          status: 'completed',
          verification: { scope: 'cached_conversation' },
        },
      },
    ),
});

defineConnectorTool({
  module: 'email-ops',
  name: 'sync_all_inboxes',
  description:
    'Perform a bounded real mailbox sync. Pending jobs must be resumed with account_id/job_id; completed only after all provider pages persist.',
  permission: 'integrations:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    account_id: z.string().uuid().optional(),
    job_id: z.string().uuid().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: { account_id: { type: 'string' }, job_id: { type: 'string' } },
  },
  handler: async (args, ctx) => {
    const mailbox = new MailboxService(ctx.tenantId, ctx.userId);
    const accounts = args.account_id
      ? [await mailbox.account(args.account_id)]
      : (await mailbox.accounts()).filter((row) =>
          ['user', 'shared_mailbox'].includes(row.account_type),
        );
    if (!accounts.length) throw new Error('EMAIL_MAILBOX_NOT_CONNECTED');
    if (args.job_id && accounts.length !== 1)
      throw new Error('EMAIL_ACCOUNT_SELECTION_REQUIRED');
    const jobs = [];
    for (const account of accounts)
      jobs.push(await mailbox.sync(account.id, args.job_id));
    const status = jobs.some((job) => job.status === 'failed')
      ? 'failed'
      : jobs.every((job) => job.status === 'completed')
        ? 'completed'
        : jobs.some((job) => job.status === 'running')
          ? 'running'
          : 'pending';
    const response = okResult(
      'sync_all_inboxes',
      { status, jobs },
      {
        receipt: { status, verification: { scope: 'persisted_mailbox_sync' } },
      },
    );
    if (status === 'failed')
      return {
        ...response,
        ok: false,
        error: {
          code: 'EMAIL_SYNC_FAILED',
          message: 'Mailbox sync failed; inspect jobs for the provider error.',
          retryable: false,
        },
      };
    return response;
  },
});

defineConnectorTool({
  module: 'email-ops',
  name: 'get_email_sync_status',
  description:
    'Read tenant-scoped mailbox job progress, completion, counts and actionable errors.',
  permission: 'integrations:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    job_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: { job_id: { type: 'string' } },
    required: ['job_id'],
  },
  handler: async (args, ctx) => {
    const job = await new MailboxService(ctx.tenantId, ctx.userId).syncStatus(
      args.job_id,
    );
    return okResult('get_email_sync_status', job, {
      receipt: {
        status: job.status,
        action_id: job.id,
      },
    });
  },
});
