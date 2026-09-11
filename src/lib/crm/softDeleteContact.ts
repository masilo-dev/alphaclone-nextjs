import type { SupabaseClient } from '@supabase/supabase-js';

export type SoftDeleteResult = { error: string | null };

/**
 * Soft-delete a contact and archive any linked business_client row.
 */
export async function softDeleteContactById(
  supabase: SupabaseClient,
  tenantId: string,
  contactId: string,
  updatedBy?: string | null
): Promise<SoftDeleteResult> {
  const now = new Date().toISOString();
  const contactUpdate: Record<string, unknown> = {
    deleted_at: now,
    status: 'inactive',
    updated_at: now,
  };
  if (updatedBy) contactUpdate.updated_by = updatedBy;

  const { error: contactError } = await supabase
    .from('contacts')
    .update(contactUpdate)
    .eq('id', contactId)
    .eq('tenant_id', tenantId);

  if (contactError) return { error: contactError.message };

  await supabase
    .from('business_clients')
    .update({ is_active: false })
    .eq('crm_contact_id', contactId)
    .eq('tenant_id', tenantId);

  return { error: null };
}

/**
 * Archive a business_client and soft-delete any linked contact row.
 */
export async function softDeleteClientById(
  supabase: SupabaseClient,
  tenantId: string,
  clientId: string,
  updatedBy?: string | null
): Promise<SoftDeleteResult> {
  const { data: client, error: fetchError } = await supabase
    .from('business_clients')
    .select('id, is_active, crm_contact_id')
    .eq('id', clientId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!client) return { error: 'Client not found' };
  if (!client.is_active) return { error: 'Client is already archived' };

  const { error: archiveError } = await supabase
    .from('business_clients')
    .update({ is_active: false })
    .eq('id', clientId)
    .eq('tenant_id', tenantId);

  if (archiveError) return { error: archiveError.message };

  if (client.crm_contact_id) {
    const now = new Date().toISOString();
    const contactUpdate: Record<string, unknown> = {
      deleted_at: now,
      status: 'inactive',
      updated_at: now,
    };
    if (updatedBy) contactUpdate.updated_by = updatedBy;

    await supabase
      .from('contacts')
      .update(contactUpdate)
      .eq('id', client.crm_contact_id)
      .eq('tenant_id', tenantId);
  }

  return { error: null };
}

/**
 * Restore a soft-deleted contact and reactivate linked business_client.
 */
export async function restoreContactById(
  supabase: SupabaseClient,
  tenantId: string,
  contactId: string
): Promise<SoftDeleteResult> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('contacts')
    .update({ deleted_at: null, status: 'active', updated_at: now })
    .eq('id', contactId)
    .eq('tenant_id', tenantId);

  if (error) return { error: error.message };

  await supabase
    .from('business_clients')
    .update({ is_active: true })
    .eq('crm_contact_id', contactId)
    .eq('tenant_id', tenantId);

  return { error: null };
}

/**
 * Restore an archived business_client and linked contact.
 */
export async function restoreClientById(
  supabase: SupabaseClient,
  tenantId: string,
  clientId: string
): Promise<SoftDeleteResult> {
  const { data: client, error: fetchError } = await supabase
    .from('business_clients')
    .select('id, crm_contact_id')
    .eq('id', clientId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!client) return { error: 'Client not found' };

  const { error: restoreError } = await supabase
    .from('business_clients')
    .update({ is_active: true })
    .eq('id', clientId)
    .eq('tenant_id', tenantId);

  if (restoreError) return { error: restoreError.message };

  if (client.crm_contact_id) {
    const now = new Date().toISOString();
    await supabase
      .from('contacts')
      .update({ deleted_at: null, status: 'active', updated_at: now })
      .eq('id', client.crm_contact_id)
      .eq('tenant_id', tenantId);
  }

  return { error: null };
}

/**
 * Permanently delete a soft-deleted contact (hard delete).
 */
export async function purgeContactById(
  supabase: SupabaseClient,
  tenantId: string,
  contactId: string
): Promise<SoftDeleteResult> {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', contactId)
    .eq('tenant_id', tenantId)
    .not('deleted_at', 'is', null);

  return { error: error?.message ?? null };
}
