import 'server-only';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type ReconciliationFindingType =
  | 'paid_invoice_missing_journal'
  | 'amount_mismatch_invoice_vs_journal'
  | 'orphaned_stripe_payment';

export interface ReconciliationFinding {
  tenantId: string;
  type: ReconciliationFindingType;
  entityId: string;
  entityType: 'business_invoice' | 'stripe_charge';
  details: string;
  expectedAmount?: number;
  recordedAmount?: number;
  detectedAt: string;
}

export interface ReconciliationReport {
  tenantId: string;
  runAt: string;
  invoicesScanned: number;
  journalsScanned: number;
  discrepanciesFound: number;
  findings: ReconciliationFinding[];
}

/**
 * Reconciles invoices, journal entries, and payment records for a tenant.
 * Read-only analysis: flags discrepancies without altering financial balances.
 */
export async function runTenantFinanceReconciliation(
  tenantId: string,
  options?: { limit?: number }
): Promise<ReconciliationReport> {
  const admin = createSupabaseAdminClient();
  const limit = options?.limit || 100;
  const findings: ReconciliationFinding[] = [];

  // 1. Fetch paid invoices
  const { data: invoices, error: invError } = await admin
    .from('business_invoices')
    .select('id, invoice_number, total, status, lifecycle_status, paid_at, currency')
    .eq('tenant_id', tenantId)
    .in('status', ['paid', 'completed'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (invError) throw invError;

  // 2. Fetch journal entries linked to invoices
  const invoiceIds = (invoices || []).map((inv) => inv.id);
  let journalEntries: Array<{ id: string; source_id: string; total_debits: number; total_credits: number }> = [];

  if (invoiceIds.length > 0) {
    const { data: journals, error: journalError } = await admin
      .from('journal_entries')
      .select('id, source_id, total_debits, total_credits')
      .eq('tenant_id', tenantId)
      .in('source_id', invoiceIds);

    if (!journalError && journals) {
      journalEntries = journals as any[];
    }
  }

  const journalsByInvoice = new Map<string, typeof journalEntries[0]>();
  for (const j of journalEntries) {
    if (j.source_id) journalsByInvoice.set(j.source_id, j);
  }

  // 3. Compare invoice records to double-entry ledger postings
  const now = new Date().toISOString();
  for (const inv of invoices || []) {
    const journal = journalsByInvoice.get(inv.id);
    if (!journal) {
      findings.push({
        tenantId,
        type: 'paid_invoice_missing_journal',
        entityId: inv.id,
        entityType: 'business_invoice',
        details: `Invoice #${inv.invoice_number || inv.id} is marked paid but has no corresponding journal entry in the general ledger.`,
        expectedAmount: Number(inv.total || 0),
        detectedAt: now,
      });
    } else {
      const invTotal = Math.round(Number(inv.total || 0) * 100);
      const journalTotal = Math.round(Number(journal.total_debits || journal.total_credits || 0) * 100);
      if (Math.abs(invTotal - journalTotal) > 1) {
        findings.push({
          tenantId,
          type: 'amount_mismatch_invoice_vs_journal',
          entityId: inv.id,
          entityType: 'business_invoice',
          details: `Invoice #${inv.invoice_number} total (${inv.total}) does not match posted journal debit/credit (${journal.total_debits}).`,
          expectedAmount: Number(inv.total || 0),
          recordedAmount: Number(journal.total_debits || 0),
          detectedAt: now,
        });
      }
    }
  }

  return {
    tenantId,
    runAt: now,
    invoicesScanned: (invoices || []).length,
    journalsScanned: journalEntries.length,
    discrepanciesFound: findings.length,
    findings,
  };
}
