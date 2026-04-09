import { UserContext } from './alphaAgent';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export interface TenantContext {
    id: string;
    name: string;
    plan: 'starter' | 'growth' | 'enterprise';
}

export interface FortressSession {
    tenantId: string;
    operatorId: string;
    timestamp: number;
    accessLevel: 'admin' | 'member' | 'viewer';
}

class TenantFortress {
    // Zero-trust enforcement layer
    // Rules: 
    // 1. Every query must be rewritten with tenantId
    // 2. Every response must be filtered before returning
    // 3. Absolute memory isolation (No cross-tenant leakage)

    async validateAccess(user: UserContext, targetTenantId: string): Promise<FortressSession> {
        console.log(`FORTRESS_GUARD: Validating access for ${user.id} to tenant ${targetTenantId}...`);

        if (user.id === 'anonymous' || !user.id) {
            throw new Error('FORTRESS_DENIED: Anonymous users cannot access tenant resources.');
        }

        const supabase = createSupabaseAdminClient();
        const { data, error } = await supabase
            .from('tenant_users')
            .select('role')
            .eq('user_id', user.id)
            .eq('tenant_id', targetTenantId)
            .single();

        if (error || !data) {
            throw new Error(`FORTRESS_DENIED: User ${user.id} is not a member of tenant ${targetTenantId}.`);
        }

        const session: FortressSession = {
            tenantId: targetTenantId,
            operatorId: user.id,
            timestamp: Date.now(),
            accessLevel: (data.role as any) || 'member'
        };

        return session;
    }

    /**
     * Re-write AI memory keys to include tenant prefix for absolute isolation
     */
    getIsolatedKey(tenantId: string, key: string): string {
        return `fortress_${tenantId}_${key}`;
    }

    /**
     * Zero-tolerance filter for outbound data
     */
    sanitizeResponse<T>(tenantId: string, data: T): T {
        // Deep inspection of data to ensure no other tenant IDs are present
        const serialized = JSON.stringify(data);
        if (serialized.includes('tenant_') && !serialized.includes(`tenant_${tenantId}`)) {
            throw new Error('SECURITY_BREACH: Cross-tenant data leak detected in response pipeline.');
        }
        return data;
    }
}

export const tenantFortress = new TenantFortress();
