import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';
import { bootstrapTenantForUser } from '@/lib/tenant/bootstrapTenantServer';
import { ENV } from '@/config/env';

const bodySchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    slug: z.string().min(1).max(100).optional(),
    plan: z.enum(['free', 'starter', 'pro', 'enterprise']).optional(),
    referralCode: z.string().min(1).max(100).optional(),
    mode: z.enum(['ensure', 'create']).optional().default('ensure'),
    idempotencyKey: z.string().uuid().optional(),
  })
  .optional();

export async function POST(req: NextRequest) {
  try {
    const { user, admin } = await requireAuthenticatedUser(req, { allowMissingProfile: true });
    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const idempotencyKey =
      req.headers.get('idempotency-key')?.trim() ||
      body?.idempotencyKey ||
      'initial-workspace-v1';
    if (idempotencyKey.length < 8 || idempotencyKey.length > 200) {
      return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 });
    }

    const { tenantId, created } = await bootstrapTenantForUser(admin, user, {
      ...body,
      idempotencyKey,
    });

    const { data: tenant, error } = await admin
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .maybeSingle();

    if (error || !tenant) {
      return NextResponse.json({ error: 'Tenant created but could not be loaded' }, { status: 500 });
    }

    // Auth admin API requires the service role key; skip in local dev when it is not configured.
    if (ENV.SUPABASE_SERVICE_ROLE_KEY) {
      const serviceAdmin = createSupabaseAdminClient();
      const { error: metadataError } = await serviceAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...(user.user_metadata || {}),
          tenant_id: tenantId,
        },
      });
      if (metadataError) {
        console.warn('[tenant/bootstrap] Failed to sync user metadata:', metadataError.message);
      }
    }

    return NextResponse.json({ success: true, created, tenant });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to bootstrap tenant', req);
  }
}
