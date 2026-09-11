import type { SupabaseClient } from '@supabase/supabase-js';
import {
  inspectContractLifecycle,
  inspectInvoiceLifecycle,
  inspectQuoteLifecycle,
  isOperationalRecord,
  type LifecycleIssue,
} from './lifecycleConsistency';

export type LifecycleConsistencyReport = {
  ok: boolean;
  issue_count: number;
  issues: LifecycleIssue[];
  query_failures: string[];
};

/** Tenant-scoped, read-only consistency report shared by dashboards and operations. */
export async function getLifecycleConsistencyReport(
  admin: SupabaseClient,
  tenantId: string,
): Promise<LifecycleConsistencyReport> {
  const [invoiceRows, contractRows, quoteRows] = await Promise.all([
    admin.from('business_invoices').select('id,status,paid_at,amount_paid,total,is_test_data').eq('tenant_id', tenantId).limit(5000),
    admin.from('contracts').select('id,status,lifecycle_status,signed_at,client_signed_at,admin_signed_at').eq('tenant_id', tenantId).limit(5000),
    admin.from('quotes').select('id,status,valid_until').eq('tenant_id', tenantId).limit(5000),
  ]);

  const queryFailures = [
    invoiceRows.error && `business_invoices: ${invoiceRows.error.message}`,
    contractRows.error && `contracts: ${contractRows.error.message}`,
    quoteRows.error && `quotes: ${quoteRows.error.message}`,
  ].filter((value): value is string => Boolean(value));

  const issues = [
    ...(invoiceRows.data || []).filter(isOperationalRecord).flatMap(inspectInvoiceLifecycle),
    ...(contractRows.data || []).flatMap(inspectContractLifecycle),
    ...(quoteRows.data || []).flatMap((row) => inspectQuoteLifecycle(row)),
  ];

  return {
    ok: issues.length === 0 && queryFailures.length === 0,
    issue_count: issues.length,
    issues: issues.slice(0, 100),
    query_failures: queryFailures,
  };
}
