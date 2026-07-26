import { createHmac, timingSafeEqual } from 'node:crypto';

export type PublicComplianceTokenPurpose = 'preferences' | 'privacy_request_status' | 'secure_download';

type TokenPayload = {
  tenantId: string;
  subject: string;
  purpose: PublicComplianceTokenPurpose;
  exp: number;
};

function secret(): string {
  return process.env.COMPLIANCE_TOKEN_SECRET
    || process.env.UNSUBSCRIBE_SECRET
    || process.env.EMAIL_UNSUBSCRIBE_SECRET
    || '';
}

export function createPublicComplianceToken(input: {
  tenantId: string;
  subject: string;
  purpose: PublicComplianceTokenPurpose;
  ttlSeconds?: number;
}): string {
  const signingSecret = secret();
  if (!signingSecret || !input.tenantId || !input.subject) return '';
  const payload: TokenPayload = {
    tenantId: input.tenantId,
    subject: input.subject.trim().toLowerCase(),
    purpose: input.purpose,
    exp: Math.floor(Date.now() / 1000) + (input.ttlSeconds || 60 * 60 * 24 * 30),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', signingSecret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyPublicComplianceToken(
  token: string,
  purpose: PublicComplianceTokenPurpose,
): TokenPayload | null {
  const signingSecret = secret();
  const [encoded, signature, extra] = String(token || '').split('.');
  if (!signingSecret || !encoded || !signature || extra) return null;
  const expected = createHmac('sha256', signingSecret).update(encoded).digest('base64url');
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (!payload.tenantId || !payload.subject || payload.purpose !== purpose) return null;
    if (!Number.isFinite(payload.exp) || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
