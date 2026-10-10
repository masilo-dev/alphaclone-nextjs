import { mapWithConcurrency } from '@/lib/concurrency/mapWithConcurrency';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { preflightOutreachRecipients } from '@/lib/email/preflightRecipients';
import { ensureEmailProviderReady } from '@/lib/mcp/ensureEmailProviderReady';
import { ingestMediaInput } from '@/lib/media/ingestMedia';
import { findReceiptByIdempotency, persistActionReceipt } from '@/lib/mcp/actionReceipts';
import { assertLeadStageTransition } from '@/lib/stageProgression';
import { normalizeLeadPipelineStage } from '@/lib/crmPipelineStages';
import { emailOperationStore, runEmailOperation } from '@/lib/email/emailOperation';
import { deriveStableMcpIdempotencyKey } from '@/lib/mcp/toolRiskTiers';
import { createHash } from 'node:crypto';
import { isUuid } from '@/lib/tenant/platformTenant';
import { CrmBulkUpdateService, CRM_UNIFIED_ALLOWLISTS, type RecordType as CrmRecordType } from '@/services/crmBulkUpdateService';

type RecordType = 'lead' | 'client' | 'contact' | 'invoice' | 'project' | 'task';
type BulkRecordArgs = {
  record_type: RecordType;
  record_ids: string[];
  patch: Record<string, unknown>;
  dry_run?: boolean;
  confirm_execute?: boolean;
  idempotency_key?: string;
  reason?: string;
};
type BatchContext = { tenantId: string; userId?: string | null };

const MAX_RECORDS_PER_BATCH = 250;
const MAX_MEDIA_PER_BATCH = 50;
const MAX_EMAIL_RECIPIENTS_PER_BATCH = 100;
const CRM_BATCH_SIZE = 50;
const BULK_EMAIL_CONCURRENCY = 5;
const BULK_MEDIA_CONCURRENCY = 2;

const RECORD_CONFIG = CRM_UNIFIED_ALLOWLISTS;

function uniqueIds(ids: unknown, label: string, max: number): string[] {
  if (!Array.isArray(ids)) throw new Error(`${label} must be an array`);
  const normalized = Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)));
  if (normalized.length === 0) throw new Error(`${label} must contain at least one item`);
  if (normalized.length > max) throw new Error(`${label} cannot exceed ${max} items per request`);
  if (normalized.some((id) => !isUuid(id))) {
    throw new Error(`${label} must contain valid UUID values`);
  }
  return normalized;
}

function optionalUniqueIds(ids: unknown, label: string, max: number): string[] {
  if (ids === undefined || ids === null) return [];
  return uniqueIds(ids, label, max);
}

function safeObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function getState(row: Record<string, unknown>, fields: string[]) {
  return Object.fromEntries(fields.map((field) => [field, row[field] ?? null]));
}

function idempotencyKey(value: unknown): string {
  const key = String(value || '').trim();
  if (!key) throw new Error('idempotency_key is required when dry_run is false');
  return key;
}

function assertExternalSource(value: string | undefined, label: string) {
  if (!value) return;
  if (/^(file:|\/|~\/|\/mnt\/|\/home\/)/i.test(value.trim())) {
    throw new Error(`${label} must be a base64/data URL value or a public HTTPS URL; local file paths are not supported`);
  }
}

async function replayIfPresent(tenantId: string, tool: string, key: string) {
  const existing = await findReceiptByIdempotency({ tenantId, tool, idempotencyKey: key });
  if (!existing) return null;
  const prior = existing.sanitized_output;
  return {
    idempotent_replay: true,
    prior_result: prior && typeof prior === 'object' ? prior : null,
    receipt_id: existing.id || null,
    action_id: existing.action_id || null,
    final_status: existing.final_status || null,
  };
}

async function recordReceipt(params: {
  tenantId: string;
  userId?: string | null;
  tool: string;
  idempotencyKey: string;
  actionId: string;
  entityType: string;
  output: Record<string, unknown>;
  input: Record<string, unknown>;
}) {
  await persistActionReceipt({
    tenantId: params.tenantId,
    userId: params.userId || null,
    tool: params.tool,
    idempotencyKey: params.idempotencyKey,
    receipt: {
      action_id: params.actionId,
      status: 'completed',
      entity_type: params.entityType,
      entity_id: params.actionId,
      timestamp: new Date().toISOString(),
      verification: {
        requested: params.output.requested,
        processed: params.output.processed,
        updated_or_sent: params.output.updated_or_sent,
        skipped: params.output.skipped,
        failed: params.output.failed,
      },
    },
    success: true,
    sanitizedInput: params.input,
    sanitizedOutput: params.output,
  });
}

