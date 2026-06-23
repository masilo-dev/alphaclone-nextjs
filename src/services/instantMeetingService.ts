import { supabase } from '@/lib/supabase';
import { dailyService, type VideoCall } from '@/services/dailyService';
import { microsoftAuthService } from '@/services/microsoftAuthService';
import { microsoftGraphService } from '@/services/microsoftGraphService';
import { tenantService } from '@/services/tenancy/TenantService';

export type PlatformMeetingProvider = 'teams' | 'livekit' | 'daily' | 'jitsi';

function mapVideoCall(row: Record<string, unknown>): VideoCall {
  return {
    ...(row as VideoCall),
    created_at: new Date(String(row.created_at)),
    updated_at: new Date(String(row.updated_at)),
    scheduled_at: new Date(String(row.scheduled_at)),
    started_at: row.started_at ? new Date(String(row.started_at)) : undefined,
    ended_at: row.ended_at ? new Date(String(row.ended_at)) : undefined,
    cancelled_at: row.cancelled_at ? new Date(String(row.cancelled_at)) : undefined,
    is_public: Boolean(row.is_public),
  };
}

export function resolveMeetingProvider(call: VideoCall | Record<string, unknown>): PlatformMeetingProvider {
  const metadata = (call.metadata || {}) as Record<string, unknown>;
  const fromMeta = String(metadata.video_provider || '').trim();
  if (fromMeta === 'teams') return 'teams';
  if (fromMeta === 'jitsi') return 'jitsi';
  if (fromMeta === 'daily') return 'daily';
  if (String(metadata.provider || '') === 'livekit') return 'livekit';
  return 'livekit';
}

export function resolveMeetingJoinUrl(call: VideoCall | Record<string, unknown>): string | null {
  const metadata = (call.metadata || {}) as Record<string, unknown>;
  return (
    (call as VideoCall).daily_room_url ||
    (typeof metadata.teams_join_url === 'string' ? metadata.teams_join_url : null) ||
    null
  );
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
      const end = new Date(now.getTime() + 60 * 60 * 1000);
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

      const { data, error } = await supabase
        .from('video_calls')
        .insert({
          tenant_id: tenantId,
          host_id: input.hostId,
          title: input.title,
          status: 'active',
          scheduled_at: now.toISOString(),
          daily_room_url: teamsMeeting.joinUrl,
          video_provider: 'external',
          provider_metadata: {
            teams_meeting_id: teamsMeeting.id,
            teams_join_url: teamsMeeting.joinUrl,
          },
          metadata: {
            video_provider: 'teams',
            teams_meeting_id: teamsMeeting.id,
            teams_join_url: teamsMeeting.joinUrl,
          },
          is_public: false,
          screen_share_enabled: true,
          chat_enabled: true,
        })
        .select('*')
        .single();

      if (error || !data) {
        return { call: null, provider: null, error: error?.message || 'Failed to save Teams meeting.' };
      }

      return { call: mapVideoCall(data), provider: 'teams', error: null };
    }

    const { call, error } = await dailyService.createVideoCall({
      hostId: input.hostId,
      title: input.title,
      tenantId,
      isPublic: false,
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
