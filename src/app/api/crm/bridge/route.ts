import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { reconcileTenantCrm, syncCrmEntity } from '@/lib/crm/crmBridgeServer';

const entitySchema = z.object({
  tenantId: z.string().uuid(),
  entity: z.enum(['deal', 'lead', 'client']),
  entityId: z.string().uuid(),
});

const reconcileSchema = z.object({
  tenantId: z.string().uuid(),
  action: z.literal('reconcile'),
});

const bodySchema = z.union([entitySchema, reconcileSchema]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 422 });
    }

    const { tenantId } = parsed.data;
    const { admin } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);
    if ('action' in parsed.data && parsed.data.action === 'reconcile') {
      const summary = await reconcileTenantCrm(admin, tenantId);
      return NextResponse.json({ success: true, ...summary });
    }

    const { entity, entityId } = parsed.data as z.infer<typeof entitySchema>;
    const result = await syncCrmEntity(admin, entity, entityId, tenantId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return routeErrorResponse(error, 'CRM bridge sync failed', req);
  }
}
