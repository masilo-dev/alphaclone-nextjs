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
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (existing?.id) {
    await admin.from('profiles').update({ email: user.email, name }).eq('id', user.id);
  } else {
    await admin.from('profiles').insert({
      id: user.id,
      email: user.email,
      name,
      role: 'tenant_admin',
    });
  }
}

export async function bootstrapTenantForUser(
  admin: SupabaseClient,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> },
  options?: {
    name?: string;
    slug?: string;
    plan?: string;
    referralCode?: string;
    mode?: 'ensure' | 'create';
    idempotencyKey?: string;
  }
): Promise<{ tenantId: string; created: boolean }> {
  await ensureUserProfile(admin, user);

  if (options?.mode !== 'create') {
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

  const { data: tenantId, error: rpcError } = await admin.rpc('create_tenant_idempotent', {
    p_name: displayName,
    p_slug: slug,
    p_admin_user_id: user.id,
    p_plan: plan,
    p_idempotency_key: options?.idempotencyKey || 'initial-workspace-v1',
  });

  if (!rpcError && tenantId) {
    return { tenantId: String(tenantId), created: true };
  }

  throw new Error(`Workspace creation is unavailable: ${rpcError?.message || 'required migration missing'}`);
}
