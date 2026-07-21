export type InboxProvider = 'microsoft' | 'zoho';

export type InboxFolder = 'inbox' | 'sent' | 'drafts' | 'trash';

export interface UnifiedInboxMessage {
  id: string;
  provider: InboxProvider;
  subject: string;
  from: string;
  to?: string[];
  snippet: string;
  body?: string;
  receivedAt: string;
  threadId?: string;
  isRead?: boolean;
  hasAttachments?: boolean;
  webLink?: string;
  /** Zoho folder id — needed to fetch full message body */
  zohoFolderId?: string;
}
