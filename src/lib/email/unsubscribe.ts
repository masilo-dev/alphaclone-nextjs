import crypto from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/siteUrl';
import { syncSuppressionCleanup } from '@/lib/email/suppression';
import { updatePublicEmailPreferences } from '@/lib/email/emailPreferences';

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

export async function isUnsubscribed(email: string, tenantId: string): Promise<boolean> {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedTenantId = String(tenantId || '').trim();
  if (!normalizedEmail || !normalizedTenantId) return false;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('email_suppressions')
    .select('id')
    .eq('tenant_id', normalizedTenantId)
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error) {
    console.error('[email/unsubscribe] isUnsubscribed lookup failed:', error);
    return false;
  }

  return Boolean(data?.id);
}

export async function addUnsubscribe(
  email: string,
  tenantId: string,
  options?: {
    category?: string;
    source?: string;
    sourceCampaignId?: string;
    tokenId?: string;
    ipAddress?: string;
    userAgent?: string;
    globalMarketing?: boolean;
  },
): Promise<void> {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedTenantId = String(tenantId || '').trim();
  if (!normalizedEmail || !normalizedTenantId) return;

  await syncSuppressionCleanup({
    tenantId: normalizedTenantId,
    email: normalizedEmail,
    reason: 'unsubscribe',
    provider: options?.source || 'unsubscribe_link',
    metadata: {
      category: options?.category || null,
      source_campaign_id: options?.sourceCampaignId || null,
      token_id: options?.tokenId || null,
    },
  });

  await updatePublicEmailPreferences(normalizedTenantId, normalizedEmail, {
    unsubscribe_all_marketing: options?.globalMarketing !== false,
    marketing: false,
    outreach: false,
    newsletter: false,
  });

  try {
    const admin = createSupabaseAdminClient();
    await admin.from('email_unsubscribe_audit').insert({
      tenant_id: normalizedTenantId,
      email: normalizedEmail,
      category: options?.category || null,
      source: options?.source || 'unsubscribe_link',
      source_campaign_id: options?.sourceCampaignId || null,
      token_id: options?.tokenId || null,
      ip_address: options?.ipAddress || null,
      user_agent: options?.userAgent || null,
      status: 'unsubscribed',
    });
  } catch (err) {
    console.error('[email/unsubscribe] audit insert failed:', err);
  }
}

export async function recordResubscribe(
  email: string,
  tenantId: string,
  options?: { category?: string; source?: string },
): Promise<void> {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedTenantId = String(tenantId || '').trim();
  if (!normalizedEmail || !normalizedTenantId) return;

  const admin = createSupabaseAdminClient();
  await admin.from('email_suppressions').delete()
    .eq('tenant_id', normalizedTenantId)
    .eq('email', normalizedEmail)
    .eq('reason', 'unsubscribe');

  await admin.from('outreach_suppressions').delete()
    .eq('tenant_id', normalizedTenantId)
    .eq('channel', 'email')
    .eq('normalized_recipient', normalizedEmail)
    .eq('reason', 'unsubscribe');

  await updatePublicEmailPreferences(normalizedTenantId, normalizedEmail, {
    marketing: true,
    outreach: true,
    newsletter: true,
  });

  await admin.from('email_unsubscribe_audit').insert({
    tenant_id: normalizedTenantId,
    email: normalizedEmail,
    category: options?.category || null,
    source: options?.source || 'preference_center',
    status: 'resubscribed',
  });
}

export function buildUnsubscribeUrl(email: string, tenantId: string): string {
  const token = generateUnsubscribeToken(email, tenantId);
  if (!token) return '';
  return `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** @deprecated Use buildUnsubscribeUrl — kept for existing call sites during migration */
export function buildEmailUnsubscribeUrl(params: { tenantId: string; email: string }) {
  return buildUnsubscribeUrl(params.email, params.tenantId);
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
