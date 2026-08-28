import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requirePlatformSuperAdmin, routeErrorResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

function normalizeSubscriptionStatus(raw: unknown): string {
  const value = String(raw || 'free').toLowerCase();
  if (value === 'trialing') return 'trial';
  if (value === 'canceled') return 'cancelled';
  if (!value || value === 'null') return 'free';
  return value;
}

export async function GET(req: NextRequest) {
  try {
    await requirePlatformSuperAdmin(req);
    const admin = createSupabaseAdminClient();
    const today = new Date().toISOString().slice(0, 10);

    const { data: tenants, error: tenantsError } = await admin
      .from('tenants')
      .select(
        'id, name, subscription_plan, subscription_status, stripe_customer_id, stripe_subscription_id, current_period_end, cancel_at_period_end, subscription_tier'
      )
      .is('deletion_pending_at', null)
      .order('name', { ascending: true });

    if (tenantsError && /column|does not exist/i.test(tenantsError.message || '')) {
      const fallback = await admin
        .from('tenants')
        .select('id, name, subscription_plan, subscription_status, subscription_tier, stripe_customer_id')
        .is('deletion_pending_at', null)
        .order('name', { ascending: true });
      if (fallback.error) throw fallback.error;
      const rows = (fallback.data || []).map((tenant) => ({
        tenant_id: tenant.id,
        tenant_name: tenant.name || 'Unnamed workspace',
        subscription_plan: tenant.subscription_plan || tenant.subscription_tier || 'free',
        subscription_status: normalizeSubscriptionStatus(tenant.subscription_status),
        stripe_customer_id: tenant.stripe_customer_id ?? null,
        stripe_subscription_id: null,
        current_period_end: null,
        cancel_at_period_end: false,
        total_mcp_calls_today: 0,
        total_leads_today: 0,
        total_outreach_today: 0,
      }));
      return NextResponse.json({ rows });
    }

    if (tenantsError) throw tenantsError;

    const { data: usageRows, error: usageError } = await admin
      .from('quota_usage')
      .select('tenant_id, leads, mcp_executions, outreach_actions')
      .eq('date', today);

    if (usageError && !/relation|does not exist/i.test(usageError.message || '')) {
      throw usageError;
    }

    const usageByTenant = new Map<
      string,
      { leads: number; mcp: number; outreach: number }
    >();

    for (const row of usageRows || []) {
      const tenantId = String(row.tenant_id || '');
      if (!tenantId) continue;
      const current = usageByTenant.get(tenantId) || { leads: 0, mcp: 0, outreach: 0 };
      usageByTenant.set(tenantId, {
        leads: current.leads + Number(row.leads || 0),
        mcp: current.mcp + Number(row.mcp_executions || 0),
        outreach: current.outreach + Number(row.outreach_actions || 0),
      });
    }

    const rows = (tenants || []).map((tenant) => {
      const usage = usageByTenant.get(tenant.id) || { leads: 0, mcp: 0, outreach: 0 };
      return {
        tenant_id: tenant.id,
        tenant_name: tenant.name || 'Unnamed workspace',
        subscription_plan: tenant.subscription_plan || tenant.subscription_tier || 'free',
        subscription_status: normalizeSubscriptionStatus(tenant.subscription_status),
        stripe_customer_id: tenant.stripe_customer_id ?? null,
        stripe_subscription_id: tenant.stripe_subscription_id ?? null,
        current_period_end: tenant.current_period_end ?? null,
        cancel_at_period_end: tenant.cancel_at_period_end ?? false,
        total_mcp_calls_today: usage.mcp,
        total_leads_today: usage.leads,
        total_outreach_today: usage.outreach,
      };
    });

    return NextResponse.json({ rows });
  } catch (error) {
    return routeErrorResponse(error, 'Tenant billing summary could not be loaded', req);
  }
}
