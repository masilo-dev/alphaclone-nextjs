import type { UserRole } from '@/types';

/** Roles that can permanently manage users across the whole platform. */
const PLATFORM_ADMIN_ROLES = new Set([
  'admin',
  'super_admin',
  'platform_admin',
  'platform_owner',
  'superadmin',
]);

/**
 * Normalize profile / claim role strings so common aliases map to known roles.
 */
export function normalizePlatformRole(role: UserRole | string | undefined | null): string {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

/** Platform-level super admin (not tenant admin / business owner). */
export function isPlatformAdminRole(role: UserRole | string | undefined | null): boolean {
  const normalized = normalizePlatformRole(role);
  return PLATFORM_ADMIN_ROLES.has(normalized);
}

/** Workspace roles that count as owners for last-owner protection. */
export const WORKSPACE_OWNER_ROLES = ['owner', 'tenant_admin'] as const;

export function isWorkspaceOwnerRole(role: string | undefined | null): boolean {
  const normalized = normalizePlatformRole(role);
  return WORKSPACE_OWNER_ROLES.includes(normalized as (typeof WORKSPACE_OWNER_ROLES)[number]);
}

/**
 * Whether a member can be removed from a workspace without leaving it ownerless.
 */
export function canRemoveWorkspaceMember(options: {
  targetRole: string | undefined | null;
  ownerCount: number;
  isSelf?: boolean;
}): { ok: boolean; reason?: string } {
  if (options.isSelf) {
    return { ok: false, reason: 'You cannot remove yourself from the workspace' };
  }
  if (isWorkspaceOwnerRole(options.targetRole) && options.ownerCount <= 1) {
    return { ok: false, reason: 'The final workspace owner cannot be removed' };
  }
  return { ok: true };
}
