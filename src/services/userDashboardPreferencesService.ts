import { supabase } from '@/lib/supabase';
import { readUserProfileState, invalidateProfileReads } from '@/lib/profileRead';

export type DashboardConversationEntry = {
  type: 'user' | 'ai';
  content: string;
  timestamp: number;
};

export type PermanentMeetingLinkPrefs = {
  roomId?: string;
  roomName?: string;
  roomUrl?: string;
  link?: string;
  createdAt?: string;
};

export type DashboardPreferencesPayload = {
  widgetOrder?: string[];
  commandHistory?: string[];
  aiConversation?: DashboardConversationEntry[];
  permanentMeetingLink?: PermanentMeetingLinkPrefs | null;
};

function parsePreferences(raw: unknown): DashboardPreferencesPayload {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;

  const widgetOrder = Array.isArray(o.widgetOrder)
    ? (o.widgetOrder as unknown[]).filter((id): id is string => typeof id === 'string')
    : undefined;

  const commandHistory = Array.isArray(o.commandHistory)
    ? (o.commandHistory as unknown[]).filter((id): id is string => typeof id === 'string')
    : undefined;

  let aiConversation: DashboardConversationEntry[] | undefined;
  if (Array.isArray(o.aiConversation)) {
    aiConversation = (o.aiConversation as unknown[])
      .map((e) => {
        if (!e || typeof e !== 'object') return null;
        const row = e as Record<string, unknown>;
        const type = row.type === 'user' || row.type === 'ai' ? row.type : null;
        const content = typeof row.content === 'string' ? row.content : '';
        const timestamp = typeof row.timestamp === 'number' ? row.timestamp : 0;
        if (!type) return null;
        return { type, content, timestamp };
      })
      .filter((x): x is DashboardConversationEntry => x !== null);
  }

  let permanentMeetingLink: PermanentMeetingLinkPrefs | null | undefined;
  if (o.permanentMeetingLink === null) {
    permanentMeetingLink = null;
  } else if (o.permanentMeetingLink && typeof o.permanentMeetingLink === 'object') {
    const p = o.permanentMeetingLink as Record<string, unknown>;
    permanentMeetingLink = {
      roomId: typeof p.roomId === 'string' ? p.roomId : undefined,
      roomName: typeof p.roomName === 'string' ? p.roomName : undefined,
      roomUrl: typeof p.roomUrl === 'string' ? p.roomUrl : undefined,
      link: typeof p.link === 'string' ? p.link : undefined,
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : undefined,
    };
  }

  return { widgetOrder, commandHistory, aiConversation, permanentMeetingLink };
}

export async function fetchDashboardPreferences(userId: string): Promise<DashboardPreferencesPayload> {
  if (!userId) return {};
  const data = await readUserProfileState(userId);
  return parsePreferences(data.dashboard_preferences);
}

export async function mergeDashboardPreferences(
  userId: string,
  patch: Partial<DashboardPreferencesPayload>
): Promise<{ ok: boolean; error?: string }> {
  if (!userId) return { ok: false, error: 'Missing user id' };

  for (let attempt = 0; attempt < 2; attempt++) {
    let stored: unknown;
    try { stored = (await readUserProfileState(userId, true)).dashboard_preferences; }
    catch { return { ok: false, error: 'Saved preferences are unavailable. No changes were written.' }; }
    const next: Record<string, unknown> = stored && typeof stored === 'object' && !Array.isArray(stored)
      ? { ...stored as Record<string, unknown> } : {};
    for (const [key, value] of Object.entries(patch)) if (value !== undefined) next[key] = value;
    let update = supabase.from('profiles').update({ dashboard_preferences: next }).eq('id', userId);
    // Compare-and-swap protects unrelated keys against concurrent tabs and components.
    update = stored == null ? update.is('dashboard_preferences', null)
      : update.eq('dashboard_preferences', JSON.stringify(stored));
    const { data, error } = await update.select('id').maybeSingle();
    if (error) return { ok: false, error: 'Preferences could not be saved. Retry after connectivity recovers.' };
    invalidateProfileReads(userId);
    if (data) return { ok: true };
  }
  return { ok: false, error: 'Preferences changed in another tab. Please retry your change.' };
}
