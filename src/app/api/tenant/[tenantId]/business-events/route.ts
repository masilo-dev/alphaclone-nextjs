import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const eventFields = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(10_000).nullable().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  eventType: z.string().trim().min(1).max(80).default('meeting'),
  attendees: z.array(z.string().trim().min(1).max(320)).max(100).default([]),
});
const createSchema = eventFields.refine((value) => new Date(value.endTime) > new Date(value.startTime), { message: 'Event end must be after its start', path: ['endTime'] });
const updateSchema = eventFields.partial().extend({ eventId: z.string().uuid() }).refine(
  (value) => !value.startTime || !value.endTime || new Date(value.endTime) > new Date(value.startTime),
  { message: 'Event end must be after its start', path: ['endTime'] },
);
const deleteSchema = z.object({ eventId: z.string().uuid() });

const mapEvent = (event: any) => ({
  id: event.id,
  tenantId: event.tenant_id,
  title: event.title,
  description: event.description,
  startTime: event.start_time,
  endTime: event.end_time,
  eventType: event.event_type,
  attendees: event.attendees || [],
  createdBy: event.created_by,
  createdAt: event.created_at,
});

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    await requireTenantAccess(tenantId, req);
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('business_events').select('*').eq('tenant_id', tenantId).order('start_time');
    if (error) throw error;
    return NextResponse.json({ events: (data || []).map(mapEvent) });
  } catch (error) { return routeErrorResponse(error, 'Calendar events could not be loaded', req); }
}

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid event', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('business_events').insert({
      tenant_id: tenantId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      start_time: parsed.data.startTime,
      end_time: parsed.data.endTime,
      event_type: parsed.data.eventType,
      attendees: parsed.data.attendees,
      created_by: user.id,
    }).select('*').single();
    if (error) throw error;
    return NextResponse.json({ event: mapEvent(data) }, { status: 201 });
  } catch (error) { return routeErrorResponse(error, 'Calendar event could not be created', req); }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    await requireTenantAccess(tenantId, req);
    const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid event update', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) patch.title = parsed.data.title;
    if (parsed.data.description !== undefined) patch.description = parsed.data.description;
    if (parsed.data.startTime !== undefined) patch.start_time = parsed.data.startTime;
    if (parsed.data.endTime !== undefined) patch.end_time = parsed.data.endTime;
    if (parsed.data.eventType !== undefined) patch.event_type = parsed.data.eventType;
    if (parsed.data.attendees !== undefined) patch.attendees = parsed.data.attendees;
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('business_events').update(patch).eq('id', parsed.data.eventId).eq('tenant_id', tenantId).select('*').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    return NextResponse.json({ event: mapEvent(data) });
  } catch (error) { return routeErrorResponse(error, 'Calendar event could not be updated', req); }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    await requireTenantAccess(tenantId, req);
    const parsed = deleteSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('business_events').delete().eq('id', parsed.data.eventId).eq('tenant_id', tenantId).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) { return routeErrorResponse(error, 'Calendar event could not be deleted', req); }
}
