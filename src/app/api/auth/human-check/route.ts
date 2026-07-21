import { NextRequest, NextResponse } from 'next/server';
import { isTurnstileEnforced, verifyTurnstileToken } from '@/lib/verifyTurnstile';

/**
 * Pre-auth human check for login/register.
 * When Turnstile is enforced, clients must pass a valid token before calling Supabase Auth.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isTurnstileEnforced()) {
      return NextResponse.json({ success: true, enforced: false });
    }

    const body = await request.json().catch(() => ({}));
    const token = String(body?.turnstileToken || body?.turnstile_token || '').trim();
    if (!token) {
      return NextResponse.json({ error: 'Security verification required' }, { status: 400 });
    }

    const ok = await verifyTurnstileToken(token);
    if (!ok) {
      return NextResponse.json({ error: 'Security verification failed. Please try again.' }, { status: 403 });
    }

    return NextResponse.json({ success: true, enforced: true });
  } catch {
    return NextResponse.json({ error: 'Security verification failed' }, { status: 500 });
  }
}
