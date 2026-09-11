import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = String(body.tenantId || '').trim();
    const actorUrn = String(body.actorUrn || body.actor || '').trim();
    const commentText = String(body.commentText || body.text || '').trim();
    const postCaption = String(body.postCaption || '').trim();

    if (!tenantId || !actorUrn) {
      return NextResponse.json({ error: 'tenantId and actorUrn are required' }, { status: 400 });
    }

    const { admin } = await requireTenantAccess(tenantId);

    const displayName = actorUrn.includes(':') ? actorUrn.split(':').pop() : actorUrn;
    const { data: lead, error } = await admin
      .from('leads')
      .insert({
        tenant_id: tenantId,
        business_name: `LinkedIn: ${displayName}`,
        source: 'linkedin_comment',
        status: 'new',
        notes: commentText || `Engaged on post: ${postCaption.slice(0, 120)}`,
        metadata: { linkedin_actor_urn: actorUrn, post_caption: postCaption },
      })
      .select('id')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, leadId: lead.id });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to capture LinkedIn lead', req);
  }
}
