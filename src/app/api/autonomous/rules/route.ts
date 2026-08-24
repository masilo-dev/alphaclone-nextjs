import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const tenantId = String(new URL(request.url).searchParams.get('tenantId') || '').trim();
    if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    const { admin } = await requireTenantAccess(tenantId);

    const { data, error } = await admin
      .from('autonomous_runner_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      rules: data || {
        tenant_id: tenantId,
        enabled: true,
        auto_send_enabled: false,
        auto_send_confidence_threshold: 85,
        high_risk_approval_required: true,
        stale_deal_days: 7,
        social_inactivity_days: 3,
        lead_action_mode: 'draft_and_task',
        email_provider: 'system_default',
      },
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load autonomous rules');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = z.object({
      tenantId: z.string().uuid(),
      enabled: z.boolean(),
      autoSendEnabled: z.boolean(),
      autoSendConfidenceThreshold: z.number().min(0).max(100),
      highRiskApprovalRequired: z.boolean(),
      staleDealDays: z.number().int().min(1).max(365),
      socialInactivityDays: z.number().int().min(1).max(365),
      leadActionMode: z.enum(['draft_and_task', 'draft_only', 'disabled']).optional(),
      emailProvider: z.string().trim().min(1).max(40).optional(),
    }).parse(await request.json());
    const tenantId = body.tenantId;
    const access = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin']);
    const admin = access.admin;

    const payload = {
      tenant_id: tenantId,
      enabled: body.enabled,
      auto_send_enabled: body.autoSendEnabled,
      auto_send_confidence_threshold: body.autoSendConfidenceThreshold,
      high_risk_approval_required: body.highRiskApprovalRequired,
      stale_deal_days: body.staleDealDays,
      social_inactivity_days: body.socialInactivityDays,
      lead_action_mode: String(body.leadActionMode || 'draft_and_task'),
      email_provider: String(body.emailProvider || 'system_default'),
      updated_by: access.user.id,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from('autonomous_runner_rules')
      .upsert(payload, { onConflict: 'tenant_id' })
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const autopilotOn = payload.auto_send_enabled && !payload.high_risk_approval_required;
    if (autopilotOn) {
      const { mcpStore } = await import('@/services/mcp/mcpStore');
      await mcpStore.updateBusinessAIState(tenantId, access.user.id, { agent_mode: 'autonomous' });
    }
    await admin.from('business_automation_events').insert({
      tenant_id: tenantId,
      event_type: 'autonomous_rules_updated',
      payload: { actorUserId: access.user.id, enabled: payload.enabled, autoSendEnabled: payload.auto_send_enabled, highRiskApprovalRequired: payload.high_risk_approval_required },
    });
    await admin.from('bonnie_logs').insert({
      tenant_id: tenantId,
      level: payload.enabled ? 'success' : 'warning',
      message: payload.enabled ? 'Agent execution state changed to RUNNING.' : 'Agent execution state changed to PAUSED.',
    });

    return NextResponse.json({ success: true, rules: data });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to update autonomous rules');
  }
}
