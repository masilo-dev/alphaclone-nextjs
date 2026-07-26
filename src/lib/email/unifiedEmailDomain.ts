export type UnifiedEmailProvider =
  | 'zoho'
  | 'microsoft_graph'
  | 'brevo'
  | 'sendgrid'
  | 'smtp'
  | 'gmail'
  | 'resend'
  | 'other';

export type EmailPurpose =
  | 'personal'
  | 'crm'
  | 'transactional'
  | 'marketing'
  | 'invoice'
  | 'contract'
  | 'project'
  | 'calendar'
  | 'automation';

export type EmailProviderCapabilities = {
  canSend: boolean;
  canReceive: boolean;
  canSyncFolders: boolean;
  canSyncThreads: boolean;
  canCreateDrafts: boolean;
  canUpdateDrafts: boolean;
  canDeleteMessages: boolean;
  canArchive: boolean;
  canMoveMessages: boolean;
  canMarkRead: boolean;
  canStar: boolean;
  canUseLabels: boolean;
  canScheduleNatively: boolean;
  canTrackDelivery: boolean;
  canTrackOpens: boolean;
  canTrackClicks: boolean;
  canReceiveReplies: boolean;
  canUseTemplates: boolean;
  canUseSharedMailboxes: boolean;
  canManageSenderIdentities: boolean;
  canUseCustomReplyTo: boolean;
  canSendBulk: boolean;
  canSendTransactional: boolean;
  canSendMarketing: boolean;
};

const OUTBOUND_ONLY: EmailProviderCapabilities = {
  canSend: true,
  canReceive: false,
  canSyncFolders: false,
  canSyncThreads: false,
  canCreateDrafts: false,
  canUpdateDrafts: false,
  canDeleteMessages: false,
  canArchive: false,
  canMoveMessages: false,
  canMarkRead: false,
  canStar: false,
  canUseLabels: false,
  canScheduleNatively: false,
  canTrackDelivery: true,
  canTrackOpens: true,
  canTrackClicks: true,
  canReceiveReplies: false,
  canUseTemplates: true,
  canUseSharedMailboxes: false,
  canManageSenderIdentities: true,
  canUseCustomReplyTo: true,
  canSendBulk: true,
  canSendTransactional: true,
  canSendMarketing: true,
};

const MAILBOX: EmailProviderCapabilities = {
  ...OUTBOUND_ONLY,
  canReceive: true,
  canSyncFolders: true,
  canSyncThreads: true,
  canCreateDrafts: true,
  canUpdateDrafts: true,
  canDeleteMessages: true,
  canArchive: true,
  canMoveMessages: true,
  canMarkRead: true,
  canStar: true,
  canReceiveReplies: true,
  canSendBulk: false,
  canSendMarketing: false,
};

export const PROVIDER_CAPABILITIES: Record<UnifiedEmailProvider, EmailProviderCapabilities> = {
  zoho: { ...MAILBOX, canUseLabels: true },
  microsoft_graph: { ...MAILBOX, canUseSharedMailboxes: true },
  brevo: { ...OUTBOUND_ONLY },
  sendgrid: { ...OUTBOUND_ONLY },
  smtp: {
    ...OUTBOUND_ONLY,
    canTrackDelivery: false,
    canTrackOpens: false,
    canTrackClicks: false,
    canUseTemplates: false,
    canSendBulk: false,
    canSendMarketing: false,
  },
  gmail: { ...MAILBOX, canUseLabels: true },
  resend: { ...OUTBOUND_ONLY, canSendBulk: false, canSendMarketing: false },
  other: { ...OUTBOUND_ONLY, canTrackDelivery: false, canTrackOpens: false, canTrackClicks: false },
};

export interface ConnectedEmailAccount {
  id: string;
  provider: UnifiedEmailProvider;
  connectionStatus: 'pending' | 'connected' | 'degraded' | 'expired' | 'revoked' | 'failed';
  allowedPurposes: EmailPurpose[];
  capabilities?: Partial<EmailProviderCapabilities>;
}

export interface SenderIdentity {
  id: string;
  providerAccountId: string;
  emailAddress: string;
  verificationStatus: 'unknown' | 'pending' | 'verified' | 'failed' | 'revoked';
  canSendAs: boolean;
  allowedPurposes: EmailPurpose[];
}

export interface EmailDefaultRule {
  purpose: EmailPurpose;
  providerAccountId: string;
  senderIdentityId: string;
  priority: number;
}

