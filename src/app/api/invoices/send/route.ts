import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { validateDailyResourceQuota } from '@/lib/server/dailyResourceQuota';
import { executeInvoiceSendCommand } from '@/lib/execution/commands/invoiceSendCommand';
import { mapProviderCodeToHttpStatus } from '@/lib/execution/domainCapabilityGuard';

const attachmentSchema = z
  .object({
    name: z.string().trim().min(1).max(300),
    storagePath: z.string().trim().max(1000).optional(),
    storage_path: z.string().trim().max(1000).optional(),
    contentType: z.string().trim().max(200).optional(),
    content_type: z.string().trim().max(200).optional(),
    size: z.number().min(0).max(20_000_000).optional(),
  })
  .transform((att) => ({
    name: att.name,
    storagePath: String(att.storagePath || att.storage_path || '').trim(),
    contentType: att.contentType || att.content_type,
    size: att.size,
  }))
  .refine((att) => att.storagePath.length > 0, { message: 'storagePath is required' });

const schema = z.object({
  tenantId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  recipients: z.union([z.string().min(3), z.array(z.string().min(3)).min(1).max(20)]).optional(),
  subject: z.string().trim().min(1).max(250).optional(),
  message: z.string().trim().max(10_000).optional(),
  attachments: z.array(attachmentSchema).max(20).optional(),
  resend: z.boolean().optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmailList(raw: unknown): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return [
    ...new Set(
      list
        .flatMap((entry) => String(entry || '').split(/[;,]/))
        .map((email) => email.trim().toLowerCase())
        .filter((email) => EMAIL_RE.test(email))
    ),
  ];
}

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Valid tenantId and invoiceId are required' }, { status: 400 });
    }

    const { tenantId, invoiceId, subject, message, attachments, resend } = parsed.data;
    const { user, admin } = await requireTenantAccess(tenantId, req);
    const { data: invoice, error } = await admin
      .from('business_invoices')
      .select('id, status, lifecycle_status, client_id, client_email, metadata, notes, clients:client_id(email)')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw error;
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const currentStatus = String(invoice.status || '').toLowerCase();
    if (['paid', 'void', 'cancelled'].includes(currentStatus)) {
      return NextResponse.json(
        { error: `Invoices in '${invoice.status}' status cannot be sent.` },
        { status: 409 }
      );
    }

    let normalizedRecipients = parseEmailList(parsed.data.recipients);
    if (!normalizedRecipients.length) {
      const clientRel = Array.isArray((invoice as any)?.clients)
        ? (invoice as any).clients[0]
        : (invoice as any)?.clients;
      const meta = ((invoice as any)?.metadata || {}) as Record<string, unknown>;
      normalizedRecipients = parseEmailList([
        invoice.client_email,
        clientRel?.email,
        meta.clientEmail,
        meta.client_email,
      ]);
    }

    if (!normalizedRecipients.length) {
      return NextResponse.json(
        { error: 'Valid recipient email is required to send this invoice' },
        { status: 400 }
      );
    }

    await validateDailyResourceQuota(tenantId, user.id, 'invoices');

    const headerKey = req.headers.get('idempotency-key') || req.headers.get('Idempotency-Key');
    const isResend =
      Boolean(resend) ||
      ['sent', 'viewed', 'overdue', 'partially_paid'].includes(currentStatus);

    const execution = await executeInvoiceSendCommand({
      tenantId,
      userId: user.id,
      invoiceId,
      recipients: normalizedRecipients,
      subject,
      message,
      attachments,
      attemptId: isResend && !parsed.data.idempotencyKey && !headerKey ? `resend-${Date.now()}` : undefined,
      idempotencyKey: parsed.data.idempotencyKey || headerKey || undefined,
      executionSource: 'ui',
    });

    if (!execution.ok) {
      const code = execution.failure_code || execution.error?.code || 'SEND_FAILED';
      return NextResponse.json(
        {
          error: execution.error?.message || 'Invoice delivery failed',
          code,
          execution_truth: {
            status: execution.status,
            verification_state: execution.verification_state,
            may_claim_completed: false,
          },
        },
        { status: mapProviderCodeToHttpStatus(code) }
      );
    }

    const result = execution.result!;
    const isSent = result.status === 'sent' || result.canonical_delivery_status === 'provider_accepted';

    return NextResponse.json(
      {
        success: true,
        ...result,
        invoiceId,
        execution_id: execution.execution_id,
        idempotency_key: execution.idempotency_key,
        message: isSent
          ? `Invoice sent to ${normalizedRecipients.join(', ')}${result.provider ? ` via ${result.provider}` : ''}`
          : result.durable
          ? 'Invoice delivery queued on Bonnie durable runtime'
          : 'Invoice delivery queued on workflow runtime',
        execution_truth: {
          status: execution.status,
          verification_state: execution.verification_state,
          may_claim_completed: isSent,
        },
      },
      { status: isSent ? 200 : 202 }
    );
  } catch (error) {
    return routeErrorResponse(error, 'Invoice delivery could not be completed', req);
  }
}
