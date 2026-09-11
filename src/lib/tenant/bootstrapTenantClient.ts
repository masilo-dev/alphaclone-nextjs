import type { Tenant } from '@/services/tenancy/types';

export type BootstrapTenantOptions = {
  name?: string;
  slug?: string;
  plan?: string;
  referralCode?: string;
  mode?: 'ensure' | 'create';
  idempotencyKey?: string;
};

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const { supabase } = await import('@/lib/supabase');
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      headers.Authorization = `Bearer ${data.session.access_token}`;
    }
  } catch {
    // cookie session may still work
  }
  return headers;
}

/** Client-side tenant bootstrap — uses Bearer token when cookies are not set yet after signup. */
export async function bootstrapTenantViaApi(
  options?: BootstrapTenantOptions
): Promise<{ tenant: Tenant | null; error: string | null; created?: boolean }> {
  try {
    const idempotencyKey =
      options?.idempotencyKey ||
      (options?.mode === 'create' ? crypto.randomUUID() : 'initial-workspace-v1');
    const res = await fetch('/api/tenant/bootstrap', {
      method: 'POST',
      headers: {
        ...(await authHeaders()),
        'Idempotency-Key': idempotencyKey,
      },
      credentials: 'include',
      body: JSON.stringify(options ?? {}),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { tenant: null, error: payload?.error || `Bootstrap failed (${res.status})` };
    }
    return {
      tenant: (payload?.tenant as Tenant) ?? null,
      error: null,
      created: Boolean(payload?.created),
    };
  } catch (err) {
    return {
      tenant: null,
      error: err instanceof Error ? err.message : 'Bootstrap request failed',
    };
  }
}
