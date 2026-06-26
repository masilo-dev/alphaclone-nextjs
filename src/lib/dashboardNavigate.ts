import { normalizeBusinessRoute } from '@/lib/normalizeDashboardRoute';
import type { UserRole } from '@/types';
import { isPlatformAdminRole } from '@/lib/platformAdmin';

/** Resolve a dashboard path for the signed-in user's role (tenant aliases, etc.). */
export function resolveDashboardPath(path: string, role?: UserRole): string {
  if (role === 'tenant_admin') {
    return normalizeBusinessRoute(path, 'tenant_admin');
  }
  return path;
}

export function canAccessSecurityDashboard(role?: UserRole): boolean {
  return role === 'admin' || isPlatformAdminRole(role);
}
