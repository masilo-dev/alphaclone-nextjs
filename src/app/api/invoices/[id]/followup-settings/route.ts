import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, createAdminSupabaseClientOrThrow, routeErrorResponse } from '@/lib/apiAuth';

const Schema = z.object({
  tenantId: z.string().uuid(),
  autoFollowupEnabled: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await context.params;
    const body = await req.json();
    const parsed = Schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const { tenantId, autoFollowupEnabled } = parsed.data;
    await requireTenantAccess(tenantId);
    const admin = createAdminSupabaseClientOrThrow();

    const { error } = await admin
      .from('business_invoices')
      .update({ auto_followup_enabled: autoFollowupEnabled, updated_at: new Date().toISOString() })
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    return NextResponse.json({ success: true, autoFollowupEnabled });
  } catch (err) {
    return routeErrorResponse(err, 'Failed to update follow-up settings', req);
  }
}
