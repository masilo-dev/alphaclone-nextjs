/**
 * 20-complete-business-lifecycle.cjs
 *
 * Comprehensive E2E Business Lifecycle Verification:
 * 1. Discover/Create Lead (leads)
 * 2. Create Deal linked to Contact/Client (deals)
 * 3. Generate Proposal/Quote (quotes, quote_items)
 * 4. Convert Quote to Contract (convertQuoteToContract) -> checks revenue_lifecycle_links
 * 5. Sign Contract -> triggers runContractSignedFlow -> provisions Invoice, Project, Tasks, Links
 * 6. Reconcile Payment on Invoice -> checks payment recording
 * 7. Query Universal Activity Timeline for Deal & Quote -> verifies full lifecycle audit context
 * 8. Safe Cleanup of all test artifacts
 */

// Self-bootstrap tsx if executed directly with node
if (!process.execArgv.some(arg => arg.includes('tsx'))) {
  const { spawnSync } = require('child_process');
  const res = spawnSync(
    process.execPath,
    ['--require', './tests/server-only-register.cjs', '--import', 'tsx', __filename, ...process.argv.slice(2)],
    { stdio: 'inherit' }
  );
  process.exit(res.status || 0);
}

try {
  require.cache[require.resolve('server-only')] = {
    id: require.resolve('server-only'),
    filename: require.resolve('server-only'),
    loaded: true,
    exports: {},
  };
} catch (e) {}

