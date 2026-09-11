import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { start } from 'workflow/api';
import { userOnboardingWorkflow } from '@/workflows/user-onboarding';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ENV } from '@/config/env';

function createUserClient(accessToken: string) {
  const url = ENV.VITE_SUPABASE_URL || ENV.NEXT_PUBLIC_SUPABASE_URL;
  const anon = ENV.VITE_SUPABASE_ANON_KEY || ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error('Supabase URL or anon key missing');
  }

  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : null;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const tenantId = String(body?.tenantId || '').trim();

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const userClient = createUserClient(token);
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();

    if (userErr || !user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const membership = await admin
      .from('tenant_users')
      .select('tenant_id')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membership.error || !membership.data) {
      return NextResponse.json({ error: 'No tenant access' }, { status: 403 });
    }

    const authUser = await admin.auth.admin.getUserById(user.id);
    if (authUser.data.user?.user_metadata?.onboarding_started_at) {
      return NextResponse.json({ success: true, skipped: true });
    }

    const { runId } = await start(userOnboardingWorkflow, [{ userId: user.id, tenantId }]);

    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(authUser.data.user?.user_metadata || {}),
        onboarding_started_at: new Date().toISOString(),
        onboarding_run_id: runId,
      },
    });

    return NextResponse.json({ success: true, runId });
  } catch (error) {
    console.error('[onboarding/start]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
