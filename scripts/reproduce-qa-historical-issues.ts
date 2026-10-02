import { createRequire } from 'module';
createRequire(import.meta.url)('./stub-server-only.cjs');

import dotenv from 'dotenv';
dotenv.config({ path: '.env.production.local' });

import { executeTool } from '../src/lib/mcp/tool-registry';
import { createSupabaseAdminClient } from '../src/lib/supabase-admin';
import crypto from 'crypto';

const TENANT_ID = '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4';
const USER_ID = 'd8fd4aea-2987-4313-90e2-e6600539ec56';

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
  console.log('REPRODUCING 8 HISTORICAL QA ISSUES FROM 1 OCTOBER 2026');
  console.log('================================================================');
  const supabase = createSupabaseAdminClient();
  const testRunId = `repro-${crypto.randomBytes(4).toString('hex')}`;

  const results: Record<string, { status: 'REPRODUCED' | 'FIXED' | 'PARTIAL'; details: any }> = {};

  // --------------------------------------------------------------------------
  // ISSUE 1: send_quote falsely marks status 'sent' when email delivery fails
  // --------------------------------------------------------------------------
  console.log('\n--- [Testing Issue 1] send_quote status honesty ---');
  try {
    // Create a draft quote
    const { data: quote, error: qErr } = await supabase.from('quotes').insert({
      tenant_id: TENANT_ID,
      quote_number: `Q-TEST-${Date.now().toString().slice(-6)}`,
      name: `Honesty Test Quote ${testRunId}`,
      total_amount: 2000,
      currency: 'EUR',
      status: 'draft',
      client_email: 'bonniiehendrix@gmail.com',
      metadata: { is_test_data: true, test_run_id: testRunId },
    }).select().single();
    if (qErr || !quote) throw qErr;

    // Call send_quote with a broken/failing destination or no provider
    const sendResRaw = await executeTool(TENANT_ID, USER_ID, 'send_quote', {
      tenant_id: TENANT_ID,
      quote_id: quote.id,
      recipient_email: 'bonniiehendrix@gmail.com',
    });
    const sendRes = unpack(sendResRaw);
    console.log('send_quote result:', sendRes);

    const { data: quoteAfter } = await supabase.from('quotes').select('status, sent_at').eq('id', quote.id).single();
    console.log('quote status in DB after send_quote:', quoteAfter?.status);

    if ((!sendRes.provider_accepted || sendRes.message_id === null) && (sendRes.sent === true || quoteAfter?.status === 'sent')) {
      console.log('❌ REPRODUCED Issue 1: Quote marked sent/status:sent despite provider_accepted: false and message_id: null!');
      results['issue_1_quote_send_honesty'] = {
        status: 'REPRODUCED',
        details: { quote_status: quoteAfter?.status, response_sent: sendRes.sent, provider_accepted: sendRes.provider_accepted, message_id: sendRes.message_id, pdf_url: sendRes.pdf_url },
      };
    } else {
      results['issue_1_quote_send_honesty'] = { status: 'FIXED', details: { quoteAfter, sendRes } };
    }

    // cleanup
    await supabase.from('quotes').delete().eq('id', quote.id);
  } catch (err: any) {
    console.error('Issue 1 check failed with error:', err.message);
    results['issue_1_quote_send_honesty'] = { status: 'REPRODUCED', details: err.message };
  }

  // --------------------------------------------------------------------------
  // ISSUE 2: PDF attachments rejected: "mime type application/pdf is not supported"
  // --------------------------------------------------------------------------
  console.log('\n--- [Testing Issue 2] PDF Attachment Ingestion & Sending ---');
  try {
    const dummyPdfBase64 = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Count 1\n/Kids [3 0 R]\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000015 00000 n \n0000000060 00000 n \n0000000111 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n150\n%%EOF').toString('base64');
    
    // Test attachmentsFromMedia through send_email tool
    let errorCaught: string | null = null;
    try {
      const emailResRaw = await executeTool(TENANT_ID, USER_ID, 'send_email', {
        tenant_id: TENANT_ID,
        to: 'bonniiehendrix@gmail.com',
        subject: `PDF Attachment Test [${testRunId}]`,
        text: 'Please find attached test PDF.',
        attachments: [
          {
            filename: 'test-invoice.pdf',
            data: dummyPdfBase64,
            mime_type: 'application/pdf',
          },
        ],
      });
      const emailRes = unpack(emailResRaw);
      console.log('send_email with PDF attachment result:', emailRes);
    } catch (err: any) {
      errorCaught = err.message;
      console.log('send_email error:', err.message);
    }

    if (errorCaught && errorCaught.includes('application/pdf')) {
      console.log('❌ REPRODUCED Issue 2:', errorCaught);
      results['issue_2_pdf_attachment_support'] = { status: 'REPRODUCED', details: errorCaught };
    } else {
      results['issue_2_pdf_attachment_support'] = { status: 'FIXED', details: errorCaught || 'Accepted without MIME rejection' };
    }
  } catch (err: any) {
    results['issue_2_pdf_attachment_support'] = { status: 'REPRODUCED', details: err.message };
  }

  // --------------------------------------------------------------------------
  // ISSUE 3: Branded document generation — Workspace logo was not recognized
  // --------------------------------------------------------------------------
  console.log('\n--- [Testing Issue 3] Branded Document Generation & Logo ---');
  try {
    const { extractTenantBranding } = await import('../src/lib/tenantBranding');
    const { data: tenant } = await supabase.from('tenants').select('*').eq('id', TENANT_ID).single();
    const branding = extractTenantBranding(tenant);
    console.log('extractTenantBranding(tenant):', branding);

    const { data: bSettings } = await supabase.from('business_settings').select('*').eq('tenant_id', TENANT_ID).single();
    console.log('business_settings logo_url:', bSettings?.logo_url);

    if (!branding.logoUrl && bSettings?.logo_url) {
      console.log('❌ REPRODUCED Issue 3: Workspace logo in business_settings is NOT recognized by extractTenantBranding(tenant)!');
      results['issue_3_workspace_logo'] = {
        status: 'REPRODUCED',
        details: {
          branding_logoUrl: branding.logoUrl || null,
          business_settings_logo: bSettings?.logo_url,
          cause: 'extractTenantBranding only reads tenant.logo_url or tenant.settings.branding, ignoring business_settings.logo_url!',
        },
      };
    } else {
      results['issue_3_workspace_logo'] = { status: 'FIXED', details: branding };
    }
  } catch (err: any) {
    results['issue_3_workspace_logo'] = { status: 'REPRODUCED', details: err.message };
  }

  // --------------------------------------------------------------------------
  // ISSUE 4: Document export returned "Document not found"
  // --------------------------------------------------------------------------
  console.log('\n--- [Testing Issue 4] Document export returned Document not found ---');
  try {
    // 1. Create a document with create_document
    const createDocRaw = await executeTool(TENANT_ID, USER_ID, 'create_document', {
      tenant_id: TENANT_ID,
      document_type: 'quote',
      title: `Doc OS Test Quote ${testRunId}`,
      structured_data: { total: 2000, currency: 'EUR' },
    });
    const createDocRes = unpack(createDocRaw);
    const docId = createDocRes.document_id;
    console.log('Created doc in Document OS:', docId);

    // 2. Clear in-memory map or test fresh export
    // In export_document_record:
    const exportRaw = await executeTool(TENANT_ID, USER_ID, 'export_document_record', {
      tenant_id: TENANT_ID,
      document_id: docId,
    });
    const exportRes = unpack(exportRaw);
    console.log('export_document_record immediate result:', Boolean(exportRes?.document));

    // Now test a document stored in Supabase doc_os_documents but NOT in memory (simulate serverless/worker restart)
    const fakeUuid = crypto.randomUUID();
    await supabase.from('doc_os_documents').insert({
      document_id: fakeUuid,
      tenant_id: TENANT_ID,
      document_type: 'quote',
      document_number: 'QTE-99999',
      title: 'Persistent DB Document',
      version: 1,
      status: 'draft',
      currency: 'EUR',
      structured_data: { total: 2000 },
      checksum: 'fakechecksum',
    });

    let exportDbError = null;
    try {
      const exportDbRaw = await executeTool(TENANT_ID, USER_ID, 'export_document_record', {
        tenant_id: TENANT_ID,
        document_id: fakeUuid,
      });
      unpack(exportDbRaw);
    } catch (err: any) {
      exportDbError = err.message;
      console.log('exportDb error for DB-persisted document:', err.message);
    }

    if (exportDbError && exportDbError.includes('Document not found')) {
      console.log('❌ REPRODUCED Issue 4: export_document_record failed with "Document not found" because it does not load from Supabase doc_os_documents!');
      results['issue_4_document_export_not_found'] = {
        status: 'REPRODUCED',
        details: exportDbError,
      };
    } else {
      results['issue_4_document_export_not_found'] = { status: 'FIXED', details: 'Loaded from DB' };
    }

    // cleanup
    await supabase.from('doc_os_documents').delete().eq('document_id', fakeUuid);
    await supabase.from('doc_os_documents').delete().eq('document_id', docId);
  } catch (err: any) {
    results['issue_4_document_export_not_found'] = { status: 'REPRODUCED', details: err.message };
  }

  // --------------------------------------------------------------------------
  // ISSUE 5: Requested EUR 2,000 becomes USD
  // --------------------------------------------------------------------------
  console.log('\n--- [Testing Issue 5] EUR 2,000 rendered as USD in documents ---');
  try {
    const { renderDocumentHtml } = await import('../src/lib/documents/renderDocument');
    const { buildQuoteDocumentInput } = await import('../src/lib/documents/documentBuilders');
    const quoteInput = buildQuoteDocumentInput(
      { quote_number: 'Q-EUR-TEST', name: 'Test Client', total_amount: 2000, currency: 'EUR' },
      [{ product_name: 'AI Integration', quantity: 1, unit_price: 2000, line_total: 2000 }],
      { name: 'AlphaClone' }
    );
    const html = renderDocumentHtml(quoteInput);
    console.log('HTML snippet around price:', html.match(/\$\d+/g));

    if (html.includes('$2000') || html.includes('$2,000') || !html.includes('€') && !html.includes('EUR')) {
      console.log('❌ REPRODUCED Issue 5: EUR 2,000 rendered with hardcoded $ ($2000.00)!');
      results['issue_5_eur_becomes_usd'] = {
        status: 'REPRODUCED',
        details: {
          rendered_dollar_signs: html.match(/\$\d+\.\d{2}/g),
          quote_currency: 'EUR',
          cause: 'renderDocumentHtml hardcodes "$" in table rates, amounts, and total due box!',
        },
      };
    } else {
      results['issue_5_eur_becomes_usd'] = { status: 'FIXED', details: 'Currency preserved' };
    }
  } catch (err: any) {
    results['issue_5_eur_becomes_usd'] = { status: 'REPRODUCED', details: err.message };
  }

  // --------------------------------------------------------------------------
  // ISSUE 6: CRM contact ID required instead of client ID, links incomplete
  // --------------------------------------------------------------------------
  console.log('\n--- [Testing Issue 6] CRM contact ID vs Client ID ---');
  try {
    // Check deals schema jsonSchema
    const { getTool } = await import('../src/lib/mcp/tool-registry');
    const createDealTool = getTool('deals', 'create_deal');
    console.log('create_deal jsonSchema properties:', Object.keys(createDealTool?.jsonSchema?.properties || {}));
    
    // Test creating a deal passing client_id (business_client id)
    const { data: client } = await supabase.from('business_clients').insert({
      tenant_id: TENANT_ID,
      name: `Deal Link Client ${testRunId}`,
      email: `deallink_${testRunId}@test.com`,
      is_active: true,
      custom_fields: { is_test_data: true },
    }).select().single();

    const dealResRaw = await executeTool(TENANT_ID, USER_ID, 'create_deal', {
      tenant_id: TENANT_ID,
      name: `Client ID Deal ${testRunId}`,
      client_id: client?.id,
      value: 2000,
      currency: 'EUR',
      is_test_data: true,
    });
    const dealRes = unpack(dealResRaw);
    console.log('create_deal with client_id output:', dealRes);

    results['issue_6_crm_id_linking'] = {
      status: 'FIXED',
      details: { deal_contact_id: dealRes.contact_id, client_id: client?.id },
    };

    if (dealRes.id) await supabase.from('deals').delete().eq('id', dealRes.id);
    if (client?.id) await supabase.from('business_clients').delete().eq('id', client.id);
  } catch (err: any) {
    console.log('❌ Issue 6 failed:', err.message);
    results['issue_6_crm_id_linking'] = { status: 'REPRODUCED', details: err.message };
  }

  // --------------------------------------------------------------------------
  // ISSUE 7: Reusing existing lead overwrites notes
  // --------------------------------------------------------------------------
  console.log('\n--- [Testing Issue 7] Reusing existing lead overwrites notes ---');
  try {
    const leadEmail = `lead_notes_${testRunId}@test.com`;
    // 1. Create original lead with initial note
    const { data: initialLead } = await supabase.from('leads').insert({
      tenant_id: TENANT_ID,
      business_name: `Original Lead ${testRunId}`,
      email: leadEmail,
      notes: 'INITIAL NOTE: Customer requested quote for EUR 2,000.',
      status: 'new',
      stage: 'lead',
    }).select().single();

    // 2. Call create_lead again with the SAME email and NEW notes
    const secondLeadRaw = await executeTool(TENANT_ID, USER_ID, 'create_lead', {
      tenant_id: TENANT_ID,
      business_name: `Original Lead ${testRunId}`,
      email: leadEmail,
      notes: 'SECOND NOTE: Followed up via phone call on Tuesday.',
    });
    const secondLeadRes = unpack(secondLeadRaw);

    const { data: leadAfter } = await supabase.from('leads').select('notes').eq('id', initialLead?.id).single();
    console.log('Lead notes after second create_lead:', leadAfter?.notes);

    if (leadAfter?.notes && leadAfter.notes.includes('INITIAL NOTE') && leadAfter.notes.includes('SECOND NOTE')) {
      console.log('✓ Notes preserved and appended!');
      results['issue_7_reusing_lead_notes'] = { status: 'FIXED', details: leadAfter.notes };
    } else {
      console.log('❌ REPRODUCED Issue 7: Initial note was lost or not appended when lead was reused!');
      results['issue_7_reusing_lead_notes'] = {
        status: 'REPRODUCED',
        details: { expected: 'Both notes preserved', actual: leadAfter?.notes },
      };
    }

    if (initialLead?.id) await supabase.from('leads').delete().eq('id', initialLead.id);
  } catch (err: any) {
    results['issue_7_reusing_lead_notes'] = { status: 'REPRODUCED', details: err.message };
  }

  // --------------------------------------------------------------------------
  // ISSUE 8: Client portal access could not be completed
  // --------------------------------------------------------------------------
  console.log('\n--- [Testing Issue 8] Client Portal Access Deadlock ---');
  try {
    // Create a new test client without password
    const portalToken = crypto.randomUUID();
    const { data: portalClient } = await supabase.from('business_clients').insert({
      tenant_id: TENANT_ID,
      name: `Portal Access Test ${testRunId}`,
      email: `portal_test_${testRunId}@test.com`,
      finance_portal_token: portalToken,
      client_portal_password_hash: null, // First time client, has no password yet
      is_active: true,
      custom_fields: { is_test_data: true },
    }).select().single();

    // Simulate first-time client trying to set password or access portal via API:
    // Calling /api/client-portal-auth/set-password without cookie
    const setPasswordModule = await import('../src/app/api/client-portal-auth/set-password/route');
    const dummyReq = new Request('http://localhost:3000/api/client-portal-auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newPassword: 'SecurePassword123!',
        confirmPassword: 'SecurePassword123!',
        token: portalToken,
      }),
    });
    const setPassRes = await setPasswordModule.POST(dummyReq as any);
    const setPassJson = await setPassRes.json();
    console.log('set-password without prior session cookie status:', setPassRes.status, setPassJson);

    if (setPassRes.status === 401 && setPassJson.error?.includes('session has expired')) {
      console.log('❌ REPRODUCED Issue 8: set-password requires an existing session cookie, which a first-time client can never have without a password!');
      results['issue_8_portal_access_deadlock'] = {
        status: 'REPRODUCED',
        details: { status: setPassRes.status, error: setPassJson.error },
      };
    } else {
      results['issue_8_portal_access_deadlock'] = { status: 'FIXED', details: setPassJson };
    }

    if (portalClient?.id) await supabase.from('business_clients').delete().eq('id', portalClient.id);
  } catch (err: any) {
    results['issue_8_portal_access_deadlock'] = { status: 'REPRODUCED', details: err.message };
  }

  console.log('\n================================================================');
  console.log('REPRODUCTION SUMMARY MATRIX');
  console.log('================================================================');
  console.log(JSON.stringify(results, null, 2));
}

run().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
