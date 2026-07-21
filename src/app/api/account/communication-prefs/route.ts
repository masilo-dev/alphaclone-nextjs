import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import { getRequestCountry } from '@/lib/server/requestGeo';

export const dynamic = 'force-dynamic';

// Snapshot of the currently published legal policies users accept at signup.
// Bump this whenever Terms/Privacy materially change so re-acceptance can be required.
const LEGAL_POLICY_VERSION = '2026-06-01';

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
  const normalized: Record<string, any> = {
    transactional: input?.transactional !== false,
    product_updates: input?.product_updates !== false,
    marketing: Boolean(input?.marketing),
    sms: Boolean(input?.sms),
  };
  // Preserve the legal acceptance audit trail if it was already recorded.
  if (input?.legal_acceptance && typeof input.legal_acceptance === 'object') {
    normalized.legal_acceptance = input.legal_acceptance;
  }
  return normalized;
}

export async function GET(req: NextRequest) {
  try {
    const { admin, user } = await getAuthedClient(req);
    const { data, error } = await admin.from('profiles').select('communication_prefs, gdpr_consent_date, gdpr_consent_ip').eq('id', user.id).maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({
        communicationPrefs: normalizePrefs(null),
        gdprConsentDate: null,
        gdprConsentIp: null,
      });
    }
    return NextResponse.json({
      communicationPrefs: normalizePrefs(data?.communication_prefs),
      gdprConsentDate: data?.gdpr_consent_date ?? null,
      gdprConsentIp: data?.gdpr_consent_ip ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    const status = message.includes('Authentication') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { admin, user } = await getAuthedClient(req);
    const payload = await req.json().catch(() => ({}));
    const communicationPrefs = normalizePrefs(payload.communicationPrefs || payload);
    const headers = req.headers;
    const country = getRequestCountry(headers);
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
      const consentIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
      const consentAt = new Date().toISOString();
      updatePayload.gdpr_consent_date = consentAt;
      updatePayload.gdpr_consent_ip = consentIp;
      updatePayload.communication_prefs.legal_acceptance = {
        accepted_at: consentAt,
        policy_version: LEGAL_POLICY_VERSION,
        ip: consentIp,
        country: country || null,
        eu_consent: isEuUk ? euConsent : null,
        age_confirmed: isEuUk ? ageConfirmed : null,
        terms_url: 'https://alphaclonesystems.com/terms-of-service',
        privacy_url: 'https://alphaclonesystems.com/privacy-policy',
      };
    }

    const profileName = String(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User').trim();
    const { error } = await admin.from('profiles').upsert(
      {
        id: user.id,
        email: user.email,
        name: profileName,
        role: 'tenant_admin',
        ...updatePayload,
      },
      { onConflict: 'id' }
    );
    if (error) throw error;

    return NextResponse.json({ success: true, communicationPrefs: updatePayload.communication_prefs });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unexpected error' }, { status: 500 });
  }
}
