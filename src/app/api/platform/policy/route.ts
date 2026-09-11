import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET() {
    try {
        const admin = createSupabaseAdminClient();
        const { data } = await admin
            .from('platform_global_settings')
            .select('settings')
            .eq('singleton_key', 'default')
            .maybeSingle();

        const security = (data?.settings?.security || {}) as Record<string, unknown>;
        return NextResponse.json({
            success: true,
            policy: {
                openRegistration: security.openRegistration !== false,
                maintenanceMode: Boolean(security.maintenanceMode),
                enforce2faTenantAdmins: Boolean(security.enforce2faTenantAdmins),
            },
        });
    } catch {
        return NextResponse.json({
            success: true,
            policy: {
                openRegistration: true,
                maintenanceMode: false,
                enforce2faTenantAdmins: false,
            },
        });
    }
}
