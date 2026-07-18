import { randomInt } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start') }),
  z.object({ action: z.literal('end'), durationSeconds: z.number().int().min(0).max(86_400).optional(), rotatePin: z.boolean().optional() }),
  z.object({ action: z.literal('lock'), locked: z.boolean() }),
]);
const adminRoles = new Set(['owner', 'admin', 'tenant_admin', 'super_admin']);

export async function PATCH(req: NextRequest, context: { params: Promise<{ callId: string }> }) {
  try {
    const { callId } = await context.params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid meeting state change' }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const { data: call, error: callError } = await admin
      .from('video_calls')
      .select('id, tenant_id, host_id, status, started_at, metadata, is_permanent')
      .eq('id', callId)
      .maybeSingle();
    if (callError) throw callError;
    if (!call?.tenant_id) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });

    const access = await requireTenantAccess(call.tenant_id, req);
    const isHost = call.host_id === access.user.id;
    const isAdmin = adminRoles.has(access.membership.role);
    if (!isHost && !isAdmin) return NextResponse.json({ error: 'Insufficient meeting permissions' }, { status: 403 });

    const metadata = call.metadata && typeof call.metadata === 'object' ? call.metadata : {};
    const permanentSessionActive = call.is_permanent && Boolean(metadata.meeting_started_at);
    if (parsed.data.action === 'start' && call.status === 'active' && (!call.is_permanent || permanentSessionActive)) {
      return NextResponse.json({ meeting: call, unchanged: true });
    }
    if (parsed.data.action === 'end' && call.is_permanent && !permanentSessionActive) {
      return NextResponse.json({ meeting: call, unchanged: true });
    }
    if (!call.is_permanent && (call.status === 'ended' || call.status === 'cancelled')) {
      return NextResponse.json({ error: `This meeting has already been ${call.status}` }, { status: 409 });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    let patch: Record<string, unknown>;
    let eventType: string;

    if (parsed.data.action === 'start') {
      patch = {
        status: 'active',
        started_at: nowIso,
        ended_at: null,
        duration_seconds: null,
        auto_end_scheduled_at: call.is_permanent ? null : undefined,
        metadata: { ...metadata, meeting_started_at: now.getTime(), meeting_locked: false },
        updated_at: nowIso,
      };
      eventType = 'meeting_started';
    } else if (parsed.data.action === 'end') {
      const durationSeconds = call.started_at
        ? Math.max(0, Math.floor((now.getTime() - new Date(call.started_at).getTime()) / 1000))
        : 0;
      patch = {
        status: call.is_permanent ? 'active' : 'ended',
        ended_at: nowIso,
        duration_seconds: durationSeconds,
        ended_reason: 'manual',
        auto_end_scheduled_at: null,
        metadata: {
          ...metadata,
          meeting_pin: parsed.data.rotatePin ? String(randomInt(100000, 1000000)) : metadata.meeting_pin,
          meeting_started_at: null,
          meeting_locked: false,
        },
        updated_at: nowIso,
      };
      eventType = 'meeting_ended';
    } else {
      patch = { metadata: { ...metadata, meeting_locked: parsed.data.locked }, updated_at: nowIso };
      eventType = parsed.data.locked ? 'meeting_locked' : 'meeting_unlocked';
    }

    const { data: updated, error } = await admin
      .from('video_calls')
      .update(patch)
      .eq('id', callId)
      .eq('tenant_id', call.tenant_id)
      .select('*')
      .single();
    if (error) throw error;

    const { error: eventError } = await admin.from('business_automation_events').insert({
      tenant_id: call.tenant_id,
      event_type: eventType,
      payload: {
        callId,
        actorUserId: access.user.id,
        durationSeconds: parsed.data.action === 'end' ? updated.duration_seconds || 0 : undefined,
      },
    });
    if (eventError) throw eventError;

    return NextResponse.json({ meeting: updated });
  } catch (error) {
    return routeErrorResponse(error, 'Meeting state could not be updated', req);
  }
}
