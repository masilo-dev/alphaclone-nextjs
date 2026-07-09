import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  refreshMicrosoftAccessToken,
  resolveMicrosoftUserId,
} from '@/services/microsoft/microsoftConnectionService';

const graphBase = 'https://graph.microsoft.com/v1.0';

async function ensureMicrosoftAccessToken(userId: string, tenantId?: string | null) {
  const supabase = createSupabaseAdminClient();
  const resolvedUserId = await resolveMicrosoftUserId(supabase, userId, tenantId);
  const { accessToken } = await refreshMicrosoftAccessToken(supabase, resolvedUserId);
  return { accessToken, resolvedUserId };
}

async function graphRequest(
  userId: string,
  tenantId: string | null | undefined,
  path: string,
  init?: RequestInit,
  retried = false
) {
  const supabase = createSupabaseAdminClient();
  const resolvedUserId = await resolveMicrosoftUserId(supabase, userId, tenantId);
  const { accessToken } = await refreshMicrosoftAccessToken(supabase, resolvedUserId);
  const response = await fetch(path.startsWith('http') ? path : `${graphBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
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
        await refreshMicrosoftAccessToken(supabase, resolvedUserId, { force: true });
        return graphRequest(userId, tenantId, path, init, true);
      } catch {
        // Fall through with the original error below.
      }
    }

    throw new Error(message);
  }

  if (response.status === 204) return { success: true };
  return response.json();
}

registerTool('microsoft', {
  name: 'microsoft_get_emails',
  description: 'Fetch recent Outlook inbox messages for the connected Microsoft account.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    limit: z.number().optional().default(20),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      limit: { type: 'number' },
    },
    required: ['tenant_id'],
  },
  handler: async (args, context) =>
    graphRequest(context.userId, args.tenant_id, `/me/mailFolders/inbox/messages?$top=${args.limit}&$orderby=receivedDateTime DESC`),
});

registerTool('microsoft', {
  name: 'microsoft_send_email',
  description: 'Send an Outlook email from the connected Microsoft account.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    to: z.array(z.string().email()),
    subject: z.string(),
    body: z.string(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      to: { type: 'array', items: { type: 'string', format: 'email' } },
      subject: { type: 'string' },
      body: { type: 'string' },
    },
    required: ['tenant_id', 'to', 'subject', 'body'],
  },
  handler: async (args, context) =>
    graphRequest(context.userId, args.tenant_id, '/me/sendMail', {
      method: 'POST',
      body: JSON.stringify({
        message: {
          subject: args.subject,
          body: { contentType: 'HTML', content: args.body },
          toRecipients: args.to.map((email) => ({ emailAddress: { address: email } })),
        },
        saveToSentItems: true,
      }),
    }),
});

registerTool('microsoft', {
  name: 'microsoft_create_meeting',
  description: 'Create a Microsoft Teams online meeting.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    subject: z.string(),
    start: z.string(),
    end: z.string(),
    attendees: z.array(z.string().email()).optional().default([]),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      subject: { type: 'string' },
      start: { type: 'string' },
      end: { type: 'string' },
      attendees: { type: 'array', items: { type: 'string', format: 'email' } },
    },
    required: ['tenant_id', 'subject', 'start', 'end'],
  },
  handler: async (args, context) =>
    graphRequest(context.userId, args.tenant_id, '/me/onlineMeetings', {
      method: 'POST',
      body: JSON.stringify({
        subject: args.subject,
        startDateTime: args.start,
        endDateTime: args.end,
        participants: {
          attendees: args.attendees.map((email) => ({ upn: email })),
        },
      }),
    }),
});

registerTool('microsoft', {
  name: 'microsoft_get_calendar',
  description: 'Fetch Microsoft calendar events.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    startDateTime: z.string().optional(),
    endDateTime: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      startDateTime: { type: 'string' },
      endDateTime: { type: 'string' },
    },
    required: ['tenant_id'],
  },
  handler: async (args, context) => {
    const params = new URLSearchParams();
    if (args.startDateTime) params.set('startDateTime', args.startDateTime);
    if (args.endDateTime) params.set('endDateTime', args.endDateTime);
    const path = params.size ? `/me/calendarView?${params.toString()}` : '/me/events';
    return graphRequest(context.userId, args.tenant_id, path);
  },
});

registerTool('microsoft', {
  name: 'microsoft_create_event',
  description: 'Create a Microsoft calendar event.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    subject: z.string(),
    start: z.string(),
    end: z.string(),
    attendees: z.array(z.string().email()).optional().default([]),
    isOnlineMeeting: z.boolean().optional().default(true),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      subject: { type: 'string' },
      start: { type: 'string' },
      end: { type: 'string' },
      attendees: { type: 'array', items: { type: 'string', format: 'email' } },
      isOnlineMeeting: { type: 'boolean' },
    },
    required: ['tenant_id', 'subject', 'start', 'end'],
  },
  handler: async (args, context) =>
    graphRequest(context.userId, args.tenant_id, '/me/events', {
      method: 'POST',
      body: JSON.stringify({
        subject: args.subject,
        start: { dateTime: args.start, timeZone: 'UTC' },
        end: { dateTime: args.end, timeZone: 'UTC' },
        attendees: args.attendees.map((email) => ({
          emailAddress: { address: email },
          type: 'required',
        })),
        isOnlineMeeting: args.isOnlineMeeting,
        onlineMeetingProvider: args.isOnlineMeeting ? 'teamsForBusiness' : undefined,
      }),
    }),
});

registerTool('microsoft', {
  name: 'microsoft_get_tasks',
  description: 'Fetch Microsoft To Do tasks for a list or return lists first.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    list_id: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      list_id: { type: 'string' },
    },
    required: ['tenant_id'],
  },
  handler: async (args, context) =>
    graphRequest(
      context.userId,
      args.tenant_id,
      args.list_id ? `/me/todo/lists/${args.list_id}/tasks` : '/me/todo/lists'
    ),
});

registerTool('microsoft', {
  name: 'microsoft_create_task',
  description: 'Create a Microsoft To Do task.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    list_id: z.string(),
    title: z.string(),
    dueDateTime: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      list_id: { type: 'string' },
      title: { type: 'string' },
      dueDateTime: { type: 'string' },
    },
    required: ['tenant_id', 'list_id', 'title'],
  },
  handler: async (args, context) =>
    graphRequest(context.userId, args.tenant_id, `/me/todo/lists/${args.list_id}/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        title: args.title,
        dueDateTime: args.dueDateTime
          ? { dateTime: args.dueDateTime, timeZone: 'UTC' }
          : undefined,
      }),
    }),
});

