import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type BonnieWorkspaceSnapshot = {
  tenant_id: string;
  counts: {
    leads: number;
    deals: number;
    contacts: number;
    clients: number;
    open_tasks: number;
    unpaid_invoices: number;
    open_tickets: number;
    contracts: number;
    campaigns: number;
  };
  autonomous: {
    enabled: boolean;
    auto_send_enabled: boolean;
    high_risk_approval_required: boolean;
  };
  recent_runner_actions: Array<{ action_key: string; status: string; created_at: string }>;
  module_summary: string;
};

export async function getBonnieWorkspaceSnapshot(tenantId: string): Promise<BonnieWorkspaceSnapshot> {
  const admin = createSupabaseAdminClient();

  async function countTable(
    table: string,
    build: (q: ReturnType<typeof admin.from>) => ReturnType<ReturnType<typeof admin.from>['select']>
  ): Promise<number> {
    try {
      const { count, error } = await build(admin.from(table));
      if (error) return 0;
      return count ?? 0;
    } catch {
      return 0;
    }
  }

  const [
    leads,
    deals,
    contacts,
    clients,
    open_tasks,
    unpaid_invoices,
    open_tickets,
    contracts,
    campaigns,
    rulesRes,
    actionsRes,
  ] = await Promise.all([
    countTable('leads', (q) => q.select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)),
    countTable('deals', (q) => q.select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)),
    countTable('contacts', (q) => q.select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)),
    countTable('business_clients', (q) => q.select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)),
    countTable('tasks', (q) =>
      q.select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).neq('status', 'completed')
    ),
    countTable('invoices', (q) =>
      q.select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['sent', 'overdue', 'pending'])
    ),
    countTable('support_tickets', (q) =>
      q.select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'open')
    ),
    countTable('contracts', (q) =>
      q.select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    ),
    countTable('email_campaigns', (q) =>
      q.select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    ),
    admin
      .from('autonomous_runner_rules')
      .select('enabled, auto_send_enabled, high_risk_approval_required')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    admin
      .from('autonomous_runner_actions')
      .select('action_key, status, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const rules = rulesRes.error ? null : rulesRes.data;

  const counts = {
    leads,
    deals,
    contacts,
    clients,
    open_tasks,
    unpaid_invoices,
    open_tickets,
    contracts,
    campaigns: typeof campaigns === 'number' ? campaigns : 0,
  };

  const parts: string[] = [];
  if (counts.leads) parts.push(`${counts.leads} leads`);
  if (counts.deals) parts.push(`${counts.deals} deals`);
  if (counts.contacts) parts.push(`${counts.contacts} contacts`);
  if (counts.clients) parts.push(`${counts.clients} clients`);
  if (counts.open_tasks) parts.push(`${counts.open_tasks} open tasks`);
  if (counts.unpaid_invoices) parts.push(`${counts.unpaid_invoices} unpaid invoices`);
  if (counts.open_tickets) parts.push(`${counts.open_tickets} open tickets`);
  if (counts.contracts) parts.push(`${counts.contracts} contracts`);
  if (counts.campaigns) parts.push(`${counts.campaigns} campaigns`);

  return {
    tenant_id: tenantId,
    counts,
    autonomous: {
      enabled: rules?.enabled ?? true,
      auto_send_enabled: rules?.auto_send_enabled ?? false,
      high_risk_approval_required: rules?.high_risk_approval_required ?? true,
    },
    recent_runner_actions: (actionsRes.error ? [] : actionsRes.data || []).map(
      (a: { action_key: string; status: string; created_at: string }) => ({
        action_key: a.action_key,
        status: a.status,
        created_at: a.created_at,
      })
    ),
    module_summary: parts.length ? parts.join(', ') : 'Workspace loaded — use tools for live detail per module.',
  };
}
