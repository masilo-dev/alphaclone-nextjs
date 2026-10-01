import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type CleanupTestRunInput = {
  tenantId: string;
  testRunId?: string;
  leadId?: string;
  clientId?: string;
  contactId?: string;
  dealId?: string;
  quoteId?: string;
  contractId?: string;
  invoiceId?: string;
  projectId?: string;
  documentIds?: string[];
  docOsIds?: string[];
  dryRun?: boolean;
};

export type CleanupTestRunResult = {
  success: boolean;
  message: string;
  cleaned_records: {
    invoices: number;
    contracts: number;
    quotes: number;
    deals: number;
    projects: number;
    clients: number;
    contacts: number;
    leads: number;
    doc_os: number;
    agent_runs: number;
  };
};

export async function cleanupTestRun(
  input: CleanupTestRunInput,
  client?: SupabaseClient
): Promise<CleanupTestRunResult> {
  const supabase = client || createSupabaseAdminClient();
  const { tenantId, testRunId } = input;

  const counts = {
    invoices: 0,
    contracts: 0,
    quotes: 0,
    deals: 0,
    projects: 0,
    clients: 0,
    contacts: 0,
    leads: 0,
    doc_os: 0,
    agent_runs: 0,
  };

  // If specific IDs were passed or testRunId is provided:
  // Clean up in reverse dependency order:
  // 1. Doc OS
  if (input.docOsIds && input.docOsIds.length > 0) {
    const { data: v } = await supabase
      .from('doc_os_versions')
      .delete()
      .in('document_id', input.docOsIds)
      .select('id');
    const { data: d } = await supabase
      .from('doc_os_documents')
      .delete()
      .in('document_id', input.docOsIds)
      .select('id');
    counts.doc_os = (v?.length || 0) + (d?.length || 0);
  }

  // 2. Invoices
  if (input.invoiceId) {
    const { data: inv } = await supabase
      .from('business_invoices')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', input.invoiceId)
      .select('id');
    counts.invoices += inv?.length || 0;
  }

  // 3. Contracts
  if (input.contractId) {
    await supabase.from('contract_parties').delete().eq('contract_id', input.contractId);
    await supabase.from('contract_lifecycle_events').delete().eq('contract_id', input.contractId);
    await supabase.from('revenue_lifecycle_links').delete().eq('target_id', input.contractId);
    const { data: c } = await supabase
      .from('contracts')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', input.contractId)
      .select('id');
    counts.contracts += c?.length || 0;
  }

  // 4. Quotes
  if (input.quoteId) {
    await supabase.from('quote_items').delete().eq('quote_id', input.quoteId);
    const { data: q } = await supabase
      .from('quotes')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', input.quoteId)
      .select('id');
    counts.quotes += q?.length || 0;
  }

  // 5. Deals
  if (input.dealId) {
    const { data: dl } = await supabase
      .from('deals')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', input.dealId)
      .select('id');
    counts.deals += dl?.length || 0;
  }

  // 6. Projects
  if (input.projectId) {
    await supabase.from('tasks').delete().eq('tenant_id', tenantId).eq('related_to_project', input.projectId);
    await supabase.from('project_milestones').delete().eq('project_id', input.projectId);
    const { data: pr } = await supabase
      .from('business_projects')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', input.projectId)
      .select('id');
    counts.projects += pr?.length || 0;
  }

  // 7. Clients
  if (input.clientId) {
    const { data: cl } = await supabase
      .from('business_clients')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', input.clientId)
      .select('id');
    counts.clients += cl?.length || 0;
  }

  // 8. Contacts
  if (input.contactId) {
    const { data: ct } = await supabase
      .from('contacts')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', input.contactId)
      .select('id');
    counts.contacts += ct?.length || 0;
  }

  // 9. Leads
  if (input.leadId) {
    const { data: ld } = await supabase
      .from('leads')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', input.leadId)
      .select('id');
    counts.leads += ld?.length || 0;
  }

  // Cleanup by testRunId if supplied
  if (testRunId) {
    const { data: runs } = await supabase
      .from('agent_runs')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('metadata->>test_run_id', testRunId)
      .select('id');
    counts.agent_runs += runs?.length || 0;
  }

  return {
    success: true,
    message: `Test run cleanup completed successfully. Cleaned ${Object.values(counts).reduce((a, b) => a + b, 0)} records.`,
    cleaned_records: counts,
  };
}
