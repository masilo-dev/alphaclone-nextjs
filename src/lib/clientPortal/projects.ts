import type { SupabaseClient } from '@supabase/supabase-js';

export async function loadClientProjects(admin: SupabaseClient, tenantId: string, clientId: string) {
  const results = await Promise.all(['projects', 'business_projects'].map(table => admin.from(table).select('*').eq('tenant_id', tenantId).eq('client_id', clientId).order('updated_at', {ascending:false})));
  const rows = new Map<string, any>();
  for (const result of results) {
    // The legacy table may not exist. Other failures must never look like emptiness.
    if (result.error && !['42P01', 'PGRST205'].includes(result.error.code)) throw result.error;
    for (const row of result.data || []) {
      if (row.deleted_at || row.metadata?.client_visible === false || rows.has(row.id)) continue;
      rows.set(row.id, row);
    }
  }
  return [...rows.values()];
}
export async function loadClientProjectDetails(admin: SupabaseClient, tenantId: string, projectId: string) {
  const results = await Promise.all([
    admin.from('project_milestones').select('*').eq('tenant_id', tenantId).eq('project_id', projectId).order('order_index'),
    admin.from('tasks').select('*').eq('tenant_id', tenantId).or(`project_id.eq.${projectId},related_to_project.eq.${projectId}`).order('created_at'),
    admin.from('project_deliverables').select('*').eq('tenant_id', tenantId).eq('project_id', projectId).order('created_at'),
  ]);
  for (const result of results) if (result.error) throw result.error;
  const publicItems = (rows: any[]) => (rows || []).filter(row => !row.deleted_at && row.metadata?.client_visible !== false).map(row => ({id:String(row.id),name:String(row.name || row.title || 'Item'),status:String(row.status || 'pending'),dueDate:row.due_date || row.target_date || null,progress:Number(row.progress_percent || 0)}));
  return {milestones:publicItems(results[0].data || []),tasks:publicItems(results[1].data || []),deliverables:publicItems(results[2].data || [])};
}
