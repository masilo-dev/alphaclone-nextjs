import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import 'server-only';

import { resolveSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  rateLimitClientPortalLogin,
  verifyClientPortalPassword,
  generateClientPortalJti,
  signClientPortalSession,
  setClientPortalCookie,
  createClientPortalSessionRow,
  writeClientPortalAuditRow,
  extractRequestIp,
  extractUserAgent,
  rotateClientPortalSessionSalt,
  CLIENT_PORTAL_LOCKOUT_FAILURES,
  CLIENT_PORTAL_LOCKOUT_MINUTES,
} from '@/lib/auth/clientPortalAuth';
import { appendWorkspaceActivity } from '@/services/finance/workspaceActivityService';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(4096),
  token: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = loginSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Valid email and password are required.' },
      { status: 400 }
    );
  }

  const { email, password, token } = parsed.data;
  const rateLimit = await rateLimitClientPortalLogin(email);
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: 'Too many login attempts. Please try again later.',
        retryAfter: Math.ceil((rateLimit.reset - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rateLimit.limit),
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'X-RateLimit-Reset': Math.ceil(rateLimit.reset / 1000).toString(),
          'Retry-After': Math.ceil((rateLimit.reset - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  const ipAddress = extractRequestIp(req);
  const userAgent = extractUserAgent(req);

  try {
    const admin = await resolveSupabaseAdminClient();

    let client: any = null;

    if (token) {
      const { data: byToken, error: tokenError } = await admin
        .from('business_clients')
        .select(
          'id, tenant_id, name, email, finance_portal_token, client_portal_password_hash, client_portal_session_salt, is_active'
        )
        .eq('finance_portal_token', token)
        .maybeSingle();
      if (tokenError) throw tokenError;
      if (byToken && byToken.email && byToken.email.toLowerCase() === email.toLowerCase()) {
        client = byToken;
      }
    }

    if (!client) {
      const { data: byEmail, error: emailError } = await admin
        .from('business_clients')
        .select(
          'id, tenant_id, name, email, finance_portal_token, client_portal_password_hash, client_portal_session_salt, is_active'
        )
        .ilike('email', email)
        .limit(5);
      if (emailError) throw emailError;
      for (const row of byEmail || []) {
        if (verifyClientPortalPassword(password, row.client_portal_password_hash)) {
          client = row;
          break;
        }
      }
    }

    if (!client || !verifyClientPortalPassword(password, client.client_portal_password_hash)) {
      // Backwards-compat: existing links / pre-rollout clients have NULL password hash.
      // If caller supplied the portal token AND the token-resolved client email matches
      // AND password_hash IS NULL, grant a set-password-scope session. The UI redirects
      // to /set-password first, which issues the full-scope cookie after password is set.
      const legacyOk =
        token &&
        client &&
        client.client_portal_password_hash == null &&
        (!password || password.length === 0 || password === client.finance_portal_token);
      if (!legacyOk) {
        if (client) {
          await admin
            .from('business_clients')
            .update({
              client_portal_login_failure_count: (client.client_portal_login_failure_count ?? 0) + 1,
              client_portal_locked_until:
                (client.client_portal_login_failure_count ?? 0) + 1 >= CLIENT_PORTAL_LOCKOUT_FAILURES
                  ? new Date(Date.now() + CLIENT_PORTAL_LOCKOUT_MINUTES * 60 * 1000).toISOString()
                  : client.client_portal_locked_until ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', client.id)
            .eq('tenant_id', client.tenant_id);
          await writeClientPortalAuditRow(admin, {
            tenant_id: client.tenant_id,
            client_id: client.id,
            event_type: 'login_failure',
            ip_address: ipAddress,
            user_agent: userAgent,
            metadata: { reason: 'bad_password', via_token: Boolean(token) },
          });
        }
        return NextResponse.json(
          { error: 'Invalid email or password.' },
          { status: 401 }
        );
      }
    }

    if (client.is_active === false) {
      await writeClientPortalAuditRow(admin, {
        tenant_id: client.tenant_id,
        client_id: client.id,
        event_type: 'login_failure',
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: { reason: 'client_inactive' },
      });
      return NextResponse.json(
        { error: 'This portal account is not active.' },
        { status: 403 }
      );
    }

    if (client.client_portal_locked_until && new Date(client.client_portal_locked_until).getTime() > Date.now()) {
      const retryAfterSec = Math.ceil((new Date(client.client_portal_locked_until).getTime() - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: 'Too many failed attempts. This account is temporarily locked.',
          retryAfter: retryAfterSec,
        },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      );
    }

    const isLegacyFirstTime = client.client_portal_password_hash == null;

    let sessionSalt = client.client_portal_session_salt;
    if (!sessionSalt) {
      sessionSalt = rotateClientPortalSessionSalt();
      const { error: saltError } = await admin
        .from('business_clients')
        .update({
          client_portal_session_salt: sessionSalt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', client.id)
        .eq('tenant_id', client.tenant_id);
      if (saltError) throw saltError;
    }

    const sessionJti = generateClientPortalJti();
    const jwt = signClientPortalSession({
      clientId: client.id,
      tenantId: client.tenant_id,
      sessionSalt,
      sessionJti,
    });

    await createClientPortalSessionRow(admin, {
      clientId: client.id,
      tenantId: client.tenant_id,
      sessionJti,
      sessionSalt,
      ipAddress,
      userAgent,
    });

    await writeClientPortalAuditRow(admin, {
      tenant_id: client.tenant_id,
      client_id: client.id,
      session_jti: sessionJti,
      event_type: 'login_success',
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { via_token: Boolean(token), legacy_first_time: isLegacyFirstTime },
    });

    void appendWorkspaceActivity(admin, {
      tenant_id: client.tenant_id,
      project_id: null,
      client_id: client.id,
      invoice_id: null,
      contract_id: null,
      actor_type: 'client',
      actor_id: client.id,
      actor_display_name: client.name ? `Client: ${client.name}` : null,
      event_type: 'client_portal.login',
      summary: `${client.name || client.email || 'Client'} logged into the client portal`,
      metadata: { via_token: Boolean(token), legacy_first_time: isLegacyFirstTime, ip_address: ipAddress },
    }).catch((e) => console.error('[client-portal-auth/login] workspace activity failed', e));

    await admin
      .from('business_clients')
      .update({
        client_portal_last_login_at: new Date().toISOString(),
        client_portal_login_failure_count: 0,
        client_portal_locked_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', client.id)
      .eq('tenant_id', client.tenant_id);

    const portalToken = client.finance_portal_token || token;
    const portalNextHref = portalToken ? `/portal/${encodeURIComponent(portalToken)}` : '/';
    const redirectTo = isLegacyFirstTime
      ? `/set-password${portalToken ? `?token=${encodeURIComponent(portalToken)}` : ''}`
      : portalNextHref;

    const response = NextResponse.json({
      success: true,
      redirectTo,
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
      },
    });

    return setClientPortalCookie(jwt, response);
  } catch (error) {
    console.error('[client-portal-auth/login]', error);
    return NextResponse.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}
