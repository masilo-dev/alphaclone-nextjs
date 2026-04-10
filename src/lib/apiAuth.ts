import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from './supabase-admin';

// Re-export the isomorphized admin client for consistency
export { createSupabaseAdminClient as createAdminSupabaseClientOrThrow };

type TenantMembership = {
    tenant_id: string;
    role: string;
};

export class RouteAuthError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
        this.name = 'RouteAuthError';
    }
}

/**
 * Lazy-loads the App Router Supabase client.
 * This prevents 'next/headers' from being evaluated in the Pages Router (Legacy APIs).
 */
async function getSupabaseServerClient() {
    const { createSupabaseServerClient } = await import('./supabase-server');
    return createSupabaseServerClient();
}

/**
 * Ensures the request is authenticated.
 * NOTE: This is designed for App Router API routes/Server Actions.
 */
export async function requireAuthenticatedUser() {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user?.id) {
        throw new RouteAuthError(401, 'Unauthorized');
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
        throw new RouteAuthError(400, 'tenantId required');
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
        throw new RouteAuthError(500, 'Failed to verify tenant access');
    }

    if (!data) {
        throw new RouteAuthError(403, 'Forbidden');
    }

    return {
        supabase,
        user,
        membership: data as TenantMembership,
    };
}

/**
 * Standard utility for returning error responses from API routes.
 */
export function routeErrorResponse(error: unknown, fallbackMessage = 'Internal server error') {
    if (error instanceof RouteAuthError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('[apiAuth] Unhandled route error:', error);
    return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
