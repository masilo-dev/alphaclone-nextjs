import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';

const daySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const slotSchema = z.object({ start: timeSchema, end: timeSchema }).refine((slot) => slot.start < slot.end, { message: 'End time must be after start time' });
const scheduleSchema = z.object({ schedule: z.record(daySchema, z.array(slotSchema).max(8)) }).superRefine((value, ctx) => {
  for (const [day, slots] of Object.entries(value.schedule)) {
    const ordered = [...slots].sort((a, b) => a.start.localeCompare(b.start));
    for (let index = 1; index < ordered.length; index += 1) {
      if (ordered[index].start < ordered[index - 1].end) ctx.addIssue({ code: 'custom', path: ['schedule', day, index], message: 'Availability slots cannot overlap' });
    }
  }
});

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { admin } = await requireTenantAccess(tenantId, req);
    const { data, error } = await admin.from('availability_schedules').select('*').eq('tenant_id', tenantId).order('is_default', { ascending: false }).order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ availability: data || null });
  } catch (error) {
    return routeErrorResponse(error, 'Availability could not be loaded', req);
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);
    const parsed = scheduleSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid availability', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data: existing, error: lookupError } = await admin.from('availability_schedules').select('id').eq('tenant_id', tenantId).order('is_default', { ascending: false }).order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (lookupError) throw lookupError;
    const mutation = existing
      ? admin.from('availability_schedules').update({ schedule_json: parsed.data.schedule, is_default: true, updated_at: new Date().toISOString() }).eq('id', existing.id).eq('tenant_id', tenantId)
      : admin.from('availability_schedules').insert({ tenant_id: tenantId, user_id: user.id, name: 'Default Hours', is_default: true, schedule_json: parsed.data.schedule });
    const { data, error } = await mutation.select('*').single();
    if (error) throw error;
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'availability_updated', payload: { scheduleId: data.id, actorUserId: user.id } });
    return NextResponse.json({ availability: data });
  } catch (error) {
    return routeErrorResponse(error, 'Availability could not be saved', req);
  }
}
