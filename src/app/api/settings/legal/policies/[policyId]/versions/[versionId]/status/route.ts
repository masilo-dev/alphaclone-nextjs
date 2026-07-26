import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';

const schema = z.object({
  tenantId: z.string().uuid(),
  status: z.enum(['in_review', 'approved', 'archived']),
});

const transitions: Record<string, string[]> = {
  draft: ['in_review', 'archived'],
  in_review: ['approved', 'archived'],
  approved: ['archived'],
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ policyId: string; versionId: string }> },
) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    const { policyId, versionId } = await context.params;
    const { user } = await requireTenantRole(parsed.data.tenantId, ['owner', 'admin', 'tenant_admin'], request);
    const admin = createAdminSupabaseClientOrThrow();
    const { data: current, error: readError } = await admin.from('legal_policy_versions').select('status')
      .eq('id', versionId).eq('policy_id', policyId).eq('tenant_id', parsed.data.tenantId).maybeSingle();
    if (readError) throw readError;
    if (!current) return NextResponse.json({ error: 'Policy version not found.' }, { status: 404 });
    if (!transitions[current.status]?.includes(parsed.data.status)) {
      return NextResponse.json({ error: `A ${current.status} version cannot move to ${parsed.data.status}.` }, { status: 409 });
    }
    const patch = parsed.data.status === 'approved'
      ? { status: parsed.data.status, approved_by: user.id }
      : { status: parsed.data.status };
    const { data, error } = await admin.from('legal_policy_versions').update(patch)
      .eq('id', versionId).eq('tenant_id', parsed.data.tenantId).select('*').single();
    if (error) throw error;
    return NextResponse.json({ version: data });
  } catch (error) {
    return routeErrorResponse(error, 'Unable to update policy review status', request);
  }
}
