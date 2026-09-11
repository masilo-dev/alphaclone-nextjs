export interface TenantBranding {
  name: string;
  logoUrl?: string;
  primaryColor?: string;
  supportEmail?: string;
  legalName?: string;
  secondaryColor?: string;
  accentColor?: string;
}

export function extractTenantBranding(
  tenant: {
    id?: string;
    name?: string | null;
    legal_name?: string | null;
    logo_url?: string | null;
    brand_color_primary?: string | null;
    brand_color_secondary?: string | null;
    settings?: unknown;
  } | null | undefined
): TenantBranding {
  if (!tenant) return { name: 'Unconfigured Business' };
  const settings = (tenant.settings || {}) as Record<string, unknown>;
  const branding = (settings.branding || settings.publicBranding || {}) as Record<string, string>;
  const legalName = (tenant.legal_name || branding.legalBusinessName || branding.legal_name || '').trim();
  const display =
    branding.displayName ||
    branding.tradingName ||
    legalName ||
    tenant.name ||
    'Unconfigured Business';
  return {
    name: display,
    legalName: legalName || undefined,
    logoUrl: branding.logoUrl || tenant.logo_url || undefined,
    primaryColor: tenant.brand_color_primary || branding.primaryColor || '#0f172a',
    secondaryColor: tenant.brand_color_secondary || branding.secondaryColor || undefined,
    accentColor: branding.accentColor || undefined,
    supportEmail: branding.supportEmail || (settings.support_email as string) || undefined,
  };
}
