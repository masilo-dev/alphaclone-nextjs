import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// 60-second in-memory cache
const cache: { data: any; ts: number } | null = (global as any).__rateLimitCache || null;
(global as any).__rateLimitCache = cache;

function getCached(): any | null {
  const entry = (global as any).__rateLimitCache;
  if (entry && Date.now() - entry.ts < 60_000) return entry.data;
  return null;
}
function setCache(data: any) {
  (global as any).__rateLimitCache = { data, ts: Date.now() };
}

export async function GET(req: NextRequest) {
  try {
    // Check Authorization
    const internalKey = req.headers.get('x-internal-api-key');
    if (internalKey !== process.env.INTERNAL_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cached = getCached();
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }

    const supabase = createSupabaseAdminClient();
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // last 1 hour

    const { data: sessions, error } = await supabase
      .from('mcp_sessions')
      .select('tool_name, success, duration_ms, created_at')
      .gte('created_at', since);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const total = (sessions || []).length;
    const successes = (sessions || []).filter((s: { success: boolean }) => s.success).length;
    const avgDuration = total > 0
      ? Math.round((sessions || []).reduce((s: number, r: { duration_ms: number | null }) => s + (r.duration_ms || 0), 0) / total)
      : 0;

    // Per-tool breakdown
    const toolMap: Record<string, { calls: number; success: number }> = {};
    for (const s of sessions || []) {
      if (!toolMap[s.tool_name]) toolMap[s.tool_name] = { calls: 0, success: 0 };
      toolMap[s.tool_name].calls++;
      if (s.success) toolMap[s.tool_name].success++;
    }

    const topTools = Object.entries(toolMap)
      .sort((a, b) => b[1].calls - a[1].calls)
      .slice(0, 10)
      .map(([tool, stats]) => ({
        tool,
        calls: stats.calls,
        success_rate: stats.calls > 0 ? Math.round((stats.success / stats.calls) * 100) : 0,
      }));

    const result = {
      period: 'last_1_hour',
      total_calls: total,
      success_rate_percent: total > 0 ? Math.round((successes / total) * 100) : 100,
      avg_duration_ms: avgDuration,
      top_tools: topTools,
      cached: false,
      generated_at: new Date().toISOString(),
    };

    setCache(result);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
