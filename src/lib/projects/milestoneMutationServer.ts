import type { SupabaseClient } from '@supabase/supabase-js';
import { computeProjectProgressPercent } from './projectEnums';
import { notifyProjectClientMilestoneUpdate } from './projectClientNotification';
import { syncMilestoneToNativeCalendar } from '@/lib/calendar/nativeCalendarSync';

export function milestoneWriteFields(input: Record<string, any>, previous?: Record<string, any>) {
  const fields: Record<string, unknown> = {};
  for (const key of ['name', 'description', 'status']) if (input[key] !== undefined) fields[key] = input[key];
  if ('dueDate' in input) fields.due_date = input.dueDate || null;
  if ('orderIndex' in input) fields.order_index = input.orderIndex;
  if (input.status && input.status !== previous?.status) fields.completed_at = input.status === 'completed' ? new Date().toISOString() : null;
  return fields;
}
export async function mutateProjectMilestone(params: {
  admin: SupabaseClient; tenantId: string; userId: string;
  action: 'created' | 'updated' | 'deleted'; input: Record<string, any>;
}) {
  const { admin, tenantId, userId, action, input } = params;
  let before: any;
  if (action !== 'created') {
    const read = await admin.from('project_milestones').select('*, project:projects!inner(id,tenant_id)').eq('id', input.id).eq('project.tenant_id', tenantId).or(`tenant_id.eq.${tenantId},tenant_id.is.null`).is('deleted_at', null).maybeSingle();
    if (read.error) throw read.error;
    if (!read.data) throw Object.assign(new Error('Milestone not found in this workspace'), { status: 404 });
    before = read.data;
  }
  const projectId = before?.project_id || input.projectId;
  const readProject = await admin.from('projects').select('id,name,client_id,status,current_stage,progress').eq('id', projectId).eq('tenant_id', tenantId).maybeSingle();
  if (readProject.error) throw readProject.error;
  if (!readProject.data) throw Object.assign(new Error('Project not found in this workspace'), { status: 404 });
  const project = readProject.data;
  const fields = milestoneWriteFields(input, before);
  if (action === 'updated' && Object.entries(fields).every(([key, value]) => (before[key] ?? null) === (value ?? null))) return { milestone: before, progress: project.progress, notification: { sent: false, skipped: 'unchanged' } };
  let milestone: any;
  if (action === 'created') {
    const last = await admin.from('project_milestones').select('order_index').eq('project_id', projectId).order('order_index', { ascending: false }).limit(1).maybeSingle();
    if (last.error) throw last.error;
    const saved = await admin.from('project_milestones').insert({ ...fields, project_id: projectId, tenant_id: tenantId, created_by: userId, owner_user_id: userId, status: input.status || 'pending', order_index: input.orderIndex ?? ((last.data?.order_index ?? -1) + 1) }).select('*').single();
    if (saved.error) throw saved.error;
    milestone = saved.data;
  } else {
    let write = admin.from('project_milestones').update({ ...fields, tenant_id: tenantId, updated_at: new Date().toISOString(), ...(action === 'deleted' ? { deleted_at: new Date().toISOString() } : {}) }).eq('id', input.id).eq('project_id', projectId).or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
    write = before.updated_at ? write.eq('updated_at', before.updated_at) : write.is('updated_at', null);
    const saved = await write.select('*').single();
    if (saved.error) throw saved.error;
    milestone = saved.data;
  }
  let progress = Number(project.progress || 0);
  const warnings: string[] = [];
  try {
    const [milestones, tasks] = await Promise.all([
      admin.from('project_milestones').select('status').eq('project_id', projectId).or(`tenant_id.eq.${tenantId},tenant_id.is.null`).is('deleted_at', null),
      admin.from('tasks').select('status').eq('tenant_id', tenantId).or(`related_to_project.eq.${projectId},project_id.eq.${projectId}`).is('deleted_at', null),
    ]);
    if (milestones.error) throw milestones.error;
    if (tasks.error) throw tasks.error;
    progress = computeProjectProgressPercent({ status: project.status, current_stage: project.current_stage, milestones: milestones.data, tasks: tasks.data });
    const updated = await admin.from('projects').update({ progress, updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', projectId);
    if (updated.error) throw updated.error;
  } catch (error) { progress = Number(project.progress || 0); warnings.push(`Milestone saved; progress recalculation failed: ${error instanceof Error ? error.message : String(error)}`); }
  try {
    await syncMilestoneToNativeCalendar(tenantId, userId, { ...milestone, due_date: action === 'deleted' ? null : milestone.due_date, project_id: projectId, client_id: project.client_id }, admin);
  } catch (error) { warnings.push('Milestone saved; calendar sync is unavailable'); }
  const activity = await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'project_updated', payload: { projectId, milestoneId: milestone.id, actorUserId: userId, action, previousProgress: Number(project.progress || 0), currentProgress: progress, trigger: 'milestone_update' } });
  if (activity.error) warnings.push('Milestone saved; activity recording is unavailable');
  const notification = await notifyProjectClientMilestoneUpdate({ admin, tenantId, projectId, milestone, action, progress }).catch(error => ({ sent: false, skipped: error instanceof Error ? error.message : String(error) }));
  return { milestone, progress, notification, warnings };
}
