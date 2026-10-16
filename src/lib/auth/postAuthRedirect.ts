import type { UserRole } from '@/types';
import { isPlatformAdminRole } from '@/lib/platformAdmin';
import { getJourneyReturnPath, clearJourneyReturnPath } from './journeyRestoration';

/** Landing path after sign-in / sign-up / OAuth callback with journey restoration. */
export function getPostAuthDashboardPath(role?: UserRole | string | null): string {
  // If the user was in the middle of a project, tab, or invoice review, restore their journey
  const returnPath = getJourneyReturnPath();
  if (returnPath) {
    clearJourneyReturnPath();
    return returnPath;
  }

  if (isPlatformAdminRole(role ?? undefined)) {
    return '/dashboard/admin/tenants';
  }
  if (role === 'tenant_admin' || role === 'business_dashboard') {
    return '/dashboard';
  }
  // All registered business users land on /dashboard
  return '/dashboard';
}

/** OAuth redirect target passed through /auth/callback?next= */
export function getOAuthNextPath(role?: UserRole | string | null): string {
  return getPostAuthDashboardPath(role);
}
