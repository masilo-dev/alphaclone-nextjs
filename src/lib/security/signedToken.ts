import { createHmac, timingSafeEqual } from 'crypto';
import { getIntegrationEncryptionSecret } from '@/lib/integration/integrationTokenCrypto';

function getSigningSecret(): string | null {
  return getIntegrationEncryptionSecret();
}

export function signPayload(payload: string, ttlSeconds = 60 * 60 * 24 * 90): string {
  const secret = getSigningSecret();
  if (!secret) return Buffer.from(payload).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = `${payload}.${exp}`;
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${Buffer.from(body).toString('base64url')}.${sig}`;
}

export function verifySignedPayload(token: string): string | null {
  const secret = getSigningSecret();
  const dot = token.lastIndexOf('.');
  if (dot <= 0) {
    try {
      return Buffer.from(token, 'base64url').toString('utf8');
    } catch {
      return null;
    }
  }
  if (!secret) return null;
  const encodedBody = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const body = Buffer.from(encodedBody, 'base64url').toString('utf8');
    const expected = createHmac('sha256', secret).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const lastDot = body.lastIndexOf('.');
    if (lastDot <= 0) return null;
    const payload = body.slice(0, lastDot);
    const exp = Number(body.slice(lastDot + 1));
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function signInvoiceTrackToken(invoiceId: string): string {
  return signPayload(invoiceId, 60 * 60 * 24 * 365);
}

export function verifyInvoiceTrackToken(token: string): string | null {
  const payload = verifySignedPayload(token);
  if (!payload) {
    try {
      const legacy = Buffer.from(token, 'base64url').toString('utf8');
      if (/^[0-9a-f-]{36}$/i.test(legacy)) return legacy;
    } catch {
      return null;
    }
    return null;
  }
  return /^[0-9a-f-]{36}$/i.test(payload) ? payload : null;
}
