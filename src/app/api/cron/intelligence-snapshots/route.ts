import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { integratedIntelligenceService } from '@/services/intelligence/integratedIntelligenceService';

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
    const snapshot = await integratedIntelligenceService.generateSnapshot(supabase, tenantId, { persist: true });

    return NextResponse.json({
      success: true,
      tenantId,
      generatedAt: snapshot.generatedAt,
      overallScore: snapshot.overallScore
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to generate snapshot' },
      { status: 500 }
    );
  }
}
