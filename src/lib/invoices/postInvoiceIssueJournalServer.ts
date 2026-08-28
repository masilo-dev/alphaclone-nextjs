import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureDefaultChartOfAccounts } from '@/lib/accounting/chartOfAccountsGuard';

export async function postInvoiceIssueJournalServer(
  admin: SupabaseClient,
  input: { tenantId: string; invoiceId: string; actorUserId?: string | null }
): Promise<{ posted: boolean; entryId?: string }> {
  await ensureDefaultChartOfAccounts(input.tenantId);

  const { data, error } = await admin.rpc('post_business_invoice_issue_journal', {
    p_tenant_id: input.tenantId,
    p_invoice_id: input.invoiceId,
    p_actor_user_id: input.actorUserId ?? null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    posted: Boolean(row?.posted),
    entryId: row?.entry_id ? String(row.entry_id) : undefined,
  };
}
