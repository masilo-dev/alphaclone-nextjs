import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { validateDailyResourceQuota } from '@/lib/server/dailyResourceQuota';
import { executeInvoiceSendCommand } from '@/lib/execution/commands/invoiceSendCommand';
import { mapProviderCodeToHttpStatus } from '@/lib/execution/domainCapabilityGuard';

const schema = z.object({
  tenantId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  recipients: z.union([z.string().email(), z.array(z.string().email()).min(1).max(20)]),
  subject: z.string().trim().min(1).max(250).optional(),
  message: z.string().trim().max(10_000).optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Valid tenantId, invoiceId, and recipient email are required' }, { status: 400 });
    }

    const { tenantId, invoiceId, subject, message } = parsed.data;
    const recipients = Array.isArray(parsed.data.recipients) ? parsed.data.recipients : [parsed.data.recipients];
    const { user, admin } = await requireTenantAccess(tenantId, req);
    const { data: invoice, error } = await admin
      .from('business_invoices')
      .select('id,status,lifecycle_status')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw error;
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (!['draft', 'approved'].includes(String(invoice.lifecycle_status || invoice.status))) {
      return NextResponse.json({ error: `Only draft or approved invoices can be sent. This invoice is ${invoice.lifecycle_status || invoice.status}.` }, { status: 409 });
    }

    await validateDailyResourceQuota(tenantId, user.id, 'invoices');

    const normalizedRecipients = [...new Set(recipients.map((email) => email.toLowerCase()))];
    const headerKey = req.headers.get('idempotency-key') || req.headers.get('Idempotency-Key');
    const execution = await executeInvoiceSendCommand({
      tenantId,
      userId: user.id,
      invoiceId,
      recipients: normalizedRecipients,
      subject,
      message,
      idempotencyKey: parsed.data.idempotencyKey || headerKey || undefined,
      executionSource: 'ui',
    });

    if (!execution.ok) {
      const code = execution.failure_code || execution.error?.code || 'SEND_FAILED';
      return NextResponse.json(
        {
          error: execution.error?.message || 'Invoice delivery blocked',
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

    const queued = execution.result!;
    return NextResponse.json(
      {
        success: true,
        ...queued,
        invoiceId,
        execution_id: execution.execution_id,
        idempotency_key: execution.idempotency_key,
        message: queued.durable
          ? 'Invoice delivery queued on Bonnie durable runtime'
          : 'Invoice delivery queued on workflow runtime',
        execution_truth: {
          status: execution.status,
          verification_state: execution.verification_state,
          may_claim_completed: false,
        },
      },
      { status: 202 }
    );
  } catch (error) {
    return routeErrorResponse(error, 'Invoice delivery could not be queued', req);
  }
}
