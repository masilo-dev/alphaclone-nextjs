import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requirePlatformSuperAdmin, routeErrorResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  tenantId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
});

export async function GET(req: NextRequest) {
  try {
    await requirePlatformSuperAdmin();
    const parsed = querySchema.safeParse({
      tenantId: req.nextUrl.searchParams.get('tenantId') || undefined,
      limit: req.nextUrl.searchParams.get('limit') || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { tenantId, limit } = parsed.data;

    let query = admin
      .from('security_logs')
      .select(`
        id,
        tenant_id,
        user_id,
        event_type,
        ip_address,
        user_agent,
        location,
        device_info,
        event_details,
        severity,
        created_at,
        tenant:tenant_id (name),
        user:user_id (name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const logs = (data || []).map((log: Record<string, unknown>) => ({
      id: log.id,
      tenantId: log.tenant_id,
      userId: log.user_id,
      eventType: log.event_type,
      ipAddress: log.ip_address,
      userAgent: log.user_agent,
      location: log.location,
      deviceInfo: log.device_info,
      eventDetails: log.event_details,
      severity: log.severity,
      createdAt: log.created_at,
      tenant: log.tenant,
      user: log.user,
    }));

    return NextResponse.json({ success: true, logs });
  } catch (err) {
    return routeErrorResponse(err);
  }
}
