import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
type Context = { params: Promise<{ id: string }> };
const inputSchema = z.object({
  workspaceId: z.string().uuid(), decision: z.enum(['accepted', 'rejected']),
  reason: z.string().trim().max(500).optional(),
});
export async function POST(req: NextRequest, context: Context) {
  try {
    const { id } = await context.params; const input = inputSchema.parse(await req.json());
    const { user, admin } = await requireTenantRole(input.workspaceId, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);
    const now = new Date().toISOString();
    const update = input.decision === 'accepted'
      ? { review_status: 'accepted', accepted_at: now, rejected_at: null, rejection_reason: null }
      : { review_status: 'rejected', rejected_at: now, rejection_reason: input.reason || 'Rejected by reviewer' };
    const { data, error } = await admin.from('lead_candidates').update({ ...update, updated_at: now })
      .eq('workspace_id', input.workspaceId).eq('id', id).select().single();
    if (error) throw error;
    const { error: activityError } = await admin.from('lead_candidate_activities').insert({
      workspace_id: input.workspaceId, created_by: user.id, actor_id: user.id, candidate_id: id,
      activity_type: input.decision, title: `Candidate ${input.decision}`, description: input.reason,
    });
    if (activityError) throw activityError;
    return NextResponse.json({ candidate: data });
  } catch (error) { return routeErrorResponse(error, 'Failed to review candidate', req); }
}