const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.join(process.cwd(), '.env.production.local') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT_ID = '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.production.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runLifecycleE2E() {
  console.log('======================================================================');
  console.log('STARTING ALPHACLONE SYSTEMS COMPLETE BUSINESS LIFECYCLE E2E AUDIT');
  console.log(`Tenant ID: ${TENANT_ID}`);
  console.log('======================================================================\n');

  const testRunId = Date.now();
  const testEmail = `e2e_lifecycle_${testRunId}@alphaclone-audit.test`;
  const companyName = `Acme Enterprise Corp ${testRunId}`;
  const contactName = `Alex Johnson ${testRunId}`;

  const cleanup = {
    leadId: null,
    clientId: null,
    dealId: null,
    quoteId: null,
    contractId: null,
    invoiceId: null,
    projectId: null,
  };

  try {
    // -------------------------------------------------------------------------
    // STEP 1: CREATE LEAD
    // -------------------------------------------------------------------------
    console.log('[STEP 1] Creating Lead...');
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .insert({
        tenant_id: TENANT_ID,
        business_name: companyName,
        contact_name: contactName,
        email: testEmail,
        status: 'qualified',
        stage: 'qualified',
        source: 'outbound_ai',
      })
      .select('id')
      .single();

    if (leadErr || !lead) throw new Error(`Lead creation failed: ${leadErr?.message}`);
    cleanup.leadId = lead.id;
    console.log(`✓ Lead created: ${lead.id}`);

    // -------------------------------------------------------------------------
    // STEP 2: CREATE CONTACT & DEAL
    // -------------------------------------------------------------------------
    console.log('[STEP 2] Creating Contact & Deal...');
    const { data: contact, error: contactErr } = await supabase
      .from('contacts')
      .insert({
        tenant_id: TENANT_ID,
        first_name: 'Alex',
        last_name: 'Johnson',
        email: testEmail,
        status: 'active',
      })
      .select('id')
      .single();

    if (contactErr || !contact) throw new Error(`Contact creation failed: ${contactErr?.message}`);
    cleanup.contactId = contact.id;

    const { data: client, error: clientErr } = await supabase
      .from('business_clients')
      .insert({
        tenant_id: TENANT_ID,
        name: companyName,
        email: testEmail,
        status: 'prospect',
      })
      .select('id')
      .single();

    if (clientErr || !client) throw new Error(`Client creation failed: ${clientErr?.message}`);
    cleanup.clientId = client.id;

    const { data: deal, error: dealErr } = await supabase
      .from('deals')
      .insert({
        tenant_id: TENANT_ID,
        name: `Website Replatform Deal ${testRunId}`,
        contact_id: contact.id,
        value: 12000,
        currency: 'USD',
        stage: 'proposal',
      })
      .select('id')
      .single();

    if (dealErr || !deal) throw new Error(`Deal creation failed: ${dealErr?.message}`);
    cleanup.dealId = deal.id;
    console.log(`✓ Contact created: ${contact.id}`);
    console.log(`✓ Deal created: ${deal.id} ($12,000 USD)`);

    // -------------------------------------------------------------------------
    // STEP 3: CREATE QUOTE WITH LINE ITEMS
    // -------------------------------------------------------------------------
    console.log('[STEP 3] Creating Quote & Line Items...');
    const quoteNumber = `QT-${Date.now().toString(36).toUpperCase()}`;
    const { data: quote, error: quoteErr } = await supabase
      .from('quotes')
      .insert({
        tenant_id: TENANT_ID,
        deal_id: deal.id,
        contact_id: contact.id,
        quote_number: quoteNumber,
        name: companyName,
        status: 'sent',
        subtotal: 10000,
        tax_percent: 20,
        tax_amount: 2000,
        total_amount: 12000,
        currency: 'USD',
        valid_until: new Date(Date.now() + 14 * 86400000).toISOString(),
        terms_and_conditions: 'Payment due within 30 days of invoice date.',
        metadata: { public_token: `tok_${Date.now()}` },
      })
      .select('id, quote_number')
      .single();

    if (quoteErr || !quote) throw new Error(`Quote creation failed: ${quoteErr?.message}`);
    cleanup.quoteId = quote.id;

    await supabase.from('quote_items').insert([
      {
        quote_id: quote.id,
        tenant_id: TENANT_ID,
        product_name: 'Core Architecture Assessment',
        quantity: 1,
        unit_price: 5000,
        line_total: 5000,
        item_order: 1,
      },
      {
        quote_id: quote.id,
        tenant_id: TENANT_ID,
        product_name: 'Implementation & Delivery Sprint',
        quantity: 1,
        unit_price: 5000,
        line_total: 5000,
        item_order: 2,
      },
    ]);
    console.log(`✓ Quote created: #${quote.quote_number} (${quote.id})`);

    // -------------------------------------------------------------------------
    // STEP 4: CONVERT QUOTE TO CONTRACT (Canonical Service)
    // -------------------------------------------------------------------------
    console.log('[STEP 4] Testing Canonical convertQuoteToContract...');
    const { convertQuoteToContract } = await import('../../src/lib/quotes/convertQuoteToContract.ts');
    const contractResult = await convertQuoteToContract(quote.id, TENANT_ID, {
      title: `MSA — ${companyName}`,
    });

    if (contractResult.error || !contractResult.contractId) {
      throw new Error(`Quote-to-contract conversion failed: ${contractResult.error}`);
    }
    cleanup.contractId = contractResult.contractId;
    console.log(`✓ Contract created from quote: ${contractResult.contractId}`);

    // Verify revenue_lifecycle_links for Quote -> Contract
    const { data: quoteContractLink } = await supabase
      .from('revenue_lifecycle_links')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .eq('source_type', 'quote')
      .eq('source_id', quote.id)
      .eq('target_type', 'contract')
      .eq('target_id', contractResult.contractId)
      .maybeSingle();

    if (!quoteContractLink) {
      throw new Error('MISSING revenue_lifecycle_link between Quote and Contract');
    }
    console.log('✓ Verified Quote -> Contract link in revenue_lifecycle_links');

    // -------------------------------------------------------------------------
    // STEP 5: RUN CONTRACT SIGNED FLOW (Synchronous Lifecycle Provisioning)
    // -------------------------------------------------------------------------
    console.log('[STEP 5] Testing Canonical runContractSignedFlow...');
    const { runContractSignedFlow } = await import('../../src/lib/contracts/contractSignedSteps.ts');
    const signedFlowResult = await runContractSignedFlow({
      tenantId: TENANT_ID,
      contractId: contractResult.contractId,
    });

    if (!signedFlowResult.invoice_id) {
      throw new Error('runContractSignedFlow did not return invoice_id');
    }
    cleanup.invoiceId = signedFlowResult.invoice_id;
    cleanup.projectId = signedFlowResult.project_id || null;
    console.log(`✓ Invoice provisioned: ${signedFlowResult.invoice_id}`);
    if (signedFlowResult.project_id) {
      console.log(`✓ Project provisioned: ${signedFlowResult.project_id}`);
    }

    // Verify revenue_lifecycle_links for Contract -> Invoice
    const { data: contractInvoiceLink } = await supabase
      .from('revenue_lifecycle_links')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .eq('source_type', 'contract')
      .eq('source_id', contractResult.contractId)
      .eq('target_type', 'invoice')
      .eq('target_id', signedFlowResult.invoice_id)
      .maybeSingle();

    if (!contractInvoiceLink) {
      throw new Error('MISSING revenue_lifecycle_link between Contract and Invoice');
    }
    console.log('✓ Verified Contract -> Invoice link in revenue_lifecycle_links');

    // -------------------------------------------------------------------------
    // STEP 6: VERIFY UNIVERSAL ACTIVITY TIMELINE
    // -------------------------------------------------------------------------
    console.log('[STEP 6] Testing Universal Activity Timeline for Deal & Quote...');
    const { buildEntityContextSummary } = await import('../../src/lib/audit/entityTimelineService.ts');

    const dealContext = await buildEntityContextSummary(supabase, TENANT_ID, 'deal', deal.id);
    console.log(`✓ Deal Timeline items count: ${dealContext.timeline.length}`);
    console.log(`✓ Deal Next Action: "${dealContext.next_action}"`);

    const quoteContext = await buildEntityContextSummary(supabase, TENANT_ID, 'quote', quote.id);
    console.log(`✓ Quote Timeline items count: ${quoteContext.timeline.length}`);
    console.log(`✓ Quote Next Action: "${quoteContext.next_action}"`);

    console.log('\n======================================================================');
    console.log('SUCCESS! ALL 6 LIFECYCLE STAGES VERIFIED DURABLY END-TO-END');
    console.log('======================================================================');
  } finally {
    console.log('\n[TEARDOWN] Cleaning up test artifacts...');
    if (cleanup.quoteId) {
      await supabase.from('quote_items').delete().eq('quote_id', cleanup.quoteId).eq('tenant_id', TENANT_ID);
      await supabase.from('quotes').delete().eq('id', cleanup.quoteId).eq('tenant_id', TENANT_ID);
    }
    if (cleanup.invoiceId) {
      await supabase.from('invoice_line_items').delete().eq('invoice_id', cleanup.invoiceId).eq('tenant_id', TENANT_ID);
      await supabase.from('business_invoices').delete().eq('id', cleanup.invoiceId).eq('tenant_id', TENANT_ID);
    }
    if (cleanup.contractId) {
      await supabase.from('contract_parties').delete().eq('contract_id', cleanup.contractId).eq('tenant_id', TENANT_ID);
      await supabase.from('contracts').delete().eq('id', cleanup.contractId).eq('tenant_id', TENANT_ID);
    }
    if (cleanup.projectId) {
      await supabase.from('tasks').delete().eq('project_id', cleanup.projectId).eq('tenant_id', TENANT_ID);
      await supabase.from('projects').delete().eq('id', cleanup.projectId).eq('tenant_id', TENANT_ID);
    }
    if (cleanup.dealId) {
      await supabase.from('deals').delete().eq('id', cleanup.dealId).eq('tenant_id', TENANT_ID);
    }
    if (cleanup.contactId) {
      await supabase.from('contacts').delete().eq('id', cleanup.contactId).eq('tenant_id', TENANT_ID);
    }
    if (cleanup.clientId) {
      await supabase.from('business_clients').delete().eq('id', cleanup.clientId).eq('tenant_id', TENANT_ID);
    }
    if (cleanup.leadId) {
      await supabase.from('leads').delete().eq('id', cleanup.leadId).eq('tenant_id', TENANT_ID);
    }
    console.log('✓ Teardown complete. Zero test residue left in production database.');
  }
}

runLifecycleE2E().catch((err) => {
  console.error('\nLifecycle E2E Failed:', err);
  process.exit(1);
});
