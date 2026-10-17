import { assertBrevoSender } from '@/lib/email/providerSenderIdentity';
import { ZohoMailService } from '@/services/zoho/ZohoMailService';

/** Read-only provider checks. Connection records alone do not prove sender readiness. */
export async function checkEmailProviderReadiness(config: {
  tenantId: string; provider: string; fromEmail?: string; apiKey: string; ownerUserId?: string | null;
}) {
  const sender = config.fromEmail?.trim().toLowerCase() || null;
  const base = { provider: config.provider, connected: true, from_email: sender };
  try {
    if (config.provider === 'zoho') {
      if (!config.ownerUserId) return { ...base, ready: false, code: 'ZOHO_ACCOUNT_OWNER_MISSING', issue: 'The Zoho mailbox has no connected owner.', verification_scope: 'mailbox_sender' };
      const addresses = await new ZohoMailService(config.ownerUserId, config.tenantId).getSenderAddresses();
      const actual = sender || addresses[0]?.toLowerCase();
      if (!actual || !addresses.some(address => address.toLowerCase() === actual)) return { ...base, ready: false, code: 'EMAIL_SENDER_NOT_VERIFIED', issue: 'The selected sender is not available on this Zoho mailbox.', verification_scope: 'mailbox_sender' };
      return { ...base, from_email: actual, ready: true, code: null, issue: null, verification_scope: 'mailbox_sender' };
    }
    if (config.provider === 'brevo') {
      if (!config.apiKey) return { ...base, ready: false, code: 'EMAIL_CREDENTIAL_UNAVAILABLE', issue: 'The saved Brevo credential could not be loaded.', verification_scope: 'provider_sender' };
      const { getBrevoActiveSenders } = await import('@/lib/email/providerSenderIdentity');
      const activeSenders = await getBrevoActiveSenders(config.apiKey);
      if (!activeSenders.length) {
        return {
          ...base,
          ready: false,
          code: 'EMAIL_SENDER_NOT_VERIFIED',
          issue: 'No active verified senders found in your Brevo account. Please add and verify a sender domain or address in Brevo.',
          verification_scope: 'provider_sender',
        };
      }
      const actual = sender || activeSenders[0];
      if (sender && !activeSenders.includes(sender)) {
        return {
          ...base,
          from_email: sender,
          ready: false,
          code: 'EMAIL_SENDER_NOT_VERIFIED',
          issue: `The configured Brevo sender ${sender} is not active. Available senders: ${activeSenders.join(', ')}`,
          verification_scope: 'provider_sender',
        };
      }
      return { ...base, from_email: actual, ready: true, code: null, issue: null, verification_scope: 'provider_sender' };
    }
    if (!sender) return { ...base, ready: false, code: 'EMAIL_SENDER_MISSING', issue: 'Select a sender for this connected provider.', verification_scope: 'configuration' };
    return { ...base, ready: true, code: null, issue: null, verification_scope: 'configuration' };
  } catch (error) {
    const failure = error as Error & { code?: string };
    return { ...base, ready: false, code: failure.code || 'EMAIL_SENDER_VERIFICATION_UNAVAILABLE',
      issue: failure.code === 'EMAIL_SENDER_NOT_VERIFIED' ? failure.message : `${config.provider} sender verification is unavailable. The connection was retained; retry the check or review provider permissions.`,
      verification_scope: config.provider === 'zoho' ? 'mailbox_sender' : 'provider_sender' };
  }
}
