import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  getCurrentOpenPeriod,
  initializeFiscalYearPeriods,
  listAccountingPeriods,
  type PeriodStatus,
} from '@/lib/accounting/accountingPeriodServer';

const adminRoles = ['owner', 'admin', 'tenant_admin', 'super_admin'];

const postSchema = z.object({
  action: z.literal('initialize_fiscal_year'),
  fiscalYear: z.number().int().min(2000).max(2100),
});

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    await requireTenantAccess(tenantId, req);

    const fiscalYearParam = req.nextUrl.searchParams.get('fiscalYear');
    const statusParam = req.nextUrl.searchParams.get('status') as PeriodStatus | null;

    const filters: { fiscalYear?: number; status?: PeriodStatus } = {};
    if (fiscalYearParam) {
      filters.fiscalYear = Number(fiscalYearParam);
    }
    if (statusParam === 'open' || statusParam === 'closed' || statusParam === 'locked') {
      filters.status = statusParam;
    }

    const admin = createSupabaseAdminClient();
    const [periods, currentPeriod] = await Promise.all([
      listAccountingPeriods(admin, tenantId, filters),
      getCurrentOpenPeriod(admin, tenantId),
    ]);

    return NextResponse.json({ periods, currentPeriod });
  } catch (error) {
    return routeErrorResponse(error, 'Accounting periods could not be loaded', req);
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantRole(tenantId, adminRoles, req);
    const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', fields: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const admin = createSupabaseAdminClient();
    const existing = await listAccountingPeriods(admin, tenantId, {
      fiscalYear: parsed.data.fiscalYear,
    });

    if (existing.length > 0) {
      return NextResponse.json(
        { error: `Periods already exist for fiscal year ${parsed.data.fiscalYear}`, periods: existing },
        { status: 409 },
      );
    }

    const periods = await initializeFiscalYearPeriods(
      admin,
      tenantId,
      parsed.data.fiscalYear,
      user.id,
    );

    await admin.from('business_automation_events').insert({
      tenant_id: tenantId,
      event_type: 'accounting_periods_initialized',
      payload: { actorUserId: user.id, fiscalYear: parsed.data.fiscalYear, count: periods.length },
    });

    return NextResponse.json({ periods }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Accounting periods could not be initialized', req);
  }
}
