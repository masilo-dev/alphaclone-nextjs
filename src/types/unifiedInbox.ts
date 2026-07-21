export type InboxProvider = 'microsoft' | 'zoho' | 'gmail';

export type InboxFolder = 'inbox' | 'sent' | 'drafts' | 'trash';

export interface UnifiedInboxMessage {
  id: string;
  provider: InboxProvider;
  subject: string;
  from: string;
  snippet: string;
  body?: string;
  receivedAt: string;
  /** Zoho folder id — needed to fetch full message body */
  zohoFolderId?: string;
}
