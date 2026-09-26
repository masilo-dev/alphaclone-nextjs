import type { SupabaseClient } from '@supabase/supabase-js';

export interface ReconcileResult {
  totalScanned: number;
  updatedMessages: number;
  matchedLeads: number;
  matchedContacts: number;
  matchedClients: number;
  errors: string[];
}

/**
 * Reconcile orphan email messages by matching recipient email addresses
 * to contacts, business_clients, and leads in the same tenant.
 */
export async function reconcileOrphanEmails(
  supabase: SupabaseClient,
  options?: { tenantId?: string; batchSize?: number; maxBatches?: number }
): Promise<ReconcileResult> {
  const batchSize = options?.batchSize ?? 100;
  const maxBatches = options?.maxBatches ?? 20;
  let totalScanned = 0;
  let updatedMessages = 0;
  let matchedLeads = 0;
  let matchedContacts = 0;
  let matchedClients = 0;
  const errors: string[] = [];

  for (let batchIdx = 0; batchIdx < maxBatches; batchIdx++) {
    let query = supabase
      .from('email_message_recipients')
      .select('id, message_id, tenant_id, email_address, contact_id')
      .is('contact_id', null)
      .not('email_address', 'is', null)
      .limit(batchSize);

    if (options?.tenantId) {
      query = query.eq('tenant_id', options.tenantId);
    }

    const { data: recipients, error: rErr } = await query;
    if (rErr) {
      errors.push(`Error fetching recipients: ${rErr.message}`);
      break;
    }

    if (!recipients || recipients.length === 0) {
      break;
    }

    totalScanned += recipients.length;

    // Cache unique emails to look up in batch
    const emailsByTenant = new Map<string, Set<string>>();
    for (const r of recipients) {
      const email = r.email_address?.trim().toLowerCase();
      if (!email) continue;
      if (!emailsByTenant.has(r.tenant_id)) {
        emailsByTenant.set(r.tenant_id, new Set());
      }
      emailsByTenant.get(r.tenant_id)!.add(email);
    }

    // Lookup contacts, clients, and leads
    const contactMap = new Map<string, string>(); // `${tenant_id}:${email}` -> contact_id
    const clientMap = new Map<string, string>();  // `${tenant_id}:${email}` -> client_id
    const leadMap = new Map<string, string>();    // `${tenant_id}:${email}` -> lead_id

    for (const [tId, emailSet] of emailsByTenant.entries()) {
      const emailList = Array.from(emailSet);

      const [cRes, clRes, lRes] = await Promise.all([
        supabase.from('contacts').select('id, email').eq('tenant_id', tId).in('email', emailList),
        supabase.from('business_clients').select('id, email').eq('tenant_id', tId).in('email', emailList),
        supabase.from('leads').select('id, email').eq('tenant_id', tId).in('email', emailList),
      ]);

      if (cRes.data) {
        for (const c of cRes.data) {
          if (c.email) contactMap.set(`${tId}:${c.email.trim().toLowerCase()}`, c.id);
        }
      }
      if (clRes.data) {
        for (const cl of clRes.data) {
          if (cl.email) clientMap.set(`${tId}:${cl.email.trim().toLowerCase()}`, cl.id);
        }
      }
      if (lRes.data) {
        for (const l of lRes.data) {
          if (l.email) leadMap.set(`${tId}:${l.email.trim().toLowerCase()}`, l.id);
        }
      }
    }

    // Apply updates
    for (const r of recipients) {
      const email = r.email_address?.trim().toLowerCase();
      if (!email) continue;
      const key = `${r.tenant_id}:${email}`;

      const contactId = contactMap.get(key) || null;
      const clientId = clientMap.get(key) || null;
      const leadId = leadMap.get(key) || null;

      if (!contactId && !clientId && !leadId) continue;

      if (contactId) matchedContacts++;
      if (clientId) matchedClients++;
      if (leadId) matchedLeads++;

      // Update message
      const msgUpdate: Record<string, unknown> = {};
      if (contactId) msgUpdate.contact_id = contactId;
      if (clientId) msgUpdate.client_id = clientId;
      if (leadId) msgUpdate.lead_id = leadId;

      const { error: mUpdateErr } = await supabase
        .from('email_messages')
        .update(msgUpdate)
        .eq('id', r.message_id)
        .eq('tenant_id', r.tenant_id);

      if (mUpdateErr) {
        errors.push(`Update msg ${r.message_id} err: ${mUpdateErr.message}`);
      } else {
        updatedMessages++;
      }

      // Update recipient row if contactId is resolved
      if (contactId) {
        await supabase
          .from('email_message_recipients')
          .update({ contact_id: contactId })
          .eq('id', r.id);
      }
    }
  }

  return {
    totalScanned,
    updatedMessages,
    matchedLeads,
    matchedContacts,
    matchedClients,
    errors,
  };
}
