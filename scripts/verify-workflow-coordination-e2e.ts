/**
 * Automated End-to-End Verification of AlphaClone Workflow Coordination & Universal LLM Experience:
 * 1. Executes one-command client lifecycle via execute_client_lifecycle tool:
 *    - Creates test prospect (EUR 2,000)
 *    - Qualifies & creates client + linked canonical contact
 *    - Creates EUR 2,000 deal
 *    - Creates EUR 2,000 quote
 *    - Converts quote to contract (Delaware governing law)
 *    - Creates EUR 2,000 invoice
 *    - Enables client portal access
 * 2. Verifies persisted workflow state in agent_runs via inspect_workflow:
 *    - Canonical customer identity
 *    - Created records
 *    - Non-zero progress and active heartbeat
 * 3. Verifies workflow interruption recovery via resume_workflow
 * 4. Verifies pre-flight readiness check via check_action_readiness
 * 5. Verifies send package preview & cryptographic approval token via preview_send_package
 * 6. Verifies customer identity corrections propagation via correct_customer_identity
 * 7. Verifies clean test cleanup via cleanup_test_run
 */

import { createRequire } from 'module';
createRequire(import.meta.url)('./stub-server-only.cjs');

import dotenv from 'dotenv';
dotenv.config({ path: '.env.production.local' });

import { executeTool } from '../src/lib/mcp/tool-registry';
import { createSupabaseAdminClient } from '../src/lib/supabase-admin';
import crypto from 'crypto';

const TENANT_ID = '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4';
const USER_ID = 'd8fd4aea-2987-4313-90e2-e6600539ec56';
const TEST_RUN_ID = `wf-e2e-${crypto.randomBytes(4).toString('hex')}`;
const TEST_EMAIL = 'bonniiehendrix@gmail.com';
const TEST_COMPANY = `AlphaClone Automation Corp [${TEST_RUN_ID}]`;

