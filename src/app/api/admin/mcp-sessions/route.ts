import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requirePlatformSuperAdmin, routeErrorResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/** Super-admin MCP session + tool execution monitor (last 24h). */
export async function GET(req: NextRequest) {
  try {
    await requirePlatformSuperAdmin();
    const hours = Math.min(72, Math.max(1, Number(req.nextUrl.searchParams.get('hours') || 24)));
    const since = new Date(Date.now() - hours * 3_600_000).toISOString();
    const admin = createSupabaseAdminClient();

    const [sessionsRes, receiptsRes, failuresRes] = await Promise.all([
      admin
        .from('mcp_sessions')
        .select('id, tenant_id, tool_name, success, duration_ms, error_message, created_at, metadata')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200),
      admin
        .from('mcp_action_receipts')
        .select('id, tenant_id, tool, success, error_message, final_status, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(100),
      admin
        .from('mcp_sessions')
        .select('tool_name, error_message, created_at')
        .eq('success', false)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    const sessions = sessionsRes.data || [];
    const total = sessions.length;
    const successes = sessions.filter((s) => s.success).length;
    const failures = total - successes;

    const byTool: Record<string, { total: number; failed: number }> = {};
    for (const row of sessions) {
      const key = row.tool_name || 'unknown';
      if (!byTool[key]) byTool[key] = { total: 0, failed: 0 };
      byTool[key].total += 1;
      if (!row.success) byTool[key].failed += 1;
    }

    const topTools = Object.entries(byTool)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 15)
      .map(([tool, stats]) => ({ tool, ...stats }));

    return NextResponse.json({
      since,
      summary: {
        totalCalls: total,
        successes,
        failures,
        successRate: total ? Math.round((successes / total) * 100) : 100,
      },
      topTools,
      recentSessions: sessions.slice(0, 40),
      recentReceipts: receiptsRes.data || [],
      recentFailures: (failuresRes.data || []).map((f) => ({
        tool: f.tool_name,
        when: f.created_at,
        reason: f.error_message || 'Unknown error',
      })),
    });
  } catch (error) {
    return routeErrorResponse(error, 'MCP sessions could not be loaded', req);
  }
}
