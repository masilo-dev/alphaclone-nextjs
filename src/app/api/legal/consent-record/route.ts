import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const consentRecordSchema = z.object({
  anonymousId: z.string().min(3).max(120),
  essential: z.literal(true),
  functional: z.boolean(),
  analytics: z.boolean(),
  marketing: z.boolean(),
  consentVersion: z.string().max(30).default('2026-10'),
  zarazSynced: z.boolean().optional(),
});

function hashIp(rawIp: string | null): string | null {
  if (!rawIp) return null;
  // Truncate and salt for privacy-preserving GDPR compliance
  return createHash('sha256')
    .update(`ac_salt_${rawIp.trim().toLowerCase()}`)
    .digest('hex')
    .slice(0, 32);
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = consentRecordSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid consent payload' }, { status: 400 });
    }

    const { anonymousId, essential, functional, analytics, marketing, consentVersion, zarazSynced } = parsed.data;

    const rawIp = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('cf-connecting-ip') || null;
    const ipHash = hashIp(rawIp);
    const userAgent = request.headers.get('user-agent')?.slice(0, 255) || null;

    const admin = createAdminSupabaseClientOrThrow();

    // 1. Look up primary AlphaClone platform tenant or default tenant
    const { data: tenant } = await admin
      .from('tenants')
      .select('id')
      .ilike('name', '%alphaclone%')
      .limit(1)
      .maybeSingle();

    const tenantId = tenant?.id || '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4';

    // 2. Insert into canonical consent_records table
    const purposes = [
      { purpose: 'cookie_essential', status: 'granted' },
      { purpose: 'cookie_functional', status: functional ? 'granted' : 'denied' },
      { purpose: 'cookie_analytics', status: analytics ? 'granted' : 'denied' },
      { purpose: 'cookie_marketing', status: marketing ? 'granted' : 'denied' },
    ];

    const records = purposes.map((p) => ({
      tenant_id: tenantId,
      purpose: p.purpose,
      channel: 'web_cmp',
      status: p.status,
      source: 'cloudflare_zaraz_bridge',
      user_agent: userAgent,
      evidence: {
        anonymous_id: anonymousId,
        consent_version: consentVersion,
        zaraz_synced: Boolean(zarazSynced),
        ip_hash: ipHash,
        all_choices: { essential, functional, analytics, marketing },
      },
      collected_at: new Date().toISOString(),
    }));

    await admin.from('consent_records').insert(records);

    return NextResponse.json({ success: true, recorded: records.length });
  } catch (error) {
    // Non-blocking for client, but return status
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Unable to record consent', details: message }, { status: 500 });
  }
}
