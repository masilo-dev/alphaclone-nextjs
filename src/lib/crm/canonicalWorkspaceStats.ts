import type { SupabaseClient } from '@supabase/supabase-js';

/** Task statuses treated as closed — canonical across reporting tools. */
export const CLOSED_TASK_STATUSES = ['completed', 'cancelled', 'done', 'archived'] as const;

/** Project statuses treated as active/in-flight. */
export const ACTIVE_PROJECT_STATUSES = ['active', 'in_progress', 'planning', 'on_hold'] as const;

export type CanonicalWorkspaceCounts = {
  open_tasks: number;
  active_projects: number;
  leads: number;
  deals: number;
  contacts: number;
  clients: number;
  unpaid_invoices: number;
};

function closedTaskFilter(statusCol = 'status'): string {
  return `(${CLOSED_TASK_STATUSES.map((s) => `"${s}"`).join(',')})`;
}

export async function countOpenTasks(
  admin: SupabaseClient,
  tenantId: string,
): Promise<number> {
  const { count, error } = await admin
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .not('status', 'in', closedTaskFilter());
  if (error) return 0;
  return count ?? 0;
}

export async function countActiveProjects(
  admin: SupabaseClient,
  tenantId: string,
): Promise<number> {
  const [bizRes, legacyRes] = await Promise.all([
    admin
      .from('business_projects')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', [...ACTIVE_PROJECT_STATUSES]),
    admin
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', [...ACTIVE_PROJECT_STATUSES]),
  ]);

  const biz = bizRes.error ? 0 : bizRes.count ?? 0;
  const legacy = legacyRes.error ? 0 : legacyRes.count ?? 0;
  return Math.max(biz, legacy) === 0 ? biz + legacy : Math.max(biz, legacy);
}

export async function getCanonicalWorkspaceCounts(
  admin: SupabaseClient,
  tenantId: string,
): Promise<CanonicalWorkspaceCounts> {
  const [
    open_tasks,
    active_projects,
    leadsRes,
    dealsRes,
    contactsRes,
    clientsRes,
    invoicesRes,
  ] = await Promise.all([
    countOpenTasks(admin, tenantId),
    countActiveProjects(admin, tenantId),
    admin.from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    admin.from('deals').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    admin.from('contacts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    admin.from('business_clients').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    admin
      .from('business_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ['sent', 'overdue', 'pending', 'draft']),
  ]);

  return {
    open_tasks,
    active_projects,
    leads: leadsRes.count ?? 0,
    deals: dealsRes.count ?? 0,
    contacts: contactsRes.count ?? 0,
    clients: clientsRes.count ?? 0,
    unpaid_invoices: invoicesRes.count ?? 0,
  };
}

export function isOpenTaskStatus(status: unknown): boolean {
  const value = String(status || '').toLowerCase();
  return !CLOSED_TASK_STATUSES.includes(value as (typeof CLOSED_TASK_STATUSES)[number]);
}
