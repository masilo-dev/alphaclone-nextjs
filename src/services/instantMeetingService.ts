import { dailyService, type VideoCall } from '@/services/dailyService';
import { microsoftAuthService } from '@/services/microsoftAuthService';
import { microsoftGraphService } from '@/services/microsoftGraphService';
import { tenantService } from '@/services/tenancy/TenantService';
import { callSignalingService } from '@/services/video/CallSignalingService';
import { dispatchPushNotification } from '@/lib/push/dispatchPushNotification';
import { MAX_MEETING_DURATION_MINUTES, meetingEndTimeFromNow } from '@/lib/meetingLimits';

export type PlatformMeetingProvider = 'teams' | 'livekit' | 'daily' | 'jitsi';

/** Minimal fields needed to resolve Teams vs AlphaClone video badge */
export type MeetingProviderInput = {
  metadata?: Record<string, unknown> | null;
  daily_room_url?: string | null;
};

function mapVideoCall(row: Record<string, unknown>): VideoCall {
  return {
    ...(row as unknown as VideoCall),
    created_at: new Date(String(row.created_at)),
    updated_at: new Date(String(row.updated_at)),
    scheduled_at: new Date(String(row.scheduled_at)),
    started_at: row.started_at ? new Date(String(row.started_at)) : undefined,
    ended_at: row.ended_at ? new Date(String(row.ended_at)) : undefined,
    cancelled_at: row.cancelled_at ? new Date(String(row.cancelled_at)) : undefined,
    is_public: Boolean(row.is_public),
  };
}

export function resolveMeetingProvider(call: MeetingProviderInput): PlatformMeetingProvider {
  const metadata = (call.metadata || {}) as Record<string, unknown>;
  const fromMeta = String(metadata.video_provider || '').trim();
  if (fromMeta === 'teams') return 'teams';
  if (fromMeta === 'jitsi') return 'jitsi';
  if (fromMeta === 'daily') return 'daily';
  if (String(metadata.provider || '') === 'livekit') return 'livekit';
  return 'livekit';
}

export function resolveMeetingJoinUrl(call: MeetingProviderInput): string | null {
  const metadata = (call.metadata || {}) as Record<string, unknown>;
  const externalUrl = (
    call.daily_room_url ||
    (typeof metadata.teams_join_url === 'string' ? metadata.teams_join_url : null) ||
    null
  );
  if (externalUrl) return externalUrl;
  return typeof metadata.invitation_path === 'string' ? metadata.invitation_path : null;
}

export function getMeetingProviderDisplay(provider: PlatformMeetingProvider): {
  label: string;
  className: string;
} {
  if (provider === 'teams') {
    return {
      label: 'Using Teams',
      className: 'bg-blue-500/10 text-blue-300 border-blue-500/25',
    };
  }
  if (provider === 'jitsi') {
    return {
      label: 'Using Jitsi',
      className: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    };
  }
  return {
    label: 'Using AlphaClone video',
    className: 'bg-teal-500/10 text-teal-300 border-teal-500/25',
  };
}

export async function createInstantMeeting(input: {
  hostId: string;
  title: string;
  tenantId?: string | null;
}): Promise<{
  call: VideoCall | null;
  provider: PlatformMeetingProvider | null;
  error: string | null;
}> {
  const tenantId = input.tenantId || tenantService.getCurrentTenantId();
  if (!tenantId) {
    return { call: null, provider: null, error: 'No active workspace selected.' };
  }

  try {
    const microsoftConnected = await microsoftAuthService.isConnected();
    if (microsoftConnected) {
      const now = new Date();
      const end = meetingEndTimeFromNow(MAX_MEETING_DURATION_MINUTES);
      const teamsMeeting = await microsoftGraphService.createOnlineMeeting({
        subject: input.title,
        startDateTime: now.toISOString(),
        endDateTime: end.toISOString(),
      });

      if (!teamsMeeting.joinUrl) {
        return {
          call: null,
          provider: null,
          error: 'Microsoft Teams did not return a join link. Reconnect Microsoft 365 under Settings → Integrations.',
        };
      }

      const response = await fetch('/api/meetings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          title: input.title,
          hostId: input.hostId,
          durationMinutes: MAX_MEETING_DURATION_MINUTES,
          scheduledAt: now.toISOString(),
          provider: 'teams',
          providerMeetingId: teamsMeeting.id,
          joinUrl: teamsMeeting.joinUrl,
          isPublic: false,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.call) {
        return { call: null, provider: null, error: payload.error || 'Failed to save Teams meeting.' };
      }

      return { call: mapVideoCall(payload.call), provider: 'teams', error: null };
    }

    const { call, error } = await dailyService.createVideoCall({
      hostId: input.hostId,
      title: input.title,
      tenantId,
      isPublic: false,
      duration: MAX_MEETING_DURATION_MINUTES,
    });

    return {
      call,
      provider: call ? 'livekit' : null,
      error: error || null,
    };
  } catch (err) {
    return {
      call: null,
      provider: null,
      error: err instanceof Error ? err.message : 'Failed to create meeting.',
    };
  }
}

export async function loadMeetingForJoin(callId: string): Promise<{
  call: VideoCall | null;
  provider: PlatformMeetingProvider | null;
  joinUrl: string | null;
  error: string | null;
}> {
  const { call, error } = await dailyService.getVideoCall(callId);
  if (error || !call) {
    return { call: null, provider: null, joinUrl: null, error: error || 'Meeting not found.' };
  }

  return {
    call,
    provider: resolveMeetingProvider(call),
    joinUrl: resolveMeetingJoinUrl(call),
    error: null,
  };
}

export async function startClientVideoCall(input: {
  hostId: string;
  hostName: string;
  tenantId?: string | null;
  clientName: string;
  clientEmail?: string | null;
}): Promise<{
  call: VideoCall | null;
  provider: PlatformMeetingProvider | null;
  joinUrl: string | null;
  recipientUserId: string | null;
  error: string | null;
}> {
  let recipientUserId: string | null = null;
  const tenantId = input.tenantId || tenantService.getCurrentTenantId();
  if (input.clientEmail?.trim() && tenantId) {
    const response = await fetch(`/api/tenant/${tenantId}/members/resolve?email=${encodeURIComponent(input.clientEmail.trim())}`, { cache: 'no-store' });
    if (response.ok) {
      const payload = await response.json();
      recipientUserId = payload.userId || null;
    }
  }

  const { call, provider, error } = await createInstantMeeting({
    hostId: input.hostId,
    tenantId,
    title: `Call with ${input.clientName}`,
  });

  if (error || !call) {
    return { call: null, provider: null, joinUrl: null, recipientUserId, error: error || 'Failed to create meeting.' };
  }

  const joinUrl = resolveMeetingJoinUrl(call);
  if (recipientUserId && joinUrl) {
    await callSignalingService.sendCallSignal(recipientUserId, {
      callerId: input.hostId,
      callerName: input.hostName,
      roomUrl: joinUrl,
      roomId: call.id,
    });
    void dispatchPushNotification({
      userId: recipientUserId,
      tenantId: tenantId ?? undefined,
      type: 'call',
      title: 'Incoming call',
      message: `${input.hostName} is calling`,
      link: `/call/${call.id}`,
      email: false,
    });
  }

  return { call, provider, joinUrl, recipientUserId, error: null };
}
