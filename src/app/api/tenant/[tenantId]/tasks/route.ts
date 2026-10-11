import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { findIdempotentPayload, recordIdempotentPayload } from '@/lib/api/offlineIdempotency';
import { canTransitionTask } from '@/lib/projects/projectTaskDomain';

const taskStatus = z.enum(['ideas', 'todo', 'in_progress', 'review', 'completed', 'cancelled']);
const taskPriority = z.enum(['low', 'medium', 'high', 'urgent']);
const dateSchema = z.string().transform((val) => {
  if (!val || !val.trim()) return null;
  const trimmed = val.trim();
  if (trimmed.includes('T')) return trimmed.split('T')[0];
  return trimmed;
}).pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional();

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(10_000).optional(),
  due_date: dateSchema,
  priority: taskPriority.default('medium'),
  related_to_project: z.string().uuid().nullable().optional(),
  related_to_deal: z.string().uuid().nullable().optional(),
  related_to_contact: z.string().uuid().nullable().optional(),
  related_to_lead: z.string().uuid().nullable().optional(),
  idempotencyKey: z.string().uuid().optional(),
});
const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(10_000).nullable().optional(),
  due_date: dateSchema,
  priority: taskPriority.optional(),
  status: taskStatus.optional(),
});
const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  changes: updateTaskSchema.optional(),
  restore: z.boolean().optional(),
  idempotencyKey: z.string().uuid().optional(),
});

