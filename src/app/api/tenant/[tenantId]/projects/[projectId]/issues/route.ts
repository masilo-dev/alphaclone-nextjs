import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const createSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(5000).nullable().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional().default('high'),
  taskId: z.string().uuid().nullable().optional(),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ tenantId: string; projectId: string }> }
) {
  try {
    const { tenantId, projectId } = await context.params;
    await requireTenantAccess(tenantId, req);
    if (!z.string().uuid().safeParse(projectId).success) {
      return NextResponse.json({ error: 'Valid projectId required' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: project, error: projectError } = await admin
      .from('projects')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', projectId)
      .maybeSingle();
    if (projectError) throw projectError;
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const statusFilter = req.nextUrl.searchParams.get('status');
    let query = admin
      .from('project_issues')
      .select('id, title, description, severity, status, task_id, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (statusFilter === 'active') {
      query = query.in('status', ['open', 'in_progress']);
    } else if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ issues: data || [] });
  } catch (error) {
    return routeErrorResponse(error, 'Project issues could not be loaded', req);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ tenantId: string; projectId: string }> }
) {
  try {
    const { tenantId, projectId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    if (!z.string().uuid().safeParse(projectId).success) {
      return NextResponse.json({ error: 'Valid projectId required' }, { status: 400 });
    }

    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid issue payload', details: parsed.error.flatten() }, { status: 422 });
    }

    const admin = createSupabaseAdminClient();
    const { data: project, error: projectError } = await admin
      .from('projects')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', projectId)
      .maybeSingle();
    if (projectError) throw projectError;
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const { data, error } = await admin
      .from('project_issues')
      .insert({
        tenant_id: tenantId,
        project_id: projectId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        severity: parsed.data.severity,
        status: 'open',
        task_id: parsed.data.taskId ?? null,
        created_by: user.id,
      })
      .select('id, title, description, severity, status, task_id, created_at, updated_at')
      .single();
    if (error) throw error;

    await admin.from('business_automation_events').insert({
      tenant_id: tenantId,
      event_type: 'project_issue_logged',
      payload: { projectId, issueId: data.id, actorUserId: user.id, severity: parsed.data.severity },
    });

    return NextResponse.json({ issue: data }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Project issue could not be created', req);
  }
}
