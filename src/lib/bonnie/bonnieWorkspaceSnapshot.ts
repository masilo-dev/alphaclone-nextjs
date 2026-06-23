import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type BonnieWorkspaceSnapshot = {
  tenant_id: string;
  counts: {
    leads: number;
    deals: number;
    open_tasks: number;
    unpaid_invoices: number;
    open_tickets: number;
  };
  autonomous: {
    enabled: boolean;
    auto_send_enabled: boolean;
    high_risk_approval_required: boolean;
  };
  recent_runner_actions: Array<{ action_key: string; status: string; created_at: string }>;
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

  const [leads, deals, open_tasks, unpaid_invoices, open_tickets, rulesRes, actionsRes] =
    await Promise.all([
      countTable('leads', (q) => q.select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)),
      countTable('deals', (q) => q.select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)),
      countTable('tasks', (q) =>
        q.select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).neq('status', 'completed')
      ),
      countTable('invoices', (q) =>
        q.select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['sent', 'overdue', 'pending'])
      ),
      countTable('support_tickets', (q) =>
        q.select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'open')
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

  return {
    tenant_id: tenantId,
    counts: {
      leads,
      deals,
      open_tasks,
      unpaid_invoices,
      open_tickets,
    },
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
  };
}
