import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logCrmActivityAdmin } from '@/lib/crm/crmActivityServer';

export async function ensureDealProposalArtifacts(
  admin: SupabaseClient,
  dealId: string,
  tenantId: string
) {
  const { data: deal } = await admin
    .from('deals')
    .select('id, name, value, contact_id, owner_id, currency')
    .eq('id', dealId)
    .maybeSingle();
  if (!deal) return { ok: false as const, reason: 'deal_not_found' };

  const { data: existingQuote } = await admin
    .from('quotes')
    .select('id')
    .eq('deal_id', dealId)
    .limit(1)
    .maybeSingle();

  if (!existingQuote?.id) {
    const quoteNum = `QUO-${Date.now().toString(36).toUpperCase()}`;
    await admin.from('quotes').insert({
      tenant_id: tenantId,
      quote_number: quoteNum,
      name: `Proposal — ${deal.name}`,
      contact_id: deal.contact_id,
      deal_id: dealId,
      status: 'draft',
      subtotal: deal.value || 0,
      total_amount: deal.value || 0,
      currency: deal.currency || 'USD',
      valid_until: new Date(Date.now() + 30 * 86400000).toISOString(),
      notes: 'Auto-generated when deal entered proposal stage.',
      created_by: deal.owner_id,
    });
  }

  if (deal.owner_id) {
    await admin.from('tasks').insert({
      tenant_id: tenantId,
      title: `Prepare proposal: ${deal.name}`,
      description: 'Deal moved to proposal — review quote and send to client.',
      assigned_to: deal.owner_id,
      created_by: deal.owner_id,
      related_to_deal: dealId,
      status: 'todo',
      priority: 'high',
      due_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    });
  }

  await logCrmActivityAdmin(admin, {
    tenantId,
    dealId,
    type: 'task',
    subject: `Proposal stage started: ${deal.name}`,
    description: 'Quote draft and owner task created automatically.',
    createdBy: deal.owner_id || undefined,
    isAutomated: true,
    source: 'deal_proposal_automation',
  });

  return { ok: true as const };
}
