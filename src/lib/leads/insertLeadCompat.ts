import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingColumnError } from '@/lib/mcp/schemaCompat';

export type LeadInsertInput = {
  tenant_id: string;
  owner_id?: string | null;
  business_name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  industry?: string | null;
  location?: string | null;
  source?: string | null;
  notes?: string | null;
  linkedin_url?: string | null;
  status?: string;
  stage?: string;
  created_at?: string;
};

function buildFullPayload(input: LeadInsertInput, now: string): Record<string, unknown> {
  return {
    tenant_id: input.tenant_id,
    owner_id: input.owner_id ?? null,
    business_name: input.business_name,
    contact_name: input.contact_name ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    industry: input.industry ?? null,
    location: input.location ?? null,
    source: input.source ?? 'mcp_connector',
    notes: input.notes ?? null,
    linkedin_url: input.linkedin_url ?? null,
    status: input.status ?? 'new',
    stage: input.stage ?? 'new',
    created_at: input.created_at ?? now,
    updated_at: now,
  };
}

/** Payload for legacy leads tables missing optional CRM columns. */
function buildMinimalPayload(input: LeadInsertInput, now: string): Record<string, unknown> {
  return {
    tenant_id: input.tenant_id,
    owner_id: input.owner_id ?? null,
    business_name: input.business_name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    industry: input.industry ?? null,
    location: input.location ?? null,
    source: input.source ?? 'mcp_connector',
    notes: input.notes ?? null,
    stage: input.stage ?? 'new',
    created_at: input.created_at ?? now,
  };
}

/**
 * Insert a lead row, retrying with a minimal column set when optional fields
 * (updated_at, status, contact_name, linkedin_url) are absent from schema cache.
 */
export async function insertLeadWithSchemaCompat<T extends Record<string, unknown> = Record<string, unknown>>(
  supabase: SupabaseClient,
  input: LeadInsertInput,
  select = '*',
) {
  const now = new Date().toISOString();
  const full = buildFullPayload(input, now);
  let result = await supabase.from('leads').insert(full).select(select).single();

  if (result.error && isMissingColumnError(result.error)) {
    const minimal = buildMinimalPayload(input, now);
    result = await supabase.from('leads').insert(minimal).select(select).single();
  }

  return result as { data: T | null; error: typeof result.error };
}
