import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const schema = z.object({
  enabled: z.boolean(),
  meetingTypes: z.array(z.object({ name: z.string().trim().min(1).max(200), duration: z.coerce.number().int().min(5).max(1440), price: z.coerce.number().min(0).max(1_000_000).optional() })).max(100),
});
const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'meeting';

export async function PUT(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid booking types', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const slugs = parsed.data.meetingTypes.map((item) => slugify(item.name));
    if (new Set(slugs).size !== slugs.length) return NextResponse.json({ error: 'Meeting type names must be unique' }, { status: 409 });
    if (!parsed.data.enabled) {
      const { error } = await admin.from('booking_types').update({ is_active: false, updated_at: new Date().toISOString() }).eq('tenant_id', tenantId);
      if (error) throw error;
    } else {
      for (let index = 0; index < parsed.data.meetingTypes.length; index++) {
        const item = parsed.data.meetingTypes[index];
        const { error } = await admin.from('booking_types').upsert({ tenant_id: tenantId, name: item.name, slug: slugs[index], duration: item.duration, price: item.price ?? 0, is_active: true, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id,slug' });
        if (error) throw error;
      }
      if (slugs.length) await admin.from('booking_types').update({ is_active: false, updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).not('slug', 'in', `(${slugs.join(',')})`);
    }
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'booking_types_updated', payload: { actorUserId: user.id, count: parsed.data.meetingTypes.length, enabled: parsed.data.enabled } });
    return NextResponse.json({ success: true });
  } catch (error) { return routeErrorResponse(error, 'Booking types could not be saved', req); }
}
