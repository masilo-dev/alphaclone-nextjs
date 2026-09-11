import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Task statuses treated as closed — canonical across reporting tools.
 * Text-side list (see `isOpenTaskStatus`): tolerant of legacy/imported spellings.
 */
export const CLOSED_TASK_STATUSES = ['completed', 'cancelled', 'done', 'archived'] as const;

/**
 * `tasks.status` is the Postgres enum `task_status`
 * (todo, in_progress, completed, cancelled, ideas, review, blocked).
 * Comparing an enum column against a label it does not have ("done",
 * "archived") makes Postgres reject the whole query, so DB filters must only
 * use labels that exist. Getting this wrong silently reported 0 open tasks
 * to Bonnie while the dashboard showed hundreds.
 */
export const TASK_STATUS_ENUM_CLOSED = ['completed', 'cancelled'] as const;

/** Project statuses treated as active/in-flight (`business_projects.status`, varchar). */
export const ACTIVE_PROJECT_STATUSES = ['active', 'in_progress', 'planning', 'on_hold'] as const;

/**
 * Legacy `projects.status` is the enum `project_status`
 * (Active, Pending, Completed, Declined, backlog, todo, in_progress, review, done, cancelled).
 * Only these labels may be used in filters against that table.
 */
export const LEGACY_PROJECT_STATUS_ENUM_ACTIVE = [
  'Active',
  'Pending',
  'backlog',
  'todo',
  'in_progress',
  'review',
] as const;

function warnCountFailure(what: string, error: { message?: string } | null): void {
  console.warn(`[canonicalWorkspaceStats] ${what} count failed; reporting 0. ${error?.message ?? ''}`.trim());
}

export type CanonicalWorkspaceCounts = {
  open_tasks: number;
  active_projects: number;
  leads: number;
  deals: number;
  contacts: number;
  clients: number;
  unpaid_invoices: number;
};

/** PostgREST `in` filter list built only from real `task_status` enum labels. */
export function closedTaskFilter(): string {
  return `(${TASK_STATUS_ENUM_CLOSED.map((s) => `"${s}"`).join(',')})`;
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
  if (error) {
    warnCountFailure('open tasks', error);
    return 0;
  }
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
      .in('status', [...LEGACY_PROJECT_STATUS_ENUM_ACTIVE]),
  ]);

  if (bizRes.error) warnCountFailure('active business_projects', bizRes.error);
  if (legacyRes.error) warnCountFailure('active projects', legacyRes.error);
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
