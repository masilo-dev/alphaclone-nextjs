import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type BonnieApprovalPreview = {
  id: string;
  toolName: string;
  riskLevel: string;
  reason: string;
  status: string;
  createdAt: string;
  preview: { target?: string; draft?: string };
  payload: Record<string, unknown>;
};

function buildPreviewFromPayload(payload: Record<string, unknown>) {
  const args = (payload.args || {}) as Record<string, unknown>;
  const target =
    args.to ||
    args.recipient ||
    args.email ||
    args.phone ||
    args.client_id ||
    undefined;
  const draft =
    args.body ||
    args.message ||
    args.content ||
    args.text ||
    args.subject ||
    args.html ||
    undefined;

  return {
    target: target ? String(target) : undefined,
    draft: draft ? String(draft).slice(0, 2000) : undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = String(new URL(request.url).searchParams.get('tenantId') || '').trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const admin = createSupabaseAdminClient();

    const { data, error } = await admin
      .from('autonomous_runner_approvals')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const bonnieApprovals: BonnieApprovalPreview[] = (data || [])
      .filter((row: { payload?: Record<string, unknown>; action_key?: string }) => {
        const payload = (row.payload || {}) as Record<string, unknown>;
        return payload.source === 'bonnie' || String(row.action_key || '').startsWith('bonnie:');
      })
      .map((row: {
        id: string;
        risk_level: string;
        reason: string;
        status: string;
        created_at: string;
        action_key?: string;
        payload?: Record<string, unknown>;
      }) => {
        const payload = (row.payload || {}) as Record<string, unknown>;
        const toolName =
          String(payload.tool_name || '') ||
          String(row.action_key || '').replace(/^bonnie:/, '');
        return {
          id: row.id,
          toolName,
          riskLevel: row.risk_level,
          reason: row.reason,
          status: row.status,
          createdAt: row.created_at,
          preview: buildPreviewFromPayload(payload),
          payload,
        };
      });

    return NextResponse.json({
      success: true,
      approvals: bonnieApprovals,
      pendingCount: bonnieApprovals.length,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load Bonnie approvals');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, approvalId, args } = body;

    if (!tenantId || !approvalId || !args || typeof args !== 'object') {
      return NextResponse.json({ error: 'tenantId, approvalId, and args are required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const admin = createSupabaseAdminClient();

    const { data: existing, error: fetchError } = await admin
      .from('autonomous_runner_approvals')
      .select('payload')
      .eq('id', approvalId)
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .maybeSingle();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Pending approval not found' }, { status: 404 });
    }

    const payload = (existing.payload || {}) as Record<string, unknown>;
    const mergedPayload = {
      ...payload,
      args: { ...((payload.args || {}) as Record<string, unknown>), ...args },
    };

    const { data, error } = await admin
      .from('autonomous_runner_approvals')
      .update({
        payload: mergedPayload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', approvalId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      approval: data,
      preview: buildPreviewFromPayload(mergedPayload),
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to update approval');
  }
}
