import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { candidateMeetsRequirements, type LeadContactRequirements } from '@/lib/lead-finder/core';
type Context = { params: Promise<{ id: string }> };
type LeadCandidateRow = Record<string, unknown> & { id: string; created_at: string };
type QualificationSnapshotRow = Record<string, unknown> & { candidate_id: string | null };

function isUnavailableSchema(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string } | null;
  const message = String(candidate?.message || '').toLowerCase();
  return candidate?.code === '42P01'
    || candidate?.code === 'PGRST205'
    || (message.includes('lead_candidates') && (message.includes('does not exist') || message.includes('schema cache')));
}

export async function GET(req: NextRequest, context: Context) {
  try {
    const { id } = await context.params; const p = req.nextUrl.searchParams;
    const workspaceId = p.get('workspaceId'); if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    const { admin } = await requireTenantAccess(workspaceId, req);
    const limit = Math.min(100, Math.max(1, Number(p.get('limit') || 50)));
    const { data: search, error: searchError } = await admin.from('lead_searches')
      .select('requirements').eq('workspace_id', workspaceId).eq('id', id).single();
    if (searchError) throw searchError;
    let query = admin.from('lead_candidates').select('*').eq('workspace_id', workspaceId)
      .eq('search_id', id).order('created_at', { ascending: false }).limit(500);
    if (p.get('cursor')) query = query.lt('created_at', p.get('cursor')!);
    if (p.get('reviewStatus')) query = query.eq('review_status', p.get('reviewStatus')!);
    const { data, error } = await query;
    if (error && isUnavailableSchema(error)) {
      return NextResponse.json(
        { candidates: [], nextCursor: null, available: false, notice: 'Lead results storage is not available for this workspace yet.' },
        { status: 200 }
      );
    }
    if (error) throw error;
    const requirements = (search?.requirements || {}) as LeadContactRequirements;
    const candidates = ((data || []) as LeadCandidateRow[]).filter((candidate) => candidateMeetsRequirements({
      business_name: String(candidate.business_name || ''),
      website: candidate.website ? String(candidate.website) : null,
      public_email: candidate.public_email ? String(candidate.public_email) : null,
      public_phone: candidate.public_phone ? String(candidate.public_phone) : null,
      facebook_url: candidate.facebook_url ? String(candidate.facebook_url) : null,
      linkedin_url: candidate.linkedin_url ? String(candidate.linkedin_url) : null,
      instagram_url: candidate.instagram_url ? String(candidate.instagram_url) : null,
    }, requirements)).slice(0, limit);
    const ids = candidates.map((candidate: LeadCandidateRow) => candidate.id);
    const { data: snapshots, error: snapshotError } = ids.length
      ? await admin.from('lead_qualification_snapshots').select('*').eq('workspace_id', workspaceId).in('candidate_id', ids)
      : { data: [], error: null };
    // The intelligence migration is additive. Existing results remain readable
    // while it is being applied or its PostgREST schema cache refreshes.
    if (snapshotError && !isUnavailableSchema(snapshotError)) throw snapshotError;
    const byCandidate = new Map(((snapshots || []) as QualificationSnapshotRow[])
      .filter((snapshot): snapshot is QualificationSnapshotRow & { candidate_id: string } => Boolean(snapshot.candidate_id))
      .map((snapshot: QualificationSnapshotRow) => [snapshot.candidate_id, snapshot]));
    return NextResponse.json({
      candidates: candidates.map((candidate: LeadCandidateRow) => ({ ...candidate, qualification: byCandidate.get(candidate.id) || null })),
      nextCursor: candidates.length === limit ? candidates.at(-1)?.created_at : null,
    });
  } catch (error) { return routeErrorResponse(error, 'Failed to load search results', req); }
}
