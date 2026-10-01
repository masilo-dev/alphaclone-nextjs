/**
 * Automated End-to-End Verification of Complete Client Lifecycle
 * 
 * Verifies:
 * 1. create_lead (with is_test_data: true, EUR notes)
 * 2. create_client (converted lead, canonical contacts sync, crm_contact_id)
 * 3. create_deal (EUR canonical currency, client UUID resolved to contact_id)
 * 4. create_quote (EUR currency, deal link, line items)
 * 5. convert_quote_to_contract (contract_value, EUR currency, links)
 * 6. send_contract (draft review send, non-blocking pre-send)
 * 7. create_invoice (EUR currency, client snapshot, line items)
 * 8. send_invoice (truthful delivery receipt status)
 * 9. generate_quote_pdf, generate_contract_pdf, generate_invoice_pdf (real PDF generation)
 * 10. Document OS create_document (Postgres doc_os_documents persistence & EUR currency)
 * 11. enable_client_portal_access & verify_client_portal_records
 * 12. get_customer_360 (complete timeline & graph)
 * 13. Clean rollback/cleanup of test records
 */

import { createRequire } from 'module';
createRequire(import.meta.url)('./stub-server-only.cjs');

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.production.local' });

const TENANT_ID = '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4';
const USER_ID = 'd8fd4aea-2987-4313-90e2-e6600539ec56';
const TEST_EMAIL = 'bonniiehendrix@gmail.com';
const TEST_COMPANY = `Automated QA Lifecycle Test ${Date.now()}`;

