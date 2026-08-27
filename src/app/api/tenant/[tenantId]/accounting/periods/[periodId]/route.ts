import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  closeAccountingPeriod,
  getAccountingPeriodById,
  lockAccountingPeriod,
  reopenAccountingPeriod,
} from '@/lib/accounting/accountingPeriodServer';

const adminRoles = ['owner', 'admin', 'tenant_admin', 'super_admin'];

const patchSchema = z.object({
  action: z.enum(['close', 'lock', 'reopen']),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ tenantId: string; periodId: string }> },
) {
  try {
    const { tenantId, periodId } = await context.params;
    const { user } = await requireTenantRole(tenantId, adminRoles, req);
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', fields: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const admin = createSupabaseAdminClient();

    switch (parsed.data.action) {
      case 'close':
        await closeAccountingPeriod(admin, tenantId, periodId, user.id);
        break;
      case 'lock':
        await lockAccountingPeriod(admin, tenantId, periodId, user.id);
        break;
      case 'reopen':
        await reopenAccountingPeriod(admin, tenantId, periodId);
        break;
      default: {
        const _exhaustive: never = parsed.data.action;
        throw new Error(`Unsupported action: ${_exhaustive}`);
      }
    }

    const period = await getAccountingPeriodById(admin, tenantId, periodId);

    await admin.from('business_automation_events').insert({
      tenant_id: tenantId,
      event_type: 'accounting_period_updated',
      payload: { actorUserId: user.id, periodId, action: parsed.data.action },
    });

    return NextResponse.json({ period });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Accounting period could not be updated';
    if (
      message.includes('not found') ||
      message.includes('already') ||
      message.includes('before locking') ||
      message.includes('Cannot reopen')
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return routeErrorResponse(error, 'Accounting period could not be updated', req);
  }
}
