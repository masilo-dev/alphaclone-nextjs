import { MICROSOFT_GRAPH_BASE_URL } from '@/config/microsoft';
import { microsoftAuthService } from '@/services/microsoftAuthService';

type GraphMethod = 'GET' | 'POST' | 'PATCH' | 'PUT';

interface GraphRequestOptions {
  method?: GraphMethod;
  body?: unknown;
  headers?: Record<string, string>;
  responseType?: 'json' | 'text' | 'blob';
}

async function graphRequest<T = any>(
  path: string,
  options: GraphRequestOptions = {}
): Promise<T> {
  const accessToken = await microsoftAuthService.getValidAccessToken();
  const response = await fetch(
    path.startsWith('http') ? path : `${MICROSOFT_GRAPH_BASE_URL}${path}`,
    {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.body instanceof Blob ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
      body:
        options.body === undefined
          ? undefined
          : options.body instanceof Blob
            ? options.body
            : JSON.stringify(options.body),
    }
  );

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(message || `Microsoft Graph request failed: ${response.status}`);
  }

  if (options.responseType === 'text') {
    return (await response.text()) as T;
  }

  if (options.responseType === 'blob') {
    return (await response.blob()) as T;
  }

  if (response.status === 204 || response.status === 202) {
    return {} as T;
  }

  const body = await response.text().catch(() => '');
  if (!body.trim()) {
    return {} as T;
  }

  return JSON.parse(body) as T;
}

function mapEmail(item: any) {
  return {
    id: item.id,
    threadId: item.conversationId,
    subject: item.subject,
    from: item.from?.emailAddress?.address || '',
    to:
      item.toRecipients?.map((recipient: any) => recipient.emailAddress?.address).filter(Boolean) ||
      [],
    body:
      item.body?.contentType === 'html'
        ? item.body?.content || ''
        : `<pre>${item.body?.content || ''}</pre>`,
    snippet: item.bodyPreview || '',
    receivedAt: item.receivedDateTime,
    isRead: !!item.isRead,
    hasAttachments: !!item.hasAttachments,
    webLink: item.webLink,
  };
}

function mapEvent(item: any) {
  return {
    id: item.id,
    subject: item.subject,
    start: item.start?.dateTime,
    end: item.end?.dateTime,
    location: item.location?.displayName || '',
    attendees:
      item.attendees?.map((attendee: any) => attendee.emailAddress?.address).filter(Boolean) || [],
    isOnlineMeeting: !!item.isOnlineMeeting,
    joinUrl: item.onlineMeeting?.joinUrl || item.onlineMeetingUrl || '',
  };
}

