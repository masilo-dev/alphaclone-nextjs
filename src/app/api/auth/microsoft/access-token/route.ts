import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import {
  getMicrosoftTokens,
  MicrosoftReconnectRequiredError,
  refreshMicrosoftAccessToken,
} from '@/services/microsoft/microsoftConnectionService';

export const runtime = 'nodejs';

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
      return NextResponse.json({ error: 'Microsoft 365 is not connected.' }, { status: 400 });
    }

    const { accessToken, refreshed } = await refreshMicrosoftAccessToken(admin, user.id, {
      force: forceRefresh,
    });
    const { connection: updatedConnection } = await getMicrosoftTokens(admin, user.id);

    return NextResponse.json({
      accessToken,
      tokenExpiry: updatedConnection?.token_expiry || connection.token_expiry,
      refreshed,
      email: updatedConnection?.microsoft_email || connection.microsoft_email,
    });
  } catch (err: unknown) {
    if (err instanceof MicrosoftReconnectRequiredError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 401 });
    }
    console.error('[Microsoft Access Token] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load Microsoft access token' },
      { status: 500 }
    );
  }
}
