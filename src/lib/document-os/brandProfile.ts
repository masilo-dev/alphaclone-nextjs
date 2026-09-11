/**
 * Tenant document brand profile — never hard-code organization names.
 */

import type { DocumentBrandProfile, LogoPlacement, PageSize } from './types';

const DEFAULT_PRIMARY = '#0f172a';
const DEFAULT_SECONDARY = '#334155';
const DEFAULT_ACCENT = '#0f766e';
const DEFAULT_HEADING = '"Source Serif 4", "Liberation Serif", Georgia, serif';
const DEFAULT_BODY = '"IBM Plex Sans", "Liberation Sans", "Helvetica Neue", Arial, sans-serif';

export function emptyBrandProfile(tenantId: string): DocumentBrandProfile {
  return {
    tenant_id: tenantId,
    legal_business_name: '',
    default_currency: 'USD',
    primary_colour: DEFAULT_PRIMARY,
    secondary_colour: DEFAULT_SECONDARY,
    accent_colour: DEFAULT_ACCENT,
    heading_font: DEFAULT_HEADING,
    body_font: DEFAULT_BODY,
    logo_placement: 'left',
    authorized_signatories: [],
    page_size: 'A4',
  };
}

type TenantLike = {
  id?: string;
  name?: string | null;
  legal_name?: string | null;
  tax_id?: string | null;
  business_address?: string | null;
  logo_url?: string | null;
  brand_color_primary?: string | null;
  brand_color_secondary?: string | null;
  settings?: unknown;
};

type BusinessSettingsLike = {
  trading_name?: string | null;
  registration_number?: string | null;
  tax_country?: string | null;
  phone?: string | null;
  website?: string | null;
  postal_address?: string | null;
  jurisdiction?: string | null;
  default_currency?: string | null;
  payment_instructions?: string | null;
  legal_footer?: string | null;
  bank_details?: Record<string, unknown> | null;
  branding?: Record<string, unknown> | null;
};

/**
 * Resolve a complete brand profile from tenant + business_settings rows.
 * Prefer legal_name; never invent "ALPHACLONE SYSTEMS's Organization."
 */
export function resolveBrandProfile(
  tenant: TenantLike | null | undefined,
  businessSettings?: BusinessSettingsLike | null
): DocumentBrandProfile {
  const tenantId = tenant?.id || '';
  const settings = (tenant?.settings || {}) as Record<string, unknown>;
  const branding = {
    ...((settings.branding || settings.publicBranding || {}) as Record<string, unknown>),
    ...((businessSettings?.branding || {}) as Record<string, unknown>),
  };

  const legalName =
    String(tenant?.legal_name || branding.legalBusinessName || branding.legal_name || '').trim() ||
    String(tenant?.name || '').trim() ||
    'Unconfigured Business';

  const tradingName =
    String(
      businessSettings?.trading_name ||
        branding.tradingName ||
        branding.displayName ||
        branding.trading_name ||
        ''
    ).trim() || undefined;

  return {
    tenant_id: tenantId,
    legal_business_name: legalName,
    trading_name: tradingName,
    registration_number:
      String(businessSettings?.registration_number || branding.registrationNumber || '').trim() ||
      undefined,
    tax_vat_number: String(tenant?.tax_id || branding.taxId || branding.vatNumber || '').trim() || undefined,
    physical_address:
      String(tenant?.business_address || branding.address || branding.physicalAddress || '').trim() ||
      undefined,
    postal_address:
      String(businessSettings?.postal_address || branding.postalAddress || '').trim() || undefined,
    business_email:
      String(branding.supportEmail || branding.businessEmail || settings.support_email || '').trim() ||
      undefined,
    telephone: String(businessSettings?.phone || branding.phone || '').trim() || undefined,
    website: String(businessSettings?.website || branding.website || '').trim() || undefined,
    default_currency: String(businessSettings?.default_currency || branding.currency || 'USD'),
    country: String(businessSettings?.tax_country || branding.country || '').trim() || undefined,
    jurisdiction:
      String(businessSettings?.jurisdiction || branding.jurisdiction || '').trim() || undefined,
    primary_logo_url:
      String(tenant?.logo_url || branding.logoUrl || branding.primaryLogoUrl || '').trim() || undefined,
    secondary_logo_url: String(branding.secondaryLogoUrl || '').trim() || undefined,
    monochrome_logo_url: String(branding.monochromeLogoUrl || '').trim() || undefined,
    favicon_url: String(branding.faviconUrl || branding.iconUrl || '').trim() || undefined,
    primary_colour: String(
      tenant?.brand_color_primary || branding.primaryColor || branding.primary_colour || DEFAULT_PRIMARY
    ),
    secondary_colour: String(
      tenant?.brand_color_secondary ||
        branding.secondaryColor ||
        branding.secondary_colour ||
        DEFAULT_SECONDARY
    ),
    accent_colour: String(branding.accentColor || branding.accent_colour || DEFAULT_ACCENT),
    heading_font: String(branding.headingFont || DEFAULT_HEADING),
    body_font: String(branding.bodyFont || DEFAULT_BODY),
    logo_placement: normalizeLogoPlacement(branding.logoPlacement || branding.logo_placement),
    authorized_signatories: Array.isArray(branding.authorizedSignatories)
      ? (branding.authorizedSignatories as DocumentBrandProfile['authorized_signatories'])
      : [],
    bank_details: (businessSettings?.bank_details || branding.bankDetails || undefined) as
      | DocumentBrandProfile['bank_details']
      | undefined,
    payment_instructions:
      String(businessSettings?.payment_instructions || branding.paymentInstructions || '').trim() ||
      undefined,
    legal_footer:
      String(businessSettings?.legal_footer || branding.legalFooter || '').trim() || undefined,
    social_links: (branding.socialLinks as Record<string, string>) || undefined,
    page_size: normalizePageSize(branding.pageSize || branding.page_size),
  };
}

function normalizeLogoPlacement(value: unknown): LogoPlacement {
  if (value === 'center' || value === 'right' || value === 'left') return value;
  return 'left';
}

function normalizePageSize(value: unknown): PageSize {
  if (value === 'Letter') return 'Letter';
  return 'A4';
}

/** Display name for documents — legal name first, never a hardcoded org string. */
export function brandDisplayName(profile: DocumentBrandProfile): string {
  return profile.trading_name || profile.legal_business_name || 'Unconfigured Business';
}

export function brandSenderBlock(profile: DocumentBrandProfile): string {
  const lines = [
    profile.legal_business_name,
    profile.trading_name && profile.trading_name !== profile.legal_business_name
      ? `Trading as ${profile.trading_name}`
      : null,
    profile.registration_number ? `Reg. ${profile.registration_number}` : null,
    profile.tax_vat_number ? `Tax/VAT ${profile.tax_vat_number}` : null,
    profile.physical_address,
    profile.business_email,
    profile.telephone,
    profile.website,
  ].filter(Boolean);
  return lines.join('\n');
}

export function assertNoHardcodedOrgName(text: string): string | null {
  const forbidden = [
    /ALPHACLONE SYSTEMS'?s?\s+Organization/i,
    /Your Business'?s?\s+Organization/i,
    /\[COMPANY NAME\]/i,
    /\{company_name\}/i,
  ];
  for (const re of forbidden) {
    if (re.test(text)) {
      return `Forbidden placeholder or hardcoded organization text detected: ${text.match(re)?.[0]}`;
    }
  }
  return null;
}
