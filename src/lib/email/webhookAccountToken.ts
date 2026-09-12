import crypto from 'node:crypto';
import type { UnifiedEmailProvider } from '@/lib/email/unifiedEmailDomain';

const TOKEN_TTL_SECONDS = 365 * 24 * 60 * 60;

function secret(): string {
  return process.env.EMAIL_WEBHOOK_ACCOUNT_SECRET || process.env.EMAIL_UNSUBSCRIBE_SECRET || process.env.UNSUBSCRIBE_SECRET || '';
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export type WebhookAccountIdentity = {
  tenantId: string;
  providerAccountId: string;
  provider: UnifiedEmailProvider;
};

/**
 * Creates an opaque callback token that identifies the tenant-owned provider
 * account before provider_message_id reconciliation occurs. Raw tenant/account
 * IDs do not need to be exposed in webhook URLs.
 */
export function createWebhookAccountToken(identity: WebhookAccountIdentity): string {
  const signingSecret = secret();
  if (!signingSecret) throw new Error('EMAIL_WEBHOOK_ACCOUNT_SECRET_REQUIRED');
  const payload = Buffer.from(JSON.stringify({
    tenantId: identity.tenantId,
    providerAccountId: identity.providerAccountId,
    provider: identity.provider,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  }), 'utf8').toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifyWebhookAccountToken(token: string): WebhookAccountIdentity | null {
  const signingSecret = secret();
  if (!signingSecret || !token) return null;
  const [payload, signature, ...rest] = token.split('.');
  if (!payload || !signature || rest.length) return null;
  const expected = sign(payload);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      tenantId?: string;
      providerAccountId?: string;
      provider?: UnifiedEmailProvider;
      exp?: number;
    };
    if (!decoded.tenantId || !decoded.providerAccountId || !decoded.provider) return null;
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      tenantId: decoded.tenantId,
      providerAccountId: decoded.providerAccountId,
      provider: decoded.provider,
    };
  } catch {
    return null;
  }
}
