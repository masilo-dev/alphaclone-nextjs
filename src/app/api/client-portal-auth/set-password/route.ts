import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import 'server-only';

import { resolveSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  hashClientPortalPassword,
  validateClientPortalPasswordStrength,
  rotateClientPortalSessionSalt,
  signClientPortalSession,
  setClientPortalCookie,
  clearClientPortalCookie,
  generateClientPortalJti,
  createClientPortalSessionRow,
  writeClientPortalAuditRow,
  requireClientPortalSession,
  extractRequestIp,
  extractUserAgent,
} from '@/lib/auth/clientPortalAuth';

export const dynamic = 'force-dynamic';

const schema = z.object({
  newPassword: z.string().min(1).max(4096),
  confirmPassword: z.string().min(1).max(4096),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'A new password and confirmation are both required.' },
      { status: 400 }
    );
  }
  if (parsed.data.newPassword !== parsed.data.confirmPassword) {
    return NextResponse.json(
      { error: 'Passwords do not match. Please try again.' },
      { status: 400 }
    );
  }
  const strength = validateClientPortalPasswordStrength(parsed.data.newPassword);
  if (!strength.ok) {
    return NextResponse.json({ error: strength.reason }, { status: 400 });
  }

  try {
    const admin = await resolveSupabaseAdminClient();
    const session = await requireClientPortalSession(admin);
    // First-time set-password flow: password_hash MUST be NULL on the current client row.
    // (Legacy sessions issued from the backwards-compat login path above must be fresh.)
    // If we're rotating, the grant-access owner endpoint handles that flow instead.
    if (!session.ok) {
      const cleared = clearClientPortalCookie();
      cleared.headers.set('Cache-Control', 'private, no-store');
      return NextResponse.json(
        { error: 'Your session has expired. Please return to the link we emailed and sign in again.' },
        { status: 401, headers: cleared.headers }
      );
    }
    const { clientId, tenantId, sessionJti: currentJti } = session.session;

    const { data: row, error: rowErr } = await admin
      .from('business_clients')
      .select('id, tenant_id, finance_portal_token, client_portal_password_hash')
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (rowErr) throw rowErr;
    if (!row) {
      const cleared = clearClientPortalCookie();
      return NextResponse.json({ error: 'Account not found.' }, { status: 404, headers: cleared.headers });
    }

    if (row.client_portal_password_hash != null) {
      // Already has a password. This endpoint is ONLY for the first-time set-password flow.
      // To change an existing password, use reset-password with owner or forgot-token path.
      return NextResponse.json(
        { error: 'A password is already set for this account. Please sign in instead or use the password reset flow.' },
        { status: 409 }
      );
    }

    const hash = hashClientPortalPassword(parsed.data.newPassword);
    const newSalt = rotateClientPortalSessionSalt();
    const now = new Date().toISOString();
    const { error: updateErr } = await admin
      .from('business_clients')
      .update({
        client_portal_password_hash: hash,
        client_portal_password_set_at: now,
        client_portal_session_salt: newSalt,
        updated_at: now,
      })
      .eq('id', clientId)
      .eq('tenant_id', tenantId);
    if (updateErr) throw updateErr;

    // Soft-delete the session used to set the password (it had the OLD salt anyway, salt rotation will
    // invalidate it if the UI retries. But do the explicit delete so audit rows line up).
    await admin
      .from('client_portal_sessions')
      .update({ is_active: false, signed_out_at: now })
      .eq('session_jti', currentJti)
      .eq('tenant_id', tenantId);

    const newJti = generateClientPortalJti();
    const jwt = signClientPortalSession({
      clientId,
      tenantId,
      sessionSalt: newSalt,
      sessionJti: newJti,
    });
    await createClientPortalSessionRow(admin, {
      clientId,
      tenantId,
      sessionJti: newJti,
      sessionSalt: newSalt,
      ipAddress: extractRequestIp(req),
      userAgent: extractUserAgent(req),
    });
    await writeClientPortalAuditRow(admin, {
      tenant_id: tenantId,
      client_id: clientId,
      session_jti: newJti,
      event_type: 'password_set',
      ip_address: extractRequestIp(req),
      user_agent: extractUserAgent(req),
      metadata: { source: 'legacy_first_time_set_password_form' },
    });

    const redirectTo = row.finance_portal_token
      ? `/portal/${encodeURIComponent(row.finance_portal_token)}`
      : '/';

    const res = NextResponse.json({ success: true, redirectTo });
    setClientPortalCookie(jwt, res);
    res.headers.set('Cache-Control', 'private, no-store');
    return res;
  } catch (error) {
    console.error('[client-portal-auth/set-password]', error);
    return NextResponse.json(
      { error: 'We could not update your password. Please try again in a moment.' },
      { status: 500 }
    );
  }
}
