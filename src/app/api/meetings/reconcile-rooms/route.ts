import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const DAILY_API_URL = 'https://api.daily.co/v1';
const DAILY_API_KEY = process.env.DAILY_API_KEY;
const LIVEKIT_URL = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

const normalizeOrigin = (value: string | null | undefined): string | null => {
  if (!value) return null;
  return value.replace(/\/+$/, '');
};

const resolveAppOrigin = (req: NextRequest): string => {
  const fromOrigin = normalizeOrigin(req.headers.get('origin'));
  if (fromOrigin) return fromOrigin;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  if (host) return `${proto}://${host}`;
  return normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) || 'https://alphaclonesystems.com';
};

type VideoCallRow = {
  id: string;
  tenant_id: string | null;
  room_id: string | null;
  daily_room_name: string | null;
  daily_room_url: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
};

async function ensureTenantMembership(userId: string, tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return !error && !!data;
}

async function checkDailyRoom(name: string): Promise<{ exists: boolean; url?: string; error?: string }> {
  if (!DAILY_API_KEY) return { exists: false, error: 'DAILY_API_KEY not configured' };
  const response = await fetch(`${DAILY_API_URL}/rooms/${encodeURIComponent(name)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
  });
  if (response.ok) {
    const room = await response.json().catch(() => ({}));
    return { exists: true, url: typeof room?.url === 'string' ? room.url : undefined };
  }
  if (response.status === 404) return { exists: false };
  const payload = await response.json().catch(() => ({}));
  return { exists: false, error: payload?.info || payload?.error || `Daily API ${response.status}` };
}

async function createDailyRoom(name: string, meetingJoinHook: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!DAILY_API_KEY) return { ok: false, error: 'DAILY_API_KEY not configured' };
  const response = await fetch(`${DAILY_API_URL}/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DAILY_API_KEY}`,
    },
    body: JSON.stringify({
      name,
      properties: {
        enable_chat: true,
        enable_screenshare: true,
        start_video_off: false,
        start_audio_off: false,
        meeting_join_hook: meetingJoinHook,
      },
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    return { ok: false, error: payload?.info || payload?.error || `Daily create failed (${response.status})` };
  }
  const room = await response.json().catch(() => ({}));
  return { ok: true, url: typeof room?.url === 'string' ? room.url : undefined };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { tenantId?: string; limit?: number };
    const tenantId = String(body.tenantId || '').trim();
    const limit = Math.min(Math.max(Number(body.limit || 100), 1), 300);
    if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });

    const isMember = await ensureTenantMembership(user.id, tenantId);
    if (!isMember) return NextResponse.json({ error: 'You are not a member of this workspace.' }, { status: 403 });

    const admin = createSupabaseAdminClient();
    const { data: rows, error } = await admin
      .from('video_calls')
      .select('id, tenant_id, room_id, daily_room_name, daily_room_url, status, metadata')
      .eq('tenant_id', tenantId)
      .in('status', ['scheduled', 'active'])
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const appOrigin = resolveAppOrigin(req);
    const joinHookUrl = `${appOrigin}/api/meetings/hooks/join`;

    const result = {
      scanned: 0,
      dailyRecreated: 0,
      dailyHealthy: 0,
      livekitTagged: 0,
      issues: [] as Array<{ callId: string; provider: 'daily' | 'livekit'; detail: string }>,
    };

    const hasLiveKit = Boolean(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET);

    for (const row of (rows || []) as VideoCallRow[]) {
      result.scanned += 1;
      const roomName = String(row.daily_room_name || row.room_id || `room-${row.id}`).trim();
      const dailyCheck = await checkDailyRoom(roomName);
      if (dailyCheck.error) {
        result.issues.push({ callId: row.id, provider: 'daily', detail: dailyCheck.error });
      } else if (dailyCheck.exists) {
        result.dailyHealthy += 1;
        await fetch(`${DAILY_API_URL}/rooms/${encodeURIComponent(roomName)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${DAILY_API_KEY}`,
          },
          body: JSON.stringify({
            properties: {
              meeting_join_hook: joinHookUrl,
            },
          }),
        }).catch(() => undefined);
        if (!row.daily_room_url && dailyCheck.url) {
          await admin
            .from('video_calls')
            .update({ daily_room_url: dailyCheck.url, daily_room_name: roomName, room_id: roomName })
            .eq('id', row.id);
        }
      } else {
        const created = await createDailyRoom(roomName, joinHookUrl);
        if (!created.ok) {
          result.issues.push({ callId: row.id, provider: 'daily', detail: created.error || 'Room recreation failed' });
        } else {
          result.dailyRecreated += 1;
          await admin
            .from('video_calls')
            .update({
              daily_room_name: roomName,
              room_id: roomName,
              daily_room_url: created.url || row.daily_room_url || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id);
        }
      }

      if (hasLiveKit) {
        const expectedRoomName = `alphaclone-${row.id}`;
        const currentMetadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        if (currentMetadata.livekit_room_name !== expectedRoomName) {
          await admin
            .from('video_calls')
            .update({
              metadata: {
                ...currentMetadata,
                livekit_room_name: expectedRoomName,
                livekit_configured: true,
              },
            })
            .eq('id', row.id);
          result.livekitTagged += 1;
        }
      } else {
        result.issues.push({ callId: row.id, provider: 'livekit', detail: 'LiveKit env vars are not fully configured' });
      }
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reconcile meeting providers';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