export async function executeBulkUpdateRecords(args: BulkRecordArgs, ctx: BatchContext) {
  const dryRun = args.dry_run !== false;
  if (!dryRun && args.confirm_execute !== true) {
    throw new Error('Set confirm_execute: true after reviewing a dry run before applying bulk changes');
  }
  return CrmBulkUpdateService.processBulkUpdate({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    recordType: args.record_type,
    recordIds: args.record_ids,
    patch: args.patch,
    dryRun,
    confirmExecute: args.confirm_execute === true,
    reason: args.reason,
    idempotencyKey: args.idempotency_key,
  });
}

type MediaItem = {
  filename?: string;
  mime_type?: string;
  media_type?: 'image' | 'video' | 'document';
  purpose?: string;
  alt_text?: string;
  source_url?: string;
  content_base64?: string;
  data_url?: string;
};

export async function executeBulkUploadMedia(args: { files: MediaItem[] }, ctx: BatchContext) {
  if (!Array.isArray(args.files) || args.files.length === 0) throw new Error('files must contain at least one media item');
  if (args.files.length > MAX_MEDIA_PER_BATCH) throw new Error(`files cannot exceed ${MAX_MEDIA_PER_BATCH} items per request`);

  const results: Array<Record<string, unknown>> = await mapWithConcurrency(
    args.files,
    BULK_MEDIA_CONCURRENCY,
    async (item, index) => {
      try {
        assertExternalSource(item.source_url, `files[${index}].source_url`);
        assertExternalSource(item.content_base64, `files[${index}].content_base64`);
        assertExternalSource(item.data_url, `files[${index}].data_url`);
        const filename = item.filename || `bulk-upload-${index + 1}.${item.media_type === 'document' ? 'pdf' : item.media_type === 'video' ? 'mp4' : 'png'}`;
        const media: any = item.data_url
          ? { type: 'data_url' as const, dataUrl: item.data_url, filename }
          : item.source_url
            ? { type: 'url' as const, url: item.source_url, filename }
            : item.content_base64
              ? {
                  type: 'base64' as const,
                  data: item.content_base64,
                  filename,
                  mimeType: item.mime_type || (item.media_type === 'document' ? 'application/pdf' : item.media_type === 'video' ? 'video/mp4' : 'image/png'),
                }
              : null;
        if (!media) throw new Error('Provide source_url, content_base64, or data_url');
        const asset = await ingestMediaInput({
          tenantId: ctx.tenantId,
          userId: ctx.userId || '',
          purpose: item.purpose || 'bulk_upload',
          media,
        });
        return {
          index,
          status: 'uploaded',
          media_id: asset.id,
          filename: asset.filename,
          mime_type: asset.mime_type,
          size_bytes: asset.size_bytes,
          media_url: asset.url,
        };
      } catch (error) {
        return { index, status: 'failed', error: error instanceof Error ? error.message : 'upload_failed' };
      }
    }
  );

  const uploaded = results.filter((item) => item.status === 'uploaded');
  return {
    action_id: crypto.randomUUID(),
    requested: args.files.length,
    processed: results.length,
    updated_or_sent: uploaded.length,
    skipped: 0,
    failed: results.length - uploaded.length,
    items: results,
  };
}

type BulkEmailArgs = {
  lead_ids?: string[];
  contact_ids?: string[];
  client_ids?: string[];
  subject: string;
  text?: string;
  html?: string;
  provider?: 'zoho' | 'brevo' | 'gmail' | 'outlook' | 'resend' | 'sendgrid';
  from_name?: string;
  dry_run?: boolean;
  confirm_send?: boolean;
  idempotency_key?: string;
  require_marketing_consent?: boolean;
  email_category?: 'marketing' | 'outreach';
};

type Recipient = { entity_type: 'lead' | 'contact' | 'client'; entity_id: string; name: string; email: string };

const RECIPIENT_TABLE_CONFIG: Record<
  Recipient['entity_type'],
  { table: string; select: string }
> = {
  lead: {
    table: 'leads',
    select: 'id, email, contact_name, business_name, name, decision_maker_name',
  },
  contact: {
    table: 'contacts',
    select: 'id, email, full_name, first_name, last_name',
  },
  client: {
    table: 'business_clients',
    select: 'id, email, name',
  },
};

function recipientDisplayName(row: Record<string, unknown>, entityType: Recipient['entity_type']): string {
  switch (entityType) {
    case 'lead':
      return String(
        row.contact_name || row.decision_maker_name || row.name || row.business_name || '',
      ).trim();
    case 'contact': {
      const fullName = String(row.full_name || '').trim();
      if (fullName) return fullName;
      return [row.first_name, row.last_name]
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .join(' ');
    }
    case 'client':
      return String(row.name || '').trim();
    default: {
      const _exhaustive: never = entityType;
      return _exhaustive;
    }
  }
}

