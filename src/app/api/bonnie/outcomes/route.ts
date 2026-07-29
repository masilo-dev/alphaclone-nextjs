import { NextRequest, NextResponse } from 'next/server';
<<<<<<< HEAD
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { normalizeDefineOutcomeArgs } from '@/lib/bonnie/outcomeArgs';
import { businessOutcomeSummary } from '@/lib/copy/businessFriendlyErrors';
=======
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
>>>>>>> origin/main

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

<<<<<<< HEAD
export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId');
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || '5'), 50);

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const { admin } = await requireTenantAccess(tenantId, req);

    const { data, error } = await admin
      .from('mcp_sessions')
      .select('id, tool_name, success, created_at, error_message')
      .eq('tenant_id', tenantId)
      .eq('tool_name', 'define_outcome')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const outcomes = (data || []).map((row: {
      id: string;
      tool_name: string | null;
      success: boolean | null;
      created_at: string;
      error_message: string | null;
    }) => ({
      id: row.id,
      label: 'Checked results',
      summary: businessOutcomeSummary({
        tool: row.tool_name || 'define_outcome',
        success: row.success,
        errorMessage: row.error_message,
      }),
      created_at: row.created_at,
      success: row.success,
    }));

    return NextResponse.json({ success: true, outcomes, items: outcomes });
  } catch (err: unknown) {
    return routeErrorResponse(err, 'Failed to load outcomes', req);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const normalized = normalizeDefineOutcomeArgs(
      body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
    );
    const tenantId = normalized.tenant_id;

    if (!tenantId) {
=======
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, criteria, status, session_id, notes } = body;

    if (!tenant_id || !criteria || !status) {
>>>>>>> origin/main
      return NextResponse.json(
        { error: 'tenant_id, criteria, and status are required' },
        { status: 400 }
      );
    }

<<<<<<< HEAD
    const { criteria, status, session_id, notes } = normalized;
    const { admin } = await requireTenantAccess(tenantId);

    const metCount = criteria.filter((c) => c.met).length;
    const score = Math.round((metCount / criteria.length) * 100);

    const { error } = await admin.from('mcp_sessions').insert({
      tenant_id: tenantId,
      tool_name: 'define_outcome',
      success: status === 'success',
      duration_ms: 0,
      tool_success: status === 'success',
      tool_latency_ms: 0,
=======
    if (!['success', 'partial', 'failure'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be one of: success, partial, failure' },
        { status: 400 }
      );
    }

    if (!Array.isArray(criteria) || criteria.length === 0) {
      return NextResponse.json({ error: 'criteria must be a non-empty array' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const metCount = criteria.filter((c: any) => c.met).length;
    const score = Math.round((metCount / criteria.length) * 100);

    // Log outcome to mcp_sessions
    const { error } = await supabase.from('mcp_sessions').insert({
      tenant_id,
      tool_name: 'define_outcome',
      success: status === 'success',
      duration_ms: 0,
>>>>>>> origin/main
      expires_at: new Date(Date.now() + 60000).toISOString(),
      error_message: status === 'failure' ? `Outcome failure. Notes: ${notes || 'none'}` : null,
    });

    if (error) {
      return NextResponse.json({ error: `Failed to record outcome: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      outcome: {
        status,
        score_percent: score,
        criteria_met: metCount,
        criteria_total: criteria.length,
        session_id: session_id || null,
        notes: notes || null,
      },
    });
<<<<<<< HEAD
  } catch (err: unknown) {
    return routeErrorResponse(err, 'Failed to record outcome', req);
=======
  } catch (err: any) {
    console.error('[bonnie/outcomes] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
>>>>>>> origin/main
  }
}
