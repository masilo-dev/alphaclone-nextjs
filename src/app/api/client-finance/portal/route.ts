import { NextRequest, NextResponse } from 'next/server';
import { resolveSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireClientPortalAccessDoubleGuarded } from '@/lib/auth/clientPortalAuth';
import { resolveClientByPortalToken, getClientFinancePortalData } from '@/services/finance/clientFinancePortalService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')?.trim();
    if (!token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 });
    }

    const admin = await resolveSupabaseAdminClient();
    const guarded = await requireClientPortalAccessDoubleGuarded(
      admin,
      token,
      resolveClientByPortalToken
    );

    if (!guarded.ok) {
      const status = guarded.error.http;
      let message = 'Access denied';
      switch (guarded.error.code) {
        case 'NO_SESSION':
        case 'BAD_TOKEN':
        case 'SALT_ROTATED':
        case 'SESSION_REVOKED':
          message = 'Session expired or invalid. Please log in again.';
          break;
        case 'CLIENT_INACTIVE':
          message = 'This portal account is not active.';
          break;
        case 'TOKEN_MISMATCH':
          message = 'Session does not match this portal.';
          break;
        case 'BAD_PORTAL_TOKEN':
          message = 'Portal not found.';
          break;
        case 'INTERNAL_ERROR':
          message = 'Server error.';
          break;
      }
      return NextResponse.json({ error: message, code: guarded.error.code }, { status });
    }

    const data = await getClientFinancePortalData(admin, token, req.nextUrl.origin);

    if (!data) {
      return NextResponse.json({ error: 'Portal not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, portal: data });
  } catch (error) {
    console.error('[client-finance/portal]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load portal' },
      { status: 500 }
    );
  }
}
