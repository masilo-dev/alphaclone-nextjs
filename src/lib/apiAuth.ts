import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from './supabase-admin';
import { clientErrorResponse } from './api/clientErrorResponse';
import { RouteAuthError } from './api/routeAuthError';
import { ENV } from '@/config/env';
import { isPlatformAdminRole } from '@/lib/platformAdmin';
import { normalizePlatformRole } from '@/lib/platformAdmin';

export { RouteAuthError };

export type { ApiErrorBody } from './api/clientErrorResponse';

// Re-export the isomorphized admin client for consistency
export { createSupabaseAdminClient as createAdminSupabaseClientOrThrow };

type TenantMembership = {
    tenant_id: string;
    role: string;
};

/**
 * Lazy-loads the App Router Supabase client.
 * This prevents 'next/headers' from being evaluated in the Pages Router (Legacy APIs).
 */
async function getSupabaseServerClient() {
    const { createSupabaseServerClient } = await import('./supabase-server');
    return createSupabaseServerClient();
}

/**
 * Ensures the request is authenticated (cookie session or Authorization Bearer).
 * NOTE: This is designed for App Router API routes/Server Actions.
 */
export async function requireAuthenticatedUser(
    req?: Request,
    options?: { allowMissingProfile?: boolean; allowPendingDeletion?: boolean }
) {
    const bearer = req?.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
    if (bearer) {
        if (!ENV.VITE_SUPABASE_URL) {
            throw new RouteAuthError(500, 'Server configuration error', 'INTERNAL_ERROR');
        }
        const admin = ENV.SUPABASE_SERVICE_ROLE_KEY
            ? createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
                auth: { persistSession: false, autoRefreshToken: false },
            })
            : createSupabaseAdminClient(bearer);
        const { data, error } = await admin.auth.getUser(bearer);
        if (error || !data?.user?.id) {
            throw new RouteAuthError(401, 'Unauthorized', 'UNAUTHORIZED');
        }
        await requireActiveProfile(admin, data.user.id, options);
        return { supabase: admin, user: data.user, admin };
    }

    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user?.id) {
        throw new RouteAuthError(401, 'Unauthorized', 'UNAUTHORIZED');
    }

    await requireActiveProfile(supabase, data.user.id, options);

    // Prefer service-role admin. Without it, reuse the cookie-authenticated server
    // client so RLS still works even when getSession() has no access_token.
    const { data: { session } } = await supabase.auth.getSession();
    const admin = ENV.SUPABASE_SERVICE_ROLE_KEY
        ? createSupabaseAdminClient()
        : session?.access_token
            ? createSupabaseAdminClient(session.access_token)
            : supabase;

    return {
        supabase,
        user: data.user,
        admin,
    };
}

async function requireActiveProfile(
    supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
    userId: string,
    options?: { allowMissingProfile?: boolean; allowPendingDeletion?: boolean }
) {
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, role, account_status, scheduled_deletion_at')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        console.error('[apiAuth] Failed to verify account status:', error);
        throw new RouteAuthError(503, 'Account verification is temporarily unavailable', 'INTERNAL_ERROR');
    }
    if (!profile) {
        if (options?.allowMissingProfile) return null;
        throw new RouteAuthError(403, 'Account profile is unavailable', 'FORBIDDEN');
    }

    const status = String(profile.account_status || 'active');
    if (status === 'deleted' || status === 'suspended' || status === 'disabled') {
        throw new RouteAuthError(403, 'Account is not active', 'FORBIDDEN');
    }
    if (status === 'pending_deletion' && !options?.allowPendingDeletion) {
        throw new RouteAuthError(403, 'Account deletion is pending', 'FORBIDDEN');
    }
    return profile;
}

/**
 * Ensures the user has access to a specific tenant.
 * NOTE: This is designed for App Router API routes/Server Actions.
 */
export async function requireTenantAccess(tenantId: string, req?: Request) {
    if (!tenantId?.trim()) {
        throw new RouteAuthError(400, 'tenantId required', 'BAD_REQUEST');
    }

    const { supabase, user, admin } = await requireAuthenticatedUser(req);

    const { data, error } = await supabase
        .from('tenant_users')
        .select('tenant_id, role')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (error) {
        console.error('[apiAuth] Failed to verify tenant membership:', error);
        throw new RouteAuthError(500, 'Failed to verify tenant access', 'INTERNAL_ERROR');
    }

    if (!data) {
        throw new RouteAuthError(403, 'Forbidden', 'FORBIDDEN');
    }

    return {
        supabase,
        user,
        membership: data as TenantMembership,
        admin,
    };
}

export async function requireTenantRole(tenantId: string, allowedRoles: string[], req?: Request) {
    const access = await requireTenantAccess(tenantId, req);
    const normalizedRole = normalizePlatformRole(access.membership.role);
    const allowed = new Set(allowedRoles.map((r) => normalizePlatformRole(r)));
    if (!allowed.has(normalizedRole)) {
        throw new RouteAuthError(403, 'Insufficient workspace permissions', 'FORBIDDEN');
    }
    return access;
}

/**
 * Platform super-admin: profiles.role is a platform admin alias (not tenant-scoped).
 * Business/workspace owners are intentionally excluded — they manage membership, not platform accounts.
 */
export async function requirePlatformSuperAdmin() {
    const { supabase, user, admin } = await requireAuthenticatedUser();

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, role, email, account_status')
        .eq('id', user.id)
        .maybeSingle();

    if (error) {
        console.error('[apiAuth] requirePlatformSuperAdmin profile:', error.message);
        throw new RouteAuthError(500, 'Failed to verify admin access', 'INTERNAL_ERROR');
    }

    if (!isPlatformAdminRole(profile?.role)) {
        throw new RouteAuthError(
            403,
            'Platform admin role required to manage platform users. Workspace owners can remove members from Team settings instead.',
            'FORBIDDEN'
        );
    }

    return { supabase, user, profile, admin };
}

/**
 * Counts total active super admins in the system to prevent accidental lockout.
 */
export async function countActiveSuperAdmins(adminClient?: any): Promise<number> {
    const admin = adminClient || createSupabaseAdminClient();
    const { data, error } = await admin
        .from('profiles')
        .select('id, role, account_status');

    if (error || !data) return 0;
    const active = data.filter(
        (p: { role?: string; account_status?: string }) =>
            isPlatformAdminRole(p.role) && (p.account_status === 'active' || !p.account_status)
    );
    return active.length;
}

/**
 * Standard utility for returning error responses from API routes.
 * Does not expose internal Error.message to the client (fallbackMessage is safe copy only).
 */
/**
 * Helper to get authenticated user and tenantId from request.
 */
export async function getApiAuthUser(req?: Request) {
  try {
    const { user, supabase } = await requireAuthenticatedUser(req);
    const tenantIdHeader = req?.headers.get('x-tenant-id');
    let tenantId = tenantIdHeader || undefined;
    if (!tenantId) {
      const { data: member } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      tenantId = member?.tenant_id;
    }
    return { user, tenantId };
  } catch {
    return null;
  }
}

export function routeErrorResponse(
    error: unknown,
    fallbackMessage = 'The request failed on our side. Try again; if it repeats, send support the request ID.',
    request?: Pick<Request, 'headers'>
): NextResponse {
    return clientErrorResponse(error, {
        request,
        scope: 'apiAuth',
        fallbackMessage,
    });
}
