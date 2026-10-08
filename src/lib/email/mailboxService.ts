import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ZohoMailService } from '@/services/zoho/ZohoMailService';
import { mailboxDate, replyRecipients } from './mailboxNormalization';

export interface MailboxFolder {
  folderId: string;
  folderName: string;
}

export interface MailboxRawMessage {
  messageId: string;
  folderId?: string;
  receivedTime?: string;
  [key: string]: unknown;
}

export interface MailboxFullMessage {
  id: string;
  thread_id: string | null;
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  date: string | null;
  is_read: boolean;
  body_html: string;
  body_text: string;
  attachments: Array<{ filename: string; size?: number; attachment_id?: string }>;
  folder_id?: string;
  headers?: Record<string, unknown>;
  reply_to?: string;
}

export interface MailboxVerification {
  account_id: string;
  address: string;
  folders: MailboxFolder[];
  verified_at: string;
  send_scope_granted: boolean | null;
}

export interface MailboxAdapter {
  verifyMailboxAccess(): Promise<MailboxVerification>;
  getFolders(): Promise<MailboxFolder[]>;
  getMessages(folderId: string, limit?: number, start?: number): Promise<any[]>;
  searchMessages(query: string, limit?: number, start?: number): Promise<any[]>;
  getFullMessagePayload(message: any, folderId?: string): Promise<MailboxFullMessage>;
  replyToMessage(params: {
    messageId: string;
    original?: MailboxFullMessage;
    bodyHtml: string;
    bodyText?: string;
    replyAll?: boolean;
    attachments?: Array<{ filename: string; content: string; contentType?: string }>;
  }): Promise<{
    messageId: string;
    data?: { messageId: string };
    original: { subject: string };
    recipients: { to: string[]; cc: string[] };
    [key: string]: unknown;
  }>;
}

type MailboxAccount = {
  id: string;
  provider: string;
  owner_user_id: string;
  account_type: string;
  email_address: string | null;
  provider_account_id: string | null;
  capabilities: Record<string, unknown>;
  last_successful_sync_at: string | null;
  sync_status: string;
  settings: Record<string, unknown>;
};
type MailboxSyncJob = {
  id: string;
  provider_account_id: string;
  status: string;
  cursor: Record<string, unknown>;
  message_count: number;
  updated_at: string;
  error_code?: string;
  error_message?: string;
  next_action?: string | null;
};
export function mailboxError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : (error as { message?: string })?.message || String(error);
  const status = (error as { status?: number })?.status;
  const explicit = message.match(
    /(?:^|:\s*)(EMAIL_[A-Z_]+|ZOHO_[A-Z_]+|MICROSOFT_[A-Z_]+):?/,
  );
  const code =
    explicit?.[1] === 'MICROSOFT_RECONNECT_REQUIRED'
      ? 'EMAIL_RECONNECT_REQUIRED'
      : explicit?.[1] ||
        (status === 403 || /scope|permission/i.test(message)
          ? 'EMAIL_PERMISSION_MISSING'
          : /reconnect|auth.*expired|refresh token|invalid_grant|decrypted with any configured secret/i.test(
                message,
              )
            ? 'EMAIL_AUTH_EXPIRED'
            : /timeout|abort/i.test(message)
              ? 'EMAIL_PROVIDER_TIMEOUT'
              : 'EMAIL_MAILBOX_FAILED');
  return { code, message };
}
function checked<T extends { error: unknown }>(result: T): T {
  if (result.error)
    throw new Error(
      `EMAIL_STORAGE_FAILED: ${(result.error as { message?: string }).message || String(result.error)}`,
    );
  return result;
}

export class MicrosoftGraphMailboxAdapter implements MailboxAdapter {
  constructor(
    readonly userId: string,
    readonly tenantId: string,
    readonly db: ReturnType<typeof createSupabaseAdminClient>,
  ) {}

