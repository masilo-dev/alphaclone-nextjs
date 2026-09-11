import type { UserRole } from '@/types';

/** Platform-level super admin (not tenant admin). */
export function isPlatformAdminRole(role: UserRole | string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}
