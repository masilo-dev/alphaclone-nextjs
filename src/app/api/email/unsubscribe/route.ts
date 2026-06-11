import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClientOrThrow } from '@/lib/apiAuth';
import { verifyEmailUnsubscribeSignature } from '@/lib/email/unsubscribe';
import { SITE_URL } from '@/lib/siteUrl';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tenantId = String(url.searchParams.get('tenantId') || '').trim();
  const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
  const sig = String(url.searchParams.get('sig') || '').trim().toLowerCase();

  if (!verifyEmailUnsubscribeSignature({ tenantId, email, sig })) {
    return NextResponse.json({ error: 'Invalid unsubscribe link' }, { status: 400 });
  }

  const supabase = createAdminSupabaseClientOrThrow();
  await supabase.from('email_suppressions').upsert({
    tenant_id: tenantId,
    email,
    reason: 'unsubscribe',
    source: 'unsubscribe_link',
    created_at: new Date().toISOString(),
  });

  const redirectTo = new URL('/privacy-choices', SITE_URL);
  redirectTo.searchParams.set('unsubscribed', '1');
  return NextResponse.redirect(redirectTo);
}

