import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { ENV } from '@/config/env';
import { stripOAuthTokens } from '@/lib/security/productionGuard';
import {
  getMicrosoftTokens,
  MicrosoftReconnectRequiredError,
  refreshMicrosoftAccessToken,
} from '@/services/microsoft/microsoftConnectionService';

export const runtime = 'nodejs';

function publicConnection(row: Record<string, unknown> | null) {
  return stripOAuthTokens(row);
}

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
    const forceRefresh = body?.force === true;

    const admin = createSupabaseAdminClient();
    const { connection } = await getMicrosoftTokens(admin, user.id);

    if (!connection) {
      return NextResponse.json({ error: 'No Microsoft connection found.' }, { status: 400 });
    }

    const expiresAt = connection.token_expiry ? new Date(connection.token_expiry).getTime() : 0;
    const needsRefresh =
      forceRefresh ||
      !connection.token_expiry ||
      Number.isNaN(expiresAt) ||
      Date.now() + 5 * 60 * 1000 >= expiresAt;

    if (!needsRefresh) {
      return NextResponse.json({
        success: true,
        refreshed: false,
        connection: publicConnection(connection as Record<string, unknown>),
      });
    }

    const clientId = ENV.AZURE_CLIENT_ID || ENV.VITE_AZURE_CLIENT_ID;
    const clientSecret = ENV.AZURE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Microsoft OAuth is not configured on the server.' },
        { status: 500 }
      );
    }

    const { refreshed } = await refreshMicrosoftAccessToken(admin, user.id, { force: forceRefresh });
    const { connection: updatedConnection } = await getMicrosoftTokens(admin, user.id);

    return NextResponse.json({
      success: true,
      refreshed,
      connection: publicConnection((updatedConnection || connection) as Record<string, unknown>),
    });
  } catch (err: unknown) {
    if (err instanceof MicrosoftReconnectRequiredError) {
      return NextResponse.json({ error: err.message, code: err.code, success: false }, { status: 401 });
    }
    console.error('[Microsoft Refresh] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to refresh Microsoft access token' },
      { status: 500 }
    );
  }
}
