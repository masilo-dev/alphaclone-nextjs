import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from './supabase-admin';
import { clientErrorResponse } from './api/clientErrorResponse';
import { RouteAuthError } from './api/routeAuthError';
import { ENV } from '@/config/env';

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
export async function requireAuthenticatedUser(req?: Request) {
    const bearer = req?.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
    if (bearer) {
        if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
            throw new RouteAuthError(500, 'Server configuration error', 'INTERNAL_ERROR');
        }
        const admin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await admin.auth.getUser(bearer);
        if (error || !data?.user?.id) {
            throw new RouteAuthError(401, 'Unauthorized', 'UNAUTHORIZED');
        }
        const supabase = await getSupabaseServerClient();
        return { supabase, user: data.user };
    }

    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user?.id) {
        throw new RouteAuthError(401, 'Unauthorized', 'UNAUTHORIZED');
    }

    return {
        supabase,
        user: data.user,
    };
}

/**
 * Ensures the user has access to a specific tenant.
 * NOTE: This is designed for App Router API routes/Server Actions.
 */
export async function requireTenantAccess(tenantId: string) {
    if (!tenantId?.trim()) {
        throw new RouteAuthError(400, 'tenantId required', 'BAD_REQUEST');
    }

    const { supabase, user } = await requireAuthenticatedUser();

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
    };
}

/**
 * Platform super-admin: profiles.role in ('admin', 'super_admin') (not tenant-scoped).
 */
export async function requirePlatformSuperAdmin() {
    const { supabase, user } = await requireAuthenticatedUser();

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    if (error) {
        console.error('[apiAuth] requirePlatformSuperAdmin profile:', error.message);
        throw new RouteAuthError(500, 'Failed to verify admin access', 'INTERNAL_ERROR');
    }

    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
        throw new RouteAuthError(403, 'Forbidden', 'FORBIDDEN');
    }

    return { supabase, user };
}

/**
 * Standard utility for returning error responses from API routes.
 * Does not expose internal Error.message to the client (fallbackMessage is safe copy only).
 */
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