registerTool('microsoft', {
  name: 'microsoft_get_contacts',
  description: 'Fetch Outlook contacts.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    limit: z.number().optional().default(50),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      limit: { type: 'number' },
    },
    required: ['tenant_id'],
  },
  handler: async (args, context) =>
    graphRequest(context.userId, args.tenant_id, `/me/contacts?$top=${args.limit}`),
});

registerTool('microsoft', {
  name: 'microsoft_upload_file',
  description: 'Upload a file into OneDrive using a base64 payload.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    file_name: z.string(),
    content_base64: z.string(),
    folder_path: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      file_name: { type: 'string' },
      content_base64: { type: 'string' },
      folder_path: { type: 'string' },
    },
    required: ['tenant_id', 'file_name', 'content_base64'],
  },
  handler: async (args, context) => {
    const { accessToken } = await ensureMicrosoftAccessToken(context.userId, args.tenant_id);
    const folderPrefix = args.folder_path?.trim() ? `${args.folder_path.replace(/^\/+/, '')}/` : '';
    const response = await fetch(
      `${graphBase}/me/drive/root:/${folderPrefix}${args.file_name}:/content`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
        },
        body: Buffer.from(args.content_base64, 'base64'),
      }
    );

    if (!response.ok) {
      throw new Error(await response.text().catch(() => 'Microsoft file upload failed.'));
    }

    return response.json();
  },
});

