import { NextRequest, NextResponse } from 'next/server';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import {
  assertCampaignTransition,
  campaignTransitionSchema,
  type CampaignStatus,
} from '@/lib/marketing/campaignDomain';

const WRITE_ROLES = ['owner', 'admin', 'tenant_admin', 'super_admin', 'staff'];

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await context.params;
    const input = campaignTransitionSchema.parse({ ...(await request.json()), campaignId });
    const { user, admin } = await requireTenantRole(input.tenantId, WRITE_ROLES, request);
    const { data: current, error: readError } = await admin
      .from('marketing_campaigns')
      .select('id,status,requires_approval,approved_at')
      .eq('tenant_id', input.tenantId)
      .eq('id', campaignId)
      .is('deleted_at', null)
      .maybeSingle();
    if (readError) throw readError;
    if (!current) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    assertCampaignTransition(current.status as CampaignStatus, input.status, {
      requiresApproval: current.requires_approval,
      approvedAt: current.approved_at,
    });
    const now = new Date().toISOString();
    const { data, error } = await admin
      .from('marketing_campaigns')
      .update({
        status: input.status,
        updated_by: user.id,
        ...(input.status === 'running' ? { started_at: now } : {}),
        ...(input.status === 'completed' ? { completed_at: now } : {}),
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', campaignId)
      .eq('status', current.status)
      .select()
      .single();
    if (error) throw error;
    await admin.from('marketing_campaign_events').insert({
      tenant_id: input.tenantId,
      campaign_id: campaignId,
      event_type: 'status_changed',
      actor_user_id: user.id,
      previous_value: { status: current.status },
      new_value: { status: input.status },
    });
    return NextResponse.json({ campaign: data });
  } catch (error) {
    return routeErrorResponse(error, 'Campaign status could not be changed.', request);
  }
}
