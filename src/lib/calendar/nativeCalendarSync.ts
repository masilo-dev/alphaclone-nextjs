import { supabase } from '@/lib/supabase';

type NativeEventType = 'task' | 'project' | 'milestone';

export type NativeCalendarSyncInput = {
  tenantId: string;
  userId: string;
  entityType: NativeEventType;
  entityId: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime?: string | null;
  clientId?: string | null;
  color?: string;
  isAllDay?: boolean;
  reminderMinutes?: number;
  metadata?: Record<string, unknown>;
  /** When true or status completed — remove synced calendar row */
  remove?: boolean;
};

function endFromStart(startTime: string, endTime?: string | null, isAllDay?: boolean): string {
  if (endTime) return endTime;
  if (isAllDay) return startTime;
  const d = new Date(startTime);
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}

export async function syncToNativeCalendar(input: NativeCalendarSyncInput): Promise<{ eventId?: string; removed?: boolean }> {
  const {
    tenantId,
    userId,
    entityType,
    entityId,
    title,
    description,
    startTime,
    endTime,
    clientId,
    color,
    isAllDay = false,
    reminderMinutes = 60,
    metadata = {},
    remove = false,
  } = input;

  const { data: existing } = await supabase
    .from('calendar_events')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('type', entityType)
    .eq('related_entity_id', entityId)
    .maybeSingle();

  if (remove || !startTime) {
    if (existing?.id) {
      await supabase.from('calendar_events').delete().eq('id', existing.id);
      return { removed: true };
    }
    return {};
  }

  const row = {
    tenant_id: tenantId,
    user_id: userId,
    title,
    description: description || null,
    start_time: startTime,
    end_time: endFromStart(startTime, endTime, isAllDay),
    type: entityType,
    color: color || (entityType === 'task' ? '#f59e0b' : entityType === 'milestone' ? '#ec4899' : '#8b5cf6'),
    is_all_day: isAllDay,
    reminder_minutes: reminderMinutes,
    client_id: clientId || null,
    related_entity_id: entityId,
    metadata: {
      ...metadata,
      sync_source: entityType,
      [`alphaclone_${entityType}_id`]: entityId,
    },
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { data } = await supabase
      .from('calendar_events')
      .update(row)
      .eq('id', existing.id)
      .select('id')
      .single();
    return { eventId: data?.id };
  }

  const { data } = await supabase
    .from('calendar_events')
    .insert(row)
    .select('id')
    .single();

  return { eventId: data?.id };
}

export async function syncTaskToNativeCalendar(
  tenantId: string,
  userId: string,
  task: {
    id: string;
    title: string;
    description?: string | null;
    due_date?: string | null;
    status?: string | null;
    priority?: string | null;
    client_id?: string | null;
  }
): Promise<void> {
  if (!task.due_date || task.status === 'completed') {
    await syncToNativeCalendar({
      tenantId,
      userId,
      entityType: 'task',
      entityId: task.id,
      title: `[Task] ${task.title}`,
      startTime: task.due_date || '',
      remove: true,
    });
    return;
  }

  await syncToNativeCalendar({
    tenantId,
    userId,
    entityType: 'task',
    entityId: task.id,
    title: `Task: ${task.title}`,
    description: task.description,
    startTime: task.due_date,
    endTime: task.due_date,
    clientId: task.client_id,
    isAllDay: false,
    reminderMinutes: 0,
    metadata: { priority: task.priority, status: task.status },
  });
}

export async function syncProjectToNativeCalendar(
  tenantId: string,
  userId: string,
  project: {
    id: string;
    name: string;
    description?: string | null;
    due_date?: string | null;
    status?: string | null;
    client_id?: string | null;
  }
): Promise<void> {
  const completed = String(project.status || '').toLowerCase() === 'completed';
  if (!project.due_date || completed) {
    await syncToNativeCalendar({
      tenantId,
      userId,
      entityType: 'project',
      entityId: project.id,
      title: project.name,
      startTime: project.due_date || '',
      remove: true,
    });
    return;
  }

  await syncToNativeCalendar({
    tenantId,
    userId,
    entityType: 'project',
    entityId: project.id,
    title: `Project Deadline: ${project.name}`,
    description: project.description,
    startTime: project.due_date,
    clientId: project.client_id,
    isAllDay: true,
    metadata: { projectId: project.id },
  });
}

export async function syncMilestoneToNativeCalendar(
  tenantId: string,
  userId: string,
  milestone: {
    id: string;
    name: string;
    description?: string | null;
    due_date?: string | null;
    status?: string | null;
    project_id: string;
    client_id?: string | null;
  }
): Promise<void> {
  if (!milestone.due_date || milestone.status === 'completed') {
    await syncToNativeCalendar({
      tenantId,
      userId,
      entityType: 'milestone',
      entityId: milestone.id,
      title: milestone.name,
      startTime: milestone.due_date || '',
      remove: true,
    });
    return;
  }

  await syncToNativeCalendar({
    tenantId,
    userId,
    entityType: 'milestone',
    entityId: milestone.id,
    title: `Milestone: ${milestone.name}`,
    description: milestone.description,
    startTime: milestone.due_date,
    clientId: milestone.client_id,
    isAllDay: true,
    metadata: { milestoneId: milestone.id, projectId: milestone.project_id },
  });
}

export async function getProjectCalendarContext(projectId: string): Promise<{
  tenantId: string;
  userId: string;
  clientId: string | null;
} | null> {
  const { data } = await supabase
    .from('projects')
    .select('tenant_id, owner_id, client_id')
    .eq('id', projectId)
    .maybeSingle();

  if (!data?.tenant_id || !data?.owner_id) return null;
  return {
    tenantId: data.tenant_id,
    userId: data.owner_id,
    clientId: data.client_id || null,
  };
}
