import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { autonomousRunnerService } from '@/services/autonomousRunnerService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tenantId = String(new URL(request.url).searchParams.get('tenantId') || '').trim();
    if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    const { admin } = await requireTenantAccess(tenantId);

    // Fetch recent runs
    const { data: runs, error: runsError } = await admin
      .from('autonomous_runner_runs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (runsError) throw runsError;

    // Fetch recent approvals
    const { data: approvals, error: approvalsError } = await admin
      .from('autonomous_runner_approvals')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (approvalsError) throw approvalsError;

    return NextResponse.json({
      success: true,
      runs: runs || [],
      approvals: approvals || []
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load autonomous trigger logs');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = String(body.tenantId || '').trim();
    if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin']);

    console.log(`[Autonomous Trigger] Starting manual execution for tenant: ${tenantId}`);
    const result = await autonomousRunnerService.runForTenant(tenantId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        run: result.run,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }
  } catch (error) {
    return routeErrorResponse(error, 'Failed to trigger autonomous runner execution');
  }
}
