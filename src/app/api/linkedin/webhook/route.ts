import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { parseLinkedInLeadResponse, syncLinkedInLeadToCrm } from '@/lib/linkedin/leadGenSync';

type LinkedInWebhookEvent = Record<string, unknown>;

function hmacSha256Hex(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function getLinkedInClientSecret(): string {
  return ENV.LINKEDIN_CLIENT_SECRET || process.env.LINKEDIN_CLIENT_SECRET || '';
}

function verifyLinkedInSignature(rawBody: string, signatureHeader: string | null, clientSecret: string): boolean {
  if (!clientSecret || !signatureHeader) return false;
  const signature = signatureHeader.replace(/^hmacsha256=/i, '').trim();
  if (!signature) return false;
  return safeEqual(hmacSha256Hex(rawBody, clientSecret), signature);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function collectEvents(payload: unknown): LinkedInWebhookEvent[] {
  const root = asRecord(payload);
  if (!root) return [];
  for (const key of ['events', 'eventNotifications', 'notifications', 'elements']) {
    const value = root[key];
    if (Array.isArray(value)) return value.filter((item): item is LinkedInWebhookEvent => Boolean(asRecord(item)));
  }
  return [root];
}

function extractTenantId(event: LinkedInWebhookEvent, fallback?: string | null): string {
  const candidates = [
    event.tenantId,
    event.tenant_id,
    asRecord(event.metadata)?.tenantId,
    asRecord(event.metadata)?.tenant_id,
    fallback,
  ];
  return candidates.map((value) => (typeof value === 'string' ? value.trim() : '')).find(Boolean) || '';
}

function looksLikeLeadFormEvent(event: LinkedInWebhookEvent): boolean {
  const text = JSON.stringify(event).toLowerCase();
  return text.includes('lead') || text.includes('formresponse') || text.includes('leadgen');
}

async function recordWebhookEvent(event: LinkedInWebhookEvent, status: string, detail?: Record<string, unknown>) {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from('webhook_events').insert({
      provider: 'linkedin',
      event_type: String(event.eventType || event.type || event.action || 'linkedin.notification'),
      status,
      payload: event,
      metadata: detail || {},
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('[linkedin/webhook] event log skipped:', error);
  }
}

export async function GET(req: NextRequest) {
  const challengeCode = req.nextUrl.searchParams.get('challengeCode')?.trim();
  const clientSecret = getLinkedInClientSecret();

  if (!challengeCode) {
    return NextResponse.json({ error: 'challengeCode is required' }, { status: 400 });
  }
  if (!clientSecret) {
    console.error('[linkedin/webhook] LINKEDIN_CLIENT_SECRET is not configured');
    return NextResponse.json({ error: 'LinkedIn webhook is not configured' }, { status: 503 });
  }

  return NextResponse.json({
    challengeCode,
    challengeResponse: hmacSha256Hex(challengeCode, clientSecret),
  });
}

export async function POST(req: NextRequest) {
  const clientSecret = getLinkedInClientSecret();
  if (!clientSecret) {
    console.error('[linkedin/webhook] LINKEDIN_CLIENT_SECRET is not configured');
    return NextResponse.json({ error: 'LinkedIn webhook is not configured' }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-li-signature');
  if (!verifyLinkedInSignature(rawBody, signature, clientSecret)) {
    return NextResponse.json({ error: 'Invalid LinkedIn signature' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody || '{}');
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
  const fallbackTenantId = req.nextUrl.searchParams.get('tenantId') || req.nextUrl.searchParams.get('tenant_id');
  const events = collectEvents(payload);
  const results: Array<{ status: string; leadId?: string; deduplicated?: boolean; reason?: string }> = [];

  for (const event of events) {
    const tenantId = extractTenantId(event, fallbackTenantId);
    if (!tenantId) {
      results.push({ status: 'ignored', reason: 'tenantId missing' });
      await recordWebhookEvent(event, 'ignored', { reason: 'tenantId missing' });
      continue;
    }

    if (!looksLikeLeadFormEvent(event)) {
      results.push({ status: 'accepted', reason: 'non-lead notification' });
      await recordWebhookEvent(event, 'accepted', { tenantId });
      continue;
    }

    const parsedLead = parseLinkedInLeadResponse(event);
    const synced = await syncLinkedInLeadToCrm(tenantId, parsedLead);
    if (synced.success) {
      results.push({
        status: 'synced',
        leadId: synced.leadId,
        deduplicated: synced.deduplicated,
      });
      await recordWebhookEvent(event, 'synced', { tenantId, leadId: synced.leadId });
    } else {
      results.push({ status: 'failed', reason: synced.error || 'Lead sync failed' });
      await recordWebhookEvent(event, 'failed', { tenantId, error: synced.error });
    }
  }

  return NextResponse.json({
    success: true,
    received: events.length,
    results,
  });
}