registerTool('microsoft', {
  name: 'microsoft_get_teams_messages',
  description: 'Fetch channel messages for a Microsoft Teams channel.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    team_id: z.string(),
    channel_id: z.string(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      team_id: { type: 'string' },
      channel_id: { type: 'string' },
    },
    required: ['tenant_id', 'team_id', 'channel_id'],
  },
  handler: async (args, context) =>
    graphRequest(context.userId, args.tenant_id, `/teams/${args.team_id}/channels/${args.channel_id}/messages`),
});

registerTool('microsoft', {
  name: 'microsoft_get_joined_teams',
  description: 'List teams the connected user is a member of.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id'],
  },
  handler: async (args, context) =>
    graphRequest(context.userId, args.tenant_id, '/me/joinedTeams'),
});

registerTool('microsoft', {
  name: 'microsoft_get_team_channels',
  description: 'List channels in a Microsoft Team.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    team_id: z.string(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      team_id: { type: 'string' },
    },
    required: ['tenant_id', 'team_id'],
  },
  handler: async (args, context) =>
    graphRequest(context.userId, args.tenant_id, `/teams/${args.team_id}/channels`),
});

registerTool('microsoft', {
  name: 'microsoft_send_channel_message',
  description: 'Send a message to a Microsoft Teams channel.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    team_id: z.string(),
    channel_id: z.string(),
    message: z.string(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      team_id: { type: 'string' },
      channel_id: { type: 'string' },
      message: { type: 'string' },
    },
    required: ['tenant_id', 'team_id', 'channel_id', 'message'],
  },
  handler: async (args, context) =>
    graphRequest(context.userId, args.tenant_id, `/teams/${args.team_id}/channels/${args.channel_id}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        body: {
          content: args.message,
          contentType: 'text',
        },
      }),
    }),
});

registerTool('microsoft', {
  name: 'microsoft_get_chats',
  description: 'List 1-on-1 or group chats the user is part of.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id'],
  },
  handler: async (args, context) =>
    graphRequest(context.userId, args.tenant_id, '/me/chats'),
});

registerTool('microsoft', {
  name: 'microsoft_create_chat',
  description: 'Create a new Microsoft Teams chat (1-on-1 or group).',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    userIds: z.array(z.string()),
    chatType: z.enum(['oneOnOne', 'group']).optional().default('oneOnOne'),
    topic: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      userIds: { type: 'array', items: { type: 'string' } },
      chatType: { type: 'string', enum: ['oneOnOne', 'group'] },
      topic: { type: 'string' },
    },
    required: ['tenant_id', 'userIds'],
  },
  handler: async (args, context) => {
    const me = await graphRequest(context.userId, args.tenant_id, '/me');
    const myId = me.id;
    const members = [
      {
        '@odata.type': '#microsoft.graph.aadUserConversationMember',
        roles: ['owner'],
        'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${myId}')`,
      },
      ...args.userIds.map((userId) => ({
        '@odata.type': '#microsoft.graph.aadUserConversationMember',
        roles: ['owner'],
        'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${userId}')`,
      })),
    ];
    return graphRequest(context.userId, args.tenant_id, '/chats', {
      method: 'POST',
      body: JSON.stringify({
        chatType: args.chatType,
        topic: args.topic,
        members,
      }),
    });
  },
});

registerTool('microsoft', {
  name: 'microsoft_send_chat_message',
  description: 'Send a message to a Microsoft Teams chat.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    chat_id: z.string(),
    message: z.string(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      chat_id: { type: 'string' },
      message: { type: 'string' },
    },
    required: ['tenant_id', 'chat_id', 'message'],
  },
  handler: async (args, context) =>
    graphRequest(context.userId, args.tenant_id, `/chats/${args.chat_id}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        body: {
          content: args.message,
          contentType: 'text',
        },
      }),
    }),
});
