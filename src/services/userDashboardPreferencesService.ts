import { supabase } from '@/lib/supabase';

export type DashboardConversationEntry = {
  type: 'user' | 'ai';
  content: string;
  timestamp: number;
};

export type PermanentMeetingLinkPrefs = {
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
  const { data, error } = await supabase
    .from('profiles')
    .select('dashboard_preferences')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return {};
  return parsePreferences(data.dashboard_preferences);
}

export async function mergeDashboardPreferences(
  userId: string,
  patch: Partial<DashboardPreferencesPayload>
): Promise<{ ok: boolean; error?: string }> {
  if (!userId) return { ok: false, error: 'Missing user id' };

  const current = await fetchDashboardPreferences(userId);
  const next: DashboardPreferencesPayload = { ...current };

  (Object.keys(patch) as (keyof DashboardPreferencesPayload)[]).forEach((key) => {
    const value = patch[key];
    if (value !== undefined) {
      (next as Record<string, unknown>)[key] = value;
    }
  });

  const { error } = await supabase.from('profiles').update({ dashboard_preferences: next }).eq('id', userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
