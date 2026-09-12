import crypto from 'node:crypto';
import { publicEmailUrl } from '@/lib/siteUrl';

const TOKEN_TTL_SECONDS = 180 * 24 * 60 * 60;

function getTrackingSecret(): string {
  return process.env.EMAIL_TRACKING_SECRET
    || process.env.UNSUBSCRIBE_SECRET
    || process.env.EMAIL_UNSUBSCRIBE_SECRET
    || '';
}

export type EmailTrackingTokenPayload = {
  tenantId: string;
  trackingId: string;
  outboundEmailId?: string | null;
  exp: number;
};

export function generateEmailTrackingToken(input: {
  tenantId: string;
  trackingId: string;
  outboundEmailId?: string | null;
}): string {
  const secret = getTrackingSecret();
  const tenantId = String(input.tenantId || '').trim();
  const trackingId = String(input.trackingId || '').trim();
  if (!secret || !tenantId || !trackingId) return '';

  const payload: EmailTrackingTokenPayload = {
    tenantId,
    trackingId,
    outboundEmailId: input.outboundEmailId || null,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyEmailTrackingToken(token: string): EmailTrackingTokenPayload | null {
  const secret = getTrackingSecret();
  if (!secret || !token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as EmailTrackingTokenPayload;
    if (!payload.tenantId || !payload.trackingId || !payload.exp) return null;
    if (Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildOpenTrackingUrl(input: {
  tenantId: string;
  trackingId: string;
  outboundEmailId?: string | null;
}): string {
  const token = generateEmailTrackingToken(input);
  if (!token) return '';
  return publicEmailUrl(`/api/track/open?token=${encodeURIComponent(token)}`);
}
