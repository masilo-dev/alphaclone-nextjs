import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { ENV } from '@/config/env';
import { createSupabaseServerClient } from '@/lib/supabase-server';

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

function getSupabaseUrl() {
    return ENV.VITE_SUPABASE_URL || ENV.NEXT_PUBLIC_SUPABASE_URL;
}

export function createAdminSupabaseClientOrThrow() {
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = ENV.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new RouteAuthError(500, 'Server is misconfigured');
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

export async function requireAuthenticatedUser() {
    if (!getSupabaseUrl() || !ENV.VITE_SUPABASE_ANON_KEY) {
        throw new RouteAuthError(500, 'Server is misconfigured');
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user?.id) {
        throw new RouteAuthError(401, 'Unauthorized');
    }

    return {
        supabase,
        user: data.user,
    };
}

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

export function routeErrorResponse(error: unknown, fallbackMessage = 'Internal server error') {
    if (error instanceof RouteAuthError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('[apiAuth] Unhandled route error:', error);
    return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
