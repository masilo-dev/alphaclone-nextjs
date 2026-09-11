import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { entanglementModelService } from '@/services/intelligence/entanglementModelService';

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
    const model = await entanglementModelService.persistTenantModel(supabase as any, tenantId);

    return NextResponse.json({ success: true, tenantId, modelVersion: model.model_version, sampleSize: model.sample_size });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to build entanglement model' },
      { status: 500 }
    );
  }
}

