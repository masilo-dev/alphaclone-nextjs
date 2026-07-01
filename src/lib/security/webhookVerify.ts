import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { ENV } from '@/config/env';
import { isProduction } from '@/lib/security/productionGuard';

export function denyIfWebhookVerificationMissing(
  provider: string,
  configured: boolean
): NextResponse | null {
  if (configured || !isProduction()) return null;
  console.error(`[webhook] ${provider} verification not configured in production`);
  return NextResponse.json({ error: 'Webhook verification not configured' }, { status: 503 });
}

export function verifyMetaHubSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string | undefined = ENV.FACEBOOK_APP_SECRET
): boolean {
  if (!appSecret || !signatureHeader?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const received = signatureHeader.slice('sha256='.length);
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(received.padEnd(expected.length, '0').slice(0, expected.length));
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null,
  authToken: string | undefined
): boolean {
  if (!authToken || !signature) return false;
  const sorted = Object.keys(params).sort();
  let data = url;
  for (const key of sorted) data += key + params[key];
  const expected = createHmac('sha1', authToken).update(data).digest('base64');
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
