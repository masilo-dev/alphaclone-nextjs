import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, criteria, status, session_id, notes } = body;

    if (!tenant_id || !criteria || !status) {
      return NextResponse.json(
        { error: 'tenant_id, criteria, and status are required' },
        { status: 400 }
      );
    }

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
  } catch (err: any) {
    console.error('[bonnie/outcomes] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
