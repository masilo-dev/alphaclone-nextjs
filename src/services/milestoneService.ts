import { tenantService } from './tenancy/TenantService';

export interface Milestone {
  id: string; projectId: string; name: string; description?: string;
  status: 'pending' | 'in_progress' | 'completed'; dueDate?: string;
  completedAt?: string; orderIndex: number; createdAt: string; updatedAt: string;
}
export type MilestoneNotification = { sent: boolean; skipped?: string; status?: string };
function mapMilestone(row: Record<string, any>): Milestone {
  return { id: row.id, projectId: row.project_id, name: row.name, description: row.description,
    status: row.status, dueDate: row.due_date || undefined, completedAt: row.completed_at || undefined,
    orderIndex: row.order_index, createdAt: row.created_at, updatedAt: row.updated_at };
}
async function requestMilestones(method: string, body?: Record<string, unknown>, projectId?: string) {
  const tenantId = tenantService.getCurrentTenantId();
  if (!tenantId) throw new Error('Select a workspace first');
  const endpoint = `/api/tenant/${encodeURIComponent(tenantId)}/project-milestones${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`;
  const response = await fetch(endpoint, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Milestone request failed');
  return payload;
}
function writableFields(input: Partial<Milestone>) {
  const result: Record<string, unknown> = {};
  for (const key of ['name', 'description', 'status', 'orderIndex'] as const) if (input[key] !== undefined) result[key] = input[key];
  if ('dueDate' in input) result.dueDate = input.dueDate || null;
  return result;
}
export const milestoneService = {
  async getMilestones(projectId: string): Promise<{ milestones: Milestone[]; error: string | null }> {
    try { const result = await requestMilestones('GET', undefined, projectId); return { milestones: (result.milestones || []).map(mapMilestone), error: null }; }
    catch (error) { return { milestones: [], error: error instanceof Error ? error.message : String(error) }; }
  },
  async createMilestone(projectId: string, input: Partial<Milestone>): Promise<{ milestone: Milestone | null; error: string | null; notification?: MilestoneNotification }> {
    try { const result = await requestMilestones('POST', { projectId, ...writableFields(input) }); return { milestone: mapMilestone(result.milestone), error: null, notification: result.notification }; }
    catch (error) { return { milestone: null, error: error instanceof Error ? error.message : String(error) }; }
  },
  async updateMilestone(id: string, input: Partial<Milestone>): Promise<{ error: string | null; notification?: MilestoneNotification; progress?: number }> {
    try { const result = await requestMilestones('PATCH', { id, ...writableFields(input) }); return { error: null, notification: result.notification, progress: result.progress }; }
    catch (error) { return { error: error instanceof Error ? error.message : String(error) }; }
  },
  async deleteMilestone(id: string): Promise<{ error: string | null; notification?: MilestoneNotification }> {
    try { const result = await requestMilestones('DELETE', { id }); return { error: null, notification: result.notification }; }
    catch (error) { return { error: error instanceof Error ? error.message : String(error) }; }
  },
};
