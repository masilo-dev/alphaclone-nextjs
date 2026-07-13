import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

function sanitizeSlug(input: string, fallback: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return base || fallback;
}

async function uniqueSlug(admin: SupabaseClient, slugBase: string): Promise<string> {
  let slug = slugBase;
  let attempt = 0;
  while (attempt < 60) {
    const { data } = await admin.from('tenants').select('id').eq('slug', slug).limit(1).maybeSingle();
    if (!data?.id) return slug;
    attempt += 1;
    slug = `${slugBase.slice(0, Math.max(8, 72 - String(attempt).length - 1))}-${attempt}`;
  }
  return `${slugBase}-${Date.now().toString(36)}`;
}

export async function ensureUserProfile(
  admin: SupabaseClient,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }
) {
  const name =
    String(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User').trim();
  await admin
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email: user.email,
        name,
        role: 'tenant_admin',
      },
      { onConflict: 'id' }
    );
}

export async function bootstrapTenantForUser(
  admin: SupabaseClient,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> },
  options?: { name?: string; slug?: string; plan?: string; referralCode?: string }
): Promise<{ tenantId: string; created: boolean }> {
  await ensureUserProfile(admin, user);

  const { data: memberships } = await admin
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })
    .limit(1);

  const existingId = memberships?.[0]?.tenant_id;
  if (existingId) {
    return { tenantId: existingId, created: false };
  }

  const displayName =
    options?.name?.trim() ||
    String(user.user_metadata?.business_name || user.user_metadata?.workspace_name || '').trim() ||
    `${String(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User').trim()}'s Organization`;

  const slugBase = sanitizeSlug(
    options?.slug || displayName,
    `org-${user.id.slice(0, 8)}`
  );
  const slug = await uniqueSlug(admin, slugBase);
  const plan = options?.plan || 'free';

  const { data: tenantId, error: rpcError } = await admin.rpc('create_tenant', {
    p_name: displayName,
    p_slug: slug,
    p_admin_user_id: user.id,
    p_plan: plan,
  });

  if (!rpcError && tenantId) {
    return { tenantId: String(tenantId), created: true };
  }

  console.warn('[bootstrapTenant] create_tenant RPC failed, using direct insert:', rpcError?.message);

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  const { data: tenant, error: insertError } = await admin
    .from('tenants')
    .insert({
      name: displayName,
      slug,
      subscription_plan: plan,
      subscription_status: 'trial',
      trial_ends_at: trialEndsAt.toISOString(),
    })
    .select('id')
    .single();

  if (insertError || !tenant?.id) {
    throw insertError || new Error('Failed to create tenant');
  }

  const { error: memberError } = await admin.from('tenant_users').upsert(
    {
      tenant_id: tenant.id,
      user_id: user.id,
      role: 'tenant_admin',
    },
    { onConflict: 'tenant_id,user_id' }
  );

  if (memberError) throw memberError;

  try {
    await admin.from('business_automation_events').insert({
      tenant_id: tenant.id,
      event_type: 'tenant_created',
      payload: {
        tenantId: tenant.id,
        name: displayName,
        adminUserId: user.id,
        source: 'bootstrap_api',
        referralCode: options?.referralCode || null,
      },
    });
  } catch {
    // optional table
  }

  return { tenantId: tenant.id, created: true };
}
