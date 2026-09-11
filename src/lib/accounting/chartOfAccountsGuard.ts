import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type CoaGuardResult =
  | { setup_required: false; account_count: number }
  | { setup_required: true; message: string; account_count: number };

export async function checkChartOfAccountsConfigured(
  tenantId: string
): Promise<CoaGuardResult> {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from('chart_of_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);

  if (error) {
    return {
      setup_required: true,
      message: 'Chart of accounts not configured',
      account_count: 0,
    };
  }

  const accountCount = count || 0;
  if (accountCount === 0) {
    return {
      setup_required: true,
      message: 'Chart of accounts not configured',
      account_count: 0,
    };
  }

  return { setup_required: false, account_count: accountCount };
}

export async function ensureDefaultChartOfAccounts(tenantId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('create_default_chart_of_accounts', { p_tenant_id: tenantId });
}
