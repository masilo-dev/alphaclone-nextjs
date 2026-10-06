import { createHmac, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow } from '@/lib/apiAuth';
import { rateLimitMiddleware, rateLimitConfigs } from '@/lib/rateLimit';
import { readClientIp } from '@/lib/verifyTurnstile';
export const dynamic = 'force-dynamic';
const consentRecordSchema = z.object({
  recordId: z.string().uuid().optional(), anonymousId: z.string().min(3).max(120), essential: z.literal(true),
  functional: z.boolean(), analytics: z.boolean(), marketing: z.boolean(),
  consentVersion: z.string().min(1).max(30), collectedAt: z.string().datetime().optional(),
  // Browser-reported read-back, not independent server verification of Cloudflare.
  zarazSynced: z.boolean().optional(),
});
export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitMiddleware(request, rateLimitConfigs.api.standard,
      `cookie-consent:${readClientIp(request) || 'anonymous'}`);
    if (limited) return limited;
    const parsed = consentRecordSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid consent payload' }, { status: 400 });
    const input = parsed.data;
    const tenantId = process.env.LEGAL_SITE_TENANT_ID?.trim() || process.env.CONTACT_TENANT_ID?.trim() || process.env.DEFAULT_TENANT_ID?.trim() || null;
    if (tenantId && !z.string().uuid().safeParse(tenantId).success) {
      return NextResponse.json({ error: 'Consent recording is not configured' }, { status: 503 });
    }
    const ip = readClientIp(request);
    const salt = process.env.CONSENT_IP_HASH_SECRET;
    const id = input.recordId || randomUUID();
    const record = {
      id, anonymous_id: input.anonymousId, tenant_id: tenantId, consent_version: input.consentVersion, essential: true,
      functional: input.functional, analytics: input.analytics, marketing: input.marketing,
      zaraz_synced: Boolean(input.zarazSynced),
      ip_hash: ip && salt ? createHmac('sha256', salt).update(ip).digest('hex') : null,
      user_agent: request.headers.get('user-agent')?.slice(0, 255) || null,
      ...(input.collectedAt ? { created_at: input.collectedAt } : {}),
      withdrawn_at: !input.functional && !input.analytics && !input.marketing ? input.collectedAt || new Date().toISOString() : null,
    };
    const admin = createAdminSupabaseClientOrThrow();
    const { error } = await admin.from('cookie_consent_records').insert(record);
    if (error?.code === '23505') {
      const { data: existing, error: lookupError } = await admin.from('cookie_consent_records')
        .select('anonymous_id,tenant_id,consent_version,essential,functional,analytics,marketing').eq('id', id).maybeSingle();
      if (lookupError || !existing) throw new Error('Consent receipt lookup failed');
      const fields = ['anonymous_id', 'tenant_id', 'consent_version', 'essential', 'functional', 'analytics', 'marketing'] as const;
      if (fields.some(key => existing[key] !== record[key])) return NextResponse.json({ error: 'Consent receipt conflict' }, { status: 409 });
      return NextResponse.json({ success: true, recorded: 1, id, replayed: true });
    }
    if (error) throw new Error('Consent record insert failed');
    return NextResponse.json({ success: true, recorded: 1, id });
  } catch (error) {
    console.error('[consent-record] Recording failed:', error);
    return NextResponse.json({ error: 'Unable to record consent' }, { status: 503 });
  }
}
