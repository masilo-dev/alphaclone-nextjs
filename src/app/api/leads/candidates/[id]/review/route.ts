import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { buildLeadQualification } from '@/lib/lead-finder/qualificationEngine';
import { promoteToCanonicalLead } from '@/services/leads/canonicalLeadPromotion';

type Context = { params: Promise<{ id: string }> };
const inputSchema = z.object({
  workspaceId: z.string().uuid(),
  decision: z.enum(['accepted', 'rejected']),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(req: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const input = inputSchema.parse(await req.json());
    const { user, admin } = await requireTenantRole(
      input.workspaceId,
      ['owner', 'admin', 'tenant_admin', 'super_admin'],
      req
    );

    if (input.decision === 'accepted') {
      const { data: candidateForGate, error: candidateForGateError } = await admin
        .from('lead_candidates')
        .select('*')
        .eq('workspace_id', input.workspaceId)
        .eq('id', id)
        .maybeSingle();
      if (candidateForGateError) throw candidateForGateError;
      if (!candidateForGate) {
        return NextResponse.json({ error: 'Candidate not found', code: 'LEAD_NOT_FOUND' }, { status: 404 });
      }
      const qualification = buildLeadQualification(candidateForGate as Record<string, unknown>);
      if (!qualification.qualified) {
        return NextResponse.json(
          {
            error: 'This candidate needs verified business and contact evidence before it can enter CRM.',
            code: qualification.disqualification_reasons.includes('LEAD_EMAIL_REQUIRED')
              ? 'LEAD_EMAIL_REQUIRED'
              : 'LEAD_QUALIFICATION_FAILED',
            hardGateResults: qualification.hard_gate_results,
          },
          { status: 422 }
        );
      }
    }

    const now = new Date().toISOString();
    const update =
      input.decision === 'accepted'
        ? { review_status: 'accepted', accepted_at: now, rejected_at: null, rejection_reason: null }
        : {
            review_status: 'rejected',
            rejected_at: now,
            rejection_reason: input.reason || 'Rejected by reviewer',
          };

    const { data, error } = await admin
      .from('lead_candidates')
      .update({ ...update, updated_at: now })
      .eq('workspace_id', input.workspaceId)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    let syncedLead: Record<string, unknown> | undefined;
    if (input.decision === 'accepted') {
      const promotion = await promoteToCanonicalLead({
        admin,
        tenantId: input.workspaceId,
        ownerId: user.id,
        source: {
          kind: 'lead_candidate',
          candidateId: id,
          candidate: (data || {}) as Record<string, unknown>,
        },
        idempotencyKey: `lead-candidate-review:${input.workspaceId}:${id}`,
        skipQualificationGate: true,
      });
      syncedLead = promotion.lead;
    }

    const { error: activityError } = await admin.from('lead_candidate_activities').insert({
      workspace_id: input.workspaceId,
      created_by: user.id,
      actor_id: user.id,
      candidate_id: id,
      activity_type: input.decision,
      title: `Candidate ${input.decision}`,
      description: input.reason,
    });
    if (activityError) throw activityError;

    return NextResponse.json({
      candidate: data,
      syncedLead: syncedLead || undefined,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to review candidate', req);
  }
}