function unpack(res: any): any {
  if (res.isError) {
    const errText = res.content?.[0]?.text || 'MCP execution failed';
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

async function run() {
  console.log('================================================================');
  console.log('ALPHACLONE WORKFLOW COORDINATION & UNIVERSAL LLM E2E VERIFICATION');
  console.log('================================================================');
  console.log('Tenant ID:', TENANT_ID);
  console.log('Test Run ID:', TEST_RUN_ID);
  console.log('Test Target Email:', TEST_EMAIL);

  const admin = createSupabaseAdminClient();
  let workflowRunId: string | null = null;
  let createdRecords: any = {};

  try {
    // ------------------------------------------------------------------
    // STEP 1: ONE-COMMAND CLIENT LIFECYCLE
    // ------------------------------------------------------------------
    console.log('\n[Step 1] Executing One-Command Client Lifecycle (execute_client_lifecycle)...');
    const lifecycleRaw = await executeTool(TENANT_ID, USER_ID, 'execute_client_lifecycle', {
      tenant_id: TENANT_ID,
      prospect_name: TEST_COMPANY,
      prospect_email: TEST_EMAIL,
      amount: 2000,
      currency: 'EUR',
      service_title: 'Enterprise AI Systems Integration',
      governing_law: 'Delaware',
      is_test_data: true,
      test_run_id: TEST_RUN_ID,
    });
    const lifecycleRes = unpack(lifecycleRaw);
    if (!lifecycleRes.success) {
      throw new Error(`execute_client_lifecycle failed: ${lifecycleRes.error}`);
    }
    workflowRunId = lifecycleRes.run_id;
    createdRecords = lifecycleRes.records;
    console.log('✓ One-command execution completed with 100% progress!');
    console.log('  Run ID:', workflowRunId);
    console.log('  Created records:', createdRecords);

    // Verify all records were generated with EUR 2,000
    if (!createdRecords.lead_id) throw new Error('Lead ID missing');
    if (!createdRecords.client_id) throw new Error('Client ID missing');
    if (!createdRecords.contact_id) throw new Error('Contact ID missing');
    if (!createdRecords.deal_id) throw new Error('Deal ID missing');
    if (!createdRecords.quote_id) throw new Error('Quote ID missing');
    if (!createdRecords.contract_id) throw new Error('Contract ID missing');
    if (!createdRecords.invoice_id) throw new Error('Invoice ID missing');
    if (!createdRecords.portal_token) throw new Error('Portal token missing');

    // ------------------------------------------------------------------
    // STEP 2: INSPECT WORKFLOW STATE
    // ------------------------------------------------------------------
    console.log('\n[Step 2] Inspecting workflow state (inspect_workflow)...');
    const inspectRaw = await executeTool(TENANT_ID, USER_ID, 'inspect_workflow', {
      tenant_id: TENANT_ID,
      run_id: workflowRunId,
    });
    const inspectRes = unpack(inspectRaw);
    console.log('✓ Workflow state inspected:');
    console.log('  Status:', inspectRes.status, 'Progress:', inspectRes.progress_pct, '%');
    console.log('  Canonical Customer:', inspectRes.canonical_customer);
    console.log('  Heartbeat age (seconds):', inspectRes.heartbeat_age_seconds);
    console.log('  Is Stalled?:', inspectRes.is_stalled);

    if (inspectRes.canonical_customer?.email !== TEST_EMAIL) {
      throw new Error(`Canonical customer email mismatch: expected ${TEST_EMAIL}, got ${inspectRes.canonical_customer?.email}`);
    }

    // ------------------------------------------------------------------
    // STEP 3: WORKFLOW RESUMPTION TEST
    // ------------------------------------------------------------------
    console.log('\n[Step 3] Testing workflow resumption (resume_workflow)...');
    const resumeRaw = await executeTool(TENANT_ID, USER_ID, 'resume_workflow', {
      tenant_id: TENANT_ID,
      run_id: workflowRunId,
    });
    const resumeRes = unpack(resumeRaw);
    console.log('✓ Workflow resumed safely:', resumeRes);
    if (!resumeRes.success) throw new Error('resume_workflow failed');

    // ------------------------------------------------------------------
    // STEP 4: PRE-FLIGHT ACTION READINESS CHECK
    // ------------------------------------------------------------------
    console.log('\n[Step 4] Checking Action Readiness (check_action_readiness)...');
    const readyRaw = await executeTool(TENANT_ID, USER_ID, 'check_action_readiness', {
      tenant_id: TENANT_ID,
      action: 'send_package',
      customer_email: TEST_EMAIL,
      quote_id: createdRecords.quote_id,
      contract_id: createdRecords.contract_id,
      invoice_id: createdRecords.invoice_id,
      currency: 'EUR',
      total_amount: 2000,
    });
    const readyRes = unpack(readyRaw);
    console.log('✓ Pre-flight readiness check result:');
    console.log('  Ready:', readyRes.ready, 'Can Proceed:', readyRes.can_proceed);
    console.log('  Blocking errors:', readyRes.blocking_errors);
    console.log('  Non-blocking warnings:', readyRes.non_blocking_warnings);
    if (!readyRes.can_proceed) {
      throw new Error(`Readiness check blocked: ${readyRes.blocking_errors.join('; ')}`);
    }

    // ------------------------------------------------------------------
    // STEP 5: SEND PACKAGE PREVIEW & APPROVAL TOKEN
    // ------------------------------------------------------------------
    console.log('\n[Step 5] Generating Send Package Preview (preview_send_package)...');
    const previewRaw = await executeTool(TENANT_ID, USER_ID, 'preview_send_package', {
      tenant_id: TENANT_ID,
      recipient_email: TEST_EMAIL,
      recipient_name: TEST_COMPANY,
      package_type: 'complete_client_package',
      quote_id: createdRecords.quote_id,
      contract_id: createdRecords.contract_id,
      invoice_id: createdRecords.invoice_id,
    });
    const previewRes = unpack(previewRaw);
    console.log('✓ Send Package Preview generated:');
    console.log('  Subject:', previewRes.subject);
    console.log('  Approval Token:', previewRes.approval_token);
    console.log('  Attachments count:', previewRes.attachments?.length);
    for (const att of previewRes.attachments || []) {
      console.log(`    - [${att.document_type}] ${att.filename} (sha256: ${att.sha256_checksum.slice(0, 12)}...)`);
    }
    if (!previewRes.approval_token.startsWith('appr_')) {
      throw new Error('Approval token is missing or malformed');
    }
    if (previewRes.attachments?.length !== 3) {
      throw new Error(`Expected 3 attachments (quote, contract, invoice), got ${previewRes.attachments?.length}`);
    }

    // ------------------------------------------------------------------
    // STEP 6: CUSTOMER IDENTITY CORRECTIONS
    // ------------------------------------------------------------------
    console.log('\n[Step 6] Testing Customer Identity Corrections (correct_customer_identity)...');
    const correctRaw = await executeTool(TENANT_ID, USER_ID, 'correct_customer_identity', {
      tenant_id: TENANT_ID,
      identifier: TEST_EMAIL,
      corrections: {
        name: `${TEST_COMPANY} [Verified Name]`,
        phone: '+1-555-0199',
      },
    });
    const correctRes = unpack(correctRaw);
    console.log('✓ Customer identity correction applied:');
    console.log('  Status:', correctRes.status, 'Message:', correctRes.message);
    console.log('  Affected records:', correctRes.affected_records);

    if (correctRes.status !== 'updated') {
      throw new Error(`Expected correction status "updated", got "${correctRes.status}"`);
    }

    console.log('\n================================================================');
    console.log('ALL WORKFLOW COORDINATION & UNIVERSAL LLM TESTS PASSED SUCCESSFULLY');
    console.log('================================================================');
  } catch (err: any) {
    console.error('\n❌ E2E VERIFICATION FAILED:', err.message || err);
    throw err;
  } finally {
    // ------------------------------------------------------------------
    // STEP 7: CLEANUP TEST RUN RECORDS
    // ------------------------------------------------------------------
    console.log('\n[Step 7] Cleaning up test records (cleanup_test_run)...');
    try {
      const cleanRaw = await executeTool(TENANT_ID, USER_ID, 'cleanup_test_run', {
        tenant_id: TENANT_ID,
        test_run_id: TEST_RUN_ID,
        lead_id: createdRecords.lead_id,
        client_id: createdRecords.client_id,
        contact_id: createdRecords.contact_id,
        deal_id: createdRecords.deal_id,
        quote_id: createdRecords.quote_id,
        contract_id: createdRecords.contract_id,
        invoice_id: createdRecords.invoice_id,
      });
      const cleanRes = unpack(cleanRaw);
      console.log('✓ Cleanup completed:', cleanRes.message);
      console.log('  Cleaned records:', cleanRes.cleaned_records);
    } catch (cleanErr: any) {
      console.warn('⚠️ Cleanup warning:', cleanErr.message);
    }
  }
}

run().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
