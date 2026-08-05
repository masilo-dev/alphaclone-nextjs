import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { calculateLinkedInPipelineMetrics } from '@/services/linkedin/pipelineMetricsService';
import { DEFAULT_TENANT_ID } from '@/lib/tenant/defaultTenant';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId') || DEFAULT_TENANT_ID;
    const adSpendParam = Number(searchParams.get('adSpend') || 0);

    const admin = createSupabaseAdminClient();
    const metrics = await calculateLinkedInPipelineMetrics(admin, tenantId, adSpendParam);

    return NextResponse.json(metrics);
  } catch (err: any) {
    console.error('[LinkedInPipelineMetricsAPI] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to calculate pipeline metrics' },
      { status: 500 }
    );
  }
}
