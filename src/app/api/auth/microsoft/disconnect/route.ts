import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { deleteMicrosoftConnection } from '@/services/microsoft/microsoftConnectionService';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    await deleteMicrosoftConnection(admin, user.id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[Microsoft Disconnect] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to disconnect Microsoft 365' },
      { status: 500 }
    );
  }
}
