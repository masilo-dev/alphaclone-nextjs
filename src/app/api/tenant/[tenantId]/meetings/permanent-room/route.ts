import { randomInt, randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const adminRoles = ['owner', 'admin', 'tenant_admin', 'super_admin'];
const patchSchema = z.object({ action: z.literal('regenerate_pin') });
const createPin = () => String(randomInt(100000, 1000000));

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { admin } = await requireTenantAccess(tenantId, req);
    const [{ data: permanent, error: roomError }, { data: past, error: pastError }] = await Promise.all([
      admin.from('video_calls').select('*').eq('tenant_id', tenantId).eq('is_permanent', true).neq('status', 'cancelled').order('created_at', { ascending: true }).limit(1).maybeSingle(),
      admin.from('video_calls').select('*').eq('tenant_id', tenantId).in('status', ['ended', 'cancelled']).order('created_at', { ascending: false }).limit(10),
    ]);
    if (roomError) throw roomError;
    if (pastError) throw pastError;
    return NextResponse.json({ permanent: permanent || null, past: past || [] });
  } catch (error) {
    return routeErrorResponse(error, 'Meeting room could not be loaded', req);
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user, admin } = await requireTenantAccess(tenantId, req);
    const { data: tenant, error: tenantError } = await admin.from('tenants').select('name').eq('id', tenantId).maybeSingle();
    if (tenantError) throw tenantError;
    if (!tenant) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    const { data: existing, error: lookupError } = await admin.from('video_calls').select('*').eq('tenant_id', tenantId).eq('is_permanent', true).neq('status', 'cancelled').order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) {
      const metadata = (existing.metadata && typeof existing.metadata === 'object') ? existing.metadata : {};
      if (metadata.meeting_pin) return NextResponse.json({ permanent: existing });
      const { data: repaired, error } = await admin.from('video_calls').update({ metadata: { ...metadata, meeting_pin: createPin() }, status: 'active', updated_at: new Date().toISOString() }).eq('id', existing.id).eq('tenant_id', tenantId).select('*').single();
      if (error) throw error;
      return NextResponse.json({ permanent: repaired });
    }

    const roomName = `alphaclone-${randomUUID()}`;
    const { data: permanent, error } = await admin.from('video_calls').insert({
      room_id: roomName,
      tenant_id: tenantId,
      daily_room_url: null,
      daily_room_name: null,
      host_id: user.id,
      title: `${tenant.name} Permanent Meeting Room`,
      status: 'active',
      participants: [],
      max_participants: 10,
      recording_enabled: false,
      screen_share_enabled: true,
      chat_enabled: true,
      cancellation_policy_hours: 3,
      allow_client_cancellation: false,
      is_public: true,
      is_permanent: true,
      duration_limit_minutes: 1440,
      metadata: { provider: 'livekit', provider_room_name: roomName, meeting_pin: createPin() },
    }).select('*').single();
    if (error?.code === '23505') {
      const { data: concurrentRoom, error: concurrentError } = await admin.from('video_calls').select('*').eq('tenant_id', tenantId).eq('is_permanent', true).neq('status', 'cancelled').maybeSingle();
      if (concurrentError) throw concurrentError;
      if (concurrentRoom) return NextResponse.json({ permanent: concurrentRoom });
    }
    if (error || !permanent) throw error || new Error('Permanent room insert returned no room');
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'permanent_meeting_room_created', payload: { callId: permanent.id, actorUserId: user.id } });
    return NextResponse.json({ permanent }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Permanent meeting room could not be created', req);
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantRole(tenantId, adminRoles, req);
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid meeting-room action' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data: room, error: lookupError } = await admin.from('video_calls').select('id, metadata').eq('tenant_id', tenantId).eq('is_permanent', true).neq('status', 'cancelled').order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (lookupError) throw lookupError;
    if (!room) return NextResponse.json({ error: 'Permanent meeting room not found' }, { status: 404 });
    const metadata = (room.metadata && typeof room.metadata === 'object') ? room.metadata : {};
    const meetingPin = createPin();
    const { data: permanent, error } = await admin.from('video_calls').update({ metadata: { ...metadata, meeting_pin: meetingPin }, updated_at: new Date().toISOString() }).eq('id', room.id).eq('tenant_id', tenantId).select('*').single();
    if (error) throw error;
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'meeting_pin_rotated', payload: { callId: room.id, actorUserId: user.id } });
    return NextResponse.json({ permanent });
  } catch (error) {
    return routeErrorResponse(error, 'Meeting code could not be regenerated', req);
  }
}
