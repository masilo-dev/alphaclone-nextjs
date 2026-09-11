import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

const schema = z.object({
  tenantId: z.string().uuid(), versionNumber: z.string().min(1), language: z.string().min(2).default('en'),
  jurisdiction: z.string().min(2).default('global'), content: z.string().min(20),
  changeSummary: z.string().max(1000), effectiveAt: z.string().datetime().optional(),
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
    const { data: previous } = await admin.from('legal_policy_versions').select('id')
      .eq('tenant_id', parsed.data.tenantId).eq('policy_id', policyId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const integrityHash = createHash('sha256').update([
      policyId, parsed.data.versionNumber, parsed.data.language, parsed.data.jurisdiction, parsed.data.content,
    ].join('\u001f')).digest('hex');
    const { data, error } = await admin.from('legal_policy_versions').insert({
      tenant_id: parsed.data.tenantId, policy_id: policyId, version_number: parsed.data.versionNumber,
      language: parsed.data.language, jurisdiction: parsed.data.jurisdiction, content: parsed.data.content,
      change_summary: parsed.data.changeSummary, effective_at: parsed.data.effectiveAt,
      previous_version_id: previous?.id, created_by: user.id, integrity_hash: integrityHash,
    }).select('*').single();
    if (error) throw error;
    return NextResponse.json({ version: data }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Unable to create policy version', request);
  }
}
