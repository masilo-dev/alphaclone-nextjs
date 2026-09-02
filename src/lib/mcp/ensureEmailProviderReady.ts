import { resolveMcpActionReadiness } from '@/lib/mcp/actionReadiness';

export class EmailProviderNotReadyError extends Error {
  readonly code = 'PROVIDER_MISSING';
  readonly missing?: string[];
  readonly setup_hint?: string;

  constructor(message: string, details?: { missing?: string[]; setup_hint?: string }) {
    super(message);
    this.name = 'EmailProviderNotReadyError';
    this.missing = details?.missing;
    this.setup_hint = details?.setup_hint;
  }
}

/** Fail fast before bulk/campaign sends when no email provider is connected. */
export async function ensureEmailProviderReady(tenantId: string, userId: string): Promise<void> {
  const readiness = await resolveMcpActionReadiness({ tenantId, userId, action: 'email_send' });
  if (!readiness.email_send?.executable) {
    throw new EmailProviderNotReadyError(
      readiness.email_send?.setup_hint ||
        'Connect Zoho, Gmail, Brevo, or another email provider in Settings → Integrations before sending.',
      { missing: readiness.email_send?.missing, setup_hint: readiness.email_send?.setup_hint },
    );
  }
}
