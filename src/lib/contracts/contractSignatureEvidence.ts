import type { SupabaseClient } from '@supabase/supabase-js';

/** Hydrate per-party evidence from canonical records, never decorative document HTML. */
export async function loadContractSignatureParties(admin: SupabaseClient, tenantId: string, contractId: string) {
  const { data: parties, error } = await admin.from('contract_parties')
    .select('id, role, party_snapshot, signature_status, signature_required, signing_order')
    .eq('tenant_id', tenantId).eq('contract_id', contractId);
  if (error) throw error;
  if (!parties?.length) return [];
  const { data: events, error: eventError } = await admin.from('contract_signature_events')
    .select('party_id, occurred_at, evidence').eq('tenant_id', tenantId).eq('contract_id', contractId)
    .eq('event_type', 'signed').order('occurred_at', { ascending: true });
  if (eventError) throw eventError;
  const ids = [...new Set((events || []).map(event => event.evidence?.signature_event_id).filter((id): id is string => typeof id === 'string'))];
  if (!ids.length) return parties;
  const { data: evidence, error: evidenceError } = await admin.from('signature_events')
    .select('id, signer_email, signature_data, created_at').eq('contract_id', contractId).in('id', ids);
  if (evidenceError) throw evidenceError;
  return parties.map(party => {
    const event = events?.find(event => event.party_id === party.id);
    const record = evidence?.find(record => record.id === event?.evidence?.signature_event_id &&
      String(record.signer_email).trim().toLowerCase() === String(party.party_snapshot?.email || '').trim().toLowerCase());
    return record ? { ...party, signature_url: record.signature_data, signed_at: event?.occurred_at || record.created_at } : party;
  });
}
