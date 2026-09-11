import type { EmailOtpType } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { publicAppUrl } from '@/lib/config/public-origin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const OTP_TYPES = new Set<EmailOtpType>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]);

function errorRedirect(code: string) {
  return NextResponse.redirect(publicAppUrl(`/auth/auth-code-error?error=${encodeURIComponent(code)}`));
}

/** Verify Supabase token-hash email links without exposing the token to client JS. */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const rawType = request.nextUrl.searchParams.get('type') as EmailOtpType | null;
  if (!tokenHash || !rawType || !OTP_TYPES.has(rawType)) {
    return errorRedirect('invalid_or_expired_link');
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: rawType });
  if (error) {
    return errorRedirect(rawType === 'recovery' ? 'expired_recovery_link' : 'invalid_or_expired_link');
  }

  if (rawType === 'recovery') {
    return NextResponse.redirect(publicAppUrl('/auth/reset-password'));
  }
  if (rawType === 'signup' || rawType === 'invite') {
    return NextResponse.redirect(publicAppUrl('/auth/welcome-gate'));
  }
  return NextResponse.redirect(publicAppUrl('/dashboard'));
}
