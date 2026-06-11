import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';

export const dynamic = 'force-dynamic';

async function getAuthedClient(req: NextRequest) {
  if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Server configuration error.');
  }
  const admin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (bearer) {
    const { data, error } = await admin.auth.getUser(bearer);
    if (error || !data.user) throw new Error('Authentication required.');
    return { admin, user: data.user };
  }
  const { data, error } = await admin.auth.getUser();
  if (error || !data.user) throw new Error('Authentication required.');
  return { admin, user: data.user };
}

function normalizePrefs(input: any) {
  return {
    transactional: input?.transactional !== false,
    product_updates: input?.product_updates !== false,
    marketing: Boolean(input?.marketing),
    sms: Boolean(input?.sms),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { admin, user } = await getAuthedClient(req);
    const { data, error } = await admin.from('profiles').select('communication_prefs, gdpr_consent_date, gdpr_consent_ip').eq('id', user.id).maybeSingle();
    if (error) throw error;
    return NextResponse.json({
      communicationPrefs: normalizePrefs(data?.communication_prefs),
      gdprConsentDate: data?.gdpr_consent_date ?? null,
      gdprConsentIp: data?.gdpr_consent_ip ?? null,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unexpected error' }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { admin, user } = await getAuthedClient(req);
    const payload = await req.json().catch(() => ({}));
    const communicationPrefs = normalizePrefs(payload.communicationPrefs || payload);
    const headers = req.headers;
    const country = headers.get('x-vercel-ip-country') || '';
    const isEuUk = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'UK'].includes(country);
    const acceptedLegal = payload.acceptedLegal !== false;
    const euConsent = Boolean(payload.euConsent);
    const ageConfirmed = Boolean(payload.ageConfirmed);

    if (!acceptedLegal) {
      return NextResponse.json({ error: 'You must accept the terms and privacy policy.' }, { status: 400 });
    }
    if (isEuUk && (!euConsent || !ageConfirmed)) {
      return NextResponse.json({ error: 'EU/UK consent and age confirmation are required.' }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {
      communication_prefs: communicationPrefs,
    };
    if (payload.marketingOptIn !== undefined) {
      updatePayload.communication_prefs.marketing = Boolean(payload.marketingOptIn);
    }
    if (payload.isRegistration || payload.captureConsent || acceptedLegal) {
      updatePayload.gdpr_consent_date = new Date().toISOString();
      updatePayload.gdpr_consent_ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
    }

    const { error } = await admin.from('profiles').update(updatePayload).eq('id', user.id);
    if (error) throw error;

    return NextResponse.json({ success: true, communicationPrefs: updatePayload.communication_prefs });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unexpected error' }, { status: 500 });
  }
}
