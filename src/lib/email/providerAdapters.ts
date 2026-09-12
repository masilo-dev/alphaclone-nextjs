import { sendWithProviderSdk, type EmailProvider } from '@/lib/email/providerSdk';
import { PROVIDER_CAPABILITIES, type EmailProviderCapabilities, type UnifiedEmailProvider } from '@/lib/email/unifiedEmailDomain';
import type { EmailProviderAdapter, ProviderMessageActionInput, ProviderSendInput, ProviderSendReceipt } from '@/lib/email/providerAdapter';

export type ProviderAdapterContext = {
  tenantId: string;
  apiKey: string;
  ownerUserId?: string | null;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
};

function classify(message: string): { code: string; retryable: boolean } {
  const value = message.toLowerCase();
  if (/429|rate.?limit|too many/.test(value)) return { code: 'EMAIL_RATE_LIMITED', retryable: true };
  if (/timeout|network|econn|socket|temporar|5\d\d/.test(value)) return { code: 'EMAIL_PROVIDER_TEMPORARY', retryable: true };
  if (/oauth|refresh token|token.*expired/.test(value)) return { code: 'EMAIL_OAUTH_TEMPORARY', retryable: true };
  if (/invalid.*(address|recipient)|hard bounce|mailbox.*not found/.test(value)) return { code: 'EMAIL_INVALID_RECIPIENT', retryable: false };
  if (/sender|from address|domain.*verif/.test(value)) return { code: 'EMAIL_SENDER_NOT_VERIFIED', retryable: false };
  if (/forbidden|permission|unauthori[sz]ed/.test(value)) return { code: 'EMAIL_PERMISSION_DENIED', retryable: false };
  return { code: 'EMAIL_PROVIDER_REJECTED', retryable: false };
}

abstract class BaseProviderAdapter implements EmailProviderAdapter {
  abstract readonly provider: UnifiedEmailProvider;
  protected abstract readonly transport: EmailProvider;
  constructor(protected readonly context: ProviderAdapterContext) {}

  getCapabilities(): EmailProviderCapabilities { return PROVIDER_CAPABILITIES[this.provider]; }
  async sendMessage(input: ProviderSendInput): Promise<ProviderSendReceipt> {
    const result = await sendWithProviderSdk(this.transport, {
      apiKey: this.context.apiKey, tenantId: this.context.tenantId, userId: this.context.ownerUserId || undefined,
      fromEmail: input.from, to: input.to, cc: input.cc, bcc: input.bcc, replyTo: input.replyTo,
      subject: input.subject, html: input.html, text: input.text, attachments: input.attachments,
      listUnsubscribeUrl: input.listUnsubscribeUrl, smtpHost: this.context.smtpHost, smtpPort: this.context.smtpPort,
      smtpUser: this.context.smtpUser, smtpPass: this.context.smtpPass,
    });
    if (result.ok) return {
      accepted: true, provider: this.provider, providerAccountId: input.accountId,
      providerMessageId: result.emailId, acceptedAt: new Date().toISOString(), rawMetadata: {},
    };
    const message = result.error || `${this.provider} rejected the delivery`;
    const error = classify(message);
    return { accepted: false, provider: this.provider, providerAccountId: input.accountId, error: { ...error, message }, rawMetadata: {} };
  }
  async refreshConnection(): Promise<{ healthy: boolean; reason?: string }> { return { healthy: true }; }
  async listSenderIdentities(): Promise<Array<{ providerId: string; emailAddress: string }>> { return []; }
  async listFolders(): Promise<Array<{ providerId: string; name: string }>> { return []; }
  async syncMessages(): Promise<{ messages: unknown[]; nextCursor?: string }> { return { messages: [] }; }
  async replyToMessage(input: ProviderSendInput & { providerMessageId: string }): Promise<{ providerMessageId: string }> {
    const receipt = await this.sendMessage(input);
    if (!receipt.accepted) throw new Error(receipt.error?.message || 'EMAIL_PROVIDER_REJECTED');
    return { providerMessageId: receipt.providerMessageId || input.providerMessageId };
  }
  async forwardMessage(input: ProviderSendInput & { providerMessageId: string }): Promise<{ providerMessageId: string }> { return this.replyToMessage(input); }
  async markRead(_input: ProviderMessageActionInput): Promise<void> { throw new Error('EMAIL_PROVIDER_OPERATION_UNSUPPORTED'); }
  async archiveMessage(_input: ProviderMessageActionInput): Promise<void> { throw new Error('EMAIL_PROVIDER_OPERATION_UNSUPPORTED'); }
  async moveMessage(_input: ProviderMessageActionInput & { providerFolderId: string }): Promise<void> { throw new Error('EMAIL_PROVIDER_OPERATION_UNSUPPORTED'); }
  async deleteMessage(_input: ProviderMessageActionInput): Promise<void> { throw new Error('EMAIL_PROVIDER_OPERATION_UNSUPPORTED'); }
  async verifyWebhook(): Promise<boolean> { return false; }
  async parseWebhook(): Promise<unknown[]> { return []; }
}

export class BrevoAdapter extends BaseProviderAdapter { readonly provider = 'brevo' as const; protected readonly transport = 'brevo' as const; }
export class ZohoAdapter extends BaseProviderAdapter { readonly provider = 'zoho' as const; protected readonly transport = 'zoho' as const; }
export class GmailAdapter extends BaseProviderAdapter { readonly provider = 'gmail' as const; protected readonly transport = 'gmail' as const; }
export class MicrosoftGraphAdapter extends BaseProviderAdapter { readonly provider = 'microsoft_graph' as const; protected readonly transport = 'outlook' as const; }
export class SendGridAdapter extends BaseProviderAdapter { readonly provider = 'sendgrid' as const; protected readonly transport = 'sendgrid' as const; }
export class ResendAdapter extends BaseProviderAdapter { readonly provider = 'resend' as const; protected readonly transport = 'resend' as const; }
export class SmtpAdapter extends BaseProviderAdapter { readonly provider = 'smtp' as const; protected readonly transport = 'smtp' as const; }

export function createProviderAdapter(provider: UnifiedEmailProvider, context: ProviderAdapterContext): EmailProviderAdapter {
  switch (provider) {
    case 'brevo': return new BrevoAdapter(context);
    case 'zoho': return new ZohoAdapter(context);
    case 'gmail': return new GmailAdapter(context);
    case 'microsoft_graph': return new MicrosoftGraphAdapter(context);
    case 'sendgrid': return new SendGridAdapter(context);
    case 'resend': return new ResendAdapter(context);
    case 'smtp': return new SmtpAdapter(context);
    default: throw new Error(`EMAIL_PROVIDER_ADAPTER_NOT_REGISTERED:${provider}`);
  }
}
