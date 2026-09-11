import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, routeErrorResponse } from '@/lib/apiAuth';
import { createPublicComplianceToken, verifyPublicComplianceToken } from '@/lib/compliance/publicTokens';

const requestSchema = z.object({
  tenantId: z.string().uuid(),
  requestType: z.enum([
    'access', 'correction', 'deletion', 'portability', 'restriction', 'objection',
    'consent_withdrawal', 'marketing_opt_out', 'do_not_sell_or_share', 'appeal', 'complaint', 'status_inquiry',
  ]),
  email: z.string().email(),
  name: z.string().max(160).optional(),
  jurisdiction: z.string().max(80).optional(),
  details: z.string().min(10).max(5000),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    const admin = createAdminSupabaseClientOrThrow();
    const { data: tenant } = await admin.from('tenants').select('id').eq('id', parsed.data.tenantId).maybeSingle();
    if (!tenant) return NextResponse.json({ error: 'The selected privacy contact is unavailable.' }, { status: 404 });
    const requestId = randomUUID();
    const requestNumber = `PR-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const statusToken = createPublicComplianceToken({
      tenantId: parsed.data.tenantId, subject: requestId, purpose: 'privacy_request_status',
      ttlSeconds: 60 * 60 * 24 * 90,
    });
    if (!statusToken) return NextResponse.json({ error: 'Privacy request token signing is not configured.' }, { status: 503 });
    const { error } = await admin.from('privacy_requests').insert({
      id: requestId, tenant_id: parsed.data.tenantId, request_number: requestNumber,
      request_type: parsed.data.requestType, requester_email: parsed.data.email.trim().toLowerCase(),
      requester_name: parsed.data.name || null, jurisdiction: parsed.data.jurisdiction || null,
      details: parsed.data.details, token_hash: createHash('sha256').update(statusToken).digest('hex'),
      token_expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
    });
    if (error) throw error;
    await admin.from('privacy_request_events').insert({
      tenant_id: parsed.data.tenantId, privacy_request_id: requestId,
      event_type: 'received', metadata: { source: 'public_request_centre' },
    });
    return NextResponse.json({ requestNumber, statusToken }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Unable to submit the privacy request', request);
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get('token') || '';
    const verified = verifyPublicComplianceToken(token, 'privacy_request_status');
    if (!verified) return NextResponse.json({ error: 'This status link is invalid or expired.' }, { status: 401 });
    const admin = createAdminSupabaseClientOrThrow();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const { data, error } = await admin.from('privacy_requests')
      .select('request_number,request_type,status,identity_status,created_at,due_at,completed_at')
      .eq('id', verified.subject).eq('tenant_id', verified.tenantId).eq('token_hash', tokenHash).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Privacy request not found.' }, { status: 404 });
    return NextResponse.json({ request: data });
  } catch (error) {
    return routeErrorResponse(error, 'Unable to load privacy request status', request);
  }
}
