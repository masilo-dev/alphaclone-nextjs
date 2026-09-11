import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { logInvoiceEvent } from '@/lib/audit/invoiceAuditLogger';

const MAX_BULK_INVOICES = 200;

const requestSchema = z.object({
  tenantId: z.string().uuid(),
  ids: z.array(z.string().uuid()).min(1).max(MAX_BULK_INVOICES),
  changes: z.object({
    status: z.enum(['void', 'cancelled']).optional(),
    disableFollowups: z.literal(true).optional(),
  }).refine((changes) => Object.keys(changes).length > 0, 'At least one change is required'),
  reason: z.string().trim().min(3).max(500).optional(),
  finalConfirmation: z.literal(true),
});

/**
 * PATCH /api/invoices/bulk
 *
 * Supports only explicit, non-delivery bulk changes. It cannot create, issue,
 * send, mark-paid, or delete invoices. Any status change is recorded per
 * invoice and in the tenant audit log. External invoice emails are never sent
 * by this route.
 */
export async function PATCH(req: NextRequest) {
  try {
    const parsed = requestSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid bulk invoice operation', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { tenantId, changes, finalConfirmation } = parsed.data;
    const ids = [...new Set(parsed.data.ids)];
    if (!finalConfirmation) {
      return NextResponse.json({ error: 'Final confirmation is required before changing invoices in bulk.' }, { status: 400 });
    }
    if (changes.status && !parsed.data.reason) {
      return NextResponse.json({ error: 'Provide a reason before voiding or cancelling invoices.' }, { status: 400 });
    }

    const { user } = await requireTenantAccess(tenantId, req);
    const admin = createAdminSupabaseClientOrThrow();
    const { data: invoices, error: fetchError } = await admin
      .from('business_invoices')
      .select('id, invoice_number, status, auto_followup_enabled')
      .eq('tenant_id', tenantId)
      .in('id', ids);
    if (fetchError) throw fetchError;
    if ((invoices || []).length !== ids.length) {
      return NextResponse.json({ error: 'One or more invoices were not found in this workspace.' }, { status: 404 });
    }

    if (changes.status) {
      const protectedInvoices = (invoices || []).filter((invoice) => ['paid', 'partially_paid'].includes(String(invoice.status).toLowerCase()));
      if (protectedInvoices.length) {
        return NextResponse.json({
          error: 'Paid or partially paid invoices cannot be voided or cancelled in bulk. Reconcile them individually first.',
          protectedInvoiceIds: protectedInvoices.map((invoice) => invoice.id),
        }, { status: 409 });
      }
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (changes.status) patch.status = changes.status;
    if (changes.disableFollowups === true) patch.auto_followup_enabled = false;

    const { data: updated, error: updateError } = await admin
      .from('business_invoices')
      .update(patch)
      .eq('tenant_id', tenantId)
      .in('id', ids)
      .select('id, invoice_number, status');
    if (updateError) throw updateError;
    if ((updated || []).length !== ids.length) {
      return NextResponse.json({ error: 'One or more invoices could not be updated.' }, { status: 409 });
    }

    await Promise.all((invoices || []).map((invoice) => logInvoiceEvent({
      invoiceId: invoice.id,
      tenantId,
      eventType: changes.status ? 'status_changed' : 'edited',
      eventData: {
        bulk: true,
        changes,
        reason: parsed.data.reason || null,
        previousStatus: invoice.status,
        external_delivery_dispatched: false,
      },
      performedBy: user.id,
    }).catch((error) => console.error('[invoices/bulk] invoice audit failed', error))));

    const { error: auditError } = await admin.from('audit_logs').insert({
      tenant_id: tenantId,
      user_id: user.id,
      action: 'invoices_bulk_updated',
      entity_type: 'invoice',
      entity_id: null,
      new_values: {
        invoice_ids: ids,
        count: ids.length,
        changes,
        reason: parsed.data.reason || null,
        final_confirmation: true,
        external_delivery_dispatched: false,
      },
      created_at: new Date().toISOString(),
    });
    if (auditError) console.error('[invoices/bulk] audit event could not be recorded:', auditError.message);

    return NextResponse.json({
      success: true,
      updated: updated?.length || 0,
      changes,
      externalDeliveryDispatched: false,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Invoices could not be updated in bulk', req);
  }
}
