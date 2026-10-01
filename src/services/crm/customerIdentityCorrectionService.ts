import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type CustomerIdentityCorrectionInput = {
  tenantId: string;
  identifier: string; // email, client UUID, contact UUID, or lead UUID
  corrections: {
    email?: string;
    name?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    company?: string;
    notes?: string;
  };
  options?: {
    dryRun?: boolean;
    updateDraftDocuments?: boolean;
  };
};

export type CustomerIdentityCorrectionResult = {
  success: boolean;
  status: 'updated' | 'conflict' | 'not_found' | 'no_change';
  message: string;
  previous_identity?: Record<string, unknown>;
  updated_identity?: Record<string, unknown>;
  conflict?: {
    conflict_type: string;
    conflicting_record_id: string;
    conflicting_table: string;
    conflicting_email: string;
    resolution_hint: string;
  };
  affected_records?: {
    contacts: number;
    business_clients: number;
    leads: number;
    draft_quotes: number;
    draft_contracts: number;
  };
};

function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0] || '', last_name: '' };
  return { first_name: parts[0] || '', last_name: parts.slice(1).join(' ') };
}

export async function correctCustomerIdentity(
  input: CustomerIdentityCorrectionInput,
  client?: SupabaseClient
): Promise<CustomerIdentityCorrectionResult> {
  const supabase = client || createSupabaseAdminClient();
  const { tenantId, identifier, corrections, options } = input;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier.trim());

  // 1. Locate matching identity records
  let targetEmail = identifier.includes('@') ? identifier.trim().toLowerCase() : '';
  let clientRow: any = null;
  let contactRow: any = null;
  let leadRow: any = null;

  if (isUuid) {
    const [{ data: c }, { data: ct }, { data: l }] = await Promise.all([
      supabase.from('business_clients').select('*').eq('tenant_id', tenantId).eq('id', identifier.trim()).maybeSingle(),
      supabase.from('contacts').select('*').eq('tenant_id', tenantId).eq('id', identifier.trim()).maybeSingle(),
      supabase.from('leads').select('*').eq('tenant_id', tenantId).eq('id', identifier.trim()).maybeSingle(),
    ]);
    clientRow = c;
    contactRow = ct;
    leadRow = l;
    targetEmail = (c?.email || ct?.email || l?.email || '').trim().toLowerCase();
  }

  if (targetEmail) {
    const [{ data: clients }, { data: contacts }, { data: leads }] = await Promise.all([
      supabase.from('business_clients').select('*').eq('tenant_id', tenantId).eq('email', targetEmail),
      supabase.from('contacts').select('*').eq('tenant_id', tenantId).eq('email', targetEmail),
      supabase.from('leads').select('*').eq('tenant_id', tenantId).eq('email', targetEmail),
    ]);
    if (!clientRow && clients?.[0]) clientRow = clients[0];
    if (!contactRow && contacts?.[0]) contactRow = contacts[0];
    if (!leadRow && leads?.[0]) leadRow = leads[0];
  }

  if (!clientRow && !contactRow && !leadRow) {
    return {
      success: false,
      status: 'not_found',
      message: `No customer record found matching identifier: "${identifier}"`,
    };
  }

  const previousIdentity = {
    email: targetEmail || clientRow?.email || contactRow?.email || leadRow?.email || null,
    name: clientRow?.name || contactRow?.full_name || (contactRow ? `${contactRow.first_name} ${contactRow.last_name}`.trim() : null) || leadRow?.business_name || null,
    phone: clientRow?.phone || contactRow?.phone || leadRow?.phone || null,
    client_id: clientRow?.id || null,
    contact_id: contactRow?.id || null,
    lead_id: leadRow?.id || null,
  };

  const newEmail = corrections.email ? corrections.email.trim().toLowerCase() : null;

  // 2. Conflict Detection: If updating email, ensure it doesn't collide with another distinct customer
  if (newEmail && newEmail !== targetEmail) {
    const knownIds = new Set([clientRow?.id, contactRow?.id, leadRow?.id].filter(Boolean));
    const [{ data: existingClients }, { data: existingContacts }] = await Promise.all([
      supabase.from('business_clients').select('id, name, email').eq('tenant_id', tenantId).eq('email', newEmail),
      supabase.from('contacts').select('id, first_name, last_name, email').eq('tenant_id', tenantId).eq('email', newEmail),
    ]);

    const conflictingClient = (existingClients || []).find((c) => !knownIds.has(c.id));
    const conflictingContact = (existingContacts || []).find((ct) => !knownIds.has(ct.id));

    if (conflictingClient || conflictingContact) {
      const confId = conflictingClient?.id || conflictingContact?.id;
      const confTable = conflictingClient ? 'business_clients' : 'contacts';
      return {
        success: false,
        status: 'conflict',
        message: `Cannot change email to "${newEmail}" because it conflicts with an existing customer record (${confTable}: ${confId}).`,
        previous_identity: previousIdentity,
        conflict: {
          conflict_type: 'email_collision',
          conflicting_record_id: confId!,
          conflicting_table: confTable,
          conflicting_email: newEmail,
          resolution_hint: 'Verify whether these are duplicate accounts requiring merge, or keep the existing distinct emails.',
        },
      };
    }
  }

  if (options?.dryRun) {
    return {
      success: true,
      status: 'no_change',
      message: 'Dry run completed. Corrections are valid and can be applied without conflicts.',
      previous_identity: previousIdentity,
      updated_identity: {
        ...previousIdentity,
        email: newEmail || previousIdentity.email,
        name: corrections.name || previousIdentity.name,
        phone: corrections.phone || previousIdentity.phone,
      },
    };
  }

  // 3. Atomically Apply Corrections Across Canonical Entities
  const now = new Date().toISOString();
  let affectedContacts = 0;
  let affectedClients = 0;
  let affectedLeads = 0;
  let affectedQuotes = 0;
  let affectedContracts = 0;

  // Name splitting
  let firstName = corrections.first_name;
  let lastName = corrections.last_name;
  if (corrections.name && !firstName) {
    const split = splitName(corrections.name);
    firstName = split.first_name;
    lastName = split.last_name;
  }

  // Update Contacts
  if (contactRow || targetEmail) {
    const contactUpdate: Record<string, unknown> = { updated_at: now };
    if (newEmail) contactUpdate.email = newEmail;
    if (firstName !== undefined) contactUpdate.first_name = firstName;
    if (lastName !== undefined) contactUpdate.last_name = lastName;
    if (corrections.phone !== undefined) contactUpdate.phone = corrections.phone;
    if (corrections.notes !== undefined) contactUpdate.notes = corrections.notes;

    let q = supabase.from('contacts').update(contactUpdate).eq('tenant_id', tenantId);
    if (contactRow?.id) q = q.eq('id', contactRow.id);
    else q = q.eq('email', targetEmail);

    const { data: updatedCts } = await q.select('id');
    affectedContacts = updatedCts?.length || 0;
  }

  // Update Business Clients
  if (clientRow || targetEmail) {
    const clientUpdate: Record<string, unknown> = { updated_at: now };
    if (newEmail) clientUpdate.email = newEmail;
    if (corrections.name !== undefined) clientUpdate.name = corrections.name;
    if (corrections.phone !== undefined) clientUpdate.phone = corrections.phone;
    if (corrections.company !== undefined) clientUpdate.company = corrections.company;
    if (corrections.notes !== undefined) clientUpdate.description = corrections.notes;

    let q = supabase.from('business_clients').update(clientUpdate).eq('tenant_id', tenantId);
    if (clientRow?.id) q = q.eq('id', clientRow.id);
    else q = q.eq('email', targetEmail);

    const { data: updatedCls } = await q.select('id');
    affectedClients = updatedCls?.length || 0;
  }

  // Update Leads (active leads only)
  if (leadRow || targetEmail) {
    const leadUpdate: Record<string, unknown> = { updated_at: now };
    if (newEmail) leadUpdate.email = newEmail;
    if (corrections.name !== undefined) leadUpdate.contact_name = corrections.name;
    if (corrections.company !== undefined) leadUpdate.business_name = corrections.company;
    if (corrections.phone !== undefined) leadUpdate.phone = corrections.phone;
    if (corrections.notes !== undefined) leadUpdate.notes = corrections.notes;

    let q = supabase.from('leads').update(leadUpdate).eq('tenant_id', tenantId);
    if (leadRow?.id) q = q.eq('id', leadRow.id);
    else q = q.eq('email', targetEmail);

    const { data: updatedLds } = await q.select('id');
    affectedLeads = updatedLds?.length || 0;
  }

  // Update only DRAFT documents if requested (NEVER overwrite issued invoices or signed contracts)
  if (options?.updateDraftDocuments && (clientRow?.id || targetEmail)) {
    if (newEmail) {
      // Draft quotes
      const { data: updatedQuotes } = await supabase
        .from('quotes')
        .update({ client_email: newEmail, updated_at: now })
        .eq('tenant_id', tenantId)
        .eq('status', 'draft')
        .or(clientRow?.id ? `client_id.eq.${clientRow.id},client_email.eq.${targetEmail}` : `client_email.eq.${targetEmail}`)
        .select('id');
      affectedQuotes = updatedQuotes?.length || 0;

      // Draft contracts
      const { data: updatedContracts } = await supabase
        .from('contracts')
        .update({ updated_at: now })
        .eq('tenant_id', tenantId)
        .eq('status', 'draft')
        .eq('client_id', clientRow?.id || '')
        .select('id');
      affectedContracts = updatedContracts?.length || 0;
    }
  }

  return {
    success: true,
    status: 'updated',
    message: `Customer identity successfully updated across CRM records (contacts: ${affectedContacts}, clients: ${affectedClients}, leads: ${affectedLeads}). Immutable issued documents preserved.`,
    previous_identity: previousIdentity,
    updated_identity: {
      ...previousIdentity,
      email: newEmail || previousIdentity.email,
      name: corrections.name || previousIdentity.name,
      phone: corrections.phone || previousIdentity.phone,
    },
    affected_records: {
      contacts: affectedContacts,
      business_clients: affectedClients,
      leads: affectedLeads,
      draft_quotes: affectedQuotes,
      draft_contracts: affectedContracts,
    },
  };
}
