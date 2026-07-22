import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { taskAutomationService } from '@/services/automation/taskAutomationService';

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string; taskId: string }> }) {
  try {
    const { tenantId, taskId } = await context.params;
    const { admin } = await requireTenantAccess(tenantId, req);
    const { data: task, error } = await admin.from('scheduled_ai_tasks').select('*').eq('tenant_id', tenantId).eq('id', taskId).maybeSingle();
    if (error) throw error;
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    const result = await taskAutomationService.executeTask(task);
    if (!result.success) return NextResponse.json({ error: result.error instanceof Error ? result.error.message : 'Task execution failed' }, { status: 502 });
    return NextResponse.json({ success: true, output: result.output });
  } catch (error) { return routeErrorResponse(error, 'Scheduled AI task could not be run', req); }
}
