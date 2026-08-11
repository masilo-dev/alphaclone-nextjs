import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
type Context = { params: Promise<{ id: string }> };
const inputSchema = z.object({
  workspaceId: z.string().uuid(), decision: z.enum(['accepted', 'rejected']),
  reason: z.string().trim().max(500).optional(),
});

function toLeadInsertFromCandidate(c: Record<string, unknown>, tenantId: string, ownerId: string) {
  const email = String(c.public_email || c.email || (c.raw_data as Record<string, unknown> | null)?.email || '').trim() || null;
  const phone = String(c.public_phone || c.phone || (c.raw_data as Record<string, unknown> | null)?.phone || '').trim() || null;
  const businessName = String(c.business_name || c.company || c.name || '').trim() || null;
  const website = String(c.website || (c.raw_data as Record<string, unknown> | null)?.website || '').trim() || null;
  const qualityScore = typeof c.quality_score === 'number' ? c.quality_score : 0;
  const fitScore = typeof c.fit_score === 'number' ? c.fit_score : 0;
  const confidence = typeof c.confidence_score === 'number' ? c.confidence_score : 0;
  const totalScore = Math.round((qualityScore * 0.5) + (fitScore * 0.35) + (confidence * 0.15));
  const stage =
    totalScore >= 75 ? 'qualified' :
    totalScore >= 50 ? 'prospect' :
    totalScore >= 25 ? 'lead' : 'lead';

  const notesParts: string[] = [];
  if (c.description) notesParts.push(String(c.description));
  if (typeof c.score_explanation === 'string' && c.score_explanation) notesParts.push(`Fit: ${c.score_explanation}`);
  if (c.city || c.country || c.industry) {
    const meta = [c.city, c.country].filter(Boolean).join(', ');
    if (meta || c.industry) notesParts.push([c.industry, meta].filter(Boolean).join(' · '));
  }
  if (c.source_url || c.source_type) {
    const srcParts = [c.source_type && `Source: ${c.source_type}`, c.source_url && String(c.source_url)].filter(Boolean);
    if (srcParts.length) notesParts.push(srcParts.join(' — '));
  }

  return {
    tenant_id: tenantId,
    owner_id: ownerId,
    business_name: businessName || 'Discovered business',
    industry: c.industry ? String(c.industry) : null,
    location: [c.city, c.country].filter(Boolean).join(', ') || null,
    phone: phone,
    email: email,
    website: website,
    source: `Lead Finder:${String(c.source_type || c.search_id || 'discovery')}`,
    stage,
    value: 0,
    notes: notesParts.length ? notesParts.join('\n\n') : null,
    outreach_status: 'pending',
    is_verified: Boolean(email || phone || website),
    trust_score: Math.max(0, Math.min(100, totalScore)),
    verification_notes:
      c.verification_status ? `Lead Finder verification: ${String(c.verification_status)}` : null,
    metadata: {
      lead_candidate_id: String(c.id || ''),
      lead_search_id: c.search_id ? String(c.search_id) : null,
      source: {
        type: c.source_type ? String(c.source_type) : null,
        external_id: c.source_external_id ? String(c.source_external_id) : null,
        url: c.source_url ? String(c.source_url) : null,
      },
      scores: {
        quality: qualityScore,
        fit: fitScore,
        confidence,
      },
    },
  };
}

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

    let syncedLead: Record<string, unknown> | null = null;
    if (input.decision === 'accepted') {
      const candidate = (data || {}) as Record<string, unknown>;
      const payload = toLeadInsertFromCandidate(candidate, input.workspaceId, user.id);
      const { data: inserted, error: leadInsertError } = await admin
        .from('leads')
        .upsert(payload, {
          onConflict: 'tenant_id,email',
          ignoreDuplicates: false,
        })
        .select()
        .maybeSingle();
      if (leadInsertError && leadInsertError.code !== '23505') throw leadInsertError;
      syncedLead = (inserted as Record<string, unknown> | null) || null;

      if (syncedLead?.id) {
        const { error: linkError } = await admin
          .from('lead_candidates')
          .update({ synced_lead_id: String(syncedLead.id), updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('workspace_id', input.workspaceId);
        void linkError;
      }
    }

    const { error: activityError } = await admin.from('lead_candidate_activities').insert({
      workspace_id: input.workspaceId, created_by: user.id, actor_id: user.id, candidate_id: id,
      activity_type: input.decision, title: `Candidate ${input.decision}`, description: input.reason,
    });
    if (activityError) throw activityError;

    return NextResponse.json({
      candidate: data,
      syncedLead: syncedLead || undefined,
    });
  } catch (error) { return routeErrorResponse(error, 'Failed to review candidate', req); }
}