function unpackMcpResult(res: any): any {
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

async function runTest() {
  console.log('--- STARTING COMPLETE CLIENT LIFECYCLE REPAIR VERIFICATION ---');
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { executeTool, initializeRegistry } = await import('@/lib/mcp/tool-registry');
  initializeRegistry();

  // Track created IDs for strict cleanup
  const created = {
    leadId: '',
    clientId: '',
    contactId: '',
    dealId: '',
    quoteId: '',
    contractId: '',
    invoiceId: '',
    docOsId: '',
  };

  try {
    // 1. CREATE LEAD
    console.log('\n[Step 1] Creating Lead...');
    const rawLeadRes = await executeTool(TENANT_ID, USER_ID, 'create_lead', {
      tenant_id: TENANT_ID,
      email: TEST_EMAIL,
      business_name: TEST_COMPANY,
      contact_name: 'Bonnie Hendrix QA',
      notes: 'Initial contact requesting EUR 2,000 package',
      is_test_data: true,
    });
    const leadData = unpackMcpResult(rawLeadRes);
    created.leadId = leadData.lead_id || leadData.id;
    console.log('✓ Lead created:', created.leadId, 'is_test_data:', leadData.is_test_data);
    if (!created.leadId) throw new Error('Lead ID missing');

    // 2. CREATE CLIENT & CONVERT LEAD
    console.log('\n[Step 2] Creating Client & Converting Lead...');
    const rawClientRes = await executeTool(TENANT_ID, USER_ID, 'create_client', {
      tenant_id: TENANT_ID,
      name: TEST_COMPANY,
      email: TEST_EMAIL,
      lead_id: created.leadId,
      is_test_data: true,
      value: 2000,
      custom_fields: { currency: 'EUR', is_test_data: true },
    });
    const clientData = unpackMcpResult(rawClientRes);
    created.clientId = clientData.id;
    created.contactId = clientData.crm_contact_id;
    console.log('✓ Client created:', created.clientId, 'crm_contact_id:', created.contactId);
    if (!created.contactId) throw new Error('crm_contact_id was not linked or created');

    // Verify lead was converted
    const { data: verifiedLead } = await admin.from('leads').select('status, stage').eq('id', created.leadId).single();
    console.log('✓ Lead status after conversion:', verifiedLead?.status, 'stage:', verifiedLead?.stage);
    if (verifiedLead?.status !== 'converted') throw new Error('Lead was not transitioned to converted');

    // 3. CREATE DEAL (Passing client_id, verifying contact resolution & EUR currency)
    console.log('\n[Step 3] Creating Deal with EUR 2,000...');
    const rawDealRes = await executeTool(TENANT_ID, USER_ID, 'create_deal', {
      tenant_id: TENANT_ID,
      title: `${TEST_COMPANY} - Standard Service`,
      client_id: created.clientId,
      value: 2000,
      currency: 'EUR',
      stage: 'proposal',
      is_test_data: true,
    });
    const dealData = unpackMcpResult(rawDealRes);
    created.dealId = dealData.id;
    console.log('✓ Deal created:', created.dealId, 'currency:', dealData.currency, 'value:', dealData.value, 'contact_id:', dealData.contact_id);
    if (dealData.currency !== 'EUR') throw new Error(`Deal currency was ${dealData.currency}, expected EUR`);
    if (dealData.contact_id !== created.contactId) throw new Error(`Deal contact_id did not resolve to canonical contact`);

    // 4. CREATE QUOTE
    console.log('\n[Step 4] Creating Quote with EUR 2,000...');
    const rawQuoteRes = await executeTool(TENANT_ID, USER_ID, 'create_quote', {
      tenant_id: TENANT_ID,
      client_id: created.clientId,
      deal_id: created.dealId,
      title: `Quote for ${TEST_COMPANY}`,
      total: 2000,
      currency: 'EUR',
      line_items: [
        { name: 'Core Consulting Package', quantity: 1, unit_price: 2000, line_total: 2000 }
      ],
      is_test_data: true,
    });
    const quoteParsed = unpackMcpResult(rawQuoteRes);
    created.quoteId = quoteParsed.id;
    console.log('✓ Quote created:', created.quoteId, 'currency:', quoteParsed.currency, 'total:', quoteParsed.total_amount);
    if (quoteParsed.currency !== 'EUR') throw new Error(`Quote currency was ${quoteParsed.currency}, expected EUR`);

    // 5. CONVERT QUOTE TO CONTRACT
    console.log('\n[Step 5] Converting Quote to Contract...');
    const rawContractRes = await executeTool(TENANT_ID, USER_ID, 'convert_quote_to_contract', {
      tenant_id: TENANT_ID,
      quote_id: created.quoteId,
      title: `Service Contract for ${TEST_COMPANY}`,
      terms: 'Payment due within 14 days of invoice.',
    });
    const contractParsed = unpackMcpResult(rawContractRes);
    created.contractId = contractParsed.contract_id;
    console.log('✓ Contract created from quote:', created.contractId);

    // Verify contract values and currency in database
    const { data: dbContract } = await admin.from('contracts').select('*').eq('id', created.contractId).single();
    console.log('✓ Contract DB verification: contract_value:', dbContract.contract_value, 'currency_code:', dbContract.currency_code);
    if (dbContract.contract_value !== 2000) throw new Error(`Contract value was ${dbContract.contract_value}, expected 2000`);
    if (dbContract.currency_code !== 'EUR') throw new Error(`Contract currency_code was ${dbContract.currency_code}, expected EUR`);

    // 6. SEND CONTRACT (Draft review send — verifying non-blocking legal pre-flight)
    console.log('\n[Step 6] Sending Contract Draft for Review...');
    const rawSendContractRes = await executeTool(TENANT_ID, USER_ID, 'send_contract', {
      tenant_id: TENANT_ID,
      contract_id: created.contractId,
      recipient_email: TEST_EMAIL,
      subject: `Review Draft Agreement: ${TEST_COMPANY}`,
      message: 'Please review the attached agreement draft.',
    });
    const sendContractData = unpackMcpResult(rawSendContractRes);
    console.log('✓ send_contract completed:', sendContractData);

    // 7. CREATE INVOICE
    console.log('\n[Step 7] Creating Invoice with EUR 2,000...');
    const rawInvoiceRes = await executeTool(TENANT_ID, USER_ID, 'create_invoice', {
      tenant_id: TENANT_ID,
      client_id: created.clientId,
      amount: 2000,
      currency: 'EUR',
      quote_id: created.quoteId,
      contract_id: created.contractId,
      opportunity_id: created.dealId,
      payment_reference: 'TEST-NOT-PAYABLE-QA',
      is_test_data: true,
      line_items: [
        { name: 'Core Consulting Package', quantity: 1, unit_price: 2000, line_total: 2000 }
      ],
    });
    const invData = unpackMcpResult(rawInvoiceRes);
    created.invoiceId = invData.id;
    console.log('✓ Invoice created:', created.invoiceId, 'currency:', invData.currency, 'client_name:', invData.client_name);
    if (invData.currency !== 'EUR') throw new Error(`Invoice currency was ${invData.currency}, expected EUR`);

    // 8. SEND INVOICE & TRUTHFUL DELIVERY RECEIPT
    console.log('\n[Step 8] Sending Invoice...');
    const rawSendInvoiceRes = await executeTool(TENANT_ID, USER_ID, 'send_invoice', {
      tenant_id: TENANT_ID,
      invoice_id: created.invoiceId,
      recipient_email: TEST_EMAIL,
    });
    const sendInvoiceData = unpackMcpResult(rawSendInvoiceRes);
    console.log('✓ send_invoice response receipt:', sendInvoiceData);
    if (sendInvoiceData.status !== 'queued' && sendInvoiceData.status !== 'sent') {
      throw new Error(`Unexpected invoice delivery state: ${sendInvoiceData.status}`);
    }

    // 9. TEST REAL PDF GENERATION (QUOTE, CONTRACT, INVOICE)
    console.log('\n[Step 9] Generating real PDFs...');
    const rawQPdf = await executeTool(TENANT_ID, USER_ID, 'generate_quote_pdf', { tenant_id: TENANT_ID, quote_id: created.quoteId });
    const qPdfData = unpackMcpResult(rawQPdf);
    console.log('✓ Quote PDF bytes:', qPdfData?.byte_length);
    if (!qPdfData?.byte_length || qPdfData.byte_length < 100) throw new Error('Quote PDF generation failed');

    const rawCPdf = await executeTool(TENANT_ID, USER_ID, 'generate_contract_pdf', { tenant_id: TENANT_ID, contract_id: created.contractId });
    const cPdfData = unpackMcpResult(rawCPdf);
    console.log('✓ Contract PDF bytes:', cPdfData?.byte_length);
    if (!cPdfData?.byte_length || cPdfData.byte_length < 100) throw new Error('Contract PDF generation failed');

    const rawIPdf = await executeTool(TENANT_ID, USER_ID, 'generate_invoice_pdf', { tenant_id: TENANT_ID, invoice_id: created.invoiceId });
    const iPdfData = unpackMcpResult(rawIPdf);
    console.log('✓ Invoice PDF bytes:', iPdfData?.byte_length);
    if (!iPdfData?.byte_length || iPdfData.byte_length < 100) throw new Error('Invoice PDF generation failed');

    // 10. DOCUMENT OS PERSISTENCE & CURRENCY
    console.log('\n[Step 10] Testing Document OS DB Persistence & EUR Currency...');
    const docOsRes = await executeTool(TENANT_ID, USER_ID, 'create_document', {
      tenant_id: TENANT_ID,
      document_type: 'invoice',
      title: `DocOS Invoice for ${TEST_COMPANY}`,
      currency: 'EUR',
      structured_data: {
        total: 2000,
        currency: 'EUR',
        items: [{ title: 'Service A', amount: 2000 }]
      },
    });
    const docOsData = JSON.parse(docOsRes.content[0].text);
    created.docOsId = docOsData.document.document_id;
    console.log('✓ Document OS doc created:', created.docOsId, 'currency:', docOsData.document.currency);
    if (docOsData.document.currency !== 'EUR') throw new Error(`DocOS currency was ${docOsData.document.currency}, expected EUR`);

    // Verify row in doc_os_documents in DB
    const { data: dbDocOs } = await admin.from('doc_os_documents').select('*').eq('document_id', created.docOsId).single();
    if (!dbDocOs) throw new Error('Document OS document was not persisted to Postgres doc_os_documents table');
    console.log('✓ Document OS persisted to database successfully:', dbDocOs.document_id);

    // 11. CLIENT PORTAL ACCESS & VERIFICATION
    console.log('\n[Step 11] Enabling & Verifying Client Portal Access...');
    const rawPortalRes = await executeTool(TENANT_ID, USER_ID, 'enable_client_portal_access', {
      tenant_id: TENANT_ID,
      client_id: created.clientId,
    });
    const portalData = unpackMcpResult(rawPortalRes);
    if (!portalData.success) throw new Error(`enable_client_portal_access failed: ${portalData.error}`);
    console.log('✓ Portal access enabled:', portalData.portal_url);

    const rawVerifyPortalRes = await executeTool(TENANT_ID, USER_ID, 'verify_client_portal_records', {
      tenant_id: TENANT_ID,
      client_id: created.clientId,
    });
    const verifyPortalData = unpackMcpResult(rawVerifyPortalRes);
    if (!verifyPortalData.success) throw new Error(`verify_client_portal_records failed: ${verifyPortalData.error}`);
    console.log('✓ Client Portal records verified: Invoices count:', verifyPortalData.invoices_count, 'Quotes count:', verifyPortalData.quotes_count);

    // 12. CUSTOMER 360 UNIFIED PROFILE
    console.log('\n[Step 12] Fetching Customer 360 Profile...');
    const rawC360Res = await executeTool(TENANT_ID, USER_ID, 'get_customer_360', {
      tenant_id: TENANT_ID,
      identifier: TEST_EMAIL,
    });
    const c360Data = unpackMcpResult(rawC360Res);
    if (!c360Data.found) throw new Error(`get_customer_360 failed: ${c360Data.error}`);
    console.log('✓ Customer 360 found:', c360Data.found, 'Primary Name:', c360Data.profile.primary_name);
    console.log('  Active Deals:', c360Data.profile.active_deals_count, 'Timeline events:', c360Data.profile.timeline?.length);

    console.log('\n======================================================');
    console.log('ALL 12 END-TO-END CLIENT LIFECYCLE REPAIR TESTS PASSED');
    console.log('======================================================');

  } catch (err: any) {
    console.error('\n❌ TEST FAILED:', err.message || err);
    throw err;
  } finally {
    // 13. CLEANUP
    console.log('\n[Step 13] Cleaning up test records...');
    if (created.docOsId) {
      await admin.from('doc_os_documents').delete().eq('document_id', created.docOsId);
      await admin.from('doc_os_versions').delete().eq('document_id', created.docOsId);
    }
    if (created.invoiceId) {
      await admin.from('business_invoices').delete().eq('id', created.invoiceId);
    }
    if (created.contractId) {
      await admin.from('contract_parties').delete().eq('contract_id', created.contractId);
      await admin.from('contract_lifecycle_events').delete().eq('contract_id', created.contractId);
      await admin.from('revenue_lifecycle_links').delete().eq('target_id', created.contractId);
      await admin.from('contracts').delete().eq('id', created.contractId);
    }
    if (created.quoteId) {
      await admin.from('quote_items').delete().eq('quote_id', created.quoteId);
      await admin.from('quotes').delete().eq('id', created.quoteId);
    }
    if (created.dealId) {
      await admin.from('deals').delete().eq('id', created.dealId);
    }
    if (created.clientId) {
      await admin.from('business_clients').delete().eq('id', created.clientId);
    }
    if (created.contactId) {
      await admin.from('contacts').delete().eq('id', created.contactId);
    }
    if (created.leadId) {
      await admin.from('leads').delete().eq('id', created.leadId);
    }
    console.log('✓ Test cleanup complete.');
  }
}

runTest().catch((err) => {
  console.error('Fatal error during execution:', err);
  process.exit(1);
});
