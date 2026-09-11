import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

const createSchema = z.object({
  tenantId: z.string().uuid(),
  brandId: z.string().uuid().optional(),
  policyType: z.string().min(2).max(80),
  title: z.string().min(2).max(180),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  versionNumber: z.string().min(1).max(30),
  language: z.string().min(2).max(12).default('en'),
  jurisdiction: z.string().min(2).max(80).default('global'),
  content: z.string().min(20),
  changeSummary: z.string().max(1000).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const tenantId = new URL(request.url).searchParams.get('tenantId') || '';
    await requireTenantAccess(tenantId);
    const admin = createAdminSupabaseClientOrThrow();
    const { data, error } = await admin.from('legal_policies')
      .select('*, legal_policy_versions(*)').eq('tenant_id', tenantId).order('updated_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ policies: data || [] });
  } catch (error) {
    return routeErrorResponse(error, 'Unable to load legal policies', request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }
    const { user } = await requireTenantAccess(parsed.data.tenantId);
    const admin = createAdminSupabaseClientOrThrow();
    const { data: policy, error: policyError } = await admin.from('legal_policies').insert({
      tenant_id: parsed.data.tenantId, brand_id: parsed.data.brandId, policy_type: parsed.data.policyType,
      title: parsed.data.title, slug: parsed.data.slug, owner_user_id: user.id,
    }).select('id').single();
    if (policyError) throw policyError;
    const integrityHash = createHash('sha256').update([
      parsed.data.policyType, parsed.data.versionNumber, parsed.data.language,
      parsed.data.jurisdiction, parsed.data.content,
    ].join('\u001f')).digest('hex');
    const { data: version, error: versionError } = await admin.from('legal_policy_versions').insert({
      tenant_id: parsed.data.tenantId, policy_id: policy.id, version_number: parsed.data.versionNumber,
      language: parsed.data.language, jurisdiction: parsed.data.jurisdiction, content: parsed.data.content,
      change_summary: parsed.data.changeSummary, created_by: user.id, integrity_hash: integrityHash,
    }).select('*').single();
    if (versionError) {
      await admin.from('legal_policies').delete().eq('id', policy.id).eq('tenant_id', parsed.data.tenantId);
      throw versionError;
    }
    return NextResponse.json({ policyId: policy.id, version }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Unable to create legal policy', request);
  }
}
