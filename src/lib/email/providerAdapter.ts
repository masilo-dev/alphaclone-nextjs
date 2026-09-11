import type {
  EmailProviderCapabilities,
  UnifiedEmailProvider,
} from '@/lib/email/unifiedEmailDomain';

export type ProviderMessageActionInput = { accountId: string; providerMessageId: string };
export type ProviderSendInput = {
  accountId: string;
  senderIdentityId: string;
  from: string;
  replyTo?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html?: string;
  text?: string;
  idempotencyKey: string;
};

export interface EmailProviderAdapter {
  readonly provider: UnifiedEmailProvider;
  getCapabilities(): EmailProviderCapabilities;
  refreshConnection(accountId: string): Promise<{ healthy: boolean; reason?: string }>;
  listSenderIdentities(accountId: string): Promise<Array<{ providerId: string; emailAddress: string }>>;
  listFolders(accountId: string): Promise<Array<{ providerId: string; name: string }>>;
  syncMessages(input: { accountId: string; cursor?: string }): Promise<{ messages: unknown[]; nextCursor?: string }>;
  sendMessage(input: ProviderSendInput): Promise<{ providerMessageId: string; acceptedAt: string }>;
  replyToMessage(input: ProviderSendInput & { providerMessageId: string }): Promise<{ providerMessageId: string }>;
  forwardMessage(input: ProviderSendInput & { providerMessageId: string }): Promise<{ providerMessageId: string }>;
  markRead(input: ProviderMessageActionInput): Promise<void>;
  archiveMessage(input: ProviderMessageActionInput): Promise<void>;
  moveMessage(input: ProviderMessageActionInput & { providerFolderId: string }): Promise<void>;
  deleteMessage(input: ProviderMessageActionInput): Promise<void>;
  verifyWebhook(input: { headers: Headers; rawBody: string }): Promise<boolean>;
  parseWebhook(input: { headers: Headers; rawBody: string }): Promise<unknown[]>;
}
