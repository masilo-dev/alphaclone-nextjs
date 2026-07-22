export interface TenantBranding {
  name: string;
  logoUrl?: string;
  primaryColor?: string;
  supportEmail?: string;
}

export function extractTenantBranding(
  tenant: { name?: string | null; logo_url?: string | null; settings?: unknown } | null | undefined
): TenantBranding {
  if (!tenant) return { name: 'Your Business' };
  const settings = (tenant.settings || {}) as Record<string, unknown>;
  const branding = (settings.branding || settings.publicBranding || {}) as Record<string, string>;
  return {
    name: branding.displayName || tenant.name || 'Your Business',
    logoUrl: branding.logoUrl || tenant.logo_url || undefined,
    primaryColor: branding.primaryColor || '#14b8a6',
    supportEmail: branding.supportEmail || (settings.support_email as string) || undefined,
  };
}
