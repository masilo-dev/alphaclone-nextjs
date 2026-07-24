import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { start } from 'workflow/api';
import { invoiceLifecycleWorkflow } from '@/workflows/invoice-lifecycle';
import { consumeDailyResourceQuota, releaseDailyResourceQuota } from '@/lib/server/dailyResourceQuota';

/**
 * Start invoice lifecycle without MCP/AI.
 * Looks up client email from the invoice when recipients are omitted.
 */
const schema = z.object({
  tenantId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  recipients: z
    .union([z.string().email(), z.array(z.string().email()).min(1).max(20)])
    .optional(),
  subject: z.string().trim().min(1).max(250).optional(),
  message: z.string().trim().max(10_000).optional(),
});

export async function POST(req: NextRequest) {
  let quotaReservation: { tenantId: string; userId: string } | null = null;
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Valid tenantId and invoiceId are required' },
        { status: 400 }
      );
    }

    const { tenantId, invoiceId, subject, message } = parsed.data;
    const { user, admin } = await requireTenantAccess(tenantId, req);
    const { data: invoice, error } = await admin
      .from('business_invoices')
      .select('id, status, client_id, clients:client_id(email)')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw error;
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (invoice.status !== 'draft') {
      return NextResponse.json(
        { error: `Only draft invoices can be sent. This invoice is ${invoice.status}.` },
        { status: 409 }
      );
    }

    let recipients: string[] = [];
    if (parsed.data.recipients) {
      recipients = Array.isArray(parsed.data.recipients)
        ? parsed.data.recipients
        : [parsed.data.recipients];
    } else {
      const clientEmail =
        (invoice as any)?.clients?.email ||
        (Array.isArray((invoice as any)?.clients)
          ? (invoice as any).clients[0]?.email
          : null);
      if (clientEmail) recipients = [String(clientEmail)];
    }
    recipients = [...new Set(recipients.map((email) => email.toLowerCase()).filter(Boolean))];
    if (!recipients.length) {
      return NextResponse.json(
        { error: 'Invoice has no client email — add a recipient or attach a client with an email' },
        { status: 400 }
      );
    }

    await consumeDailyResourceQuota(tenantId, user.id, 'invoices');
    quotaReservation = { tenantId, userId: user.id };

    const { runId } = await start(invoiceLifecycleWorkflow, [
      {
        invoiceId,
        tenantId,
        actorUserId: user.id,
        recipients,
        subject,
        message,
      },
    ]);

    quotaReservation = null;
    return NextResponse.json(
      {
        success: true,
        status: 'queued',
        message: 'Invoice delivery has been queued',
        runId,
      },
      { status: 202 }
    );
  } catch (error) {
    if (quotaReservation) {
      await releaseDailyResourceQuota(
        quotaReservation.tenantId,
        quotaReservation.userId,
        'invoices'
      );
    }
    return routeErrorResponse(error, 'Invoice delivery could not be queued', req);
  }
}