export const microsoftGraphService = {
  async getInboxMessages(limit = 25) {
    const data = await graphRequest<{ value: any[] }>(
      `/me/mailFolders/inbox/messages?$top=${limit}&$orderby=receivedDateTime DESC`
    );
    return data.value.map(mapEmail);
  },

  async sendEmail(input: {
    to: string[];
    subject: string;
    body: string;
    cc?: string[];
    bcc?: string[];
  }) {
    await graphRequest('/me/sendMail', {
      method: 'POST',
      body: {
        message: {
          subject: input.subject,
          body: { contentType: 'HTML', content: input.body },
          toRecipients: input.to.map((email) => ({ emailAddress: { address: email } })),
          ccRecipients: (input.cc || []).map((email) => ({ emailAddress: { address: email } })),
          bccRecipients: (input.bcc || []).map((email) => ({ emailAddress: { address: email } })),
        },
        saveToSentItems: true,
      },
    });

    return { success: true };
  },

  async getCalendarEvents(startDateTime?: string, endDateTime?: string) {
    const query = new URLSearchParams();
    if (startDateTime) query.set('startDateTime', startDateTime);
    if (endDateTime) query.set('endDateTime', endDateTime);
    const path = query.size
      ? `/me/calendarView?${query.toString()}`
      : '/me/events?$top=50&$orderby=start/dateTime';

    const data = await graphRequest<{ value: any[] }>(path);
    return data.value.map(mapEvent);
  },

  async createCalendarEvent(input: {
    subject: string;
    body?: string;
    start: string;
    end: string;
    attendees?: string[];
    location?: string;
    isOnlineMeeting?: boolean;
  }) {
    const event = await graphRequest<any>('/me/events', {
      method: 'POST',
      body: {
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
        onlineMeetingProvider: input.isOnlineMeeting ? 'teamsForBusiness' : undefined,
      },
    });

    return mapEvent(event);
  },

  async getTaskLists() {
    const data = await graphRequest<{ value: any[] }>('/me/todo/lists');
    return data.value;
  },

  async getTasks(listId: string) {
    const data = await graphRequest<{ value: any[] }>(`/me/todo/lists/${listId}/tasks`);
    return data.value;
  },

  async createTask(input: {
    listId: string;
    title: string;
    body?: string;
    dueDateTime?: string;
  }) {
    return graphRequest(`/me/todo/lists/${input.listId}/tasks`, {
      method: 'POST',
      body: {
        title: input.title,
        body: input.body ? { content: input.body, contentType: 'text' } : undefined,
        dueDateTime: input.dueDateTime
          ? { dateTime: input.dueDateTime, timeZone: 'UTC' }
          : undefined,
      },
    });
  },

  async completeTask(listId: string, taskId: string) {
    return graphRequest(`/me/todo/lists/${listId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: {
        status: 'completed',
      },
    });
  },

  async createTeamsMeeting(input: {
    subject: string;
    start: string;
    end: string;
    attendees?: string[];
    description?: string;
  }) {
    const meeting = await graphRequest<any>('/me/onlineMeetings', {
      method: 'POST',
      body: {
        subject: input.subject,
        startDateTime: input.start,
        endDateTime: input.end,
        participants: {
          attendees: (input.attendees || []).map((email) => ({
            upn: email,
          })),
        },
      },
    });

    return {
      id: meeting.id,
      subject: meeting.subject,
      joinUrl: meeting.joinWebUrl,
      chatInfo: meeting.chatInfo,
      organizer: meeting.organizer,
      description: input.description || '',
    };
  },

  async getTeamsMeetingTranscript(meetingId: string) {
    const accessToken = await microsoftAuthService.getValidAccessToken();
    const response = await fetch(
      `https://graph.microsoft.com/beta/me/onlineMeetings/${meetingId}/transcripts`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(await response.text().catch(() => 'Unable to fetch transcript.'));
    }

    return response.json();
  },

  async uploadFile(input: { file: File | Blob; fileName: string; folderPath?: string }) {
    const basePath = input.folderPath?.trim() ? `${input.folderPath.replace(/^\/+/, '')}/` : '';
    return graphRequest(
      `/me/drive/root:/${basePath}${input.fileName}:/content`,
      {
        method: 'PUT',
        body: input.file,
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      }
    );
  },

  async getContacts(limit = 50) {
    const data = await graphRequest<{ value: any[] }>(`/me/contacts?$top=${limit}`);
    return data.value;
  },

  async getTeams() {
    const data = await graphRequest<{ value: any[] }>('/me/joinedTeams');
    return data.value;
  },

  async getChannelMessages(teamId: string, channelId: string) {
    const data = await graphRequest<{ value: any[] }>(
      `/teams/${teamId}/channels/${channelId}/messages`
    );
    return data.value;
  },

  async getTeamChannels(teamId: string) {
    const data = await graphRequest<{ value: any[] }>(`/teams/${teamId}/channels`);
    return data.value;
  },

  async sendChannelMessage(teamId: string, channelId: string, message: string) {
    return graphRequest(`/teams/${teamId}/channels/${channelId}/messages`, {
      method: 'POST',
      body: {
        body: {
          content: message,
          contentType: 'text',
        },
      },
    });
  },

  async getChats() {
    const data = await graphRequest<{ value: any[] }>('/me/chats');
    return data.value;
  },

  async createChat(input: { userIds: string[]; chatType?: 'oneOnOne' | 'group'; topic?: string }) {
    const me = await this.getCurrentUser();
    const myId = me.id;
    const members = [
      {
        '@odata.type': '#microsoft.graph.aadUserConversationMember',
        roles: ['owner'],
        'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${myId}')`,
      },
      ...input.userIds.map((userId) => ({
        '@odata.type': '#microsoft.graph.aadUserConversationMember',
        roles: ['owner'],
        'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${userId}')`,
      })),
    ];
    return graphRequest('/chats', {
      method: 'POST',
      body: {
        chatType: input.chatType || (input.userIds.length > 1 ? 'group' : 'oneOnOne'),
        topic: input.topic,
        members,
      },
    });
  },

  async sendChatMessage(chatId: string, message: string) {
    return graphRequest(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: {
        body: {
          content: message,
          contentType: 'text',
        },
      },
    });
  },

  async getCurrentUser() {
    return graphRequest('/me');
  },

  async getMessage(messageId: string) {
    const data = await graphRequest<any>(`/me/messages/${messageId}`);
    return mapEmail(data);
  },

  async getFolderMessages(folder: string, limit = 25) {
    const folderPath = folder === 'sent' ? 'sentitems' : folder === 'trash' ? 'deleteditems' : folder === 'drafts' ? 'drafts' : 'inbox';
    const data = await graphRequest<{ value: any[] }>(
      `/me/mailFolders/${folderPath}/messages?$top=${limit}&$orderby=receivedDateTime DESC`
    );
    return data.value.map(mapEmail);
  },

  async getConversationMessages(conversationId: string) {
    const data = await graphRequest<{ value: any[] }>(
      `/me/messages?$filter=conversationId eq '${conversationId}'&$orderby=receivedDateTime ASC`
    );
    return data.value.map(mapEmail);
  },

  async replyToMessage(messageId: string, comment: string) {
    await graphRequest(`/me/messages/${messageId}/reply`, {
      method: 'POST',
      body: {
        comment,
      },
    });
    return { success: true };
  },
};
