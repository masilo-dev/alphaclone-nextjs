import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

const schema = z.object({
  tenantId: z.string().uuid(), versionId: z.string().uuid(), publicUrl: z.string().url().refine((url) => url.startsWith('https://')),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ policyId: string }> },
) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    const { policyId } = await context.params;
    const { user } = await requireTenantAccess(parsed.data.tenantId);
    const admin = createAdminSupabaseClientOrThrow();
    const { data: version, error: readError } = await admin.from('legal_policy_versions').select('id,status')
      .eq('id', parsed.data.versionId).eq('policy_id', policyId).eq('tenant_id', parsed.data.tenantId).single();
    if (readError) throw readError;
    if (version.status !== 'approved') {
      return NextResponse.json({ error: 'Only an approved policy version can be published', code: 'APPROVAL_REQUIRED' }, { status: 409 });
    }
    await admin.from('legal_policy_versions').update({ status: 'superseded' })
      .eq('policy_id', policyId).eq('tenant_id', parsed.data.tenantId).eq('status', 'published').neq('id', version.id);
    const publishedAt = new Date().toISOString();
    const { error: updateError } = await admin.from('legal_policy_versions').update({
      status: 'published', published_at: publishedAt, public_url: parsed.data.publicUrl,
    }).eq('id', version.id).eq('tenant_id', parsed.data.tenantId);
    if (updateError) throw updateError;
    const { error: publicationError } = await admin.from('legal_policy_publications').insert({
      tenant_id: parsed.data.tenantId, policy_version_id: version.id, public_url: parsed.data.publicUrl,
      published_by: user.id, published_at: publishedAt,
    });
    if (publicationError) throw publicationError;
    return NextResponse.json({ published: true, versionId: version.id, publishedAt });
  } catch (error) {
    return routeErrorResponse(error, 'Unable to publish policy', request);
  }
}