async function validateRelations(admin: ReturnType<typeof createSupabaseAdminClient>, tenantId: string, input: z.infer<typeof createTaskSchema>) {
  const relations = [
    ['projects', input.related_to_project],
    ['deals', input.related_to_deal],
    ['contacts', input.related_to_contact],
    ['leads', input.related_to_lead],
  ] as const;
  for (const [table, id] of relations) {
    if (!id) continue;
    const { data } = await admin.from(table).select('id').eq('tenant_id', tenantId).eq('id', id).maybeSingle();
    if (!data) throw new Error(`Related ${table.slice(0, -1)} does not belong to this workspace`);
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = createTaskSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid task details', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { idempotencyKey, ...taskInput } = parsed.data;

    if (idempotencyKey) {
      const existing = await findIdempotentPayload(admin, tenantId, idempotencyKey, 'offline_task_create');
      if (existing?.taskId) {
        const { data: existingTask } = await admin
          .from('tasks')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('id', String(existing.taskId))
          .maybeSingle();
        if (existingTask) return NextResponse.json({ task: existingTask });
      }
    }

    await validateRelations(admin, tenantId, taskInput);
    const { data: task, error } = await admin.from('tasks').insert({
      tenant_id: tenantId,
      created_by: user.id,
      status: 'todo',
      ...taskInput,
    }).select('*').single();
    if (error) throw error;

    if (idempotencyKey) {
      await recordIdempotentPayload(admin, tenantId, idempotencyKey, 'offline_task_create', { taskId: task.id }, user.id);
    }

    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'task_created', payload: { taskId: task.id, actorUserId: user.id } });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Task could not be created', req);
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = bulkSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success || (!parsed.data.restore && (!parsed.data.changes || Object.keys(parsed.data.changes).length === 0))) {
      return NextResponse.json({ error: 'Invalid task update' }, { status: 400 });
    }
    const admin = createSupabaseAdminClient();
    const { idempotencyKey } = parsed.data;

    if (idempotencyKey) {
      const existing = await findIdempotentPayload(admin, tenantId, idempotencyKey, 'offline_task_update');
      if (existing?.updated) {
        return NextResponse.json({ success: true, updated: Number(existing.updated) || parsed.data.ids.length });
      }
    }
    let currentTasks: Array<{ id: string; status: string; entered_column_at?: string; created_at?: string; updated_at?: string }> = [];
    if (!parsed.data.restore && parsed.data.changes?.status) {
      const nextStatus = parsed.data.changes.status;
      const { data: current, error: currentError } = await admin
        .from('tasks')
        .select('id, status, entered_column_at, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .in('id', parsed.data.ids)
        .is('deleted_at', null);
      if (currentError) throw currentError;
      if ((current || []).length !== parsed.data.ids.length) {
        return NextResponse.json({ error: 'One or more tasks were not found' }, { status: 404 });
      }
      currentTasks = current || [];
      const invalid = currentTasks.find((task) => !canTransitionTask(task.status, nextStatus));
      if (invalid) {
        return NextResponse.json({
          error: `Task status cannot move from ${invalid.status} to ${nextStatus}`,
        }, { status: 409 });
      }
    }
    const nowIso = new Date().toISOString();
    const changes = {
      ...(parsed.data.restore ? { deleted_at: null, archived: false, archived_at: null, archived_by: null } : parsed.data.changes),
      updated_at: nowIso,
      ...(!parsed.data.restore && parsed.data.changes?.status ? { entered_column_at: nowIso } : {}),
      ...(!parsed.data.restore && parsed.data.changes?.status === 'completed' ? { completed_at: nowIso } : {}),
    };
    let updateQuery = admin.from('tasks').update(changes).eq('tenant_id', tenantId).in('id', parsed.data.ids);
    if (parsed.data.restore) updateQuery = updateQuery.not('deleted_at', 'is', null);
    else updateQuery = updateQuery.is('deleted_at', null);
    const { data, error } = await updateQuery.select('id');
    if (error) throw error;
    if ((data || []).length !== parsed.data.ids.length) return NextResponse.json({ error: 'One or more tasks were not found' }, { status: 404 });

    // Insert append-only transition logs for status changes
    if (!parsed.data.restore && parsed.data.changes?.status && currentTasks.length > 0) {
      const nextStatus = parsed.data.changes.status;
      const logRows = currentTasks.map((t) => {
        const prevEnteredAt = t.entered_column_at || t.updated_at || t.created_at || nowIso;
        const durationMs = Math.max(0, new Date(nowIso).getTime() - new Date(prevEnteredAt).getTime());
        return {
          tenant_id: tenantId,
          board_type: 'workspace_tasks',
          card_id: t.id,
          from_state: t.status,
          to_state: nextStatus,
          actor_id: user.id,
          reason: 'Status updated via task management',
          duration_in_previous_state_ms: durationMs,
          is_override: false,
          metadata: { previous_entered_at: prevEnteredAt },
        };
      });
      const { error: logErr } = await (admin.from('board_transition_logs') as any).insert(logRows);
      if (logErr) {
        console.error('[tasks/route] Failed to log task transition:', logErr);
      }
    }

    if (idempotencyKey) {
      await recordIdempotentPayload(
        admin,
        tenantId,
        idempotencyKey,
        'offline_task_update',
        { updated: data?.length || 0, taskIds: parsed.data.ids },
        user.id,
      );
    }

    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'tasks_updated', payload: { taskIds: parsed.data.ids, actorUserId: user.id, changes: parsed.data.changes } });
    return NextResponse.json({ success: true, updated: data?.length || 0 });
  } catch (error) {
    return routeErrorResponse(error, 'Tasks could not be updated', req);
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = bulkSchema.pick({ ids: true }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid task selection' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const nowIso = new Date().toISOString();
    const { data: existingTasks } = await admin
      .from('tasks')
      .select('id, status')
      .eq('tenant_id', tenantId)
      .in('id', parsed.data.ids)
      .is('deleted_at', null);

    const { data, error } = await admin.from('tasks').update({
      deleted_at: nowIso,
      archived: true,
      archived_at: nowIso,
      archived_by: user.id,
      updated_at: nowIso,
    }).eq('tenant_id', tenantId).in('id', parsed.data.ids).is('deleted_at', null).select('id');
    if (error) throw error;
    if ((data || []).length !== parsed.data.ids.length) return NextResponse.json({ error: 'One or more tasks were not found' }, { status: 404 });

    // Append-only transition log for soft-archival
    if (existingTasks && existingTasks.length > 0) {
      const logRows = existingTasks.map((t) => ({
        tenant_id: tenantId,
        board_type: 'workspace_tasks',
        card_id: t.id,
        from_state: t.status,
        to_state: 'archived',
        actor_id: user.id,
        reason: 'Task archived',
        is_override: false,
        metadata: { archived_at: nowIso, previous_state: t.status },
      }));
      const { error: logErr } = await (admin.from('board_transition_logs') as any).insert(logRows);
      if (logErr) {
        console.error('[tasks/route] Failed to log task archival:', logErr);
      }
    }

    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'tasks_trashed', payload: { taskIds: parsed.data.ids, actorUserId: user.id } });
    return NextResponse.json({ success: true, trashed: data?.length || 0 });
  } catch (error) {
    return routeErrorResponse(error, 'Tasks could not be deleted', req);
  }
}
