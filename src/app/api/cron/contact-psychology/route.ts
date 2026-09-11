import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { contactPsychologyService } from '@/services/intelligence/contactPsychologyService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Missing tenantId' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const result = await contactPsychologyService.recomputeTenant(supabase as any, tenantId, 400);

    return NextResponse.json({ success: true, tenantId, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to recompute contact psychology' },
      { status: 500 }
    );
  }
}

