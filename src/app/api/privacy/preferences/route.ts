import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, routeErrorResponse } from '@/lib/apiAuth';
import { verifyPublicComplianceToken } from '@/lib/compliance/publicTokens';

const updateSchema = z.object({
  token: z.string().min(20),
  marketing: z.boolean(),
  newsletter: z.boolean(),
  productAnnouncements: z.boolean(),
  eventInvitations: z.boolean(),
  salesFollowUp: z.boolean(),
  researchRequests: z.boolean(),
  optionalServiceUpdates: z.boolean(),
  preferredLanguage: z.string().min(2).max(12).optional(),
  preferredFrequency: z.enum(['immediate', 'daily', 'weekly', 'monthly']).optional(),
});

function publicRecord(row: Record<string, unknown> | null) {
  return {
    marketing: Boolean(row?.marketing),
    newsletter: Boolean(row?.newsletter),
    productAnnouncements: Boolean(row?.product_announcements),
    eventInvitations: Boolean(row?.event_invitations),
    salesFollowUp: Boolean(row?.sales_follow_up),
    researchRequests: Boolean(row?.research_requests),
    optionalServiceUpdates: row?.optional_service_updates !== false,
    preferredLanguage: String(row?.preferred_language || ''),
    preferredFrequency: String(row?.preferred_frequency || 'immediate'),
  };
}

export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get('token') || '';
    const verified = verifyPublicComplianceToken(token, 'preferences');
    if (!verified) return NextResponse.json({ error: 'This preference link is invalid or expired.' }, { status: 401 });
    const admin = createAdminSupabaseClientOrThrow();
    const { data, error } = await admin.from('communication_preferences').select('*')
      .eq('tenant_id', verified.tenantId).eq('email_address', verified.subject).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ email: verified.subject, preferences: publicRecord(data) });
  } catch (error) {
    return routeErrorResponse(error, 'Unable to load communication preferences', request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    const verified = verifyPublicComplianceToken(parsed.data.token, 'preferences');
    if (!verified) return NextResponse.json({ error: 'This preference link is invalid or expired.' }, { status: 401 });
    const admin = createAdminSupabaseClientOrThrow();
    const values = {
      tenant_id: verified.tenantId,
      email_address: verified.subject,
      marketing: parsed.data.marketing,
      newsletter: parsed.data.newsletter,
      product_announcements: parsed.data.productAnnouncements,
      event_invitations: parsed.data.eventInvitations,
      sales_follow_up: parsed.data.salesFollowUp,
      research_requests: parsed.data.researchRequests,
      optional_service_updates: parsed.data.optionalServiceUpdates,
      preferred_language: parsed.data.preferredLanguage || null,
      preferred_frequency: parsed.data.preferredFrequency || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await admin.from('communication_preferences').upsert(values, { onConflict: 'tenant_id,email_address' });
    if (error) throw error;
    if (!parsed.data.marketing) {
      await admin.from('email_suppressions').upsert({
        tenant_id: verified.tenantId, email: verified.subject, reason: 'unsubscribe',
        metadata: { source: 'preference_centre' }, updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,email' });
    } else {
      await admin.from('email_suppressions').delete()
        .eq('tenant_id', verified.tenantId).eq('email', verified.subject).eq('reason', 'unsubscribe');
    }
    await admin.from('communication_preference_events').insert({
      tenant_id: verified.tenantId, email_address: verified.subject, event_type: 'preferences_updated',
      evidence: { channel: 'public_preference_centre', preferences: values },
    });
    return NextResponse.json({ saved: true, preferences: publicRecord(values) });
  } catch (error) {
    return routeErrorResponse(error, 'Unable to save communication preferences', request);
  }
}
