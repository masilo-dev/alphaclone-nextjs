import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { verifyEmail, batchVerifyEmails } from '@/lib/outbound/emailVerification';

const verifySchema = z.object({
  tenantId: z.string().uuid(),
  email: z.string().email().max(320),
  provider: z.enum(['dns_mx', 'manual']).default('dns_mx'),
  forceRefresh: z.boolean().default(false),
  manualStatus: z.enum(['valid', 'invalid', 'risky', 'catch_all', 'unknown']).optional(),
});

const batchSchema = z.object({
  tenantId: z.string().uuid(),
  emails: z.array(z.string().email().max(320)).min(1).max(50),
});

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId') || '';
    const email = request.nextUrl.searchParams.get('email') || '';
    if (!z.string().uuid().safeParse(tenantId).success) {
      return NextResponse.json({ error: 'Valid tenantId required' }, { status: 400 });
    }
    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }
    await requireTenantAccess(tenantId, request);

    const admin = (await import('@/lib/supabase-admin')).createSupabaseAdminClient();
    const normalized = email.trim().toLowerCase();
    const { data } = await admin
      .from('outbound_email_verifications')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('normalized_email', normalized)
      .maybeSingle();

    return NextResponse.json({ success: true, verification: data || null });
  } catch (error) {
    return routeErrorResponse(error, 'Email verification could not be loaded', request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    // Batch mode
    if (Array.isArray(body.emails)) {
      const parsed = batchSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid batch verification input', details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      await requireTenantAccess(parsed.data.tenantId, request);
      const results = await batchVerifyEmails(parsed.data.tenantId, parsed.data.emails);
      return NextResponse.json({ success: true, results });
    }

    // Single verification
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid verification input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    await requireTenantAccess(parsed.data.tenantId, request);
    const result = await verifyEmail(parsed.data.tenantId, parsed.data.email, {
      provider: parsed.data.provider,
      forceRefresh: parsed.data.forceRefresh,
      manualStatus: parsed.data.manualStatus,
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return routeErrorResponse(error, 'Email verification failed', request);
  }
}
