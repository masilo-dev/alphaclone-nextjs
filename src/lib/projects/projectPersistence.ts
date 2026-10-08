import type { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeProjectStatus } from '@/lib/projects/projectEnums';
import { resolveCanonicalLifecycleClient } from '@/lib/crm/resolveCanonicalLifecycleClient';

export async function updatePersistedProject(supabase: ReturnType<typeof createSupabaseAdminClient>, tenantId: string, projectId: string, fields: Record<string, any>) {
  for (const key of ['id', 'tenant_id', 'metadata', 'created_by', 'created_at']) {
    if (key in fields) throw Object.assign(new Error(`input.fields.${key} cannot be changed through project updates`), {code: 'VALIDATION_ERROR'});
  }
  if (fields.client_id) fields = {...fields, client_id: await resolveCanonicalLifecycleClient(supabase, tenantId, fields.client_id)};
  for (const table of ['projects', 'business_projects']) {
    const found = await supabase.from(table).select('id').eq('tenant_id', tenantId).eq('id', projectId).maybeSingle();
    if (found.error) throw found.error;
    if (!found.data) continue;
    const patch: Record<string, any> = {...fields, updated_at: new Date().toISOString()};
    if (table === 'projects' && fields.status) {
      const status = normalizeProjectStatus(fields.status);
      if (!status) throw Object.assign(new Error('input.status is not a supported project status'), {code: 'VALIDATION_ERROR'});
      patch.status = status;
    }
    const saved = await supabase.from(table).update(patch).eq('tenant_id', tenantId).eq('id', projectId).select('*').single();
    if (saved.error) throw saved.error;
    return {...saved.data, receipt: {action_id: projectId, status: 'verified', entity_type: 'project', entity_id: projectId, timestamp: new Date().toISOString()}};
  }
  throw Object.assign(new Error('input.project_id does not resolve to a project in this workspace'), {code: 'RESOURCE_NOT_FOUND'});
}
