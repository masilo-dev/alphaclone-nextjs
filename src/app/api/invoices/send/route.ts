import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { start } from 'workflow/api';
import { invoiceLifecycleWorkflow } from '@/workflows/invoice-lifecycle';
import { validateDailyResourceQuota } from '@/lib/server/dailyResourceQuota';

const schema = z.object({
  tenantId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  recipients: z.union([z.string().email(), z.array(z.string().email()).min(1).max(20)]),
  subject: z.string().trim().min(1).max(250).optional(),
  message: z.string().trim().max(10_000).optional(),
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

    const { runId } = await start(invoiceLifecycleWorkflow, [{
      invoiceId,
      tenantId,
      actorUserId: user.id,
      recipients: [...new Set(recipients.map((email) => email.toLowerCase()))],
      subject,
      message,
    }]);

    return NextResponse.json({
      success: true,
      status: 'queued',
      message: 'Invoice delivery has been queued',
      runId,
    }, { status: 202 });
  } catch (error) {
    return routeErrorResponse(error, 'Invoice delivery could not be queued', req);
  }
}
