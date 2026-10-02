/**
 * Verification script for AlphaClone Systems reliability fixes:
 * 1. search_emails multi-table lookup for bonniiehendrix@gmail.com
 * 2. get_action_status lookup for email action and Instagram operation
 * 3. execution budget verification for social tools
 * 4. structured lead creation with fit_score, website, and research metadata
 */

// Neutralize server-only for CLI script runner
try {
  const serverOnlyPath = require.resolve('server-only');
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
  } as any;
} catch {}

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production.local') });

async function verify() {
  console.log('=== AlphaClone Systems Reliability Verification ===\n');

  const tenantId = '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4';
  const userId = 'd8fd4aea-2987-4313-90e2-e6600539ec56';

  // 1. Tool execution budgets
  console.log('1. Checking tool execution budgets...');
  const { resolveMcpToolTimeoutMs } = await import('../src/lib/mcp/mcpToolExecutionBudget');
  const igPhotoTimeout = resolveMcpToolTimeoutMs('publish_instagram_photo');
  const igReelTimeout = resolveMcpToolTimeoutMs('publish_instagram_reel');
  const xImageTimeout = resolveMcpToolTimeoutMs('publish_x_image');
  const emailTimeout = resolveMcpToolTimeoutMs('send_email');

  console.log(`   publish_instagram_photo timeout: ${igPhotoTimeout}ms (expected: 45000ms)`);
  console.log(`   publish_instagram_reel timeout:  ${igReelTimeout}ms (expected: 45000ms)`);
  console.log(`   publish_x_image timeout:         ${xImageTimeout}ms (expected: 45000ms)`);
  console.log(`   send_email timeout:              ${emailTimeout}ms (expected: 15000ms)`);

  if (igPhotoTimeout !== 45000 || igReelTimeout !== 45000 || xImageTimeout !== 45000) {
    throw new Error('Social publish tool timeout budget verification failed!');
  }
  console.log('   ✓ Tool execution budgets verified.\n');

  function parseMcpResult(res: any) {
    if (typeof res === 'string') {
      try { return JSON.parse(res); } catch { return res; }
    }
    if (res?.content?.[0]?.text) {
      try { return JSON.parse(res.content[0].text); } catch { return res.content[0].text; }
    }
    return res;
  }

  // 2. Search emails for bonniiehendrix@gmail.com
  console.log('2. Testing search_emails for bonniiehendrix@gmail.com...');
  const { executeTool } = await import('../src/lib/mcp/tool-registry');
  const rawSearchResult = await executeTool(tenantId, userId, 'search_emails', {
    tenant_id: tenantId,
    query: 'bonniiehendrix@gmail.com',
  });

  const parsedSearch = parseMcpResult(rawSearchResult);
  const matches = parsedSearch?.data?.matches || parsedSearch?.matches || [];
  console.log(`   Found ${matches.length} matching emails.`);

  const brevoMatch = matches.find(
    (m: any) =>
      m.recipient_email?.toLowerCase().includes('bonniiehendrix') &&
      m.provider === 'brevo' &&
      m.delivery_status === 'provider_accepted'
  );

  if (!brevoMatch) {
    console.error('Matches:', JSON.stringify(matches, null, 2));
    throw new Error('Expected Brevo email for bonniiehendrix@gmail.com not found in search_emails!');
  }

  console.log('   ✓ Found outbound Brevo message:');
  console.log(`     Message ID: ${brevoMatch.message_id}`);
  console.log(`     Action ID:  ${brevoMatch.action_id || brevoMatch.evidence?.action_id}`);
  console.log(`     Status:     ${brevoMatch.delivery_status}`);
  console.log(`     Subject:    ${brevoMatch.subject}\n`);

  // 3. Testing get_action_status
  console.log('3. Testing get_action_status...');

  // 3a. Email action ID lookup
  console.log('   3a. Testing email action ID lookup (2dd490da-6e46-432e-ae03-35efacb94600)...');
  const emailStatusResult = await executeTool(tenantId, userId, 'get_action_status', {
    tenant_id: tenantId,
    action_id: '2dd490da-6e46-432e-ae03-35efacb94600',
  });
  const parsedEmailStatus = parseMcpResult(emailStatusResult);
  const emailReceipt = parsedEmailStatus?.data?.receipt || parsedEmailStatus?.receipt;

  if (!emailReceipt || emailReceipt.provider !== 'brevo') {
    console.error('Email status result:', parsedEmailStatus);
    throw new Error('Email action status lookup failed!');
  }
  console.log(`     ✓ Status: ${emailReceipt.final_status}, Provider: ${emailReceipt.provider}, Ref: ${emailReceipt.provider_reference}`);

  // 3b. Instagram operation lookup
  console.log('   3b. Testing Instagram operation lookup (a831e53e-9421-4276-91d0-2328e1bac296)...');
  const igStatusResult = await executeTool(tenantId, userId, 'get_action_status', {
    tenant_id: tenantId,
    action_id: 'a831e53e-9421-4276-91d0-2328e1bac296',
  });
  const parsedIgStatus = parseMcpResult(igStatusResult);
  const igReceipt = parsedIgStatus?.data?.receipt || parsedIgStatus?.receipt;

  if (!igReceipt || igReceipt.final_status !== 'published' || !igReceipt.live_url?.includes('instagram.com')) {
    console.error('IG status result:', parsedIgStatus);
    throw new Error('Instagram action status lookup failed!');
  }
  console.log(`     ✓ Status: ${igReceipt.final_status}, URL: ${igReceipt.live_url}`);
  console.log(`     ✓ Provider post ID: ${igReceipt.provider_reference}\n`);

  // 4. Testing structured create_lead with website and fit_score
  console.log('4. Testing structured create_lead...');
  const testBusinessName = `QA Test Business ${Date.now()}`;
  const testLeadResult = await executeTool(tenantId, userId, 'create_lead', {
    tenant_id: tenantId,
    business_name: testBusinessName,
    website: 'https://test-business-verified.co.za',
    fit_score: 82,
    research_qualification_state: 'research_qualified',
    source_url: 'https://test-business-verified.co.za/contact',
    notes: 'Test lead for structured qualification verification',
    is_test_data: true,
  });

  const parsedLead = parseMcpResult(testLeadResult);
  const createdLeadId = parsedLead?.data?.id || parsedLead?.id || parsedLead?.data?.lead_id || parsedLead?.lead_id;

  if (!createdLeadId) {
    console.error('Lead result:', parsedLead);
    throw new Error('Lead creation failed to return lead ID!');
  }

  const { createSupabaseAdminClient } = await import('../src/lib/supabase-admin');
  const supabase = createSupabaseAdminClient();
  const { data: leadRow } = await supabase
    .from('leads')
    .select('id, business_name, website, score, intelligence_score, metadata')
    .eq('id', createdLeadId)
    .single();

  console.log('   Created lead verified from DB:');
  console.log(`     ID:                 ${leadRow?.id}`);
  console.log(`     Website:            ${leadRow?.website} (expected: https://test-business-verified.co.za)`);
  console.log(`     Score:              ${leadRow?.score} (expected: 82)`);
  console.log(`     Intelligence Score: ${leadRow?.intelligence_score} (expected: 82)`);
  console.log(`     Research Meta:      ${JSON.stringify((leadRow?.metadata as any)?.research?.qualification_state)}`);

  if (leadRow?.website !== 'https://test-business-verified.co.za' || Number(leadRow?.score) !== 82) {
    throw new Error('Lead row website or score mismatch!');
  }
  console.log('   ✓ Structured lead fields and score verified.');

  // Clean up test lead
  await supabase.from('leads').delete().eq('id', createdLeadId);
  console.log('   ✓ Cleaned up test lead.\n');

  console.log('=== All Reliability Verifications Passed Successfully! ===');
}

verify().catch((err) => {
  console.error('\nVerification FAILED:', err);
  process.exit(1);
});
