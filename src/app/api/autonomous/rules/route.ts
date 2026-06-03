import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  try {
    const tenantId = String(new URL(request.url).searchParams.get('tenantId') || '').trim();
    if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    await requireTenantAccess(tenantId);
    const admin = createSupabaseAdminClient();

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
    const body = await request.json();
    const tenantId = String(body.tenantId || '').trim();
    if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    const access = await requireTenantAccess(tenantId);
    const admin = createSupabaseAdminClient();

    const payload = {
      tenant_id: tenantId,
      enabled: body.enabled !== false,
      auto_send_enabled: body.autoSendEnabled === true,
      auto_send_confidence_threshold: Number(body.autoSendConfidenceThreshold || 85),
      high_risk_approval_required: body.highRiskApprovalRequired !== false,
      stale_deal_days: Number(body.staleDealDays || 7),
      social_inactivity_days: Number(body.socialInactivityDays || 3),
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

    return NextResponse.json({ success: true, rules: data });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to update autonomous rules');
  }
}


