import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export type WorkspaceActivityActorType = 'system' | 'team_user' | 'client' | 'external' | 'ai';

export interface WorkspaceActivityRow {
  id: string;
  tenant_id: string;
  project_id: string | null;
  client_id: string | null;
  invoice_id: string | null;
  contract_id: string | null;
  actor_type: WorkspaceActivityActorType;
  actor_id: string | null;
  actor_display_name: string | null;
  event_type: string;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type WorkspaceActivityInsert = Omit<WorkspaceActivityRow, 'id' | 'created_at'>;

export interface ActivityQueryOptions {
  limit?: number;
  since?: Date;
}

function isActorType(value: string): value is WorkspaceActivityActorType {
  return ['system', 'team_user', 'client', 'external', 'ai'].includes(value);
}

export async function appendWorkspaceActivity(
  admin: SupabaseClient,
  row: WorkspaceActivityInsert
): Promise<{ success: boolean; error?: unknown }> {
  try {
    const actorType = isActorType(row.actor_type) ? row.actor_type : 'system';
    const { error } = await admin
      .from('workspace_activity')
      .insert({
        tenant_id: row.tenant_id,
        project_id: row.project_id ?? null,
        client_id: row.client_id ?? null,
        invoice_id: row.invoice_id ?? null,
        contract_id: row.contract_id ?? null,
        actor_type: actorType,
        actor_id: row.actor_id ?? null,
        actor_display_name: row.actor_display_name ?? null,
        event_type: String(row.event_type || 'unknown').slice(0, 256),
        summary: String(row.summary || ''),
        metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
      });
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('[workspaceActivityService] appendWorkspaceActivity failed', error);
    return { success: false, error };
  }
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
  const limit = opts.limit ?? 50;
  const since = opts.since;

  let query = admin
    .from('workspace_activity')
    .select('*')
    .eq('tenant_id', tenantId)
    .or(`client_id.eq.${clientId},project_id.in.(select id from projects where client_id.eq.${clientId} and tenant_id.eq.${tenantId}),invoice_id.in.(select id from business_invoices where client_id.eq.${clientId} and tenant_id.eq.${tenantId}),contract_id.in.(select id from contracts where client_id.eq.${clientId} and tenant_id.eq.${tenantId})`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (since) {
    query = query.gte('created_at', since.toISOString());
  }

  const { data, error } = await query;
  if (error) {
    console.error('[workspaceActivityService] getClientScopedActivity failed', error);
    return { activity: [] };
  }

  return { activity: (data || []) as WorkspaceActivityRow[] };
}
