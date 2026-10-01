import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { executeTool } from '@/lib/mcp/tool-registry';

export type ExecuteClientLifecycleInput = {
  tenantId: string;
  userId?: string | null;
  prospectName: string;
  prospectEmail: string;
  amount: number;
  currency?: string;
  serviceTitle?: string;
  governingLaw?: string;
  isTestData?: boolean;
  testRunId?: string;
};

export type LifecycleStageResult = {
  stage: string;
  success: boolean;
  record_id?: string;
  data?: unknown;
  error?: string;
};

export type ExecuteClientLifecycleResult = {
  success: boolean;
  run_id: string;
  prospect_name: string;
  prospect_email: string;
  currency: string;
  amount: number;
  records: {
    lead_id?: string;
    client_id?: string;
    contact_id?: string;
    deal_id?: string;
    quote_id?: string;
    contract_id?: string;
    invoice_id?: string;
    project_id?: string;
    portal_token?: string;
    portal_url?: string;
  };
  stages: LifecycleStageResult[];
  error?: string;
};

function unpackResult(res: any): any {
  if (res.isError) {
    const errText = res.content?.[0]?.text || 'MCP tool error';
    throw new Error(errText);
  }
  const text = res.content?.[0]?.text;
  if (!text) return res;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && 'ok' in parsed && 'data' in parsed) {
      if (parsed.ok === false) {
        throw new Error(parsed.error?.message || 'Connector tool error');
      }
      return parsed.data;
    }
    return parsed;
  } catch (err: any) {
    if (err.message && !err.message.includes('JSON')) throw err;
    return text;
  }
}

