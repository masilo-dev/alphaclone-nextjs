import { ZohoMailService } from '@/services/zoho/ZohoMailService';

export function zohoAccountSender(accounts: Array<Record<string, unknown>>, accountId?: string): string | undefined {
  const selected = accountId ? accounts.find((row) => String(row.accountId) === accountId)
    : accounts.length === 1 ? accounts[0] : undefined;
  if (!selected) return undefined;
  return [selected.primaryEmailAddress, selected.mailAddress, selected.incomingUserName]
    .map((value) => String(value || '').trim().toLowerCase())
    .find((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

export async function resolveZohoSender(userId: string, tenantId: string, accountId?: string) {
  const response = await new ZohoMailService(userId, tenantId).getAccounts();
  return zohoAccountSender(response?.data || [], accountId);
}

const verifiedSenders = new Map<string, { at: number; emails: string[] }>();
/** Verify the configured sender against this exact tenant provider credential. */
export async function assertBrevoSender(apiKey: string, email: string): Promise<void> {
  let cached = verifiedSenders.get(apiKey);
  if (!cached || Date.now() - cached.at > 60_000) {
    const response = await fetch('https://api.brevo.com/v3/senders', {
      headers: { 'api-key': apiKey }, signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`EMAIL_SENDER_VERIFICATION_FAILED: Brevo returned HTTP ${response.status}`);
    const body = await response.json();
    cached = { at: Date.now(), emails: (body.senders || []).filter((sender: { active?: boolean }) => sender.active === true)
      .map((sender: { email: string }) => sender.email.trim().toLowerCase()) };
    verifiedSenders.set(apiKey, cached);
  }
  if (!cached.emails.includes(email.trim().toLowerCase())) {
    throw new Error('EMAIL_SENDER_NOT_VERIFIED: The configured Brevo sender is not active. Select a verified sender in provider settings.');
  }
}
