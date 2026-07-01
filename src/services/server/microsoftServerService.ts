import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import {
  getMicrosoftTokens,
  refreshMicrosoftAccessToken,
} from '@/services/microsoft/microsoftConnectionService';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

export interface MicrosoftServerConnection {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string | null;
  microsoft_email: string | null;
  display_name: string | null;
}

function createAdminClient() {
  return createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
}

async function refreshMicrosoftConnection(connection: MicrosoftServerConnection) {
  const supabase = createAdminClient();
  await refreshMicrosoftAccessToken(supabase, connection.user_id, { force: true });
  const { connection: updated } = await getMicrosoftTokens(supabase, connection.user_id);
  if (!updated) return connection;
  const tokens = await getMicrosoftTokens(supabase, connection.user_id);
  return {
    id: updated.user_id,
    user_id: updated.user_id,
    token_expiry: updated.token_expiry,
    microsoft_email: updated.microsoft_email,
    display_name: updated.display_name,
    access_token: tokens.accessToken || '',
    refresh_token: tokens.refreshToken || '',
  } as MicrosoftServerConnection;
}

async function getValidConnection(userId: string) {
  const supabase = createAdminClient();
  const { accessToken, refreshToken, connection } = await getMicrosoftTokens(supabase, userId);

  if (!connection) return null;

  const expiresAt = connection.token_expiry ? new Date(connection.token_expiry).getTime() : NaN;
  const needsRefresh =
    !connection.token_expiry ||
    Number.isNaN(expiresAt) ||
    Date.now() + 5 * 60 * 1000 >= expiresAt;
  if (needsRefresh) {
    return refreshMicrosoftConnection({
      ...connection,
      id: connection.user_id,
      access_token: accessToken || '',
      refresh_token: refreshToken || '',
    } as MicrosoftServerConnection);
  }

  return {
    id: connection.user_id,
    user_id: connection.user_id,
    token_expiry: connection.token_expiry,
    microsoft_email: connection.microsoft_email,
    display_name: connection.display_name,
    access_token: accessToken || '',
    refresh_token: refreshToken || '',
  } as MicrosoftServerConnection;
}

async function graphRequest<T = any>(
  userId: string,
  path: string,
  init: RequestInit = {},
  beta = false,
  retried = false
): Promise<T> {
  const connection = await getValidConnection(userId);
  if (!connection?.access_token) {
    throw new Error('Microsoft is not connected for this user.');
  }

  const baseUrl = beta ? 'https://graph.microsoft.com/beta' : GRAPH_BASE_URL;
  const response = await fetch(path.startsWith('http') ? path : `${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => 'Microsoft Graph request failed.');
    const isAuthError =
      response.status === 401 ||
      response.status === 403 ||
      /InvalidAuthenticationToken|token.*expired|Lifetime validation failed/i.test(message);

    if (isAuthError && !retried) {
      try {
        await refreshMicrosoftConnection(connection);
        return graphRequest<T>(userId, path, init, beta, true);
      } catch {
        // Fall through with the original error below.
      }
    }

    throw new Error(message);
  }

  if (response.status === 204 || response.status === 202) return {} as T;
  const body = await response.text().catch(() => '');
  if (!body.trim()) return {} as T;
  return JSON.parse(body) as T;
}

export const microsoftServerService = {
  async getConnection(userId: string) {
    return getValidConnection(userId);
  },

  async isConnected(userId: string) {
    return Boolean(await getValidConnection(userId));
  },

  async sendEmail(
    userId: string,
    input: { to: string[]; subject: string; html: string; cc?: string[]; bcc?: string[] }
  ) {
    await graphRequest(userId, '/me/sendMail', {
      method: 'POST',
      body: JSON.stringify({
        message: {
          subject: input.subject,
          body: { contentType: 'HTML', content: input.html },
          toRecipients: input.to.map((email) => ({ emailAddress: { address: email } })),
          ccRecipients: (input.cc || []).map((email) => ({ emailAddress: { address: email } })),
          bccRecipients: (input.bcc || []).map((email) => ({ emailAddress: { address: email } })),
        },
        saveToSentItems: true,
      }),
    });

    return { id: null };
  },

  async getCalendarBusyWindows(userId: string, startIso: string, endIso: string) {
    const params = new URLSearchParams({
      startDateTime: startIso,
      endDateTime: endIso,
      $select: 'start,end,showAs,isCancelled',
    });
    const data = await graphRequest<{ value: any[] }>(userId, `/me/calendarView?${params.toString()}`);
    return (data.value || [])
      .filter((event) => !event.isCancelled)
      .map((event) => ({
        start: new Date(event.start?.dateTime).getTime(),
        end: new Date(event.end?.dateTime).getTime(),
        showAs: event.showAs,
      }));
  },

  async createCalendarEvent(
    userId: string,
    input: {
      subject: string;
      start: string;
      end: string;
      attendees?: string[];
      body?: string;
      location?: string;
      isOnlineMeeting?: boolean;
    }
  ) {
    return graphRequest<any>(userId, '/me/events', {
      method: 'POST',
      body: JSON.stringify({
        subject: input.subject,
        body: { contentType: 'HTML', content: input.body || '' },
        start: { dateTime: input.start, timeZone: 'UTC' },
        end: { dateTime: input.end, timeZone: 'UTC' },
        location: { displayName: input.location || '' },
        attendees: (input.attendees || []).map((email) => ({
          emailAddress: { address: email },
          type: 'required',
        })),
        isOnlineMeeting: input.isOnlineMeeting ?? true,
        onlineMeetingProvider: input.isOnlineMeeting === false ? undefined : 'teamsForBusiness',
      }),
    });
  },

  async getTeamsMeetingTranscript(userId: string, meetingId: string) {
    return graphRequest(userId, `/me/onlineMeetings/${meetingId}/transcripts`, {}, true);
  },
};
