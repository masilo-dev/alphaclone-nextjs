import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { createSupabaseServerClient } from '@/lib/supabase-server';

type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function resolveTenantContextForUser(
    supabase: ServerSupabase,
    userId: string,
    bodyTenantId?: string | null
): Promise<{ tenantId: string; plan: string } | null> {
    const resolvePlan = async (tenantId: string): Promise<{ tenantId: string; plan: string }> => {
        const admin = createSupabaseAdminClient();
        const { data: t } = await admin
            .from('tenants')
            .select('subscription_plan')
            .eq('id', tenantId)
            .maybeSingle();
        return { tenantId, plan: (t?.subscription_plan as string) || 'free' };
    };

    if (bodyTenantId) {
        const { data: m } = await supabase
            .from('user_tenant_roles')
            .select('tenant_id')
            .eq('user_id', userId)
            .eq('tenant_id', bodyTenantId)
            .maybeSingle();
        if (m?.tenant_id) return resolvePlan(m.tenant_id);

        const { data: tu } = await supabase
            .from('tenant_users')
            .select('tenant_id')
            .eq('user_id', userId)
            .eq('tenant_id', bodyTenantId)
            .maybeSingle();
        if (tu?.tenant_id) return resolvePlan(tu.tenant_id);
        return null;
    }

    const { data: m } = await supabase
        .from('user_tenant_roles')
        .select('tenant_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

    if (m?.tenant_id) return resolvePlan(m.tenant_id);

    const { data: tu } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
    if (tu?.tenant_id) return resolvePlan(tu.tenant_id);

    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', userId)
        .maybeSingle();
    if (profile?.tenant_id) return resolvePlan(profile.tenant_id);

    return null;
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
