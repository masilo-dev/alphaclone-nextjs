import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { deleteLinkedInIntegration } from '@/services/linkedin/linkedinIntegrationService';

async function ensureTenantMembership(userId: string, tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return !error && !!data;
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

    const body = (await req.json()) as { tenantId?: string; linkedinMemberId?: string };
    const tenantId = body.tenantId?.trim();
    const linkedinMemberId = body.linkedinMemberId?.trim();

    if (!tenantId || !linkedinMemberId) {
      return NextResponse.json({ error: 'tenantId and linkedinMemberId are required' }, { status: 400 });
    }

    const isMember = await ensureTenantMembership(user.id, tenantId);
    if (!isMember) {
      return NextResponse.json({ error: 'You are not a member of this workspace.' }, { status: 403 });
    }

<<<<<<< HEAD
    const removed = await deleteLinkedInIntegration({
      tenantId,
      userId: user.id,
      linkedinMemberId,
    });
    if (!removed.success) {
      return NextResponse.json({ error: removed.error || 'Failed to disconnect' }, { status: 500 });
=======
    const admin = createSupabaseAdminClient();
    const { error: removeError } = await admin
      .from('linkedin_integrations')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .eq('linkedin_member_id', linkedinMemberId);

    if (removeError) {
      return NextResponse.json({ error: removeError.message }, { status: 500 });
>>>>>>> origin/main
    }

    const admin = createSupabaseAdminClient();
    const { data: remaining } = await admin
      .from('linkedin_integrations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (!remaining) {
      await admin.from('tenant_integrations').upsert(
        {
          tenant_id: tenantId,
          integration_id: 'linkedin-social',
          status: 'disconnected',
          configured_by: user.id,
          metadata: { reason: 'manual_disconnect' },
        },
        { onConflict: 'tenant_id,integration_id' }
      );
    }

<<<<<<< HEAD
=======
    // Remove stale queued sync jobs for tenant-level LinkedIn rows that no longer resolve.
>>>>>>> origin/main
    await admin
      .from('social_post_sync_queue')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('platform', 'linkedin')
      .is('processed_at', null);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to disconnect LinkedIn';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
