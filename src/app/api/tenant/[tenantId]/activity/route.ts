import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const schema = z.object({
  action: z.string().trim().min(1).max(120),
  metadata: z.record(z.string(), z.unknown()).default({}),
  device: z.object({ browser: z.string().max(80), deviceType: z.string().max(40), userAgent: z.string().max(500) }).optional(),
});

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid activity record' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from('activity_logs').insert({ user_id: user.id, tenant_id: tenantId, action: parsed.data.action, metadata: parsed.data.metadata, ip_address: null, country: 'Private', city: 'Private', device_type: parsed.data.device?.deviceType || 'unknown', browser: parsed.data.device?.browser || 'unknown', user_agent: parsed.data.device?.userAgent || req.headers.get('user-agent') || 'unknown' });
    if (error) throw error;
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Activity could not be recorded', req);
  }
}
