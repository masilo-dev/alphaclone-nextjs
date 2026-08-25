import { NextRequest, NextResponse } from 'next/server';
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe';
import {
  getPublicEmailPreferences,
  updatePublicEmailPreferences,
} from '@/lib/email/emailPreferences';
import { EMAIL_PREFERENCE_CATEGORIES } from '@/lib/email/emailPurposeRegistry';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tenantId = String(url.searchParams.get('tenant') || '').trim();
  const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
  const token = String(url.searchParams.get('token') || '').trim();

  if (!tenantId || !email) {
    return NextResponse.json({ error: 'tenant and email are required' }, { status: 400 });
  }

  if (token) {
    const verified = verifyUnsubscribeToken(token);
    if (!verified || verified.tenantId !== tenantId || verified.email !== email) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    }
  }

  const preferences = await getPublicEmailPreferences(tenantId, email);
  return NextResponse.json({
    email,
    tenant_id: tenantId,
    preferences,
    categories: EMAIL_PREFERENCE_CATEGORIES,
  });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const tenantId = String(body.tenant_id || body.tenantId || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const token = String(body.token || '').trim();

  if (!tenantId || !email || !token) {
    return NextResponse.json({ error: 'tenant_id, email, and token are required' }, { status: 400 });
  }

  const verified = verifyUnsubscribeToken(token);
  if (!verified || verified.tenantId !== tenantId || verified.email !== email) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }

  await updatePublicEmailPreferences(tenantId, email, {
    marketing: body.marketing,
    outreach: body.outreach,
    newsletter: body.newsletter,
    categories: body.categories,
    unsubscribe_all_marketing: body.unsubscribe_all_marketing === true,
  });

  const preferences = await getPublicEmailPreferences(tenantId, email);
  return NextResponse.json({ success: true, preferences });
}
