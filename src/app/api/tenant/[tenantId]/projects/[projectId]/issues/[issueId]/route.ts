import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const patchSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  resolution: z.string().trim().max(5000).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ tenantId: string; projectId: string; issueId: string }> }
) {
  try {
    const { tenantId, projectId, issueId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    if (!z.string().uuid().safeParse(projectId).success || !z.string().uuid().safeParse(issueId).success) {
      return NextResponse.json({ error: 'Valid projectId and issueId required' }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid issue update', details: parsed.error.flatten() }, { status: 422 });
    }
    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const updates: Record<string, unknown> = {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    };
    if (parsed.data.status === 'resolved' || parsed.data.status === 'closed') {
      updates.resolution = parsed.data.resolution ?? 'Resolved via workspace';
    }

    const { data, error } = await admin
      .from('project_issues')
      .update(updates)
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .eq('id', issueId)
      .is('deleted_at', null)
      .select('id, title, description, severity, status, task_id, created_at, updated_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });

    if (parsed.data.status === 'resolved') {
      await admin.from('business_automation_events').insert({
        tenant_id: tenantId,
        event_type: 'project_issue_resolved',
        payload: { projectId, issueId, actorUserId: user.id },
      });
    }

    return NextResponse.json({ issue: data });
  } catch (error) {
    return routeErrorResponse(error, 'Project issue could not be updated', req);
  }
}
