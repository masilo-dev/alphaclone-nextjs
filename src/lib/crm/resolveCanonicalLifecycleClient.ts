import type { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function resolveCanonicalLifecycleClient(admin: ReturnType<typeof createSupabaseAdminClient>, tenantId: string, id: string): Promise<string> {
  const direct = await admin.from('business_clients').select('id').eq('tenant_id', tenantId).eq('id', id).maybeSingle();
  if (direct.error) throw direct.error;
  if (direct.data) return direct.data.id;
  const linked = await admin.from('business_clients').select('id').eq('tenant_id', tenantId).eq('crm_contact_id', id).limit(2);
  if (linked.error) throw linked.error;
  if (linked.data?.length === 1) return linked.data[0].id;
  throw Object.assign(new Error(linked.data?.length ? 'input.client_id has multiple canonical links; select a business client ID' : 'input.client_id does not resolve to a canonical client in this workspace'), {code: 'VALIDATION_ERROR'});
}

export async function assertLifecycleEmailAvailable(admin: ReturnType<typeof createSupabaseAdminClient>, tenantId: string, email: string, tables: string[]): Promise<void> {
  const pattern = email.trim().replace(/[\\%_]/g, value => `\\${value}`);
  for (const table of tables) {
    const result = await admin.from(table).select('id').eq('tenant_id', tenantId).ilike('email', pattern).limit(2);
    if (result.error) throw result.error;
    if (result.data?.length) throw Object.assign(new Error(`input.email already matches ${table} in this workspace. Select the existing record instead of creating a duplicate.`), {code: 'VALIDATION_ERROR'});
  }
}
