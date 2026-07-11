import type { UserRole } from '@/types';
import { isPlatformAdminRole } from '@/lib/platformAdmin';

/** Default landing path after sign-in / sign-up / OAuth callback. */
export function getPostAuthDashboardPath(role?: UserRole | string | null): string {
  if (isPlatformAdminRole(role ?? undefined)) {
    return '/dashboard/admin/tenants';
  }
  if (role === 'tenant_admin' || role === 'business_dashboard') {
    return '/dashboard';
  }
  // Legacy client portal — keep isolated until fully removed.
  if (role === 'client') {
    return '/dashboard/projects';
  }
  // Unknown / visitor — business owner default (every new signup is tenant_admin).
  return '/dashboard';
}

/** OAuth redirect target passed through /auth/callback?next= */
export function getOAuthNextPath(role?: UserRole | string | null): string {
  return getPostAuthDashboardPath(role);
}
