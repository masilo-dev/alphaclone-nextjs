import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getLatestCheckpoint } from '@/lib/bonnie/runtime/checkpointService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tenantId = String(request.nextUrl.searchParams.get('tenantId') || '').trim();
    const runId = String(request.nextUrl.searchParams.get('runId') || '').trim();
    const taskId = String(request.nextUrl.searchParams.get('taskId') || '').trim();
    if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    await requireTenantAccess(tenantId);

    const admin = createSupabaseAdminClient();

    if (taskId) {
      const { data: task } = await admin
        .from('agent_tasks')
        .select('*')
        .eq('id', taskId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

      const [{ data: attempts }, checkpoint, { data: tools }] = await Promise.all([
        admin
          .from('agent_task_attempts')
          .select('*')
          .eq('task_id', taskId)
          .order('attempt_number', { ascending: true }),
        getLatestCheckpoint(taskId, tenantId),
        admin
          .from('agent_tool_executions')
          .select('id, tool_name, status, provider_reference, started_at, completed_at, error_message')
          .eq('task_id', taskId)
          .order('started_at', { ascending: true }),
      ]);

      return NextResponse.json({
        success: true,
        task,
        attempts: attempts || [],
        checkpoint,
        tools: tools || [],
      });
    }

    if (!runId) return NextResponse.json({ error: 'runId or taskId required' }, { status: 400 });
    const { data: tasks } = await admin
      .from('agent_tasks')
      .select('id, title, status, assigned_agent_id, risk_level, attempt_count, updated_at, failure_reason')
      .eq('run_id', runId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    return NextResponse.json({ success: true, tasks: tasks || [] });
  } catch (err: unknown) {
    return routeErrorResponse(err);
  }
}