  private async getValidAccessToken(): Promise<string> {
    try {
      const {
        getMicrosoftTokens,
        refreshMicrosoftAccessToken,
      } = await import('@/services/microsoft/microsoftConnectionService');
      const { connection } = await getMicrosoftTokens(this.db, this.userId);
      if (!connection) {
        throw new Error('EMAIL_MAILBOX_NOT_CONNECTED: Microsoft 365 is not connected.');
      }
      const { accessToken } = await refreshMicrosoftAccessToken(this.db, this.userId);
      if (!accessToken) {
        throw new Error('EMAIL_AUTH_EXPIRED: Microsoft 365 access token could not be obtained.');
      }
      return accessToken;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        (err as { code?: string })?.code === 'MICROSOFT_RECONNECT_REQUIRED' ||
        /reconnect|secret|decrypt|malformed/i.test(message)
      ) {
        throw new Error(
          'EMAIL_RECONNECT_REQUIRED: Microsoft 365 session expired. Reconnect in Settings → Integrations.',
        );
      }
      throw err;
    }
  }

  private async graphFetch(path: string, options: RequestInit = {}): Promise<any> {
    const accessToken = await this.getValidAccessToken();
    const url = path.startsWith('https://')
      ? path
      : `https://graph.microsoft.com/v1.0${path.startsWith('/') ? path : `/${path}`}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 401 || res.status === 403 || /invalid.*token|expired/i.test(text)) {
        throw new Error('EMAIL_AUTH_EXPIRED: Microsoft Graph access token rejected.');
      }
      throw new Error(`MICROSOFT_GRAPH_ERROR_${res.status}: ${text || res.statusText}`);
    }
    if (res.status === 204) return {};
    return res.json().catch(() => ({}));
  }

  async verifyMailboxAccess(): Promise<MailboxVerification> {
    const profile = await this.graphFetch('/me');
    const address = profile.mail || profile.userPrincipalName;
    if (!address || !String(address).includes('@')) {
      throw new Error('EMAIL_MAILBOX_ADDRESS_UNAVAILABLE');
    }
    const folders = await this.getFolders();
    const inbox = folders.find((f) => f.folderName.toLowerCase() === 'inbox');
    if (!inbox) throw new Error('EMAIL_INBOX_NOT_FOUND');
    await this.getMessages(inbox.folderId, 1, 1);
    return {
      account_id: String(profile.id),
      address: String(address),
      folders,
      verified_at: new Date().toISOString(),
      send_scope_granted: true,
    };
  }

  async getFolders(): Promise<MailboxFolder[]> {
    const data = await this.graphFetch('/me/mailFolders?$top=50');
    const list = Array.isArray(data?.value) ? data.value : [];
    return list.map((f: any) => ({
      folderId: String(f.id),
      folderName: String(f.displayName || 'Folder'),
    }));
  }

  async getMessages(folderId: string, limit = 20, start = 1): Promise<MailboxRawMessage[]> {
    const skip = Math.max(0, start - 1);
    const select = [
      'id',
      'conversationId',
      'subject',
      'from',
      'toRecipients',
      'ccRecipients',
      'receivedDateTime',
      'isRead',
      'hasAttachments',
      'bodyPreview',
      'body',
      'internetMessageHeaders',
    ].join(',');
    const data = await this.graphFetch(
      `/me/mailFolders/${encodeURIComponent(folderId)}/messages?$top=${limit}&$skip=${skip}&$orderby=receivedDateTime%20desc&$select=${select}`,
    );
    const list = Array.isArray(data?.value) ? data.value : [];
    return list.map((msg: any) => ({
      ...msg,
      messageId: String(msg.id),
      folderId,
      receivedTime: String(msg.receivedDateTime || ''),
    }));
  }

  async searchMessages(query: string, limit = 20, start = 1): Promise<MailboxRawMessage[]> {
    const skip = Math.max(0, start - 1);
    const select = [
      'id',
      'conversationId',
      'subject',
      'from',
      'toRecipients',
      'ccRecipients',
      'receivedDateTime',
      'isRead',
      'hasAttachments',
      'bodyPreview',
      'body',
      'parentFolderId',
      'internetMessageHeaders',
    ].join(',');
    const data = await this.graphFetch(
      `/me/messages?$search="${encodeURIComponent(query)}"&$top=${limit}&$skip=${skip}&$select=${select}`,
    );
    const list = Array.isArray(data?.value) ? data.value : [];
    return list.map((msg: any) => ({
      ...msg,
      messageId: String(msg.id),
      folderId: String(msg.parentFolderId || ''),
      receivedTime: String(msg.receivedDateTime || ''),
    }));
  }

  async getFullMessagePayload(message: any, folderId?: string): Promise<MailboxFullMessage> {
    let full = message;
    if (!full.body?.content) {
      const select = [
        'id',
        'conversationId',
        'subject',
        'from',
        'toRecipients',
        'ccRecipients',
        'receivedDateTime',
        'isRead',
        'hasAttachments',
        'bodyPreview',
        'body',
        'parentFolderId',
        'internetMessageHeaders',
      ].join(',');
      full = await this.graphFetch(
        `/me/messages/${encodeURIComponent(message.id || message.messageId)}?$select=${select}`,
      );
    }
    const html = full.body?.contentType === 'html' ? String(full.body?.content || '') : '';
    const text =
      full.body?.contentType === 'text'
        ? String(full.body?.content || '')
        : (html
            .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim() || String(full.bodyPreview || ''));

    const headers: Record<string, string> = {};
    if (Array.isArray(full.internetMessageHeaders)) {
      for (const h of full.internetMessageHeaders) {
        if (h?.name && h?.value) {
          headers[String(h.name).toLowerCase()] = String(h.value);
        }
      }
    }

    const fromAddress = full.from?.emailAddress?.address || '';
    const fromName = full.from?.emailAddress?.name || '';
    const fromStr = fromName && fromAddress ? `${fromName} <${fromAddress}>` : fromAddress || fromName;

    const toAddresses = Array.isArray(full.toRecipients)
      ? full.toRecipients.map((r: any) => r.emailAddress?.address).filter(Boolean)
      : [];
    const ccAddresses = Array.isArray(full.ccRecipients)
      ? full.ccRecipients.map((r: any) => r.emailAddress?.address).filter(Boolean)
      : [];

    return {
      id: String(full.id),
      thread_id: String(full.conversationId || headers['references'] || headers['in-reply-to'] || full.id),
      subject: String(full.subject || ''),
      from: fromStr,
      to: toAddresses,
      cc: ccAddresses,
      date: mailboxDate(full.receivedDateTime),
      is_read: Boolean(full.isRead),
      body_html: html,
      body_text: text,
      attachments: [],
      folder_id: folderId || full.parentFolderId,
      headers,
      reply_to: headers['reply-to'],
    };
  }

  async replyToMessage(params: {
    messageId: string;
    bodyHtml: string;
    bodyText?: string;
    original?: MailboxFullMessage;
    replyAll?: boolean;
    attachments?: Array<{ filename: string; content: string; contentType?: string }>;
  }) {
    const action = params.replyAll ? 'createReplyAll' : 'createReply';
    const draft = await this.graphFetch(`/me/messages/${encodeURIComponent(params.messageId)}/${action}`, {
      method: 'POST',
    });
    const draftId = String(draft?.id || params.messageId);

    await this.graphFetch(`/me/messages/${encodeURIComponent(draftId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        body: {
          contentType: params.bodyHtml ? 'html' : 'text',
          content: params.bodyHtml || params.bodyText || '',
        },
      }),
    });

    await this.graphFetch(`/me/messages/${encodeURIComponent(draftId)}/send`, {
      method: 'POST',
    });

    const original = params.original || {
      subject: String(draft.subject || ''),
      from: '',
      to: [],
      cc: [],
    };
    const own = [draft.from?.emailAddress?.address || ''];
    const recipients = replyRecipients(original, own, Boolean(params.replyAll));

    return {
      messageId: draftId,
      data: { messageId: draftId },
      original: { subject: original.subject },
      recipients,
    };
  }
}

