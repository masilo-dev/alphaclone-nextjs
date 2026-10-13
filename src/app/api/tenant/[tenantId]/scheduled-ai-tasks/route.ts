import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { taskAutomationService, getNextTaskRun } from '@/services/automation/taskAutomationService';

import { isValidCronSchedule } from '@/services/automation/taskAutomationService';
import { validateTimezone } from '@/lib/scheduling/scheduleTime';
const cronSchema = z.string().trim().refine(isValidCronSchedule, 'Invalid five-field cron expression');
const createSchema = z.object({ name: z.string().trim().min(1).max(200), prompt: z.string().trim().max(20000).optional(), schedule: cronSchema,
  timezone: z.string().min(1), action: z.object({ tool_name: z.string().min(1), args: z.record(z.string(), z.unknown()) }).optional(),
}).refine(value => Boolean(value.prompt?.trim() || value.action), 'Prompt or exact action is required');
const updateSchema = z.object({ id: z.string().uuid(), status: z.enum(['active', 'paused']) });

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { admin } = await requireTenantAccess(tenantId, req);
    const { data: tasks, error } = await admin.from('scheduled_ai_tasks').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    const ids = (tasks || []).map((task: any) => task.id);
    const { data: results, error: resultError } = ids.length ? await admin.from('scheduled_ai_task_results').select('*').eq('tenant_id', tenantId).in('task_id', ids).order('ran_at', { ascending: false }).limit(500) : { data: [], error: null };
    if (resultError) throw resultError;
    const latest = new Map<string, unknown>();
    for (const result of results || []) if (!latest.has(result.task_id)) latest.set(result.task_id, result);
    return NextResponse.json({ tasks: (tasks || []).map((task: any) => ({ ...task, latest_result: latest.get(task.id) || null })) });
  } catch (error) { return routeErrorResponse(error, 'Scheduled AI tasks could not be loaded', req); }
}

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid task or schedule', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const timezone = validateTimezone(parsed.data.timezone);
    const admin = createSupabaseAdminClient();
    const data = await taskAutomationService.createTask({ tenantId, userId: user.id, name: parsed.data.name, prompt: parsed.data.prompt || '', schedule: parsed.data.schedule, timezone, action: parsed.data.action });
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'scheduled_ai_task_created', payload: { taskId: data.id, actorUserId: user.id } });
    return NextResponse.json({ task: data }, { status: 201 });
  } catch (error) { return routeErrorResponse(error, 'Scheduled AI task could not be created', req); }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid task update' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const update: Record<string, unknown> = { status: parsed.data.status, updated_at: new Date().toISOString() };
    if (parsed.data.status === 'active') {
      const { data: current, error: readError } = await admin.from('scheduled_ai_tasks').select('schedule,timezone').eq('tenant_id', tenantId).eq('id', parsed.data.id).maybeSingle();
      if (readError) throw readError;
      if (!current) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      update.next_run_at = getNextTaskRun(current.schedule, new Date(), current.timezone || 'UTC').toISOString();
    }
    const { data, error } = await admin.from('scheduled_ai_tasks').update(update).eq('tenant_id', tenantId).eq('id', parsed.data.id).select('*').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'scheduled_ai_task_status_changed', payload: { taskId: data.id, status: parsed.data.status, actorUserId: user.id } });
    return NextResponse.json({ task: data });
  } catch (error) { return routeErrorResponse(error, 'Scheduled AI task could not be updated', req); }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const id = req.nextUrl.searchParams.get('id') || '';
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Valid task id required' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('scheduled_ai_tasks').delete().eq('tenant_id', tenantId).eq('id', id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'scheduled_ai_task_deleted', payload: { taskId: id, actorUserId: user.id } });
    return NextResponse.json({ success: true });
  } catch (error) { return routeErrorResponse(error, 'Scheduled AI task could not be deleted', req); }
}
