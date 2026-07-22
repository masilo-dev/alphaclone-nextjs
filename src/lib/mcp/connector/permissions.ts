import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { ConnectorPermission, ConnectorRole } from './types';
import { throwConnectorError } from './response';

const ROLE_PERMISSIONS: Record<ConnectorRole, ConnectorPermission[]> = {
  owner: [
    'platform:read',
    'platform:admin',
    'platform:restart',
    'audit:read',
    'audit:run',
    'bonnie:read',
    'bonnie:write',
    'bonnie:execute',
    'crm:read',
    'crm:write',
    'crm:delete',
    'social:read',
    'social:write',
    'social:publish',
    'marketing:read',
    'marketing:write',
    'sales:read',
    'sales:write',
    'calendar:read',
    'calendar:write',
    'documents:read',
    'documents:write',
    'reports:read',
    'integrations:read',
    'integrations:write',
  ],
  admin: [
    'platform:read',
    'platform:admin',
    'audit:read',
    'audit:run',
    'bonnie:read',
    'bonnie:write',
    'bonnie:execute',
    'crm:read',
    'crm:write',
    'crm:delete',
    'social:read',
    'social:write',
    'social:publish',
    'marketing:read',
    'marketing:write',
    'sales:read',
    'sales:write',
    'calendar:read',
    'calendar:write',
    'documents:read',
    'documents:write',
    'reports:read',
    'integrations:read',
    'integrations:write',
  ],
  member: [
    'platform:read',
    'audit:read',
    'bonnie:read',
    'bonnie:write',
    'bonnie:execute',
    'crm:read',
    'crm:write',
    'social:read',
    'social:write',
    'social:publish',
    'marketing:read',
    'marketing:write',
    'sales:read',
    'sales:write',
    'calendar:read',
    'calendar:write',
    'documents:read',
    'documents:write',
    'reports:read',
    'integrations:read',
  ],
  viewer: [
    'platform:read',
    'audit:read',
    'bonnie:read',
    'crm:read',
    'social:read',
    'marketing:read',
    'sales:read',
    'calendar:read',
    'documents:read',
    'reports:read',
    'integrations:read',
  ],
  guest: ['platform:read', 'crm:read', 'reports:read'],
};

function normalizeRole(raw: unknown): ConnectorRole {
  const role = String(raw || 'member').toLowerCase();
  if (role === 'owner' || role === 'admin' || role === 'member' || role === 'viewer' || role === 'guest') {
    return role;
  }
  if (role === 'super_admin' || role === 'superadmin') return 'owner';
  return 'member';
}

export async function resolveTenantRole(
  tenantId: string,
  userId: string
): Promise<{ role: ConnectorRole; permissions: ConnectorPermission[] }> {
  const supabase = createSupabaseAdminClient();

  const { data: membership } = await supabase
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();

  if (membership?.role) {
    const role = normalizeRole(membership.role);
    return { role, permissions: ROLE_PERMISSIONS[role] };
  }

  // Fallback: tenant owners table / profiles
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .maybeSingle();

  if (!tenantErr && tenant) {
    const ownerId = (tenant as any).owner_id || (tenant as any).created_by || (tenant as any).user_id;
    if (ownerId && ownerId === userId) {
      return { role: 'owner', permissions: ROLE_PERMISSIONS.owner };
    }
  }

  return { role: 'member', permissions: ROLE_PERMISSIONS.member };
}

export async function assertPermission(
  tenantId: string,
  userId: string,
  required: ConnectorPermission | ConnectorPermission[]
): Promise<{ role: ConnectorRole; permissions: ConnectorPermission[] }> {
  const resolved = await resolveTenantRole(tenantId, userId);
  const needed = Array.isArray(required) ? required : [required];
  const missing = needed.filter((p) => !resolved.permissions.includes(p));
  if (missing.length > 0) {
    throwConnectorError(
      'PERMISSION_DENIED',
      `Missing required permission(s): ${missing.join(', ')}`,
      { role: resolved.role, required: needed, missing }
    );
  }
  return resolved;
}
