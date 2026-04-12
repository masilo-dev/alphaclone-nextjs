import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { createSupabaseServerClient } from '@/lib/supabase-server';

type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function resolveTenantContextForUser(
    supabase: ServerSupabase,
    userId: string,
    bodyTenantId?: string | null
): Promise<{ tenantId: string; plan: string } | null> {
    if (bodyTenantId) {
        const { data: m } = await supabase
            .from('user_tenant_roles')
            .select('tenant_id')
            .eq('user_id', userId)
            .eq('tenant_id', bodyTenantId)
            .maybeSingle();
        if (!m?.tenant_id) return null;
        const admin = createSupabaseAdminClient();
        const { data: t } = await admin
            .from('tenants')
            .select('subscription_plan')
            .eq('id', m.tenant_id)
            .maybeSingle();
        return { tenantId: m.tenant_id, plan: (t?.subscription_plan as string) || 'free' };
    }

    const { data: m } = await supabase
        .from('user_tenant_roles')
        .select('tenant_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

    if (!m?.tenant_id) return null;

    const admin = createSupabaseAdminClient();
    const { data: t } = await admin
        .from('tenants')
        .select('subscription_plan')
        .eq('id', m.tenant_id)
        .maybeSingle();

    return { tenantId: m.tenant_id, plan: (t?.subscription_plan as string) || 'free' };
}

export async function isPlatformSuperAdmin(
    supabase: ServerSupabase,
    userId: string
): Promise<boolean> {
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
    return profile?.role === 'admin';
}

export function skipAiQuotaForAdminMode(
    mode: string | undefined,
    isSuperAdmin: boolean
): boolean {
    return mode === 'admin' && isSuperAdmin;
}
