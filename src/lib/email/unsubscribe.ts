import crypto from 'crypto';
import { SITE_URL } from '@/lib/siteUrl';

export function buildEmailUnsubscribeUrl(params: { tenantId: string; email: string }) {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET || '';
  if (!secret) return '';
  const email = String(params.email || '').trim().toLowerCase();
  const tenantId = String(params.tenantId || '').trim();
  const base = `${tenantId}:${email}`;
  const sig = crypto.createHmac('sha256', secret).update(base).digest('hex');
  const url = new URL('/api/email/unsubscribe', SITE_URL);
  url.searchParams.set('tenantId', tenantId);
  url.searchParams.set('email', email);
  url.searchParams.set('sig', sig);
  return url.toString();
}

export function verifyEmailUnsubscribeSignature(params: { tenantId: string; email: string; sig: string }) {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET || '';
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

