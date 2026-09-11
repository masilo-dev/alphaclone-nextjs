import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { isExecutionFeatureEnabled } from '@/lib/projects/executionFeatureFlags';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ tenantId: string }> },
) {
  try {
    const { tenantId } = await context.params;
    await requireTenantAccess(tenantId, req);
    const admin = createSupabaseAdminClient();

    const enabled = await isExecutionFeatureEnabled(admin, 'PROJECTS_V2', tenantId);
    if (!enabled) {
      return NextResponse.json({ error: 'Projects V2 is not enabled for this workspace' }, { status: 404 });
    }

    const url = new URL(req.url);
    const templateId = url.searchParams.get('templateId');

    if (templateId) {
      const { data: template, error: templateError } = await admin
        .from('project_templates')
        .select('id, name, description, template_key, version, is_active, metadata, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .eq('id', templateId)
        .eq('is_active', true)
        .maybeSingle();
      if (templateError) throw templateError;
      if (!template) return NextResponse.json({ error: 'Project template not found' }, { status: 404 });

      const [{ data: phases, error: phasesError }, { data: tasks, error: tasksError }, { data: dependencies, error: dependenciesError }] = await Promise.all([
        admin
          .from('project_template_phases')
          .select('id, template_id, name, description, order_index, relative_days_from_start, metadata')
          .eq('tenant_id', tenantId)
          .eq('template_id', templateId)
          .order('order_index'),
        admin
          .from('project_template_tasks')
          .select('id, template_id, phase_id, task_key, title, description, priority, relative_start_days, relative_due_days, weight, requires_approval, order_index, metadata')
          .eq('tenant_id', tenantId)
          .eq('template_id', templateId)
          .order('order_index'),
        admin
          .from('project_template_dependencies')
          .select('task_key, depends_on_task_key, dependency_type, lag_minutes')
          .eq('tenant_id', tenantId)
          .eq('template_id', templateId),
      ]);
      if (phasesError) throw phasesError;
      if (tasksError) throw tasksError;
      if (dependenciesError) throw dependenciesError;

      return NextResponse.json({ template, phases: phases || [], tasks: tasks || [], dependencies: dependencies || [] });
    }

    const { data, error } = await admin
      .from('project_templates')
      .select('id, name, description, template_key, version, is_active, metadata, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name');
    if (error) throw error;

    return NextResponse.json({ templates: data || [] });
  } catch (error) {
    return routeErrorResponse(error, 'Project templates could not be loaded', req);
  }
}
