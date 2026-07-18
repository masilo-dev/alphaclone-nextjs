import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
  try {
    const input = z.object({
      tenantId: z.string().uuid(),
      projectId: z.string().uuid(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().trim().max(4000).default(''),
    }).parse(await req.json());
    const { user } = await requireTenantAccess(input.tenantId);
    const admin = createSupabaseAdminClient();
    const { data: project, error: projectError } = await admin.from('projects')
      .select('id').eq('id', input.projectId).eq('tenant_id', input.tenantId).maybeSingle();
    if (projectError) throw projectError;
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const { data, error } = await admin.from('client_feedback').insert({
      tenant_id: input.tenantId,
      project_id: input.projectId,
      user_id: user.id,
      rating: input.rating,
      comment: input.comment,
    }).select('id').single();
    if (error) throw error;
    await admin.from('business_automation_events').insert({
      tenant_id: input.tenantId,
      event_type: 'client_feedback_submitted',
      payload: { feedbackId: data.id, projectId: input.projectId, actorUserId: user.id, rating: input.rating },
    });
    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    return routeErrorResponse(error, 'Feedback could not be submitted', req);
  }
}
