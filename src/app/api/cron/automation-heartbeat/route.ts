import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { getChiefOfStaffLastRunAt } from '@/lib/automation/chiefOfStaffRunner';
import { notifyTenantOwner } from '@/lib/automation/platformHardening';

export const dynamic = 'force-dynamic';

const HEARTBEAT_HOURS = 26;

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  const supabase = createSupabaseAdminClient();
  const cutoff = Date.now() - HEARTBEAT_HOURS * 60 * 60 * 1000;
  const alerts: Array<{ tenantId: string; lastRunAt: string | null }> = [];

  try {
    const { data: tenants, error } = await supabase.from('tenants').select('id').limit(1000);
    if (error) throw error;

    for (const tenant of tenants || []) {
      const lastRunAt = await getChiefOfStaffLastRunAt(tenant.id);
      const stale = !lastRunAt || new Date(lastRunAt).getTime() < cutoff;

      if (stale) {
        alerts.push({ tenantId: tenant.id, lastRunAt });
        await notifyTenantOwner(tenant.id, {
          title: 'Automation heartbeat: Chief of Staff missed',
          message: lastRunAt
            ? `run_chief_of_staff_routine last ran at ${lastRunAt}. Expected at least once every 24h.`
            : 'run_chief_of_staff_routine has no recorded runs. Daily automation may be dormant.',
          link: '/dashboard/settings/automation',
          sendEmail: true,
        });
      }
    }

    return NextResponse.json({
      success: true,
      stale_tenants: alerts.length,
      alerts,
      checked_at: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
