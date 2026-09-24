export interface TenantBranding {
  name: string;
  companyName?: string;
  legalName?: string;
  logoUrl?: string;
  companyLogo?: string;
  primaryColor?: string;
  primaryBrandColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  businessEmail?: string;
  supportEmail?: string;
  businessPhone?: string;
  website?: string;
  businessAddress?: string;
  registrationNumber?: string;
  taxNumber?: string;
  taxId?: string;
  documentFooterText?: string;
}

export function extractTenantBranding(
  tenant: {
    id?: string;
    name?: string | null;
    legal_name?: string | null;
    logo_url?: string | null;
    brand_color_primary?: string | null;
    brand_color_secondary?: string | null;
    tax_id?: string | null;
    business_address?: string | null;
    settings?: unknown;
  } | null | undefined
): TenantBranding {
  if (!tenant) return { name: 'Unconfigured Business' };
  const settings = (tenant.settings || {}) as Record<string, unknown>;
  const branding = (settings.branding || settings.publicBranding || settings.documentBranding || {}) as Record<string, any>;
  const legalName = (tenant.legal_name || branding.legalBusinessName || branding.legalName || branding.legal_name || '').trim();
  const display =
    branding.companyName ||
    branding.displayName ||
    branding.tradingName ||
    tenant.name ||
    legalName ||
    'Unconfigured Business';

  const logo = branding.companyLogo || branding.logoUrl || branding.logo || tenant.logo_url || undefined;
  const primaryColor = tenant.brand_color_primary || branding.primaryBrandColor || branding.primaryColor || branding.brand_color_primary || '#0f172a';
  const secondaryColor = tenant.brand_color_secondary || branding.secondaryColor || branding.brand_color_secondary || undefined;
  const email = branding.businessEmail || branding.supportEmail || (settings.support_email as string) || undefined;
  const phone = branding.businessPhone || branding.phone || undefined;
  const website = branding.website || (settings.website as string) || undefined;
  const address = tenant.business_address || branding.businessAddress || branding.address || undefined;
  const taxId = tenant.tax_id || branding.taxNumber || branding.taxId || branding.tax_id || undefined;
  const regNumber = branding.registrationNumber || branding.registration_number || undefined;
  const footerText = branding.documentFooterText || branding.footerText || undefined;

  return {
    name: display,
    companyName: display,
    legalName: legalName || undefined,
    logoUrl: logo,
    companyLogo: logo,
    primaryColor,
    primaryBrandColor: primaryColor,
    secondaryColor,
    accentColor: branding.accentColor || undefined,
    businessEmail: email,
    supportEmail: email,
    businessPhone: phone,
    website,
    businessAddress: address,
    registrationNumber: regNumber,
    taxNumber: taxId,
    taxId,
    documentFooterText: footerText,
  };
}
