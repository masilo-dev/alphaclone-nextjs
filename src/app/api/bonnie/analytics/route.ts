import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  try {
    const tenantId = String(request.nextUrl.searchParams.get('tenantId') || '');
    const days = Math.max(1, Math.min(90, Number(request.nextUrl.searchParams.get('days') || 30)));
    const { admin } = await requireTenantAccess(tenantId, request);
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    const [toolResult, runResult, approvalResult, attributionResult] = await Promise.all([
      admin.from('mcp_sessions').select('tool_name, tool_success, success, tool_latency_ms, duration_ms, error_message, metadata, created_at').eq('tenant_id', tenantId).gte('created_at', since).order('created_at', { ascending: false }).limit(5000),
      admin.from('agent_runs').select('id, status, progress_pct, created_at, completed_at').eq('tenant_id', tenantId).gte('created_at', since).limit(2000),
      admin.from('agent_approvals').select('id, status, created_at, decided_at').eq('tenant_id', tenantId).gte('created_at', since).limit(2000),
      admin.from('revenue_attribution').select('attributed_amount, currency_code, evidence, created_at').eq('tenant_id', tenantId).gte('created_at', since).limit(5000),
    ]);
    type ToolRow = { tool_name?: string | null; tool_success?: boolean | null; success?: boolean | null; tool_latency_ms?: number | null; duration_ms?: number | null; metadata?: Record<string, unknown> | null };
    type RunRow = { status: string };
    type ApprovalRow = { status: string };
    type AttributionRow = { attributed_amount?: number | string | null; currency_code?: string | null };
    const tools = (toolResult.data || []) as ToolRow[];
    const succeeded = tools.filter((row) => row.tool_success ?? row.success).length;
    const failed = tools.length - succeeded;
    const latencies = tools.map((row) => Number(row.tool_latency_ms ?? row.duration_ms ?? 0)).filter((value) => value >= 0);
    const averageLatencyMs = latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : 0;
    const sorted = [...latencies].sort((a,b) => a-b);
    const p95LatencyMs = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] : 0;
    const estimatedCost = tools.reduce((sum, row) => sum + Number((row.metadata as Record<string, unknown> | null)?.cost_usd || 0), 0);
    const toolMap = new Map<string, { calls: number; successes: number; latency: number; failures: number }>();
    for (const row of tools) { const name = row.tool_name || 'unknown'; const current = toolMap.get(name) || { calls: 0, successes: 0, latency: 0, failures: 0 }; current.calls += 1; current.latency += Number(row.tool_latency_ms ?? row.duration_ms ?? 0); if (row.tool_success ?? row.success) current.successes += 1; else current.failures += 1; toolMap.set(name, current); }
    const toolPerformance = [...toolMap.entries()].map(([tool, value]) => ({ tool, calls: value.calls, successRate: value.calls ? value.successes / value.calls : 0, failures: value.failures, averageLatencyMs: value.calls ? Math.round(value.latency / value.calls) : 0 })).sort((a,b) => b.calls-a.calls).slice(0,30);
    const runs = (runResult.data || []) as RunRow[];
    const completedRuns = runs.filter((row) => ['completed','succeeded','COMPLETED'].includes(row.status)).length;
    const approvals = (approvalResult.data || []) as ApprovalRow[];
    const pendingApprovals = approvals.filter((row) => row.status === 'pending').length;
    const decidedApprovals = approvals.filter((row) => row.status !== 'pending').length;
    const attributed = (attributionResult.data || []) as AttributionRow[];
    const revenueByCurrency = attributed.reduce((acc: Record<string, number>, row) => { acc[row.currency_code || 'USD'] = (acc[row.currency_code || 'USD'] || 0) + Number(row.attributed_amount || 0); return acc; }, {});
    return NextResponse.json({ success: true, periodDays: days, tools: { calls: tools.length, succeeded, failed, successRate: tools.length ? succeeded/tools.length : 0, averageLatencyMs, p95LatencyMs, estimatedCostUsd: estimatedCost, performance: toolPerformance }, runs: { total: runs.length, completed: completedRuns, successRate: runs.length ? completedRuns/runs.length : 0 }, approvals: { total: approvals.length, pending: pendingApprovals, decided: decidedApprovals }, revenueByCurrency });
  } catch (error) { return routeErrorResponse(error, 'Bonnie analytics could not be loaded', request); }
}
