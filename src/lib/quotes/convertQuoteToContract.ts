import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  resolveBusinessClientIdForParty,
  resolvePartyEmail,
} from '@/lib/contracts/contractCoherenceServer';
import { emitBusinessEvent } from '@/lib/automation/emit-event';

export interface ConvertQuoteToContractOptions {
  title?: string;
  createdBy?: string;
  terms?: string;
}

export interface ConvertQuoteToContractResult {
  contractId: string | null;
  status: string | null;
  error: string | null;
}

export async function convertQuoteToContract(
  quoteId: string,
  tenantId: string,
  options?: ConvertQuoteToContractOptions
): Promise<ConvertQuoteToContractResult> {
  const admin = createSupabaseAdminClient();

  const { data: quote, error: quoteError } = await admin
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .eq('tenant_id', tenantId)
    .single();

  if (quoteError || !quote) {
    return { contractId: null, status: null, error: 'Quote not found' };
  }

  const existingMeta = (quote.metadata || {}) as Record<string, unknown>;
  if (existingMeta.converted_contract_id) {
    const existingContractId = String(existingMeta.converted_contract_id);
    const { data: existingContract } = await admin
      .from('contracts')
      .select('id, status')
      .eq('id', existingContractId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (existingContract) {
      return {
        contractId: existingContract.id,
        status: existingContract.status,
        error: null,
      };
    }
  }

  const { data: items } = await admin
    .from('quote_items')
    .select('*')
    .eq('quote_id', quoteId)
    .order('item_order', { ascending: true });

  const partyId = quote.client_id || quote.contact_id || null;
  const clientId = await resolveBusinessClientIdForParty(admin, tenantId, partyId);
  const clientEmail =
    (quote as { client_email?: string }).client_email ||
    (existingMeta.client_email as string | undefined) ||
    (await resolvePartyEmail(admin, tenantId, partyId));

  const total = Number(quote.total_amount || 0);
  const currency = quote.currency || 'USD';
  const quoteTitle = quote.name || quote.title || `Quote #${quote.quote_number}`;
  const contractTitle = options?.title || `Contract: ${quoteTitle}`;

  const lineItemsSummary = (items || [])
    .map(
      (item: Record<string, unknown>, idx: number) =>
        `${idx + 1}. ${item.product_name || item.description || 'Service'} — Quantity: ${item.quantity || 1} — Amount: ${currency} ${item.line_total || item.unit_price || 0}`
    )
    .join('\n');

  const content = [
    `# MASTER SERVICES AGREEMENT`,
    `This agreement is created from quote ${quote.quote_number}.`,
    `\n## Scope of Services`,
    lineItemsSummary || `Total Agreed Amount: ${currency} ${total}`,
    `\n## Terms & Conditions`,
    quote.terms_and_conditions || options?.terms || 'Standard payment terms apply upon execution.',
    `\n## Governing Law & Jurisdiction`,
    'This Agreement shall be governed by and construed in accordance with the laws of Delaware, United States.',
    `\nTotal Value: ${currency} ${total}`,
  ].join('\n\n');

  const now = new Date().toISOString();

  let clientName = quote.name || null;
  if (clientId) {
    const { data: bClient } = await admin
      .from('business_clients')
      .select('name')
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (bClient?.name) clientName = bClient.name;
  }

  const { data: contract, error: contractError } = await admin
    .from('contracts')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      client_name: clientName,
      deal_id: quote.deal_id || null,
      title: contractTitle,
      content,
      status: 'draft',
      lifecycle_status: 'draft',
      type: 'service_agreement',
      value: total,
      total_value: total,
      contract_value: total,
      currency_code: currency,
      payment_amount: total,
      governing_law: 'Delaware, United States',
      jurisdiction: 'Delaware',
      user_id: options?.createdBy || null,
      owner_user_id: options?.createdBy || null,
      metadata: {
        converted_from_quote_id: quoteId,
        quote_number: quote.quote_number,
        quote_id: quoteId,
        converted_at: now,
        currency,
        is_test_data: Boolean(existingMeta.is_test_data),
      },
    })
    .select('id, status')
    .single();

  if (contractError || !contract) {
    return {
      contractId: null,
      status: null,
      error: contractError?.message || 'Failed to create contract',
    };
  }

  // Add party record if client email or name exists
  if (clientEmail || quote.name) {
    await admin.from('contract_parties').insert({
      tenant_id: tenantId,
      contract_id: contract.id,
      party_snapshot: { email: clientEmail || '', name: quote.name || clientEmail || 'Client' },
      role: 'client',
      signing_order: 1,
      signature_status: 'pending',
    });
  }

  // Connect to revenue lifecycle graph
  await admin.from('revenue_lifecycle_links').upsert(
    {
      tenant_id: tenantId,
      source_type: 'quote',
      source_id: quoteId,
      target_type: 'contract',
      target_id: contract.id,
      relationship: 'converted_to',
      metadata: { initiated_by: options?.createdBy || 'system' },
    },
    { onConflict: 'tenant_id,source_type,source_id,target_type,target_id,relationship' }
  );

  if (quote.deal_id) {
    await admin.from('revenue_lifecycle_links').upsert(
      {
        tenant_id: tenantId,
        source_type: 'deal',
        source_id: quote.deal_id,
        target_type: 'contract',
        target_id: contract.id,
        relationship: 'formalized_by',
        metadata: { quote_id: quoteId },
      },
      { onConflict: 'tenant_id,source_type,source_id,target_type,target_id,relationship' }
    );
  }

  // Update quote metadata with reference to contract
  await admin
    .from('quotes')
    .update({
      metadata: {
        ...existingMeta,
        converted_contract_id: contract.id,
        contract_created_at: now,
      },
    })
    .eq('id', quoteId)
    .eq('tenant_id', tenantId);

  // Emit canonical business event
  await emitBusinessEvent(tenantId, 'contract.created', {
    contractId: contract.id,
    quoteId,
    dealId: quote.deal_id || null,
    clientId,
    title: contractTitle,
    value: total,
    currency,
    actorUserId: options?.createdBy || quote.created_by || null,
  }).catch((err) => {
    console.warn('[convertQuoteToContract] emit event failed:', err?.message || err);
  });

  return { contractId: contract.id, status: contract.status, error: null };
}