export class GmailMailboxAdapter implements MailboxAdapter {
  constructor(
    readonly userId: string,
    readonly tenantId: string,
    readonly db: ReturnType<typeof createSupabaseAdminClient>,
  ) {}

  private async getImapClient() {
    const { resolveEmailProviderConfig } = await import(
      '@/lib/email/providerIntegrationResolver'
    );
    const config = await resolveEmailProviderConfig({
      preferredUserId: this.userId,
      preferredProvider: 'gmail',
    });
    if (!config || config.provider !== 'gmail' || !config.apiKey) {
      throw new Error(
        'EMAIL_AUTH_EXPIRED: Gmail integration not configured with App Password.',
      );
    }
    const { gmailServerService } = await import(
      '@/services/server/gmailServerService'
    );
    return { client: await gmailServerService.getImapClient(this.userId), config };
  }

  async verifyMailboxAccess(): Promise<MailboxVerification> {
    const { client, config } = await this.getImapClient();
    await client.connect();
    try {
      const lock = await client.getMailboxLock('INBOX');
      lock.release();
      const folders: MailboxFolder[] = [
        { folderId: 'INBOX', folderName: 'Inbox' },
        { folderId: '[Gmail]/Sent Mail', folderName: 'Sent' },
      ];
      return {
        account_id: config.fromEmail!,
        address: config.fromEmail!,
        folders,
        verified_at: new Date().toISOString(),
        send_scope_granted: true,
      };
    } finally {
      await client.logout();
    }
  }

