import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { logCrmActivityAdmin } from '@/lib/crm/crmActivityServer';
import { logDealStageActivity } from '@/lib/crm/crmBridgeServer';

const bodySchema = z.object({
  tenantId: z.string().uuid(),
  type: z.enum(['note', 'call', 'email', 'meeting', 'task', 'stage_change']),
  subject: z.string().min(1),
  description: z.string().optional(),
  contactId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  fromStage: z.string().optional(),
  toStage: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 422 });
    }

    const payload = parsed.data;
    const { user, admin } = await requireTenantRole(payload.tenantId, ['owner', 'admin', 'tenant_admin', 'member', 'super_admin'], req);

    if (payload.type === 'stage_change' && payload.dealId && payload.fromStage && payload.toStage) {
      await logDealStageActivity(admin, {
        tenantId: payload.tenantId,
        dealId: payload.dealId,
        fromStage: payload.fromStage,
        toStage: payload.toStage,
        userId: user.id,
      });
      return NextResponse.json({ success: true });
    }

    const activity = await logCrmActivityAdmin(admin, {
      tenantId: payload.tenantId,
      type: payload.type,
      subject: payload.subject,
      description: payload.description,
      contactId: payload.contactId,
      companyId: payload.companyId,
      opportunityId: payload.opportunityId,
      dealId: payload.dealId,
      projectId: payload.projectId,
      createdBy: user.id,
      metadata: payload.metadata,
      source: 'crm_api',
    });

    return NextResponse.json({ success: true, activityId: activity?.id });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to log CRM activity', req);
  }
}
