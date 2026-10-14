import type { SupabaseClient } from '@supabase/supabase-js';

/** Shared canonical lookup; database failures must never become empty success. */
export async function loadProjectLifecycleSummary(admin: SupabaseClient, tenantId: string, projectId: string) {
  const found = await admin.from('projects').select('*').eq('tenant_id', tenantId).eq('id', projectId).is('deleted_at', null).maybeSingle();
  if (found.error) throw found.error;
  if (!found.data) throw Object.assign(new Error('Project not found in this workspace'), {code: 'RESOURCE_NOT_FOUND'});
  const project = found.data;
  const results = await Promise.all([
    admin.from('tasks').select('*', {count:'exact'}).eq('tenant_id', tenantId).or(`project_id.eq.${projectId},related_to_project.eq.${projectId}`).is('deleted_at', null).order('created_at').limit(1000),
    admin.from('project_milestones').select('*').eq('tenant_id',tenantId).eq('project_id',projectId).is('deleted_at',null).order('order_index'),
    admin.from('project_activity').select('*').eq('tenant_id',tenantId).eq('project_id',projectId).order('created_at',{ascending:false}).limit(50),
    admin.from('contracts').select('id,title,status,lifecycle_status,project_id,client_id').eq('tenant_id',tenantId).or(project.contract_id ? `project_id.eq.${projectId},id.eq.${project.contract_id}` : `project_id.eq.${projectId}`),
    admin.from('business_invoices').select('id,invoice_number,status,total,amount_paid,balance_due,due_date,currency').eq('tenant_id',tenantId).eq('project_id',projectId),
    admin.from('business_clients').select('id,name,email').eq('tenant_id',tenantId).eq('id',project.client_id || '00000000-0000-0000-0000-000000000000').maybeSingle(),
  ]);
  for (const result of results) if (result.error) throw result.error;
  const tasks = (results[0].data || []) as any[];
  const completed = tasks.filter(t => ['completed','done'].includes(t.status));
  return {project, linked_client:results[5].data, tasks, milestones:results[1].data || [],
    linked_contracts:results[3].data || [], linked_invoices:results[4].data || [], activity:results[2].data || [],
    task_summary:{total:results[0].count ?? tasks.length,completed:completed.length,pending:tasks.length-completed.length,counts_truncated:(results[0].count ?? 0)>tasks.length},
    upcoming_deadlines:tasks.filter(t=>t.due_date && !['completed','done','cancelled','archived'].includes(t.status)).sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date))).slice(0,10),
  };
}