  async getFolders(): Promise<MailboxFolder[]> {
    const { client } = await this.getImapClient();
    await client.connect();
    try {
      const list = await client.list();
      return list.map((box: any) => ({
        folderId: box.path,
        folderName: box.name,
      }));
    } finally {
      await client.logout();
    }
  }

  async getMessages(folderId = 'INBOX', limit = 20, _start = 1): Promise<MailboxRawMessage[]> {
    const { client } = await this.getImapClient();
    await client.connect();
    try {
      const lock = await client.getMailboxLock(folderId);
      try {
        const messages: MailboxRawMessage[] = [];
        // @ts-ignore
        for await (const msg of client.fetch({ last: limit }, { envelope: true, source: false, gmThreadId: true })) {
          const env = msg.envelope;
          if (!env) continue;
          messages.push({
            messageId: msg.uid.toString(),
            id: msg.uid.toString(),
            // @ts-ignore
            threadId: msg.gmThreadId || msg.uid.toString(),
            subject: env.subject || '',
            from: env.from?.[0] ? `${env.from[0].name || ''} <${env.from[0].address}>`.trim() : 'Unknown',
            to: (env.to || []).map((t: any) => t.address).filter(Boolean),
            cc: (env.cc || []).map((c: any) => c.address).filter(Boolean),
            receivedTime: env.date?.toISOString(),
            date: env.date?.toISOString(),
            folderId,
          });
        }
        return messages.reverse();
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  async searchMessages(query: string, limit = 20, _start = 1): Promise<MailboxRawMessage[]> {
    const { client } = await this.getImapClient();
    await client.connect();
    try {
      const lock = await client.getMailboxLock('INBOX');
      try {
        const uids = await client.search({ body: query });
        if (!uids || !uids.length) return [];
        const messages: MailboxRawMessage[] = [];
        // @ts-ignore
        for await (const msg of client.fetch(uids.slice(-limit), { envelope: true, gmThreadId: true })) {
          const env = msg.envelope;
          if (!env) continue;
          messages.push({
            messageId: msg.uid.toString(),
            id: msg.uid.toString(),
            // @ts-ignore
            threadId: msg.gmThreadId || msg.uid.toString(),
            subject: env.subject || '',
            from: env.from?.[0] ? `${env.from[0].name || ''} <${env.from[0].address}>`.trim() : 'Unknown',
            receivedTime: env.date?.toISOString(),
            folderId: 'INBOX',
          });
        }
        return messages.reverse();
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  async getFullMessagePayload(message: any, folderId = 'INBOX'): Promise<MailboxFullMessage> {
    const { client } = await this.getImapClient();
    await client.connect();
    try {
      const lock = await client.getMailboxLock(folderId);
      try {
        const uid = Number(message.id || message.messageId);
        const fetched = (await client.fetchOne(uid, { envelope: true, source: true, threadId: true, gmThreadId: true } as any)) as any;
        const env = (fetched && typeof fetched === 'object' && 'envelope' in fetched && fetched.envelope) ? (fetched.envelope as any) : {};
        const rawSource = (fetched && typeof fetched === 'object' && 'source' in fetched && fetched.source) ? fetched.source.toString() : '';
        const html = rawSource.includes('<html') ? rawSource : '';
        const text = rawSource.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

        return {
          id: String(uid),
          thread_id: String((fetched && typeof fetched === 'object' && (fetched.threadId || fetched.gmThreadId)) || message.threadId || uid),
          subject: String(env.subject || message.subject || ''),
          from: env.from?.[0] ? `${env.from[0].name || ''} <${env.from[0].address}>`.trim() : String(message.from || 'Unknown'),
          to: (env.to || []).map((t: any) => t.address).filter(Boolean),
          cc: (env.cc || []).map((c: any) => c.address).filter(Boolean),
          date: mailboxDate(env.date || message.receivedTime),
          is_read: true,
          body_html: html,
          body_text: text || message.snippet || '',
          attachments: [],
          folder_id: folderId,
        };
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  async replyToMessage(params: {
    messageId: string;
    bodyHtml: string;
    bodyText?: string;
    original?: MailboxFullMessage;
    replyAll?: boolean;
    attachments?: Array<{ filename: string; content: string; contentType?: string }>;
  }) {
    const { gmailServerService } = await import(
      '@/services/server/gmailServerService'
    );
    const { config } = await this.getImapClient();
    const original: MailboxFullMessage = params.original || {
      id: params.messageId,
      thread_id: null,
      subject: 'Re: Conversation',
      from: '',
      to: [],
      cc: [],
      date: null,
      is_read: true,
      body_html: '',
      body_text: '',
      attachments: [],
    };
    const own = [config.fromEmail!];
    const recipients = replyRecipients(original, own, Boolean(params.replyAll));
    const result = await gmailServerService.sendEmail(this.userId, {
      to: recipients.to.join(','),
      subject: original.subject.startsWith('Re:') ? original.subject : `Re: ${original.subject}`,
      messageBody: params.bodyHtml || params.bodyText || '',
      threadId: original.thread_id || params.messageId,
      cc: recipients.cc.join(','),
      attachments: params.attachments,
    });
    return {
      messageId: String(result.id),
      data: { messageId: String(result.id) },
      original: { subject: original.subject },
      recipients,
    };
  }
}

export class MailboxService {
  constructor(
    readonly tenantId: string,
    readonly userId: string,
    readonly db = createSupabaseAdminClient(),
  ) {
    if (!tenantId || !userId) throw new Error('EMAIL_AUTH_REQUIRED');
  }

  async accounts(): Promise<MailboxAccount[]> {
    const { data } = checked(
      await this.db
        .from('email_provider_accounts')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .is('deleted_at', null),
    );
    return (data || []).filter(
      (row) =>
        row.owner_user_id === this.userId ||
        row.account_type === 'shared_mailbox',
    );
  }

  async account(id?: string): Promise<MailboxAccount> {
    const accounts = (await this.accounts()).filter((row) =>
      ['user', 'shared_mailbox'].includes(row.account_type),
    );
    const matches = id ? accounts.filter((row) => row.id === id) : accounts;
    if (matches.length !== 1)
      throw new Error(
        matches.length
          ? 'EMAIL_ACCOUNT_SELECTION_REQUIRED: pass account_id from list_email_accounts'
          : 'EMAIL_MAILBOX_NOT_CONNECTED',
      );
    const target = matches[0];
    const sendingOnlyProviders = ['brevo', 'resend', 'sendgrid'];
    if (sendingOnlyProviders.includes(target.provider.toLowerCase())) {
      throw new Error(
        `EMAIL_MAILBOX_NOT_SUPPORTED: ${target.provider} is a sending-only provider and does not support mailbox sync or reading.`,
      );
    }
    const supportedProviders = [
      'zoho',
      'microsoft',
      'microsoft_graph',
      'outlook',
      'gmail',
      'imap',
    ];
    if (!supportedProviders.includes(target.provider.toLowerCase())) {
      throw new Error(`EMAIL_READ_ADAPTER_UNAVAILABLE: ${target.provider}`);
    }
    return target;
  }

  provider(account: MailboxAccount): MailboxAdapter {
    if (!account.owner_user_id) throw new Error('EMAIL_ACCOUNT_OWNER_REQUIRED');
    const p = (account.provider || '').toLowerCase();
    if (p === 'zoho') {
      return new ZohoMailService(account.owner_user_id, this.tenantId);
    }
    if (['microsoft', 'microsoft_graph', 'outlook'].includes(p)) {
      return new MicrosoftGraphMailboxAdapter(account.owner_user_id, this.tenantId, this.db);
    }
    if (['gmail', 'imap'].includes(p)) {
      return new GmailMailboxAdapter(account.owner_user_id, this.tenantId, this.db);
    }
    if (['brevo', 'resend', 'sendgrid'].includes(p)) {
      throw new Error(
        `EMAIL_MAILBOX_NOT_SUPPORTED: ${account.provider} is a sending-only provider and does not support mailbox sync or reading.`,
      );
    }
    throw new Error(`EMAIL_READ_ADAPTER_UNAVAILABLE: ${account.provider}`);
  }

  async verify(account: MailboxAccount) {
    const provider = this.provider(account);
    const identity = await provider.verifyMailboxAccess();
    if (
      account.provider_account_id &&
      account.provider_account_id !== identity.account_id
    )
      throw new Error('EMAIL_PROVIDER_ACCOUNT_MISMATCH');
    const capabilities = {
      ...account.capabilities,
      read: true,
      read_verified_at: identity.verified_at,
      send: identity.send_scope_granted,
      send_verified: Boolean(account.capabilities?.send_verified),
      native_reply: true,
      attachment_metadata: true,
    };
    checked(
      await this.db
        .from('email_provider_accounts')
        .update({
          email_address: identity.address,
          provider_account_id: identity.account_id,
          capabilities,
          updated_at: identity.verified_at,
        })
        .eq('tenant_id', this.tenantId)
        .eq('id', account.id),
    );
    return {
      ...account,
      email_address: identity.address,
      provider_account_id: identity.account_id,
      capabilities,
      identity,
    };
  }

  async discover() {
    const accounts = await this.accounts();
    const results = [];
    const supportedProviders = [
      'zoho',
      'microsoft',
      'microsoft_graph',
      'outlook',
      'gmail',
      'imap',
    ];
    for (const account of accounts) {
      if (!supportedProviders.includes(account.provider.toLowerCase())) {
        results.push({ ...account, read_access: 'unsupported' });
        continue;
      }
      try {
        results.push({
          ...(await this.verify(account)),
          read_access: 'verified',
        });
      } catch (error) {
        results.push({
          ...account,
          read_access: 'failed',
          error: mailboxError(error),
        });
      }
    }
    return results.map(({ settings: _settings, ...account }) => ({
      account_id: account.id,
      provider: account.provider,
      sender: account.email_address,
      account_type: account.account_type,
      capabilities: account.capabilities,
      read_access: account.read_access,
      sync_status: account.sync_status,
      last_successful_sync_at: account.last_successful_sync_at,
      ...('error' in account ? { error: account.error } : {}),
    }));
  }

  async ingest(
    account: MailboxAccount,
    message: Record<string, unknown>,
    folderName: string,
  ) {
    const { data } = checked(
      await this.db.rpc('ingest_mailbox_message', {
        p_tenant: this.tenantId,
        p_account: account.id,
        p_message: {
          ...message,
          date: mailboxDate(message.date),
          folder_name: folderName.toLowerCase(),
          direction: ['sent', 'drafts', 'templates', 'outbox'].includes(
            folderName.toLowerCase(),
          )
            ? 'outbound'
            : 'inbound',
          application_status:
            message.application_status ||
            (['drafts', 'templates'].includes(folderName.toLowerCase())
              ? 'draft'
              : folderName.toLowerCase() === 'outbox'
                ? 'queued'
                : 'sent'),
          mailbox: account.email_address,
          provider: account.provider,
        },
      }),
    );
    const canonical = checked(
      await this.db
        .from('email_messages')
        .select('provider_thread_id')
        .eq('tenant_id', this.tenantId)
        .eq('provider_account_id', account.id)
        .eq('id', String(data))
        .single(),
    ).data;
    if (canonical?.provider_thread_id)
      message.thread_id = canonical.provider_thread_id;
    return String(data);
  }

  // Each invocation performs a bounded slice. Pending slices are durable and
  // explicitly resumed by job_id; they are never described as queued/completed.
  async sync(accountId?: string, jobId?: string): Promise<MailboxSyncJob> {
    const account = await this.verify(await this.account(accountId));
    let job;
    if (jobId) {
      job = checked(
        await this.db
          .from('email_mailbox_sync_jobs')
          .select('*')
          .eq('tenant_id', this.tenantId)
          .eq('user_id', this.userId)
          .eq('provider_account_id', account.id)
          .eq('id', jobId)
          .single(),
      ).data;
      if (job.status === 'completed' || job.status === 'failed') return job;
      if (
        job.status === 'running' &&
        Date.parse(job.updated_at) > Date.now() - 120000
      )
        return job;
      const claimed = checked(
        await this.db
          .from('email_mailbox_sync_jobs')
          .update({ status: 'running', updated_at: new Date().toISOString() })
          .eq('tenant_id', this.tenantId)
          .eq('id', job.id)
          .eq('updated_at', job.updated_at)
          .select('*')
          .maybeSingle(),
      ).data;
      if (!claimed) return this.syncStatus(job.id);
      job = claimed;
    } else {
      const result = await this.db
        .from('email_mailbox_sync_jobs')
        .insert({
          tenant_id: this.tenantId,
          user_id: this.userId,
          provider_account_id: account.id,
          status: 'running',
        })
        .select('*')
        .single();
      if (result.error?.code === '23505') {
        const active = checked(
          await this.db
            .from('email_mailbox_sync_jobs')
            .select('*')
            .eq('tenant_id', this.tenantId)
            .eq('user_id', this.userId)
            .eq('provider_account_id', account.id)
            .in('status', ['running', 'pending'])
            .single(),
        ).data;
        if (
          active.status === 'pending' ||
          Date.parse(active.updated_at) < Date.now() - 120000
        )
          return this.sync(account.id, active.id);
        return active;
      }
      job = checked(result).data;
    }
    if (!job) throw new Error('EMAIL_SYNC_JOB_REQUIRED');
    try {
      const provider = this.provider(account);
      const folders = await provider.getFolders();
      let folderIndex = Number(job.cursor.folder_index || 0);
      let start = Number(job.cursor.start || 1);
      let count = job.message_count;
      const deadline = Date.now() + 15000;
      let pages = 0;
      const watermark = account.last_successful_sync_at
        ? Date.parse(account.last_successful_sync_at) - 86400000
        : null;
      while (
        folderIndex < folders.length &&
        pages < 2 &&
        Date.now() < deadline
      ) {
        const folder = folders[folderIndex];
        const messages = await provider.getMessages(folder.folderId, 10, start);
        let reachedWatermark = false;
        for (const message of messages) {
          const timestamp = mailboxDate(message.receivedTime);
          if (
            watermark !== null &&
            timestamp &&
            Date.parse(timestamp) < watermark
          ) {
            reachedWatermark = true;
            break;
          }
          await this.ingest(
            account,
            (await provider.getFullMessagePayload(
              message,
              folder.folderId,
            )) as unknown as Record<string, unknown>,
            folder.folderName,
          );
          count++;
        }
        pages++;
        if (reachedWatermark || messages.length < 10) {
          folderIndex++;
          start = 1;
        } else start += messages.length;
      }
      const completed = folderIndex >= folders.length;
      const now = new Date().toISOString();
      const patch = {
        status: completed ? 'completed' : 'pending',
        message_count: count,
        cursor: { folder_index: folderIndex, start },
        updated_at: now,
        completed_at: completed ? now : null,
      };
      checked(
        await this.db
          .from('email_mailbox_sync_jobs')
          .update(patch)
          .eq('tenant_id', this.tenantId)
          .eq('id', job.id),
      );
      checked(
        await this.db
          .from('email_provider_accounts')
          .update({
            sync_status: completed ? 'healthy' : 'syncing',
            ...(completed
              ? { last_successful_sync_at: now, last_error_code: null }
              : {}),
          })
          .eq('tenant_id', this.tenantId)
          .eq('id', account.id),
      );
      return {
        ...job,
        ...patch,
        next_action: completed
          ? null
          : 'Resume sync_all_inboxes with this account_id and job_id.',
      };
    } catch (error) {
      const failure = mailboxError(error);
      const patch = {
        status: 'failed',
        error_code: failure.code,
        error_message: failure.message,
        updated_at: new Date().toISOString(),
      };
      checked(
        await this.db
          .from('email_mailbox_sync_jobs')
          .update(patch)
          .eq('tenant_id', this.tenantId)
          .eq('id', job.id),
      );
      checked(
        await this.db
          .from('email_provider_accounts')
          .update({
            sync_status: 'failed',
            last_error_code: failure.code,
            last_error_at: new Date().toISOString(),
          })
          .eq('tenant_id', this.tenantId)
          .eq('id', account.id),
      );
      return { ...job, ...patch };
    }
  }

  async syncStatus(jobId: string) {
    return checked(
      await this.db
        .from('email_mailbox_sync_jobs')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .eq('user_id', this.userId)
        .eq('id', jobId)
        .single(),
    ).data;
  }

  async list(args: {
    account_id?: string;
    folder?: string;
    limit?: number;
    start?: number;
    query?: string;
  }) {
    const account = await this.verify(await this.account(args.account_id));
    const provider = this.provider(account);
    const folders = await provider.getFolders();
    const folder = folders.find(
      (row) =>
        row.folderId === args.folder ||
        row.folderName.toLowerCase() === (args.folder || 'inbox').toLowerCase(),
    );
    if (!folder && !args.query) throw new Error('EMAIL_FOLDER_NOT_FOUND');
    const limit = args.limit || 20,
      start = args.start || 1;
    const messages = args.query
      ? await provider.searchMessages(args.query, limit, start)
      : await provider.getMessages(folder!.folderId, limit, start);
    const output = [];
    for (const raw of messages) {
      const currentFolder = args.query
        ? folders.find((row) => row.folderId === String(raw.folderId))
        : folder;
      if (!currentFolder) throw new Error('EMAIL_PROVIDER_FOLDER_ID_REQUIRED');
      const full = await provider.getFullMessagePayload(
        raw,
        currentFolder.folderId,
      );
      const id = await this.ingest(
        account,
        full as unknown as Record<string, unknown>,
        currentFolder.folderName,
      );
      output.push({
        message_id: id,
        provider_message_id: full.id,
        thread_id: full.thread_id,
        account_id: account.id,
        mailbox: account.email_address,
        sender: full.from,
        recipients: full.to,
        cc: full.cc,
        subject: full.subject,
        timestamp: mailboxDate(full.date),
        unread: !full.is_read,
        folder_id: currentFolder.folderId,
        snippet: full.body_text.slice(0, 150),
      });
    }
    return {
      total: output.length,
      messages: output,
      folder: args.folder || 'inbox',
      account_id: account.id,
      freshness: {
        source: 'provider_live',
        checked_at: new Date().toISOString(),
        sync_status: account.sync_status,
        last_successful_sync_at: account.last_successful_sync_at,
      },
      pagination: {
        start,
        limit,
        next_start: messages.length === limit ? start + limit : null,
      },
      ...(messages.length === 0
        ? { empty: true, empty_scope: args.query ? 'search' : 'folder' }
        : {}),
    };
  }

  async content(messageId: string, accountId?: string) {
    if (!accountId) {
      const available = (await this.accounts()).filter((row) =>
        ['user', 'shared_mailbox'].includes(row.account_type),
      );
      let source = this.db
        .from('email_messages')
        .select('provider_account_id')
        .eq('tenant_id', this.tenantId)
        .in(
          'provider_account_id',
          available.map((row) => row.id),
        );
      source = /^[0-9a-f-]{36}$/i.test(messageId)
        ? source.eq('id', messageId)
        : source.eq('provider_message_id', messageId);
      const matches = checked(await source.limit(2)).data || [];
      if (matches.length !== 1)
        throw new Error(
          matches.length
            ? 'EMAIL_ACCOUNT_SELECTION_REQUIRED'
            : 'EMAIL_MESSAGE_NOT_FOUND',
        );
      accountId = matches[0].provider_account_id;
    }
    const account = await this.account(accountId);
    let query = this.db
      .from('email_messages')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('provider_account_id', account.id);
    query = /^[0-9a-f-]{36}$/i.test(messageId)
      ? query.eq('id', messageId)
      : query.eq('provider_message_id', messageId);
    const row = checked(await query.maybeSingle()).data;
    if (!row)
      throw new Error('EMAIL_MESSAGE_NOT_FOUND: list/search the mailbox first');
    if (!row.folder_id)
      return {
        ...row.metadata,
        message_id: row.id,
        provider_message_id: row.provider_message_id,
        thread_id: row.provider_thread_id || row.thread_id,
        account_id: account.id,
        freshness: {
          source: 'cached',
          checked_at: row.mailbox_synced_at || row.updated_at,
        },
      };
    const provider = this.provider(account);
    const payload = await provider.getFullMessagePayload(
      { ...row.metadata, messageId: row.provider_message_id },
      row.folder_id,
    );
    await this.ingest(
      account,
      payload as unknown as Record<string, unknown>,
      row.folder_name,
    );
    return {
      ...payload,
      message_id: row.id,
      provider_message_id: row.provider_message_id,
      account_id: account.id,
      mailbox: account.email_address,
      freshness: {
        source: 'provider_live',
        checked_at: new Date().toISOString(),
      },
    };
  }

  async conversation(
    threadId: string,
    accountId?: string,
    limit = 50,
    offset = 0,
  ) {
    const account = await this.account(accountId);
    // Canonical thread UUIDs and native thread IDs are both accepted; never
    // search unrelated mailboxes or silently truncate without pagination.
    let query = this.db
      .from('email_messages')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('provider_account_id', account.id);
    query = /^[0-9a-f-]{36}$/i.test(threadId)
      ? query.eq('thread_id', threadId)
      : query.eq('provider_thread_id', threadId);
    const rows =
      checked(
        await query
          .order('mailbox_sort_at', { ascending: true })
          .range(offset, offset + limit),
      ).data || [];
    const messages = rows.slice(0, limit).map((row) => ({
      ...row.metadata,
      message_id: row.id,
      provider_message_id: row.provider_message_id,
      thread_id: row.provider_thread_id || row.thread_id,
      timestamp: row.received_at || row.sent_at || row.created_at,
    }));
    messages.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    return {
      thread_id: threadId,
      account_id: account.id,
      messages,
      freshness: {
        source: 'cached',
        sync_status: account.sync_status,
        last_successful_sync_at: account.last_successful_sync_at,
      },
      completeness:
        'Messages currently synced; finish sync_all_inboxes for full mailbox history.',
      next_offset: rows.length > limit ? offset + limit : null,
    };
  }
}
