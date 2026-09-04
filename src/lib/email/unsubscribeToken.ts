import crypto from 'crypto';
import { isAbsoluteHttpsUrl, publicEmailUrl } from '@/lib/siteUrl';

const TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;

function getUnsubscribeSecret(): string {
  return process.env.UNSUBSCRIBE_SECRET || process.env.EMAIL_UNSUBSCRIBE_SECRET || '';
}

function base64UrlEncode(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export function generateUnsubscribeToken(email: string, tenantId: string): string {
  const secret = getUnsubscribeSecret();
  if (!secret) return '';

  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedTenantId = String(tenantId || '').trim();
  if (!normalizedEmail || !normalizedTenantId) return '';

  const payload = {
    email: normalizedEmail,
    tenantId: normalizedTenantId,
    exp: Math.floor((Date.now() + TOKEN_TTL_MS) / 1000),
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

export function verifyUnsubscribeToken(token: string): { email: string; tenantId: string } | null {
  const secret = getUnsubscribeSecret();
  if (!secret || !token?.trim()) return null;

  const parts = token.trim().split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;
  const expected = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');

  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as {
      email?: string;
      tenantId?: string;
      exp?: number;
    };
    if (!payload.email || !payload.tenantId) return null;
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;

    return {
      email: String(payload.email).trim().toLowerCase(),
      tenantId: String(payload.tenantId).trim(),
    };
  } catch {
    return null;
  }
}

function buildLegacySignedUnsubscribeUrl(email: string, tenantId: string): string {
  const secret = getUnsubscribeSecret();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedTenantId = String(tenantId || '').trim();
  if (!secret || !normalizedEmail || !normalizedTenantId) return '';

  const sig = crypto.createHmac('sha256', secret).update(`${normalizedTenantId}:${normalizedEmail}`).digest('hex');
  const params = new URLSearchParams({
    tenantId: normalizedTenantId,
    email: normalizedEmail,
    sig,
  });
  return publicEmailUrl(`/api/unsubscribe?${params.toString()}`);
}

/**
 * Builds a secure HTTPS unsubscribe URL for email footers and List-Unsubscribe headers.
 */
export function buildUnsubscribeUrl(email: string, tenantId: string): string {
  const token = generateUnsubscribeToken(email, tenantId);
  if (token) {
    const url = publicEmailUrl(`/api/unsubscribe?token=${encodeURIComponent(token)}`);
    if (isAbsoluteHttpsUrl(url)) return url;
  }

  const legacy = buildLegacySignedUnsubscribeUrl(email, tenantId);
  if (legacy && isAbsoluteHttpsUrl(legacy)) return legacy;

  return publicEmailUrl('/preferences/email');
}

/** Legacy HMAC link verification (tenantId + email + sig query params) */
export function verifyEmailUnsubscribeSignature(params: { tenantId: string; email: string; sig: string }) {
  const secret = getUnsubscribeSecret();
  if (!secret) return false;

  const email = String(params.email || '').trim().toLowerCase();
  const tenantId = String(params.tenantId || '').trim();
  const sig = String(params.sig || '').trim().toLowerCase();
  if (!email || !tenantId || !sig) return false;

  const base = `${tenantId}:${email}`;
  const expected = crypto.createHmac('sha256', secret).update(base).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

/** @deprecated Use buildUnsubscribeUrl — kept for existing call sites during migration */
export function buildEmailUnsubscribeUrl(params: { tenantId: string; email: string }) {
  return buildUnsubscribeUrl(params.email, params.tenantId);
}

export function buildPreferencesUrl(tenantId: string, email: string, token?: string): string {
  const params = new URLSearchParams({
    tenant: tenantId,
    email: email.trim().toLowerCase(),
  });
  if (token) params.set('token', token);
  return publicEmailUrl(`/preferences/email?${params.toString()}`);
}
