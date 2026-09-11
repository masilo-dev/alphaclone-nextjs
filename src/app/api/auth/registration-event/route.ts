import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ENV } from '@/config/env';
import { recordRegistrationEvent } from '@/lib/auth/registrationEvents';
import { getRequestCountry } from '@/lib/server/requestGeo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function createUserClient(accessToken: string) {
  const url = ENV.VITE_SUPABASE_URL || ENV.NEXT_PUBLIC_SUPABASE_URL;
  const anon = ENV.VITE_SUPABASE_ANON_KEY || ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Supabase URL or anon key missing');
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : null;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userClient = createUserClient(token);
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const admin = createSupabaseAdminClient();
    const result = await recordRegistrationEvent(admin, {
      user,
      signupMethod: 'email',
      sourceUrl: req.headers.get('referer'),
      userAgent: req.headers.get('user-agent'),
      country: getRequestCountry(req.headers),
      selectedPlan: body?.selectedPlan,
      referralCode: body?.referralCode,
      businessName: body?.businessName,
      marketingOptIn: body?.marketingOptIn,
      legalAccepted: body?.legalAccepted,
      euConsent: body?.euConsent,
      ageConfirmed: body?.ageConfirmed,
      metadata: {
        immediateSession: true,
      },
    });

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    console.error('[auth/registration-event]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
