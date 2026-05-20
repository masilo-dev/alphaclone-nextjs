import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, approvalId, status } = body;
    
    if (!tenantId || !approvalId || !status) {
      return NextResponse.json({ error: 'Missing tenantId, approvalId, or status' }, { status: 400 });
    }
    
    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    
    await requireTenantAccess(tenantId);
    const admin = createSupabaseAdminClient();

    const { data, error } = await admin
      .from('autonomous_runner_approvals')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', approvalId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, approval: data });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to update approval status');
  }
}
