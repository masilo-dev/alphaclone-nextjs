import { NextRequest, NextResponse } from 'next/server';
import 'server-only';

import { resolveSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  requireClientPortalSession,
  revokeClientPortalSessionByJti,
  clearClientPortalCookie,
  writeClientPortalAuditRow,
  extractRequestIp,
  extractUserAgent,
} from '@/lib/auth/clientPortalAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const admin = await resolveSupabaseAdminClient();
    const session = await requireClientPortalSession(admin);
    const ipAddress = extractRequestIp(req);
    const userAgent = extractUserAgent(req);

    if (session.ok) {
      await revokeClientPortalSessionByJti(admin, session.session.sessionJti);
      await writeClientPortalAuditRow(admin, {
        tenant_id: session.session.tenantId,
        client_id: session.session.clientId,
        session_jti: session.session.sessionJti,
        event_type: 'logout',
        ip_address: ipAddress,
        user_agent: userAgent,
      });
    }

    return clearClientPortalCookie(
      NextResponse.json({ success: true })
    );
  } catch (error) {
    console.error('[client-portal-auth/logout]', error);
    return clearClientPortalCookie(
      NextResponse.json({ success: true })
    );
  }
}
