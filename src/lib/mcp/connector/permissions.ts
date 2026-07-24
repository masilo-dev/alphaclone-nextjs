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
    'audit:run',
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
  if (role === 'super_admin' || role === 'superadmin' || role === 'tenant_admin') return 'owner';
  return 'member';
}

async function isTenantOwner(tenantId: string, userId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data: tenant } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle();
  if (!tenant) return false;
  const ownerId =
    (tenant as any).owner_id || (tenant as any).created_by || (tenant as any).user_id || null;
  return Boolean(ownerId && ownerId === userId);
}

async function readMembershipRole(tenantId: string, userId: string): Promise<ConnectorRole | null> {
  const supabase = createSupabaseAdminClient();

  // Prefer tenant_users (canonical in many deployments)
  const { data: tu, error: tuErr } = await supabase
    .from('tenant_users')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!tuErr && tu?.role) return normalizeRole(tu.role);

  const { data: tm, error: tmErr } = await supabase
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!tmErr && tm?.role) return normalizeRole(tm.role);

  return null;
}

export async function resolveTenantRole(
  tenantId: string,
  userId: string
): Promise<{ role: ConnectorRole; permissions: ConnectorPermission[] }> {
  const membershipRole = await readMembershipRole(tenantId, userId);
  const owner = await isTenantOwner(tenantId, userId);

  // Root cause: owners were often stored as membership role=member, blocking audit:run.
  if (owner) {
    return { role: 'owner', permissions: ROLE_PERMISSIONS.owner };
  }

  if (membershipRole) {
    return { role: membershipRole, permissions: ROLE_PERMISSIONS[membershipRole] };
  }

  // Fail closed: never invent "member" for users with no membership row.
  throwConnectorError(
    'PERMISSION_DENIED',
    'Not a member of this workspace',
    { tenant_id: tenantId, user_id: userId }
  );
  // Unreachable — satisfy TypeScript
  return { role: 'guest', permissions: ROLE_PERMISSIONS.guest };
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