export async function executeClientLifecycle(
  input: ExecuteClientLifecycleInput,
  client?: SupabaseClient
): Promise<ExecuteClientLifecycleResult> {
  const supabase = client || createSupabaseAdminClient();
  const tenantId = input.tenantId;
  const userId = input.userId || 'system-orchestrator';
  const currency = (input.currency || 'EUR').toUpperCase();
  const amount = Number(input.amount) || 2000;
  const serviceTitle = input.serviceTitle || 'Core Consulting Services';
  const governingLaw = input.governingLaw || 'Delaware';
  const testRunId = input.testRunId || randomUUID();
  const isTestData = Boolean(input.isTestData);

  // Initialize Workflow state in agent_runs
  const now = new Date().toISOString();
  const { data: run, error: runErr } = await supabase
    .from('agent_runs')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      title: `Client Lifecycle: ${input.prospectName}`,
      description: `Complete one-command client lifecycle execution for ${input.prospectName} (${input.prospectEmail})`,
      status: 'running',
      progress_pct: 0,
      execution_mode: 'semi_autonomous',
      started_at: now,
      last_progress_at: now,
      metadata: {
        is_test_data: isTestData,
        test_run_id: testRunId,
        workflow_state: {
          objective: `Client Lifecycle for ${input.prospectName}`,
          scope: ['lead', 'qualify', 'client', 'deal', 'quote', 'contract', 'invoice', 'project', 'portal'],
          canonical_customer: {
            name: input.prospectName,
            email: input.prospectEmail,
          },
          created_records: {},
          step_outcomes: {},
          approvals: [],
          provider_receipts: [],
        },
      },
    })
    .select('*')
    .single();

  if (runErr || !run) {
    throw new Error(`Failed to initialize workflow run: ${runErr?.message || 'unknown'}`);
  }

  const runId = run.id;
  const stages: LifecycleStageResult[] = [];
  const records: ExecuteClientLifecycleResult['records'] = {};

  const updateRunProgress = async (pct: number, nextAction: string) => {
    await supabase
      .from('agent_runs')
      .update({
        progress_pct: pct,
        last_progress_at: new Date().toISOString(),
        metadata: {
          is_test_data: isTestData,
          test_run_id: testRunId,
          workflow_state: {
            objective: `Client Lifecycle for ${input.prospectName}`,
            scope: ['lead', 'qualify', 'client', 'deal', 'quote', 'contract', 'invoice', 'project', 'portal'],
            canonical_customer: {
              name: input.prospectName,
              email: input.prospectEmail,
              client_id: records.client_id,
              contact_id: records.contact_id,
            },
            created_records: records,
            step_outcomes: Object.fromEntries(stages.map((s) => [s.stage, s.data])),
            next_action: nextAction,
          },
        },
      })
      .eq('id', runId)
      .eq('tenant_id', tenantId);
  };

  try {
    // 1. Stage: Create Lead
    const rawLeadRes = await executeTool(tenantId, userId, 'create_lead', {
      tenant_id: tenantId,
      business_name: input.prospectName,
      contact_name: input.prospectName,
      email: input.prospectEmail,
      status: 'new',
      source: 'outbound_campaign',
      notes: `One-command lifecycle prospect. Package requested: ${currency} ${amount}`,
      is_test_data: isTestData,
    });
    const leadData = unpackResult(rawLeadRes);
    records.lead_id = leadData.lead_id || leadData.id;
    stages.push({ stage: 'create_lead', success: true, record_id: records.lead_id, data: leadData });
    await updateRunProgress(15, 'convert_client');

    // 2. Stage: Create Client & Convert Lead
    const rawClientRes = await executeTool(tenantId, userId, 'create_client', {
      tenant_id: tenantId,
      name: input.prospectName,
      email: input.prospectEmail,
      lead_id: records.lead_id,
      is_test_data: isTestData,
      value: amount,
      custom_fields: { currency, is_test_data: isTestData, test_run_id: testRunId },
    });
    const clientData = unpackResult(rawClientRes);
    records.client_id = clientData.id;
    records.contact_id = clientData.crm_contact_id;
    stages.push({ stage: 'convert_client', success: true, record_id: records.client_id, data: clientData });
    await updateRunProgress(30, 'create_deal');

    // 3. Stage: Create Deal
    const rawDealRes = await executeTool(tenantId, userId, 'create_deal', {
      tenant_id: tenantId,
      title: `${input.prospectName} - ${serviceTitle}`,
      client_id: records.client_id,
      value: amount,
      currency,
      stage: 'proposal',
      is_test_data: isTestData,
    });
    const dealData = unpackResult(rawDealRes);
    records.deal_id = dealData.id;
    stages.push({ stage: 'create_deal', success: true, record_id: records.deal_id, data: dealData });
    await updateRunProgress(45, 'create_quote');

    // 4. Stage: Create Quote
    const rawQuoteRes = await executeTool(tenantId, userId, 'create_quote', {
      tenant_id: tenantId,
      client_id: records.client_id,
      deal_id: records.deal_id,
      title: `Quote for ${input.prospectName}`,
      total: amount,
      currency,
      line_items: [
        { name: serviceTitle, quantity: 1, unit_price: amount, line_total: amount }
      ],
      is_test_data: isTestData,
    });
    const quoteData = unpackResult(rawQuoteRes);
    records.quote_id = quoteData.id;
    stages.push({ stage: 'create_quote', success: true, record_id: records.quote_id, data: quoteData });
    await updateRunProgress(60, 'convert_quote_to_contract');

    // 5. Stage: Convert Quote to Contract
    const rawContractRes = await executeTool(tenantId, userId, 'convert_quote_to_contract', {
      tenant_id: tenantId,
      quote_id: records.quote_id,
      title: `Service Agreement - ${input.prospectName}`,
      terms: `Governing Law: ${governingLaw}. Payment due upon invoice generation.`,
    });
    const contractData = unpackResult(rawContractRes);
    records.contract_id = contractData.contract_id;
    stages.push({ stage: 'convert_contract', success: true, record_id: records.contract_id, data: contractData });
    await updateRunProgress(75, 'create_invoice');

    // 6. Stage: Create Invoice
    const rawInvoiceRes = await executeTool(tenantId, userId, 'create_invoice', {
      tenant_id: tenantId,
      client_id: records.client_id,
      amount,
      currency,
      quote_id: records.quote_id,
      contract_id: records.contract_id,
      opportunity_id: records.deal_id,
      payment_reference: isTestData ? 'TEST-NOT-PAYABLE-QA' : undefined,
      is_test_data: isTestData,
      line_items: [
        { name: serviceTitle, quantity: 1, unit_price: amount, line_total: amount }
      ],
    });
    const invoiceData = unpackResult(rawInvoiceRes);
    records.invoice_id = invoiceData.id;
    stages.push({ stage: 'create_invoice', success: true, record_id: records.invoice_id, data: invoiceData });
    await updateRunProgress(85, 'enable_client_portal');

    // 7. Stage: Client Portal Access
    const rawPortalRes = await executeTool(tenantId, userId, 'enable_client_portal_access', {
      tenant_id: tenantId,
      client_id: records.client_id,
    });
    const portalData = unpackResult(rawPortalRes);
    records.portal_token = portalData.portal_token;
    records.portal_url = portalData.portal_url;
    stages.push({ stage: 'client_portal', success: true, record_id: records.portal_token, data: portalData });

    // Mark workflow run completed (100%)
    await supabase
      .from('agent_runs')
      .update({
        status: 'completed',
        progress_pct: 100,
        completed_at: new Date().toISOString(),
        last_progress_at: new Date().toISOString(),
      })
      .eq('id', runId)
      .eq('tenant_id', tenantId);

    return {
      success: true,
      run_id: runId,
      prospect_name: input.prospectName,
      prospect_email: input.prospectEmail,
      currency,
      amount,
      records,
      stages,
    };
  } catch (err: any) {
    const errorMsg = err.message || 'Unknown error occurred during lifecycle orchestration';
    stages.push({ stage: 'error', success: false, error: errorMsg });

    await supabase
      .from('agent_runs')
      .update({
        status: 'failed',
        failure_reason: errorMsg,
        updated_at: new Date().toISOString(),
      })
      .eq('id', runId)
      .eq('tenant_id', tenantId);

    return {
      success: false,
      run_id: runId,
      prospect_name: input.prospectName,
      prospect_email: input.prospectEmail,
      currency,
      amount,
      records,
      stages,
      error: errorMsg,
    };
  }
}
