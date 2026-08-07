export type InboxProvider = 'gmail' | 'microsoft' | 'zoho';

export type InboxFolder = 'inbox' | 'sent' | 'drafts' | 'trash';

/** Client-side / metadata labels for organizing mail beyond folders. */
export type InboxLabel =
  | 'needs-reply'
  | 'follow-up'
  | 'invoice'
  | 'contract'
  | 'vip'
  | 'personal';

export const INBOX_LABEL_OPTIONS: { id: InboxLabel; label: string }[] = [
  { id: 'needs-reply', label: 'Needs reply' },
  { id: 'follow-up', label: 'Follow-up' },
  { id: 'invoice', label: 'Invoice' },
  { id: 'contract', label: 'Contract' },
  { id: 'vip', label: 'VIP' },
  { id: 'personal', label: 'Personal' },
];

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
  isStarred?: boolean;
  hasAttachments?: boolean;
  webLink?: string;
  /** Zoho folder id — needed to fetch full message body */
  zohoFolderId?: string;
  /** Optional labels (server or client-attached) */
  labels?: InboxLabel[];
}
