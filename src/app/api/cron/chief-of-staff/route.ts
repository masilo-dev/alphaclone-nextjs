import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { runChiefOfStaffForTenant } from '@/lib/automation/chiefOfStaffRunner';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  const supabase = createSupabaseAdminClient();

  try {
    const { data: tenants, error } = await supabase.from('tenants').select('id').limit(1000);
    if (error) throw error;

    const results: Array<{ tenantId: string; success: boolean; error?: string }> = [];

    for (const tenant of tenants || []) {
      try {
        const outcome = await runChiefOfStaffForTenant(tenant.id);
        results.push({
          tenantId: tenant.id,
          success: outcome.success,
          error: outcome.success ? undefined : String(outcome.error || outcome.result?.content?.[0]?.text || 'failed'),
        });
      } catch (tenantErr: unknown) {
        const message = tenantErr instanceof Error ? tenantErr.message : String(tenantErr);
        results.push({ tenantId: tenant.id, success: false, error: message });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
