import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { loadClientProjects } from '@/lib/clientPortal/projects';

import type { WorkspaceActivityRow } from './workspaceActivityWriter';
export { appendWorkspaceActivity } from './workspaceActivityWriter';
export type { WorkspaceActivityActorType, WorkspaceActivityRow, WorkspaceActivityInsert } from './workspaceActivityWriter';

export interface ActivityQueryOptions {
  throwErrors?: boolean;
  limit?: number;
  since?: Date;
}

export async function getTenantRecentActivity(
  admin: SupabaseClient,
  tenantId: string,
  opts: ActivityQueryOptions = {}
): Promise<{ activity: WorkspaceActivityRow[] }> {
  const limit = opts.limit ?? 50;
  const since = opts.since;

  let query = admin
    .from('workspace_activity')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (since) {
    query = query.gte('created_at', since.toISOString());
  }

  const { data, error } = await query;
  if (error) {
    console.error('[workspaceActivityService] getTenantRecentActivity failed', error);
    return { activity: [] };
  }

  return { activity: (data || []) as WorkspaceActivityRow[] };
}

export async function getClientScopedActivity(
  admin: SupabaseClient,
  tenantId: string,
  clientId: string,
  opts: ActivityQueryOptions = {}
): Promise<{ activity: WorkspaceActivityRow[] }> {
  const limit = Math.max(1, Math.min(opts.limit ?? 50, 200));
  const since = opts.since;

  // PostgREST .or() cannot contain SQL subqueries. Resolve related entity IDs
  // first, then build a valid UUID filter across the activity table.
  const [projectsRes, invoicesRes, contractsRes] = await Promise.all([
    loadClientProjects(admin, tenantId, clientId).then(data=>({data,error:null})),
    admin.from('business_invoices').select('id').eq('tenant_id', tenantId).eq('client_id', clientId).in('status',['sent','viewed','partially_paid','overdue','paid','completed']).limit(500),
    admin.from('contracts').select('id').eq('tenant_id', tenantId).eq('client_id', clientId).in('status',['sent','viewed','negotiating','client_signed','fully_signed','signed','active','completed']).limit(500),
  ]);

  for (const result of [projectsRes, invoicesRes, contractsRes]) {
    if (result.error) {
      if (opts.throwErrors) throw result.error;
      console.error('[workspaceActivityService] related entity lookup failed', result.error);
    }
  }

  const filters = [`client_id.eq.${clientId}`];
  const appendInFilter = (column: string, rows: Array<{ id: string }> | null) => {
    const ids = (rows || []).map((row) => row.id).filter(Boolean);
    if (ids.length) filters.push(`${column}.in.(${ids.join(',')})`);
  };
  appendInFilter('project_id', projectsRes.data as Array<{ id: string }> | null);
  appendInFilter('invoice_id', invoicesRes.data as Array<{ id: string }> | null);
  appendInFilter('contract_id', contractsRes.data as Array<{ id: string }> | null);

  let query = admin
    .from('workspace_activity')
    .select('*')
    .eq('tenant_id', tenantId)
    .or(filters.join(','))
    .order('created_at', { ascending: false })
    .limit(limit);

  if (since) {
    query = query.gte('created_at', since.toISOString());
  }

  const { data, error } = await query;
  if (error) {
    if (opts.throwErrors) throw error;
    console.error('[workspaceActivityService] getClientScopedActivity failed', error);
    return { activity: [] };
  }

  const allowed = [projectsRes,invoicesRes,contractsRes].map(result=>new Set((result.data || []).map(row=>row.id)));
  const scoped = (data || []).filter(row=>(!row.project_id || allowed[0].has(row.project_id)) && (!row.invoice_id || allowed[1].has(row.invoice_id)) && (!row.contract_id || allowed[2].has(row.contract_id)));
  return { activity: scoped as WorkspaceActivityRow[] };
}
