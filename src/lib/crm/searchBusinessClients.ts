import type { SupabaseClient } from '@supabase/supabase-js';
import { buildIlikeOrFilter } from '@/lib/db/postgrestFilters';
import { getUnifiedContacts } from '@/lib/crm/unifiedContacts';

export type BusinessClientSearchRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  industry: string | null;
  location: string | null;
  sales_stage: string | null;
  value: number | null;
  website: string | null;
  is_active: boolean;
  created_at: string;
  source: 'business_clients' | 'contacts';
};

/**
 * Search business clients and unified CRM contacts by name, email, phone, website, or location.
 */
export async function searchBusinessClients(
  supabase: SupabaseClient,
  tenantId: string,
  query: string,
  limit = 100
): Promise<BusinessClientSearchRow[]> {
  const trimmed = String(query || '').trim();
  if (!trimmed) {
    throw new Error('query is required');
  }

  const capped = Math.min(Math.max(Number(limit) || 100, 1), 1000);
  const orFilter = buildIlikeOrFilter(
    ['name', 'email', 'phone', 'website', 'location'],
    trimmed
  );

  const { data: clientRows, error: clientErr } = await supabase
    .from('business_clients')
    .select(
      'id, name, email, phone, industry, location, sales_stage, value, website, is_active, created_at'
    )
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .or(orFilter)
    .order('created_at', { ascending: false })
    .limit(capped);

  if (clientErr) throw new Error(clientErr.message);

  const unified = await getUnifiedContacts(supabase, tenantId, {
    limit: capped,
    search: trimmed,
  });

  const merged = new Map<string, BusinessClientSearchRow>();

  for (const row of clientRows || []) {
    merged.set(String(row.id), {
      id: String(row.id),
      name: String(row.name || ''),
      email: row.email ?? null,
      phone: row.phone ?? null,
      industry: row.industry ?? null,
      location: row.location ?? null,
      sales_stage: row.sales_stage ?? null,
      value: row.value ?? null,
      website: row.website ?? null,
      is_active: row.is_active !== false,
      created_at: row.created_at,
      source: 'business_clients',
    });
  }

  for (const contact of unified) {
    if (merged.has(contact.id)) continue;
    merged.set(contact.id, {
      id: contact.id,
      name: contact.full_name,
      email: contact.email,
      phone: contact.phone,
      industry: null,
      location: null,
      sales_stage: contact.lifecycle_stage,
      value: null,
      website: null,
      is_active: contact.status !== 'inactive',
      created_at: contact.created_at,
      source: 'contacts',
    });
  }

  return Array.from(merged.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, capped);
}
