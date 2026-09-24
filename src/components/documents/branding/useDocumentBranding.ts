'use client';

import { useMemo } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { extractTenantBranding, TenantBranding } from '@/lib/tenantBranding';

export type TenantLikeInput = {
  id?: string;
  name?: string | null;
  legal_name?: string | null;
  logo_url?: string | null;
  brand_color_primary?: string | null;
  brand_color_secondary?: string | null;
  tax_id?: string | null;
  business_address?: string | null;
  settings?: unknown;
};

export interface UseDocumentBrandingResult {
  branding: TenantBranding;
  hasLogo: boolean;
  brandColor: string;
  secondaryColor?: string;
  displayName: string;
}

/**
 * Global tenant-aware document branding hook.
 * Resolves branding dynamically from tenant prop or active TenantContext.
 */
export function useDocumentBranding(tenantProp?: TenantLikeInput | null): UseDocumentBrandingResult {
  let contextTenant: TenantLikeInput | null = null;
  try {
    const tenantCtx = useTenant();
    contextTenant = (tenantCtx?.currentTenant as TenantLikeInput) ?? null;
  } catch {
    // In case hook is called outside TenantProvider (e.g. public portal routes)
    contextTenant = null;
  }

  const effectiveTenant = tenantProp !== undefined ? tenantProp : contextTenant;

  return useMemo(() => {
    const branding = extractTenantBranding(effectiveTenant);
    const hasLogo = Boolean(branding.logoUrl && typeof branding.logoUrl === 'string' && branding.logoUrl.trim().length > 0);
    const brandColor = branding.primaryColor || '#0f172a';

    return {
      branding,
      hasLogo,
      brandColor,
      secondaryColor: branding.secondaryColor,
      displayName: branding.name || 'Unconfigured Business',
    };
  }, [effectiveTenant]);
}