export class UnifiedEmailDomainError extends Error {
  constructor(
    public readonly code:
      | 'ACCOUNT_NOT_CONNECTED'
      | 'PURPOSE_NOT_ALLOWED'
      | 'PROVIDER_CANNOT_SEND'
      | 'SENDER_NOT_AUTHORISED'
      | 'SENDER_NOT_VERIFIED'
      | 'RECIPIENT_SUPPRESSED'
      | 'NO_SEND_ROUTE',
    message: string,
  ) {
    super(message);
    this.name = 'UnifiedEmailDomainError';
  }
}

export function capabilitiesFor(account: ConnectedEmailAccount): EmailProviderCapabilities {
  return { ...PROVIDER_CAPABILITIES[account.provider], ...account.capabilities };
}

export function resolveSendRoute(input: {
  purpose: EmailPurpose;
  accounts: ConnectedEmailAccount[];
  identities: SenderIdentity[];
  defaults: EmailDefaultRule[];
  explicitAccountId?: string;
  explicitIdentityId?: string;
}): { account: ConnectedEmailAccount; identity: SenderIdentity } {
  const { purpose, accounts, identities } = input;
  const rule = [...input.defaults]
    .filter((candidate) => candidate.purpose === purpose)
    .sort((a, b) => b.priority - a.priority)[0];
  const explicitlySelectedIdentity = input.explicitIdentityId
    ? identities.find((candidate) => candidate.id === input.explicitIdentityId)
    : undefined;
  const accountId =
    input.explicitAccountId
    || explicitlySelectedIdentity?.providerAccountId
    || rule?.providerAccountId;
  // Selecting another account invalidates the old account's default identity.
  const identityId =
    input.explicitIdentityId
    || (input.explicitAccountId ? undefined : rule?.senderIdentityId);
  const account = accountId
    ? accounts.find((candidate) => candidate.id === accountId)
    : accounts.find((candidate) =>
        candidate.connectionStatus === 'connected'
        && candidate.allowedPurposes.includes(purpose)
        && capabilitiesFor(candidate).canSend);

  if (!account) throw new UnifiedEmailDomainError('NO_SEND_ROUTE', `No email account is available for ${purpose}`);
  if (account.connectionStatus !== 'connected') {
    throw new UnifiedEmailDomainError('ACCOUNT_NOT_CONNECTED', 'The selected email account is not connected');
  }
  if (!account.allowedPurposes.includes(purpose)) {
    throw new UnifiedEmailDomainError('PURPOSE_NOT_ALLOWED', `The selected account cannot send ${purpose} email`);
  }
  if (!capabilitiesFor(account).canSend) {
    throw new UnifiedEmailDomainError('PROVIDER_CANNOT_SEND', 'The selected provider does not support sending');
  }

  const identity = identityId
    ? identities.find((candidate) => candidate.id === identityId)
    : identities.find((candidate) =>
        candidate.providerAccountId === account.id
        && candidate.allowedPurposes.includes(purpose)
        && candidate.verificationStatus === 'verified'
        && candidate.canSendAs);
  if (!identity || identity.providerAccountId !== account.id || !identity.canSendAs) {
    throw new UnifiedEmailDomainError('SENDER_NOT_AUTHORISED', 'The From address is not authorised for this account');
  }
  if (identity.verificationStatus !== 'verified') {
    throw new UnifiedEmailDomainError('SENDER_NOT_VERIFIED', 'The selected sender identity is not verified');
  }
  if (!identity.allowedPurposes.includes(purpose)) {
    throw new UnifiedEmailDomainError('PURPOSE_NOT_ALLOWED', `The selected sender cannot send ${purpose} email`);
  }
  return { account, identity };
}

export function normalizeRecipientAddress(address: string): string {
  return address.trim().toLowerCase();
}

export function assertRecipientsAllowed(
  recipients: string[],
  suppressions: Array<{ emailAddress: string; active: boolean }>,
): void {
  const blocked = new Set(
    suppressions.filter((entry) => entry.active).map((entry) => normalizeRecipientAddress(entry.emailAddress)),
  );
  const suppressed = recipients.map(normalizeRecipientAddress).find((address) => blocked.has(address));
  if (suppressed) {
    throw new UnifiedEmailDomainError(
      'RECIPIENT_SUPPRESSED',
      `The recipient ${suppressed} is suppressed across all providers`,
    );
  }
}
