import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { countOpenTasks } from '@/lib/crm/canonicalWorkspaceStats';

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
    revenue_paid: number;
    revenue_outstanding: number;
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
    build: (q: any) => any
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
    invoiceRowsRes,
    rulesRes,
    actionsRes,
  ] = await Promise.all([
    countTable('leads', (q) => q.select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)),
    countTable('deals', (q) => q.select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)),
    countTable('contacts', (q) => q.select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)),
    countTable('business_clients', (q) => q.select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)),
    countOpenTasks(admin, tenantId),
    countTable('business_invoices', (q) =>
      q.select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['sent', 'overdue', 'pending'])
    ),
    countTable('tickets', (q) =>
      q.select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
        .in('status', ['new', 'open', 'in_progress', 'waiting_on_business', 'escalated', 'reopened'])
    ),
    countTable('contracts', (q) =>
      q.select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    ),
    countTable('email_campaigns', (q) =>
      q.select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    ),
    admin
      .from('business_invoices')
      .select('total, status')
      .eq('tenant_id', tenantId)
      .limit(500),
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
  const invoiceRows = invoiceRowsRes.error ? [] : invoiceRowsRes.data || [];
  const revenue_paid = invoiceRows
    .filter((i: { status?: string }) => i.status === 'paid')
    .reduce((s: number, i: { total?: number }) => s + (Number(i.total) || 0), 0);
  const revenue_outstanding = invoiceRows
    .filter((i: { status?: string }) => i.status !== 'paid')
    .reduce((s: number, i: { total?: number }) => s + (Number(i.total) || 0), 0);

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
    revenue_paid,
    revenue_outstanding,
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
  if (counts.revenue_paid > 0) parts.push(`$${Math.round(counts.revenue_paid).toLocaleString()} revenue collected`);
  if (counts.revenue_outstanding > 0) parts.push(`$${Math.round(counts.revenue_outstanding).toLocaleString()} outstanding`);

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