async function loadRecipients(args: BulkEmailArgs, tenantId: string): Promise<{ recipients: Recipient[]; skipped: Array<Record<string, string>> }> {
  const supabase = createSupabaseAdminClient() as any;
  const allGroups: Array<{ type: Recipient['entity_type']; ids: string[] }> = [
    { type: 'lead', ids: optionalUniqueIds(args.lead_ids, 'lead_ids', MAX_EMAIL_RECIPIENTS_PER_BATCH) },
    { type: 'contact', ids: optionalUniqueIds(args.contact_ids, 'contact_ids', MAX_EMAIL_RECIPIENTS_PER_BATCH) },
    { type: 'client', ids: optionalUniqueIds(args.client_ids, 'client_ids', MAX_EMAIL_RECIPIENTS_PER_BATCH) },
  ];
  const groups = allGroups.filter((group) => group.ids.length > 0);

  if (!groups.length) throw new Error('Provide at least one of lead_ids, contact_ids, or client_ids');
  const requestedCount = groups.reduce((count, group) => count + group.ids.length, 0);
  if (requestedCount > MAX_EMAIL_RECIPIENTS_PER_BATCH) {
    throw new Error(`The combined recipient list cannot exceed ${MAX_EMAIL_RECIPIENTS_PER_BATCH} records per send`);
  }

  const recipients: Recipient[] = [];
  const skipped: Array<Record<string, string>> = [];
  for (const group of groups) {
    const config = RECIPIENT_TABLE_CONFIG[group.type];
    const { data, error } = await supabase
      .from(config.table)
      .select(config.select)
      .eq('tenant_id', tenantId)
      .in('id', group.ids);
    if (error) throw new Error(`Unable to load ${group.type} recipients: ${error.message}`);
    const rows = (data || []) as unknown as Array<Record<string, unknown>>;
    const byId = new Map(rows.map((row) => [String(row.id), row]));
    for (const id of group.ids) {
      const row = byId.get(id);
      if (!row) {
        skipped.push({ entity_type: group.type, entity_id: id, reason: 'not_found' });
        continue;
      }
      const email = String(row.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        skipped.push({ entity_type: group.type, entity_id: id, reason: 'missing_or_invalid_email' });
        continue;
      }
      const name = recipientDisplayName(row, group.type) || email;
      recipients.push({ entity_type: group.type, entity_id: id, name, email });
    }
  }
  const deduplicated = Array.from(new Map(recipients.map((recipient) => [recipient.email, recipient])).values());
  for (const recipient of recipients) {
    if (deduplicated.find((candidate) => candidate.email === recipient.email)?.entity_id !== recipient.entity_id) {
      skipped.push({ entity_type: recipient.entity_type, entity_id: recipient.entity_id, reason: 'duplicate_email' });
    }
  }
  return { recipients: deduplicated, skipped };
}

export async function executeBulkEmail(args: BulkEmailArgs, ctx: BatchContext) {
  if (args.dry_run !== false) return executeBulkEmailOnce(args, ctx);
  if (args.confirm_send !== true) throw new Error('Set confirm_send: true after reviewing a dry run');
  const key = args.idempotency_key || deriveStableMcpIdempotencyKey({ tenantId: ctx.tenantId, toolName: 'send_bulk_email', args: args as unknown as Record<string, unknown> });
  // Reconcile historical receipts without repeating previously attempted recipients.
  const historical = await findReceiptByIdempotency({ tenantId: ctx.tenantId, tool: 'send_bulk_email', idempotencyKey: key });
  if (historical?.sanitized_output && typeof historical.sanitized_output === 'object') {
    return { ...historical.sanitized_output, success: historical.success === true && Number((historical.sanitized_output as Record<string, unknown>).failed || 0) === 0, idempotent_replay: true };
  }
  return runEmailOperation({
    store: emailOperationStore(ctx.tenantId, 'email_batch', key),
    execute: (actionId, checkpoint) => executeBulkEmailOnce({ ...args, idempotency_key: key }, ctx, actionId, checkpoint),
  });
}

