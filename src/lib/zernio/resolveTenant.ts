import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/** Resolve tenant ID from a Zernio account ID stored in tenants.settings.zernio */
export async function resolveTenantByZernioAccountId(accountId: string): Promise<string | null> {
  if (!accountId?.trim()) return null;
  const admin = createSupabaseAdminClient();
  const { data: tenants } = await admin.from('tenants').select('id, settings');

  for (const tenant of tenants || []) {
    const zernio = (tenant.settings as Record<string, unknown> | null)?.zernio as Record<string, string> | undefined;
    if (!zernio) continue;
    const ids = [zernio.whatsappAccountId, zernio.instagramAccountId, zernio.linkedinOrgAccountId, zernio.accountId].filter(Boolean);
    if (ids.includes(accountId)) return tenant.id;
  }
  return null;
}
