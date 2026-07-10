import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';
import { bootstrapTenantForUser } from '@/lib/tenant/bootstrapTenantServer';

const bodySchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    slug: z.string().min(1).max(100).optional(),
    plan: z.string().optional(),
  })
  .optional();

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const admin = createSupabaseAdminClient();

    const { tenantId, created } = await bootstrapTenantForUser(admin, user, body);

    const { data: tenant, error } = await admin
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .maybeSingle();

    if (error || !tenant) {
      return NextResponse.json({ error: 'Tenant created but could not be loaded' }, { status: 500 });
    }

    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata || {}),
        tenant_id: tenantId,
      },
    });

    return NextResponse.json({ success: true, created, tenant });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to bootstrap tenant', req);
  }
}
