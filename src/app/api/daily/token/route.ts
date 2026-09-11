import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';
import { ENV } from '@/config/env';

const DAILY_API_URL = 'https://api.daily.co/v1';
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

async function ensureDailyRoomExists(roomName: string) {
  const headers = { Authorization: `Bearer ${ENV.DAILY_API_KEY}` };
  const check = await fetch(`${DAILY_API_URL}/rooms/${encodeURIComponent(roomName)}`, { headers });
  if (check.ok) return;
  if (check.status !== 404) throw new Error('Daily room could not be validated');
  const created = await fetch(`${DAILY_API_URL}/rooms`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: roomName, privacy: 'private', properties: { enable_chat: true, enable_screenshare: true } }) });
  if (!created.ok) throw new Error('Daily room could not be restored');
}

export async function POST(req: NextRequest) {
  try {
    if (!ENV.DAILY_API_KEY) return NextResponse.json({ error: 'Daily video is not configured' }, { status: 503 });
    const body = await req.json().catch(() => ({}));
    const callId = typeof body.callId === 'string' ? body.callId.trim() : '';
    if (!isUuid(callId)) return NextResponse.json({ error: 'Valid callId is required' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data: call, error } = await admin.from('video_calls').select('id, tenant_id, host_id, status, is_public, daily_room_name, daily_room_url, room_id, metadata').eq('id', callId).maybeSingle();
    if (error) throw error;
    if (!call || ['ended', 'cancelled'].includes(call.status)) return NextResponse.json({ error: 'Meeting not found or ended' }, { status: 404 });
    let userId: string | null = null;
    let displayName = typeof body.guestName === 'string' ? body.guestName.trim().slice(0, 80) : 'Guest';
    let isOwner = false;
    try {
      const auth = await requireAuthenticatedUser(req);
      userId = auth.user.id;
      displayName = String(auth.user.user_metadata?.name || auth.user.email?.split('@')[0] || 'User').slice(0, 80);
      if (call.host_id === userId) isOwner = true;
      else if (call.tenant_id) {
        const { data: membership } = await admin.from('tenant_users').select('role').eq('tenant_id', call.tenant_id).eq('user_id', userId).maybeSingle();
        if (membership) isOwner = ['owner', 'admin', 'tenant_admin', 'super_admin'].includes(membership.role);
      }
    } catch { /* guest bearer/PIN validation below */ }
    let authorized = Boolean(userId && call.host_id === userId);
    if (!authorized && userId && call.tenant_id) {
      const { data: membership } = await admin.from('tenant_users').select('user_id').eq('tenant_id', call.tenant_id).eq('user_id', userId).maybeSingle();
      authorized = Boolean(membership);
    }
    const isWorkspaceParticipant = authorized;
    const accessToken = typeof body.meetingAccessToken === 'string' ? body.meetingAccessToken.trim() : '';
    if (!authorized && accessToken) {
      const { data: link } = await admin.from('meeting_links').select('meeting_id, expires_at').eq('meeting_id', callId).eq('link_token', accessToken).maybeSingle();
      authorized = Boolean(link && new Date(link.expires_at).getTime() > Date.now());
    }
    const metadata = call.metadata && typeof call.metadata === 'object' ? call.metadata : {};
    if (metadata.meeting_locked && !isWorkspaceParticipant) return NextResponse.json({ error: 'This meeting is locked to new guests' }, { status: 423 });
    if (!authorized && call.is_public) {
      const expectedPin = String(metadata.meeting_pin || '');
      const startedAt = Number(metadata.meeting_started_at || 0);
      authorized = (!expectedPin || expectedPin === String(body.meetingAccessPin || '')) && (!startedAt || Date.now() - startedAt <= 35 * 60 * 1000);
    }
    if (!authorized) return NextResponse.json({ error: 'Meeting access denied' }, { status: 403 });
    const roomName = call.daily_room_name || call.room_id;
    if (!roomName) return NextResponse.json({ error: 'Daily room is not configured' }, { status: 409 });
    await ensureDailyRoomExists(roomName);
    const response = await fetch(`${DAILY_API_URL}/meeting-tokens`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ENV.DAILY_API_KEY}` }, body: JSON.stringify({ properties: { room_name: roomName, user_name: displayName || 'Guest', is_owner: isOwner, exp: Math.floor(Date.now() / 1000) + 3600 } }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: payload.info || 'Daily token could not be issued' }, { status: 502 });
    return NextResponse.json({ token: payload.token, roomUrl: call.daily_room_url });
  } catch (error) {
    return routeErrorResponse(error, 'Daily meeting token could not be issued', req);
  }
}
