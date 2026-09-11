import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { campaignCreateSchema } from '@/lib/marketing/campaignDomain';

const WRITE_ROLES = ['owner', 'admin', 'tenant_admin', 'super_admin', 'staff'];

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId') ?? '';
    const status = request.nextUrl.searchParams.get('status');
    const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('pageSize') ?? 30)));
    const { admin } = await requireTenantAccess(tenantId, request);
    let query = admin
      .from('marketing_campaigns')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (status) query = query.eq('status', status);
    const { data, error, count } = await query;
    if (error) throw error;
    return NextResponse.json({ campaigns: data ?? [], page, pageSize, total: count ?? 0 });
  } catch (error) {
    return routeErrorResponse(error, 'Campaigns could not be loaded.', request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = campaignCreateSchema.parse(await request.json());
    const { user, admin } = await requireTenantRole(parsed.tenantId, WRITE_ROLES, request);
    const { data, error } = await admin
      .from('marketing_campaigns')
      .insert({
        tenant_id: parsed.tenantId,
        name: parsed.name,
        description: parsed.description,
        objective: parsed.objective,
        type: parsed.channels.length > 1 ? 'multi_channel' : parsed.channels[0],
        channels: parsed.channels,
        currency_code: parsed.currencyCode,
        budget_amount: parsed.budgetAmount,
        start_at: parsed.startAt,
        end_at: parsed.endAt,
        timezone: parsed.timezone,
        requires_approval: parsed.requiresApproval,
        status: parsed.requiresApproval ? 'pending_approval' : 'draft',
        metadata: parsed.metadata,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();
    if (error) throw error;
    await admin.from('audit_logs').insert({
      tenant_id: parsed.tenantId,
      user_id: user.id,
      action: 'marketing_campaign_created',
      entity_type: 'marketing_campaign',
      entity_id: data.id,
      new_values: { name: data.name, objective: data.objective, status: data.status },
    });
    return NextResponse.json({ campaign: data }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Campaign could not be created.', request);
  }
}
