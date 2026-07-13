import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const referralCode = String(body?.referralCode || '').trim();
    if (!referralCode) {
      return NextResponse.json({ error: 'referralCode is required' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('email, name, tenant_id')
      .eq('id', user.id)
      .maybeSingle();

    const { error } = await admin.from('referrals').upsert(
      {
        referral_code: referralCode,
        referred_user_id: user.id,
        referred_email: String(body?.referredEmail || profile?.email || user.email || '').trim() || null,
        referred_name: String(profile?.name || user.user_metadata?.name || '').trim() || null,
        tenant_id: profile?.tenant_id || null,
        status: 'registered',
        claimed_at: new Date().toISOString(),
      },
      { onConflict: 'referral_code,referred_user_id' }
    );

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to record referral' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record referral';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
