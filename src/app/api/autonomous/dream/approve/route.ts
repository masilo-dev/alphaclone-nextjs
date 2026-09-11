import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { mergeDreamSession } from '@/services/nexusMemoryService';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = body.tenantId || body.tenant_id;
    const sessionId = body.sessionId || body.session_id;

    if (!tenantId || !sessionId) {
      return NextResponse.json({ error: 'Missing tenantId or sessionId' }, { status: 400 });
    }

    const { user } = await requireTenantAccess(tenantId);
    const admin = createSupabaseAdminClient();

    const { data: updated, error: updateErr } = await admin
      .from('bonnie_dream_sessions')
      .update({ status: 'applied', applied_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('tenant_id', tenantId)
      .select('id, status')
      .single();

    if (updateErr) throw updateErr;

    const mergeResult = await mergeDreamSession(tenantId, sessionId, user.id);

    return NextResponse.json({
      success: true,
      session: updated,
      memories_merged: mergeResult.merged,
      memory_summary: mergeResult.memorySummary,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to approve dream update');
  }
}
