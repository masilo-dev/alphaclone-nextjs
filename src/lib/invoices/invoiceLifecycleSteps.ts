/**
 * Shared invoice lifecycle steps — used by Workflow SDK and Bonnie durable runtime.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { invoiceEmailTemplates } from '@/lib/email/invoiceEmailTemplates';
import { getPublicInvoicePaymentUrl } from '@/lib/invoices/publicInvoiceAccess';
import { ensureInvoicePaymentLink } from '@/lib/invoicing/invoicePaymentLink';
import { logInvoiceEvent } from '@/lib/audit/invoiceAuditLogger';
import { generateThemedInvoicePdfBuffer } from '@/lib/documents/themedDocumentPdf';
import { recordDailyResourceQuota } from '@/lib/server/dailyResourceQuota';
import { fileInvoiceDocument } from '@/lib/documents/fileDocument';
import { postInvoiceIssueJournalServer } from '@/lib/invoices/postInvoiceIssueJournalServer';
import { scheduleInvoiceLifecycleFollowUp } from '@/lib/invoices/invoiceLifecycleFollowUp';

export type InvoiceAttachmentItem = {
  name: string;
  storagePath?: string;
  storage_path?: string;
  contentType?: string;
  content_type?: string;
  size?: number;
};

export type InvoiceLifecycleInput = {
  invoiceId: string;
  tenantId: string;
  actorUserId?: string;
  recipients?: string[];
  subject?: string;
  message?: string;
  attachments?: InvoiceAttachmentItem[];
};

export const INVOICE_DOCUMENTS_BUCKET = 'invoice-documents';

const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/csv',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

let bucketEnsurePromise: Promise<void> | null = null;

export async function ensureInvoiceDocumentsBucket(admin: any): Promise<void> {
  if (bucketEnsurePromise) {
    return bucketEnsurePromise;
  }
  bucketEnsurePromise = (async () => {
    try {
      const { data: bucket, error: getError } = await admin.storage.getBucket(INVOICE_DOCUMENTS_BUCKET);
      if (bucket && !getError) {
        const existingAllowed: string[] = Array.isArray(bucket.allowed_mime_types)
          ? bucket.allowed_mime_types
          : [];
        const needsUpdate = ALLOWED_ATTACHMENT_MIME_TYPES.some(
          (mime) => !existingAllowed.includes(mime)
        );
        if (needsUpdate) {
          await admin.storage.updateBucket(INVOICE_DOCUMENTS_BUCKET, {
            public: false,
            fileSizeLimit: 15728640,
            allowedMimeTypes: ALLOWED_ATTACHMENT_MIME_TYPES,
          });
        }
        return;
      }

      const { error: createError } = await admin.storage.createBucket(INVOICE_DOCUMENTS_BUCKET, {
        public: false,
        fileSizeLimit: 15728640,
        allowedMimeTypes: ALLOWED_ATTACHMENT_MIME_TYPES,
      });
      if (createError) {
        const msg = String(createError.message || '').toLowerCase();
        if (!msg.includes('already exists') && !msg.includes('duplicate')) {
          console.warn('[invoice-lifecycle] Bucket creation notice:', createError.message);
        }
      }
    } catch (err) {
      console.warn('[invoice-lifecycle] Bucket ensure fallback notice:', err);
    }
  })();
  return bucketEnsurePromise;
}

function cleanInvoiceNotes(rawNotes?: string | null): string | undefined {
  if (!rawNotes) return undefined;
  const cleaned = String(rawNotes).split('---METADATA---')[0]?.trim();
  return cleaned || undefined;
}

export async function loadInvoiceForLifecycle(invoiceId: string, tenantId: string) {
  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from('business_invoices')
    .select(`
      *,
      client:client_id(id, name, email, phone, company, location),
      project:project_id(id, name)
    `)
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !row) {
    throw new Error(`Invoice not found: ${error?.message || invoiceId}`);
  }

  const [{ data: tenant }, { data: businessSettings }, { data: lineItems }] = await Promise.all([
    admin
      .from('tenants')
      .select('id, name, legal_name, slug, logo_url, settings')
      .eq('id', tenantId)
      .maybeSingle(),
    admin
      .from('business_settings')
      .select('trading_name, business_name, logo_url, brand_color, support_email')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    admin
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: true }),
  ]);

  const metadata = ((row.metadata && typeof row.metadata === 'object') ? row.metadata : {}) as Record<string, any>;
  let legacyMeta: Record<string, any> = {};
  if (typeof row.notes === 'string' && row.notes.includes('---METADATA---')) {
    try {
      const parts = row.notes.split('---METADATA---');
      legacyMeta = JSON.parse(parts[1].trim());
    } catch {
      // ignore malformed legacy notes metadata
    }
  }

  const clientRel = Array.isArray(row.client) ? row.client[0] : row.client;
  const resolvedClientName =
    String(
      row.client_name ||
        clientRel?.name ||
        metadata.clientName ||
        metadata.client_name ||
        legacyMeta.clientName ||
        ''
    ).trim() || 'Valued Client';

  const resolvedClientEmail = String(
    row.client_email ||
      clientRel?.email ||
      metadata.clientEmail ||
      metadata.client_email ||
      legacyMeta.clientEmail ||
      ''
  ).trim();

  const resolvedTenantName =
    String(
      businessSettings?.trading_name ||
        businessSettings?.business_name ||
        tenant?.name ||
        tenant?.legal_name ||
        ''
    ).trim() || 'AlphaClone Systems';

  return {
    ...row,
    invoiceNumber: row.invoice_number,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    taxRate: Number(row.tax_rate ?? metadata.taxRate ?? legacyMeta.taxRate ?? 0),
    discountAmount: Number(row.discount_amount ?? metadata.discountAmount ?? legacyMeta.discountAmount ?? 0),
    lineItems: (lineItems || []).map((li: any) => ({
      id: li.id,
      description: li.description,
      quantity: Number(li.quantity || 1),
      rate: Number(li.unit_price ?? li.rate ?? 0),
      unit_price: Number(li.unit_price ?? li.rate ?? 0),
      amount: Number(li.amount || 0),
    })),
    client: {
      id: clientRel?.id || row.client_id || null,
      name: resolvedClientName,
      email: resolvedClientEmail,
      phone: clientRel?.phone || null,
      address: clientRel?.location || null,
    },
    tenant: {
      ...(tenant || {}),
      name: resolvedTenantName,
      logo_url: businessSettings?.logo_url || tenant?.logo_url || null,
    },
    businessSettings: businessSettings || null,
    metadata,
  };
}

export async function generateAndStoreInvoicePdf(
  invoiceId: string,
  tenantId: string,
  actorUserId?: string
): Promise<{ storagePath: string }> {
  const invoice = await loadInvoiceForLifecycle(invoiceId, tenantId);
  const admin = createSupabaseAdminClient();

  await ensureInvoiceDocumentsBucket(admin);

  const items = invoice.lineItems || [];
  const tenant = invoice.tenant;

  const pdf = await generateThemedInvoicePdfBuffer(
    invoice as any,
    items as any,
    tenant as any,
    invoice.client ? { name: invoice.client.name, email: invoice.client.email } : undefined
  );
  const storagePath = `tenant/${tenantId}/invoices/${invoiceId}.pdf`;

  let { error: uploadError } = await admin.storage
    .from(INVOICE_DOCUMENTS_BUCKET)
    .upload(storagePath, pdf, { contentType: 'application/pdf', upsert: true });

  if (uploadError && String(uploadError.message || '').toLowerCase().includes('bucket not found')) {
    bucketEnsurePromise = null;
    await ensureInvoiceDocumentsBucket(admin);
    const retry = await admin.storage
      .from(INVOICE_DOCUMENTS_BUCKET)
      .upload(storagePath, pdf, { contentType: 'application/pdf', upsert: true });
    uploadError = retry.error;
  }
  if (uploadError) throw new Error(`Invoice PDF could not be stored: ${uploadError.message}`);

  const nowIso = new Date().toISOString();
  const existingMeta = (invoice.metadata || {}) as Record<string, unknown>;
  const { error: metaUpdateError } = await admin
    .from('business_invoices')
    .update({
      metadata: {
        ...existingMeta,
        pdf_storage_path: storagePath,
        pdf_generated_at: nowIso,
      },
      updated_at: nowIso,
    })
    .eq('tenant_id', tenantId)
    .eq('id', invoiceId);

  if (metaUpdateError) {
    throw new Error(`Failed to record invoice PDF metadata: ${metaUpdateError.message}`);
  }

  const { data: invoiceRow } = await admin
    .from('business_invoices')
    .select('id, invoice_number, status, total, client_id, project_id, contract_id')
    .eq('tenant_id', tenantId)
    .eq('id', invoiceId)
    .maybeSingle();

  if (invoiceRow && actorUserId) {
    await fileInvoiceDocument(admin, {
      tenantId,
      userId: actorUserId,
      invoice: invoiceRow,
      storagePath,
      storageBucket: INVOICE_DOCUMENTS_BUCKET,
      sizeBytes: pdf.byteLength,
    }).catch((error) =>
      console.error('[invoice-lifecycle] catalog filing failed', error instanceof Error ? error.message : error)
    );
  }

  return { storagePath };
}

export async function sendInvoiceEmailPhase(
  input: InvoiceLifecycleInput
): Promise<{ provider: string | null; emailId: string | null; recipients: string[]; actionUrl: string }> {
  const invoice = await loadInvoiceForLifecycle(input.invoiceId, input.tenantId);
  const explicitRecipients = (input.recipients || [])
    .flatMap((r) => String(r || '').split(','))
    .map((r) => r.trim())
    .filter(Boolean);
  const recipients = explicitRecipients.length
    ? explicitRecipients
    : [invoice.client?.email].map((r) => String(r || '').trim()).filter(Boolean);

  if (!recipients.length) {
    throw new Error(`Invoice ${input.invoiceId} has no recipient email`);
  }

  const admin = createSupabaseAdminClient();
  let storagePath = (invoice.pdf_storage_path || (invoice.metadata as any)?.pdf_storage_path) as string | undefined;

  let storedPdf: any = null;
  if (storagePath) {
    const { data, error } = await admin.storage
      .from(INVOICE_DOCUMENTS_BUCKET)
      .download(storagePath);
    if (!error && data) {
      storedPdf = data;
    } else {
      const altPath = storagePath.startsWith('tenant/')
        ? `${input.tenantId}/${input.invoiceId}/invoice.pdf`
        : `tenant/${input.tenantId}/invoices/${input.invoiceId}.pdf`;
      const { data: altData, error: altError } = await admin.storage
        .from(INVOICE_DOCUMENTS_BUCKET)
        .download(altPath);
      if (!altError && altData) {
        storedPdf = altData;
        storagePath = altPath;
      }
    }
  }

  if (!storedPdf) {
    const generated = await generateAndStoreInvoicePdf(input.invoiceId, input.tenantId, input.actorUserId);
    storagePath = generated.storagePath;
    const { data: freshPdf, error: dlErr } = await admin.storage
      .from(INVOICE_DOCUMENTS_BUCKET)
      .download(storagePath);
    if (dlErr || !freshPdf) {
      throw new Error(`Stored invoice PDF could not be loaded: ${dlErr?.message || 'not found'}`);
    }
    storedPdf = freshPdf;
  }

  const invoiceNumber = invoice.invoice_number || invoice.invoiceNumber;
  await ensureInvoicePaymentLink({ tenantId: input.tenantId, invoiceId: input.invoiceId }).catch(() => undefined);
  const actionUrl = await getPublicInvoicePaymentUrl(admin, input.invoiceId, input.tenantId);

  const emailAttachments: Array<{ filename: string; content: string; contentType: string }> = [
    {
      filename: `Invoice_${invoiceNumber}.pdf`,
      content: Buffer.from(await storedPdf.arrayBuffer()).toString('base64'),
      contentType: 'application/pdf',
    },
  ];

  const metaAttachments = Array.isArray((invoice.metadata as any)?.attachments)
    ? ((invoice.metadata as any).attachments as InvoiceAttachmentItem[])
    : [];
  const requestedAttachments = input.attachments?.length ? input.attachments : metaAttachments;
  const seenPaths = new Set<string>();

  for (const att of requestedAttachments) {
    const path = String(att?.storagePath || att?.storage_path || '').trim();
    if (!path || seenPaths.has(path)) continue;
    if (!path.startsWith(`tenant/${input.tenantId}/`)) {
      console.warn(`[invoice-lifecycle] Skipping attachment outside tenant prefix: ${path}`);
      continue;
    }
    seenPaths.add(path);
    const { data: attBlob, error: attErr } = await admin.storage
      .from(INVOICE_DOCUMENTS_BUCKET)
      .download(path);
    if (attErr || !attBlob) {
      console.warn(`[invoice-lifecycle] Could not download attachment ${path}:`, attErr?.message);
      continue;
    }
    emailAttachments.push({
      filename: att.name || path.split('/').pop() || 'attachment',
      content: Buffer.from(await attBlob.arrayBuffer()).toString('base64'),
      contentType: att.contentType || att.content_type || 'application/octet-stream',
    });
  }

  const result = await sendEmailServer({
    tenantId: input.tenantId,
    userId: input.actorUserId,
    to: recipients,
    subject: input.subject || `Invoice ${invoiceNumber} from ${invoice.tenant?.name || 'AlphaClone Systems'}`,
    html: invoiceEmailTemplates.invoiceSent({
      recipientName: invoice.client?.name || 'Valued Client',
      recipientEmail: recipients[0],
      tenantId: input.tenantId,
      invoiceNumber,
      amount: invoice.total || invoice.total_amount || 0,
      currency: invoice.currency || 'USD',
      dueDate: invoice.due_date,
      actionUrl,
      workspaceName: invoice.tenant?.name || 'AlphaClone Systems',
      notes: input.message || cleanInvoiceNotes(invoice.notes),
    }),
    attachments: emailAttachments,
    templateName: 'invoiceLifecycleSent',
    skipFooter: true,
  });
  if (!result.success) throw new Error(`Invoice email dispatch failed: ${result.error}`);

  const now = new Date().toISOString();
  const { error: deliveryError } = await admin.from('invoice_delivery_log').insert(
    recipients.map((email) => ({
      invoice_id: input.invoiceId,
      tenant_id: input.tenantId,
      sent_at: now,
      delivered_at: null,
      sent_to_email: email,
      email_provider: result.provider,
      provider_msg_id: result.emailId || null,
      delivery_status: 'PENDING',
    }))
  );
  if (deliveryError) throw new Error(`Failed to record invoice delivery log: ${deliveryError.message}`);

  return {
    provider: result.provider ?? null,
    emailId: result.emailId ?? null,
    recipients,
    actionUrl,
  };
}

export async function markInvoiceSentPhase(
  input: InvoiceLifecycleInput,
  deliveryMeta?: { provider?: string | null; emailId?: string | null; recipients?: string[] }
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data: current, error: currentError } = await admin
    .from('business_invoices')
    .select('id, invoice_number, status, client_email, client_name, metadata')
    .eq('tenant_id', input.tenantId)
    .eq('id', input.invoiceId)
    .maybeSingle();

  if (currentError || !current) {
    throw new Error(`Invoice could not be loaded for sent transition: ${currentError?.message || input.invoiceId}`);
  }

  if (['paid', 'void', 'cancelled'].includes(current.status)) {
    throw new Error(`Invoice in status '${current.status}' cannot transition to sent`);
  }

  const nextStatus = ['draft', 'approved'].includes(current.status) ? 'sent' : current.status;
  const primaryRecipient = deliveryMeta?.recipients?.[0] || input.recipients?.[0] || current.client_email || null;
  const existingMeta = ((current.metadata && typeof current.metadata === 'object') ? current.metadata : {}) as Record<string, unknown>;

  const updatePayload: Record<string, unknown> = {
    status: nextStatus,
    lifecycle_status: nextStatus === 'sent' ? 'sent' : current.status,
    sent_at: now,
    is_public: true,
    delivery_status: 'PENDING',
    canonical_delivery_status: 'sent',
    updated_at: now,
    metadata: {
      ...existingMeta,
      last_sent_at: now,
      last_email_provider: deliveryMeta?.provider || null,
      last_email_id: deliveryMeta?.emailId || null,
      last_sent_recipients: deliveryMeta?.recipients || input.recipients || (primaryRecipient ? [primaryRecipient] : []),
      email_delivery_status: 'provider_accepted',
    },
  };

  if (primaryRecipient) {
    updatePayload.client_email = primaryRecipient;
  }

  const { data: invoice, error } = await admin
    .from('business_invoices')
    .update(updatePayload)
    .eq('tenant_id', input.tenantId)
    .eq('id', input.invoiceId)
    .select('id,invoice_number,status')
    .maybeSingle();
  if (error) throw new Error(`Failed to update invoice sent status: ${error.message}`);
  if (!invoice) {
    throw new Error('Invoice could not transition to sent');
  }

  if (input.actorUserId) {
    await recordDailyResourceQuota(
      input.tenantId,
      input.actorUserId,
      'invoices',
      1,
      `invoice-lifecycle:${input.invoiceId}`
    );
  }

  const [auditResult, eventResult, lifecycleResult] = await Promise.allSettled([
    logInvoiceEvent({
      invoiceId: input.invoiceId,
      tenantId: input.tenantId,
      eventType: 'sent',
      eventData: {
        invoiceNumber: invoice.invoice_number,
        provider: deliveryMeta?.provider || null,
        emailId: deliveryMeta?.emailId || null,
        recipients: deliveryMeta?.recipients || input.recipients || [],
      },
      performedBy: input.actorUserId || 'system',
    }),
    admin
      .from('business_automation_events')
      .insert({
        tenant_id: input.tenantId,
        event_type: 'invoice_sent',
        payload: {
          invoiceId: input.invoiceId,
          invoiceNumber: invoice.invoice_number,
          actorUserId: input.actorUserId || null,
          provider: deliveryMeta?.provider || null,
          emailId: deliveryMeta?.emailId || null,
        },
      })
      .then(({ error: eventError }: { error: Error | null }) => {
        if (eventError) throw eventError;
      }),
    admin
      .from('invoice_lifecycle_events')
      .insert({
        tenant_id: input.tenantId,
        invoice_id: input.invoiceId,
        event_type: 'status_sent',
        from_status: current.status,
        to_status: nextStatus,
        actor_user_id: input.actorUserId || null,
        source: 'invoice_lifecycle',
        evidence: {
          delivery_state: 'provider_accepted',
          provider: deliveryMeta?.provider || null,
          email_id: deliveryMeta?.emailId || null,
          recipients: deliveryMeta?.recipients || input.recipients || [],
        },
      })
      .then(({ error: lifecycleError }: { error: Error | null }) => {
        if (lifecycleError) throw lifecycleError;
      }),
  ]);
  if (auditResult.status === 'rejected') {
    console.error('[invoice-lifecycle] sent audit failed', auditResult.reason);
  }
  if (eventResult.status === 'rejected') {
    console.error('[invoice-lifecycle] sent event failed', eventResult.reason);
  }
  if (lifecycleResult.status === 'rejected') {
    console.error('[invoice-lifecycle] lifecycle event failed', lifecycleResult.reason);
  }

  try {
    await postInvoiceIssueJournalServer(admin, {
      tenantId: input.tenantId,
      invoiceId: input.invoiceId,
      actorUserId: input.actorUserId || null,
    });
  } catch (journalError) {
    console.error('[invoice-lifecycle] issue journal failed', journalError);
  }
}

export async function runInvoiceInitialSend(input: InvoiceLifecycleInput): Promise<{
  storagePath: string;
  provider: string | null;
  emailId: string | null;
  recipients: string[];
  actionUrl: string;
}> {
  const { storagePath } = await generateAndStoreInvoicePdf(
    input.invoiceId,
    input.tenantId,
    input.actorUserId
  );
  const email = await sendInvoiceEmailPhase(input);
  await markInvoiceSentPhase(input, email);
  await scheduleInvoiceLifecycleFollowUp({
    tenantId: input.tenantId,
    invoiceId: input.invoiceId,
    actorUserId: input.actorUserId,
  });
  return { storagePath, ...email };
}

export async function checkInvoicePaymentSettled(invoiceId: string, tenantId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data: invoice, error } = await admin
    .from('business_invoices')
    .select('status')
    .eq('tenant_id', tenantId)
    .eq('id', invoiceId)
    .single();
  if (error) throw error;
  return invoice.status === 'paid' || invoice.status === 'void' || invoice.status === 'cancelled';
}

export async function sendInvoiceReminderPhase(invoiceId: string, tenantId: string): Promise<void> {
  const invoice = await loadInvoiceForLifecycle(invoiceId, tenantId);
  if (!invoice.client?.email) throw new Error(`Invoice ${invoiceId} has no client email for reminder`);
  const invoiceNumber = invoice.invoice_number || invoice.invoiceNumber;
  const admin = createSupabaseAdminClient();
  const actionUrl = await getPublicInvoicePaymentUrl(admin, invoiceId, tenantId);
  const { executeSendEmailCommand } = await import('@/lib/execution/commands/sendEmailCommand');
  const execution = await executeSendEmailCommand({
    tenantId,
    to: invoice.client.email,
    subject: `Reminder: Invoice ${invoiceNumber}`,
    html: invoiceEmailTemplates.invoiceSent({
      recipientName: invoice.client?.name || 'Valued Client',
      recipientEmail: invoice.client.email,
      tenantId,
      invoiceNumber,
      amount: invoice.total || invoice.total_amount || 0,
      currency: invoice.currency || 'USD',
      dueDate: invoice.due_date,
      actionUrl,
      workspaceName: invoice.tenant?.name || 'AlphaClone Systems',
      notes: 'Friendly reminder that this invoice is still awaiting payment.',
    }),
    templateName: 'invoiceLifecycleReminder',
    skipFooter: true,
    executionSource: 'cron',
    skipPolicyEvaluation: true,
    initiationSource: 'cron.invoice_lifecycle_reminder',
    relatedRecord: { type: 'invoice', id: invoiceId },
    idempotencyKey: `invoice-lifecycle-remind:${tenantId}:${invoiceId}:${new Date().toISOString().slice(0, 10)}`,
    auditMetadata: {
      source_module: 'cron',
      source_action: 'invoice.lifecycle_reminder',
    },
  });
  if (!execution.ok || !execution.result?.success) {
    throw new Error(`Invoice reminder failed: ${execution.error?.message || execution.result?.error}`);
  }

  await admin
    .from('business_invoices')
    .update({
      reminder_count: Number(invoice.reminder_count || 0) + 1,
      last_reminder_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', invoiceId);
}

export async function escalateInvoiceOverduePhase(
  invoiceId: string,
  tenantId: string,
  actorUserId?: string
): Promise<void> {
  const invoice = await loadInvoiceForLifecycle(invoiceId, tenantId);
  if (!invoice.client?.email) throw new Error(`Invoice ${invoiceId} has no client email for overdue notice`);
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data: updated, error: statusError } = await admin
    .from('business_invoices')
    .update({ status: 'overdue', lifecycle_status: 'overdue', updated_at: now })
    .eq('tenant_id', tenantId)
    .eq('id', invoiceId)
    .in('status', ['sent', 'viewed', 'partially_paid'])
    .select('id')
    .maybeSingle();
  if (statusError) throw statusError;
  if (!updated) return;

  const invoiceNumber = invoice.invoice_number || invoice.invoiceNumber;
  const actionUrl = await getPublicInvoicePaymentUrl(admin, invoiceId, tenantId);
  const result = await sendEmailServer({
    tenantId,
    to: invoice.client.email,
    subject: `Overdue: Invoice ${invoiceNumber}`,
    html: invoiceEmailTemplates.invoiceOverdue({
      recipientName: invoice.client?.name || 'Valued Client',
      recipientEmail: invoice.client.email,
      tenantId,
      invoiceNumber,
      amount: invoice.total || invoice.total_amount || 0,
      currency: invoice.currency || 'USD',
      dueDate: invoice.due_date,
      actionUrl,
      workspaceName: invoice.tenant?.name || 'AlphaClone Systems',
    }),
    templateName: 'invoiceLifecycleOverdue',
    skipFooter: true,
  });
  if (!result.success) throw new Error(`Invoice overdue email failed: ${result.error}`);

  await Promise.allSettled([
    logInvoiceEvent({
      invoiceId,
      tenantId,
      eventType: 'status_changed',
      eventData: { invoiceNumber },
      performedBy: actorUserId || 'system',
    }),
    admin.from('business_automation_events').insert({
      tenant_id: tenantId,
      event_type: 'invoice_overdue',
      payload: { invoiceId, invoiceNumber },
    }),
  ]);
}
