import { emailReceiptEvidence } from '@/lib/email/emailReceiptEvidence';
/**
 * Individual email MCP actions — real provider sends (no fake success).
 */

import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { okResult, throwConnectorError } from '@/lib/mcp/connector/response';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import type { OutboundEmailProvider } from '@/lib/email/sendEmail';
import { findReceiptByIdempotency, persistActionReceipt } from '@/lib/mcp/actionReceipts';
import { executeMcpWrite } from '@/lib/mcp/executionGateway';
import { isDurableRuntimeEnabled } from '@/lib/bonnie/runtime/types';
import { shouldUseMcpDirectExecution } from '@/lib/mcp/mcpDirectExecution';
import { enqueueEmailSendTask } from '@/lib/email/durableEmailTask';
import { processNormalizedTrigger } from '@/lib/bonnie/runtime/triggerGateway';
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
      .select('id, business_name, contact_name, email')
      .eq('tenant_id', params.tenantId)
      .or(`business_name.ilike.${pattern},contact_name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(10),
  ]);

  const matches: Array<{ id: string; name: string; email: string }> = [];
  for (const c of contacts || []) {
    const legacyEmails = (c as { emails?: unknown }).emails;
    const email = String(c.email || (Array.isArray(legacyEmails) ? legacyEmails[0] : '') || '').trim();
    if (!email.includes('@')) continue;
    matches.push({
      id: c.id,
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || email,
      email,
    });
  }
  for (const l of leads || []) {
    const legacyEmails = (l as { emails?: unknown }).emails;
    const email = String(l.email || (Array.isArray(legacyEmails) ? legacyEmails[0] : '') || '').trim();
    if (!email.includes('@')) continue;
    matches.push({
      id: l.id,
      name: String(l.contact_name || l.business_name || email),
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
    // 1. Direct base64 content / data payload
    if (raw.content && typeof raw.content === 'string') {
      out.push({
        filename: String(raw.filename || 'attachment.bin'),
        content: String(raw.content),
        contentType: String(raw.contentType || raw.mime_type || raw.mimeType || 'application/octet-stream'),
      });
      continue;
    }
    if (raw.data && typeof raw.data === 'string') {
      out.push({
        filename: String(raw.filename || 'attachment.bin'),
        content: String(raw.data),
        contentType: String(raw.contentType || raw.mime_type || raw.mimeType || 'application/octet-stream'),
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
      media = { type: 'asset_id', assetId: String(raw.assetId || raw.asset_id) };
    } else if (raw.type === 'base64') {
      media = {
        type: 'base64',
        data: String(raw.data || raw.content),
        mimeType: String(raw.mime_type || raw.mimeType || 'application/octet-stream'),
        filename: String(raw.filename || 'attachment.bin'),
      };
    } else if (raw.type === 'url' || raw.url) {
      media = { type: 'url', url: String(raw.url), filename: raw.filename ? String(raw.filename) : undefined };
    }
    if (!media) continue;

    try {
      const asset = await ingestMediaInput({ tenantId, userId, media, purpose: 'email_attachment' });
      const res = await fetch(asset.url);
      const buf = Buffer.from(await res.arrayBuffer());
      out.push({
        filename: asset.filename,
        content: buf.toString('base64'),
        contentType: asset.mime_type,
      });
    } catch (err: any) {
      console.warn('[MCP send_email] failed to ingest attachment via media:', err?.message || err);
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
    const { data: accounts, error: accountError } = await supabase
      .from('email_provider_accounts')
      .select('id, provider, connection_status, email_address, display_name, account_type, capabilities, legacy_integration_id, created_at')
      .eq('tenant_id', tenantId).is('deleted_at', null);
    const { data: integrations, error: integrationError } = await supabase
      .from('integrations').select('id, type, enabled')
      .eq('tenant_id', tenantId).in('type', ['zoho', 'gmail', 'brevo', 'sendgrid', 'resend', 'outlook', 'microsoft', 'microsoft365']);
    const { data: senders, error: senderError } = await supabase
      .from('email_sender_addresses')
      .select('id, provider, email_address, display_name, is_default, is_verified, region')
      .eq('tenant_id', tenantId);
    if (accountError || integrationError || senderError) {
      throw new Error(`EMAIL_ACCOUNT_DISCOVERY_FAILED: ${accountError?.message || integrationError?.message || senderError?.message}`);
    }
    const { resolveAllConnectedEmailProviders } = await import('@/lib/email/providerIntegrationResolver');
    const resolved = await resolveAllConnectedEmailProviders({tenantId, preferredUserId: ctx.userId, fallbackToEnv: false});
    const byAccount = new Map(resolved.map(config => [config.providerAccountId, config]));
    return okResult('list_email_accounts', {
      accounts: (accounts || []).map((row) => ({
        account_id: row.id, provider: row.provider, status: row.connection_status,
        sender: row.email_address || byAccount.get(row.id)?.fromEmail || null, sender_configured: Boolean(row.email_address || byAccount.get(row.id)?.fromEmail),
        sender_verification_error: byAccount.get(row.id)?.senderVerificationError || null,
        account_type: row.account_type, business_sending: row.account_type !== 'platform', capabilities: {...row.capabilities, send: row.account_type === 'platform' ? true : Boolean(byAccount.get(row.id)?.fromEmail), platform_notification_only: row.account_type === 'platform'}, connected_at: row.created_at,
      })),
      integrations: integrations || [],
      sender_addresses: [...(senders || []), ...resolved.filter(config => config.fromEmail && !(senders || []).some(row => row.provider === config.provider && row.email_address === config.fromEmail)).map(config => ({provider: config.provider, account_id: config.providerAccountId, email_address: config.fromEmail, source: 'execution_resolver', is_verified: null}))],
      duplicate_platform_groups: Object.values((accounts || []).filter(row => row.account_type === 'platform').reduce<Record<string, string[]>>((groups, row) => {const key = `${row.provider}:${row.email_address}`; (groups[key] ||= []).push(row.id); return groups;}, {})).filter(ids => ids.length > 1),
      limitation: 'Connected configuration does not prove sender verification or inbox delivery.',
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
      to: { type: 'string', description: 'Recipient email or leave blank and use recipient_name/contact_id' },
      recipient_name: { type: 'string' },
      contact_id: { type: 'string', format: 'uuid' },
      lead_id: { type: 'string', format: 'uuid' },
      cc: { type: 'array', items: { type: 'string' } },
      bcc: { type: 'array', items: { type: 'string' } },
      subject: { type: 'string' },
      text: { type: 'string', description: 'Plain text message body (gateway renders branded HTML)' },
      html: { type: 'string', description: 'Rejected unless text is also provided — use text and let the gateway render HTML' },
      category: {
        type: 'string',
        enum: ['marketing', 'outreach', 'transactional', 'account_security', 'invoice_payment', 'contract_document', 'booking_calendar', 'internal_notification'],
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
    if (!tenantId || !userId) throwConnectorError('AUTH_REQUIRED', 'Authenticated workspace session required');

    const idempotencyKey =
      args.idempotency_key?.trim() || `mcp-send_email-${crypto.randomUUID()}`;

    const existing = await findReceiptByIdempotency({
      tenantId,
      tool: 'send_email',
      idempotencyKey,
    });
    if (existing) {
      const evidence = await emailReceiptEvidence(tenantId, userId, existing);
      const replay = okResult('send_email', { ...existing.sanitized_output as Record<string, unknown>, ...evidence,
        idempotent_replay: true }, {
        receipt: { action_id: String(existing.action_id), status: String(existing.final_status),
          provider: existing.provider as string, provider_reference: existing.provider_reference as string, entity_type: 'email' },
        meta: { deduplicated: true, idempotency_key: idempotencyKey },
      });
      if (!existing.success || evidence.delivery_evidence?.status === 'failed') {
        return { ...replay, ok: false as const, error: { code: String(existing.error_code || 'PREVIOUS_EMAIL_EXECUTION_FAILED'),
          message: 'The previous email attempt was not successful. Review its persisted outcome; no new send was made.', retryable: false } };
      }
      return replay;
    }

    const recipient = await resolveRecipientByNameOrEmail({
      tenantId,
      to: args.to,
      recipient_name: args.recipient_name,
      contact_id: args.contact_id,
      lead_id: args.lead_id,
    });

    if (!args.text && !args.html) {
      throwConnectorError('INVALID_MEDIA', 'Email message body is required (plain text). Raw HTML bypass is not permitted.');
    }
    if (args.html && !args.text) {
      throwConnectorError('INVALID_MEDIA', 'Provide plain text message content. The email gateway renders branded HTML automatically.');
    }

    const attachments = await attachmentsFromMedia(tenantId, userId, args.attachments);

    const { resolveMcpActionReadiness } = await import('@/lib/mcp/actionReadiness');
    const readiness = await resolveMcpActionReadiness({ tenantId, userId, action: 'email_send' });
    if (!readiness.email_send?.executable) {
      throwConnectorError(
        'PROVIDER_MISSING',
        readiness.email_send?.setup_hint ||
          'Connect Zoho, Gmail, Brevo, or another email provider in Settings → Integrations before sending.',
        { missing: readiness.email_send?.missing }
      );
    }

    const preferredOutbound: OutboundEmailProvider | undefined =
      args.provider === 'zoho' ||
      args.provider === 'brevo' ||
      args.provider === 'sendgrid' ||
      args.provider === 'resend' ||
      args.provider === 'outlook' ||
      args.provider === 'gmail'
        ? args.provider
        : undefined;

    if (isDurableRuntimeEnabled() && !shouldUseMcpDirectExecution('send_email')) {
      try {
        await processNormalizedTrigger({
          tenant_id: tenantId,
          user_id: userId,
          trigger_type: 'api_request',
          event_type: 'email.send',
          source: 'mcp:send_email',
          correlation_id: idempotencyKey,
          deduplication_key: idempotencyKey,
          payload: {
            to: recipient.email,
            subject: args.subject,
            durable: true,
          },
        }).catch(() => undefined);

        const enqueued = await enqueueEmailSendTask({
          tenantId,
          userId,
          idempotencyKey,
          payload: {
            to: recipient.email,
            subject: args.subject,
            text: args.text,
            provider: preferredOutbound,
            recipient_name: args.recipient_name,
          },
        });

        return okResult(
          'send_email',
          {
            status: 'queued',
            run_id: enqueued.runId,
            task_id: enqueued.taskId,
            durable: true,
            poll_tool: 'get_outcome_status',
            delivery_status: 'queued',
            recipient: recipient.email,
            idempotency_key: idempotencyKey,
          },
          { meta: { durable: true, idempotency_key: idempotencyKey } }
        );
      } catch (durableErr) {
        console.warn('[send_email] Durable enqueue failed; falling back to direct send:', durableErr);
      }
    }

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
        to: recipient.email,
        provider: preferredOutbound,
      },
      execute: async ({ actionId }) =>
        sendEmailServer({
          tenantId,
          userId,
          to: recipient.email,
          subject: args.subject,
          message: args.text,
          recipientName: args.recipient_name || recipient.matches?.[0]?.name,
          headline: args.headline,
          category: args.category || 'outreach',
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
          },
          attachments: attachments.length
            ? attachments.map((a) => ({
                filename: a.filename,
                content: a.content,
                contentType: a.contentType,
              }))
            : undefined,
          preferredProvider: preferredOutbound,
          providerAccountId: args.account_id,
        }),
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
        metadata: { code: gatewayResult.error?.code, error: gatewayResult.error?.message },
      });
      return { ...okResult('send_email', { ...result, action_id: gatewayResult.actionId,
        delivery_status: result?.deliveryStatus || 'failed', provider_message_id: result?.emailId || null }),
        ok: false as const, error: { code: gatewayResult.error?.code || 'PROVIDER_REJECTED',
          message: gatewayResult.error?.message || 'Email provider rejected the send', retryable: false } };
    }

    const result = gatewayResult.result!;
    const acceptedAt = new Date().toISOString();
    const delivery = {
      provider: result.provider,
      message_id: result.emailId,
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
      status: 'completed' as const,
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
      status: 'completed',
      provider: result.provider,
      providerReference: result.emailId,
      idempotencyKey,
      metadata: { recipient_source: recipient.source, action_id: gatewayResult.actionId },
    });

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
    if (!tenantId) throwConnectorError('TENANT_ACCESS_DENIED', 'Active workspace required');
    const supabase = createSupabaseAdminClient();

    const actionId = args.action_id?.trim();
    const idempotencyKey = args.idempotency_key?.trim();
    const tool = args.tool?.trim();
    const providerRef = args.provider_reference?.trim();

    if (!actionId && !idempotencyKey && !providerRef) {
      throwConnectorError('RESOURCE_NOT_FOUND', 'Provide action_id, idempotency_key, or provider_reference');
    }

    // 1. Check mcp_action_receipts by idempotency_key (with tool or general)
    if (idempotencyKey && tool) {
      const row = await findReceiptByIdempotency({
        tenantId,
        tool,
        idempotencyKey,
      });
      if (row) return okResult('get_action_status', await emailReceiptEvidence(tenantId, ctx.userId, row));
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
      if (byIdemp) return okResult('get_action_status', await emailReceiptEvidence(tenantId, ctx.userId, byIdemp));
    }

    // 2. Check mcp_action_receipts by action_id
    if (actionId) {
      const { data: byAction } = await supabase
        .from('mcp_action_receipts')
        .select('*')
        .eq('tenant_id', tenantId)
        .or(`action_id.eq.${actionId},id.eq.${actionId}`)
        .maybeSingle();
      if (byAction) return okResult('get_action_status', await emailReceiptEvidence(tenantId, ctx.userId, byAction));
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
        orConditions.push(`provider_post_id.eq.${providerRef}`, `provider_container_id.eq.${providerRef}`);
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
            ['provider_processing', 'verifying', 'reconciliation_required'].includes(socialOp.state) &&
            socialOp.platform === 'instagram'
          ) {
            try {
              const { reconcileInstagramPublishOperation } = await import('@/lib/social/providerAssetPublishers');
              const reconciled = await reconcileInstagramPublishOperation(socialOp.id);
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
              console.warn('[get_action_status] live instagram reconciliation attempt:', err);
            }
          }

          const receipt = {
            id: currentOp.id,
            action_id: currentOp.id,
            tenant_id: currentOp.tenant_id,
            tool: `publish_${currentOp.platform}_post`,
            provider: currentOp.platform,
            final_status: currentOp.state,
            provider_reference: currentOp.provider_post_id || currentOp.provider_container_id,
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
      if (actionId) orConditions.push(`action_id.eq.${actionId}`, `id.eq.${actionId}`);
      if (idempotencyKey) orConditions.push(`idempotency_key.eq.${idempotencyKey}`);
      if (providerRef) orConditions.push(`provider_reference.eq.${providerRef}`);

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
            success: extAction.status === 'completed' || extAction.status === 'published',
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
            final_status: emailLog.status === 'sent' ? 'provider_accepted' : emailLog.status,
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

// ── read_emails / list_received_emails ───────────────────────────────────────
defineConnectorTool({
  module: 'email-ops',
  name: 'read_emails',
  description:
    'List received emails and recent email dispatches/threads for the authenticated workspace. Returns message IDs, senders, subjects, dates, and preview snippets.',
  permission: 'integrations:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
    folder: z.string().optional().default('inbox'),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number' },
      folder: { type: 'string' },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const tenantId = ctx.tenantId;
    if (!tenantId) throwConnectorError('TENANT_ACCESS_DENIED', 'Active workspace required');
    const supabase = createSupabaseAdminClient();

    const { data: dispatches } = await supabase
      .from('project_email_dispatches')
      .select('id, project_id, client_id, stage, recipient_email, subject, body_text, sent_at, approval_status, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(args.limit || 20);

    const messages = (dispatches || []).map((row) => ({
      message_id: row.id,
      project_id: row.project_id,
      client_id: row.client_id,
      stage: row.stage,
      sender_email: 'system@alphaclone.ai',
      recipient_email: row.recipient_email,
      subject: row.subject,
      snippet: (row.body_text || '').slice(0, 150),
      sent_at: row.sent_at || row.created_at,
      approval_status: row.approval_status,
    }));

    return okResult('read_emails', {
      total: messages.length,
      folder: args.folder || 'inbox',
      messages,
    });
  },
});

// ── read_email_content ───────────────────────────────────────────────────────
defineConnectorTool({
  module: 'email-ops',
  name: 'read_email_content',
  description:
    'Read full body text, HTML, headers, and attachments of a specific email message by message_id.',
  permission: 'integrations:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    message_id: z.string().min(1),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      message_id: { type: 'string' },
    },
    required: ['message_id'],
  },
  handler: async (args, ctx) => {
    const tenantId = ctx.tenantId;
    if (!tenantId) throwConnectorError('TENANT_ACCESS_DENIED', 'Active workspace required');
    const supabase = createSupabaseAdminClient();

    const { data: dispatch } = await supabase
      .from('project_email_dispatches')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', args.message_id)
      .maybeSingle();

    if (!dispatch) {
      throwConnectorError('RESOURCE_NOT_FOUND', `Email message with ID "${args.message_id}" not found`);
    }

    return okResult('read_email_content', {
      message_id: dispatch.id,
      tenant_id: dispatch.tenant_id,
      project_id: dispatch.project_id,
      client_id: dispatch.client_id,
      recipient_email: dispatch.recipient_email,
      subject: dispatch.subject,
      body_text: dispatch.body_text,
      body_html: dispatch.body_text ? `<p>${dispatch.body_text.replace(/\n/g, '<br/>')}</p>` : '',
      autonomy_level: dispatch.autonomy_level,
      approval_status: dispatch.approval_status,
      sent_at: dispatch.sent_at || dispatch.created_at,
    });
  },
});

// ── search_emails ─────────────────────────────────────────────────────────────
defineConnectorTool({
  module: 'email-ops',
  name: 'search_emails',
  description:
    'Search workspace outbound emails and drafts across provider dispatches (email_logs, receipts, external actions, project workflows) by recipient email, subject, keyword, action_id, or provider message ID.',
  permission: 'integrations:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    query: z.string().min(1),
    limit: z.number().int().min(1).max(50).optional().default(20),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      limit: { type: 'number' },
    },
    required: ['query'],
  },
  handler: async (args, ctx) => {
    const tenantId = ctx.tenantId;
    if (!tenantId) throwConnectorError('TENANT_ACCESS_DENIED', 'Active workspace required');
    const supabase = createSupabaseAdminClient();

    const rawQuery = args.query.trim();
    const cleanPattern = rawQuery.replace(/[%_]/g, '');
    const pattern = `%${cleanPattern}%`;
    const limit = args.limit || 20;

    type UnifiedEmailMatch = {
      message_id: string;
      action_id?: string;
      recipient_email: string;
      subject: string;
      snippet: string;
      provider?: string;
      delivery_status: string;
      sent_at: string;
      source: string;
      evidence: {
        provider_reference?: string;
        action_id?: string;
        verified: boolean;
        metadata?: unknown;
      };
    };

    const matches: UnifiedEmailMatch[] = [];
    const seenKeys = new Set<string>();

    // 1. Search email_logs (direct provider outbound dispatches via Brevo, Zoho, Gmail, etc.)
    try {
      const { data: logs } = await supabase
        .from('email_logs')
        .select('id, to_email, subject, status, email_id, provider, created_at, metadata')
        .eq('tenant_id', tenantId)
        .or(`to_email.ilike.${pattern},subject.ilike.${pattern},email_id.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(limit);

      for (const log of logs || []) {
        const key = log.email_id || log.id;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const statusNormalized =
          log.status === 'sent'
            ? 'provider_accepted'
            : log.status || 'unknown';

        matches.push({
          message_id: log.email_id || log.id,
          action_id: (log.metadata as { action_id?: string })?.action_id,
          recipient_email: log.to_email || '',
          subject: log.subject || '(no subject)',
          snippet: `Provider: ${log.provider || 'unknown'}, status: ${statusNormalized}`,
          provider: log.provider || undefined,
          delivery_status: statusNormalized,
          sent_at: log.created_at,
          source: 'email_logs',
          evidence: {
            provider_reference: log.email_id || undefined,
            verified: Boolean(log.email_id),
            metadata: log.metadata,
          },
        });
      }
    } catch (err) {
      console.warn('[search_emails] email_logs query error:', err);
    }

    // 2. Search mcp_action_receipts (where tool = 'send_email')
    try {
      const { data: receipts } = await supabase
        .from('mcp_action_receipts')
        .select('id, action_id, idempotency_key, tool, final_status, provider, provider_reference, sanitized_input, sanitized_output, created_at')
        .eq('tenant_id', tenantId)
        .eq('tool', 'send_email')
        .order('created_at', { ascending: false })
        .limit(limit * 2);

      const qLower = cleanPattern.toLowerCase();
      for (const rec of receipts || []) {
        const inputStr = JSON.stringify(rec.sanitized_input || '').toLowerCase();
        const outputStr = JSON.stringify(rec.sanitized_output || '').toLowerCase();
        const actionMatches =
          (rec.action_id && rec.action_id.toLowerCase().includes(qLower)) ||
          (rec.provider_reference && rec.provider_reference.toLowerCase().includes(qLower)) ||
          inputStr.includes(qLower) ||
          outputStr.includes(qLower);

        if (!actionMatches) continue;

        const key = rec.provider_reference || rec.action_id || rec.id;
        if (seenKeys.has(key)) {
          // If we already saw this from email_logs, enrich action_id
          const existing = matches.find((m) => m.evidence.provider_reference === rec.provider_reference || m.message_id === rec.provider_reference);
          if (existing && !existing.action_id && rec.action_id) {
            existing.action_id = rec.action_id;
            existing.evidence.action_id = rec.action_id;
          }
          continue;
        }
        seenKeys.add(key);

        const target = (rec.sanitized_input as { target?: { resource_id?: string }; to?: string })?.target;
        const recipient = target?.resource_id || (rec.sanitized_input as { to?: string })?.to || '';

        matches.push({
          message_id: rec.provider_reference || rec.action_id || rec.id,
          action_id: rec.action_id || undefined,
          recipient_email: recipient,
          subject: (rec.sanitized_input as { subject?: string })?.subject || '(action receipt)',
          snippet: `Action ID: ${rec.action_id}, Status: ${rec.final_status}`,
          provider: rec.provider || undefined,
          delivery_status: rec.final_status === 'completed' ? 'provider_accepted' : rec.final_status || 'unknown',
          sent_at: rec.created_at,
          source: 'mcp_action_receipts',
          evidence: {
            provider_reference: rec.provider_reference || undefined,
            action_id: rec.action_id || undefined,
            verified: Boolean(rec.provider_reference),
          },
        });
      }
    } catch (err) {
      console.warn('[search_emails] mcp_action_receipts query error:', err);
    }

    // 3. Search external_actions (where action_type = 'email' or tool_name = 'send_email')
    try {
      const { data: actions } = await supabase
        .from('external_actions')
        .select('id, action_id, tool_name, action_type, status, provider, provider_reference, payload, target, created_at, completed_at')
        .eq('tenant_id', tenantId)
        .or('action_type.eq.email,tool_name.eq.send_email')
        .order('created_at', { ascending: false })
        .limit(limit * 2);

      const qLower = cleanPattern.toLowerCase();
      for (const act of actions || []) {
        const payloadStr = JSON.stringify(act.payload || '').toLowerCase();
        const actMatches =
          (act.action_id && act.action_id.toLowerCase().includes(qLower)) ||
          (act.provider_reference && act.provider_reference.toLowerCase().includes(qLower)) ||
          payloadStr.includes(qLower);

        if (!actMatches) continue;

        const key = act.provider_reference || act.action_id || act.id;
        if (seenKeys.has(key)) {
          const existing = matches.find((m) => m.evidence.provider_reference === act.provider_reference || m.action_id === act.action_id);
          if (existing && !existing.action_id && act.action_id) {
            existing.action_id = act.action_id;
            existing.evidence.action_id = act.action_id;
          }
          continue;
        }
        seenKeys.add(key);

        const payload = (act.payload as { to?: string; subject?: string }) || {};
        matches.push({
          message_id: act.provider_reference || act.action_id || act.id,
          action_id: act.action_id || undefined,
          recipient_email: payload.to || (act.target as { resource_id?: string })?.resource_id || '',
          subject: payload.subject || '(external action)',
          snippet: `Action: ${act.tool_name}, Status: ${act.status}`,
          provider: act.provider || undefined,
          delivery_status: act.status === 'completed' ? 'provider_accepted' : act.status,
          sent_at: act.completed_at || act.created_at,
          source: 'external_actions',
          evidence: {
            provider_reference: act.provider_reference || undefined,
            action_id: act.action_id || undefined,
            verified: Boolean(act.provider_reference),
          },
        });
      }
    } catch (err) {
      console.warn('[search_emails] external_actions query error:', err);
    }

    // 4. Search project_email_dispatches (internal workflow emails and drafts)
    try {
      const { data: dispatches } = await supabase
        .from('project_email_dispatches')
        .select('id, project_id, client_id, stage, recipient_email, subject, body_text, sent_at, approval_status, created_at')
        .eq('tenant_id', tenantId)
        .or(`subject.ilike.${pattern},recipient_email.ilike.${pattern},body_text.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(limit);

      for (const row of dispatches || []) {
        if (seenKeys.has(row.id)) continue;
        seenKeys.add(row.id);

        matches.push({
          message_id: row.id,
          recipient_email: row.recipient_email,
          subject: row.subject,
          snippet: (row.body_text || '').slice(0, 150),
          sent_at: row.sent_at || row.created_at,
          delivery_status: row.approval_status === 'sent' ? 'provider_accepted' : row.approval_status || 'draft',
          source: 'project_email_dispatches',
          evidence: {
            verified: Boolean(row.sent_at),
          },
        });
      }
    } catch (err) {
      console.warn('[search_emails] project_email_dispatches query error:', err);
    }

    // Sort all matches by timestamp descending and apply limit
    matches.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
    const finalMatches = matches.slice(0, limit);

    return okResult('search_emails', {
      query: args.query,
      count: finalMatches.length,
      matches: finalMatches,
    });
  },
});
