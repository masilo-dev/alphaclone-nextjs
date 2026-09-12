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
  attachments?: Array<{ filename: string; content: string | Buffer; contentType?: string }>;
  listUnsubscribeUrl?: string;
};

export type ProviderSendReceipt = {
  accepted: boolean;
  provider: UnifiedEmailProvider;
  providerAccountId: string;
  providerMessageId?: string;
  providerThreadId?: string;
  acceptedAt?: string;
  error?: { code: string; message: string; retryable: boolean };
  rawMetadata?: Record<string, unknown>;
};

export interface EmailProviderAdapter {
  readonly provider: UnifiedEmailProvider;
  getCapabilities(): EmailProviderCapabilities;
  refreshConnection(accountId: string): Promise<{ healthy: boolean; reason?: string }>;
  listSenderIdentities(accountId: string): Promise<Array<{ providerId: string; emailAddress: string }>>;
  listFolders(accountId: string): Promise<Array<{ providerId: string; name: string }>>;
  syncMessages(input: { accountId: string; cursor?: string }): Promise<{ messages: unknown[]; nextCursor?: string }>;
  sendMessage(input: ProviderSendInput): Promise<ProviderSendReceipt>;
  replyToMessage(input: ProviderSendInput & { providerMessageId: string }): Promise<{ providerMessageId: string }>;
  forwardMessage(input: ProviderSendInput & { providerMessageId: string }): Promise<{ providerMessageId: string }>;
  markRead(input: ProviderMessageActionInput): Promise<void>;
  archiveMessage(input: ProviderMessageActionInput): Promise<void>;
  moveMessage(input: ProviderMessageActionInput & { providerFolderId: string }): Promise<void>;
  deleteMessage(input: ProviderMessageActionInput): Promise<void>;
  verifyWebhook(input: { headers: Headers; rawBody: string }): Promise<boolean>;
  parseWebhook(input: { headers: Headers; rawBody: string }): Promise<unknown[]>;
}

/** One registry for campaign, MCP, Bonnie and workflow execution. */
export class EmailProviderRegistry {
  private readonly adapters = new Map<UnifiedEmailProvider, EmailProviderAdapter>();

  register(adapter: EmailProviderAdapter): void { this.adapters.set(adapter.provider, adapter); }
  has(provider: UnifiedEmailProvider): boolean { return this.adapters.has(provider); }
  get(provider: UnifiedEmailProvider): EmailProviderAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new Error(`EMAIL_PROVIDER_ADAPTER_NOT_REGISTERED:${provider}`);
    return adapter;
  }
}

export function normalizeProviderReceipt(input: {
  provider: UnifiedEmailProvider;
  providerAccountId: string;
  providerMessageId?: string;
  providerThreadId?: string;
  acceptedAt?: string;
  error?: { code: string; message: string; retryable: boolean };
  rawMetadata?: Record<string, unknown>;
}): ProviderSendReceipt {
  return {
    accepted: !input.error && Boolean(input.providerMessageId),
    provider: input.provider,
    providerAccountId: input.providerAccountId,
    providerMessageId: input.providerMessageId,
    providerThreadId: input.providerThreadId,
    acceptedAt: input.acceptedAt,
    error: input.error,
    rawMetadata: input.rawMetadata,
  };
}