async function executeBulkEmailOnce(args: BulkEmailArgs, ctx: BatchContext, operationId?: string,
  checkpoint?: (output: Record<string, unknown>) => Promise<void>) {
  const subject = String(args.subject || '').trim();
  if (!subject) throw new Error('subject is required');
  if (!String(args.text || '').trim() && !String(args.html || '').trim()) {
    throw new Error('Provide text or html content');
  }
  const dryRun = args.dry_run !== false;
  const emailCategory = args.email_category || 'outreach';
  if (!dryRun && args.confirm_send !== true) {
    throw new Error('Set confirm_send: true after reviewing a dry run before sending bulk email');
  }
  if (!dryRun) {
    await ensureEmailProviderReady(ctx.tenantId, ctx.userId || '');
  }
  const key = dryRun ? null : idempotencyKey(args.idempotency_key);

  const { recipients, skipped } = await loadRecipients(args, ctx.tenantId);

  const preflight = await preflightOutreachRecipients(
    ctx.tenantId,
    recipients.map((r) => ({
      email: r.email,
      id: r.entity_id,
      entityType: r.entity_type,
      skipConsentCheck: emailCategory === 'outreach' || args.require_marketing_consent === false,
    })),
    { requireMarketingConsent: emailCategory === 'marketing' && args.require_marketing_consent !== false },
  );

  const eligibleEmailSet = new Set(preflight.eligibleRecipients.map((r) => r.email));
  const suppressionSkipped = recipients
    .filter((r) => !eligibleEmailSet.has(r.email))
    .map((r) => {
      const match = preflight.excluded.find((e) => e.email === r.email);
      return { entity_type: r.entity_type, entity_id: r.entity_id, reason: match?.reason || 'suppressed' };
    });

  const eligibleRecipients = recipients.filter((r) => eligibleEmailSet.has(r.email));
  const allSkipped = [...skipped, ...suppressionSkipped];

  const actionId = operationId || crypto.randomUUID();
  const results: Array<Record<string, unknown>> = dryRun
    ? eligibleRecipients.map((recipient) => ({ ...recipient, status: 'dry_run' }))
    : [];

  if (!dryRun) {
    await mapWithConcurrency(eligibleRecipients, BULK_EMAIL_CONCURRENCY, async (recipient) => {
      const outcome = await (async () => {
      try {
        const sent = await sendEmailServer({
          tenantId: ctx.tenantId,
          userId: ctx.userId || '',
          to: recipient.email,
          subject,
          text: args.text,
          html: args.html,
          fromName: args.from_name || 'AlphaClone Systems',
          preferredProvider: args.provider as any,
          templateName: 'mcpBulkEmail',
          category: emailCategory,
          idempotencyKey: `bulk:${createHash('sha256').update(`${key}:${recipient.email}`).digest('hex')}`,
          auditMetadata: { batch_id: actionId, source_module: 'mcp', source_action: 'bulk_email' },
        });
        return {
          ...recipient,
          status: sent.deliveryStatus || (sent.success ? 'provider_accepted' : 'failed'),
          execution_success: sent.success,
          provider: sent.provider || null,
          email_id: sent.emailId || null,
          message_id: sent.emailId || null,
          canonical_message_id: sent.canonicalMessageId || null,
          provider_account_id: sent.providerAccountId || null,
          sender: sent.sender || null,
          delivery_evidence: sent.deliveredAt || null,
          accepted_at: sent.success ? new Date().toISOString() : null,
          sent_at: null,
          failed_at: sent.success ? null : new Date().toISOString(),
          error_code: sent.success ? null : sent.code || 'PROVIDER_SEND_FAILED',
          error: sent.success ? null : sent.error || 'send_failed',
        };
      } catch (error) {
        return { ...recipient, status: 'unknown', execution_success: false, error_code: 'OUTCOME_UNKNOWN', error: 'Execution interrupted; reconcile before retrying.' };
      }
      })();
      results.push(outcome);
      await checkpoint?.({ action_id: actionId, status: 'executing', recipients: [...results], skipped_recipients: allSkipped });
      return outcome;
    });
  }

  const sentCount = results.filter((result) => ['provider_accepted', 'delivered'].includes(String(result.status))).length;
  const failedCount = results.filter((result) => result.status === 'failed').length;
  const unknownCount = results.filter((result) => result.status === 'unknown').length;
  const executionErrors = results.filter((result) => result.execution_success === false).length;
  const output: Record<string, unknown> = {
    action_id: actionId,
    dry_run: dryRun,
    execution_mode: dryRun ? 'simulated' : 'direct',
    email_category: emailCategory,
    status: dryRun ? 'simulated' : unknownCount ? 'unknown' : failedCount || executionErrors ? 'failed' : 'provider_accepted',
    success: dryRun || (failedCount === 0 && unknownCount === 0 && executionErrors === 0),
    execution_errors: executionErrors,
    provider_accepted: sentCount,
    delivered: results.filter((row) => row.status === 'delivered').length,
    unknown: unknownCount,
    idempotency_key: key,
    requested: preflight.requested + skipped.length,
    eligible: eligibleRecipients.length,
    processed: dryRun ? 0 : results.length,
    updated_or_sent: sentCount,
    skipped: allSkipped.length,
    failed: failedCount,
    preflight: {
      previously_unsubscribed: preflight.previously_unsubscribed,
      hard_suppressed: preflight.hard_suppressed + preflight.complaint_suppressed,
      duplicates_removed: preflight.duplicates_removed + skipped.filter((row) => row.reason === 'duplicate_email').length,
      invalid: preflight.invalid,
      consent_blocked: preflight.consent_blocked,
    },
    recipients: results,
    skipped_recipients: allSkipped,
  };

  return output;
}
