import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { extractTenantBranding } from '@/lib/tenantBranding';
import { COMPANY_LEGAL, formatLegalAddress } from '@/lib/seo/siteEntity';
import { resolveEmailLogoUrl } from '@/lib/email/emailConfig';
import { SITE_URL, absoluteUrl } from '@/lib/siteUrl';
import type { BrandIdentity } from '@/lib/compliance/communicationCompliance';

export interface TenantEmailBrandingProfile {
  tenantId: string;
  version: string;
  brand: BrandIdentity;
  senderDisplayName: string;
  replyToEmail?: string;
  fromEmail?: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  preferencesUrl?: string;
  unsubscribeConfigured: boolean;
  signatureHtml?: string;
  signatureText?: string;
  socialLinks: Array<{ label: string; url: string }>;
  isPlatformFallback: boolean;
}

function readString(value: unknown): string | undefined {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || undefined;
}

export function buildPlatformEmailBranding(tenantName?: string): TenantEmailBrandingProfile {
  return {
    tenantId: 'platform',
    version: 'platform-v1',
    isPlatformFallback: true,
    brand: {
      legalCompanyName: COMPANY_LEGAL.legalName,
      tradingName: 'Alphaclone Systems',
      logoUrl: resolveEmailLogoUrl(),
      logoAlt: 'Alphaclone Systems',
      primaryColor: '#0f766e',
      textColor: '#1e293b',
      postalAddress: formatLegalAddress(),
      website: SITE_URL,
      supportEmail: 'support@alphaclonesystems.com',
    },
    senderDisplayName: tenantName ? `Alphaclone Systems (for ${tenantName})` : 'Alphaclone Systems',
    replyToEmail: 'support@alphaclonesystems.com',
    privacyPolicyUrl: absoluteUrl('/privacy-policy'),
    termsUrl: absoluteUrl('/terms-of-service'),
    preferencesUrl: absoluteUrl('/settings/notifications'),
    unsubscribeConfigured: true,
    socialLinks: [
      { label: 'LinkedIn', url: 'https://www.linkedin.com/company/alphaclone-systems' },
      { label: 'Website', url: SITE_URL },
    ],
  };
}

export async function loadTenantEmailBrandingProfile(
  tenantId: string,
  options?: { isPlatformNotification?: boolean },
): Promise<TenantEmailBrandingProfile> {
  if (options?.isPlatformNotification) {
    return buildPlatformEmailBranding();
  }

  const supabase = createSupabaseAdminClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, logo_url, brand_color_primary, brand_color_secondary, settings, website_url')
    .eq('id', tenantId)
    .maybeSingle();

  if (!tenant) {
    return buildPlatformEmailBranding();
  }

  const settings = (tenant.settings || {}) as Record<string, unknown>;
  const brandingSettings = (settings.branding || settings.publicBranding || {}) as Record<string, string>;
  const emailSettings = (settings.email || settings.emailBranding || {}) as Record<string, string>;
  const extracted = extractTenantBranding(tenant);

  const legalName =
    readString(brandingSettings.legalBusinessName) ||
    readString(brandingSettings.legal_name) ||
    readString(extracted.legalName) ||
    readString(extracted.name) ||
    'Your Business';

  const tradingName = readString(extracted.name) || legalName;
  const logoUrl = resolveEmailLogoUrl();
  const website = readString(brandingSettings.website) || readString(tenant.website_url) || readString(emailSettings.website);
  const supportEmail = readString(emailSettings.supportEmail) || readString(extracted.supportEmail);
  const replyTo = readString(emailSettings.replyTo) || readString(emailSettings.reply_to) || supportEmail;
  const address =
    readString(brandingSettings.businessAddress) ||
    readString(brandingSettings.postalAddress) ||
    readString(settings.business_address as string);

  const hasTenantBrand = Boolean(logoUrl || address || website || supportEmail);

  if (!hasTenantBrand) {
    const fallback = buildPlatformEmailBranding(tradingName);
    return {
      ...fallback,
      tenantId,
      senderDisplayName: readString(emailSettings.senderDisplayName) || tradingName,
      replyToEmail: replyTo,
    };
  }

  const privacyPolicyUrl =
    readString(brandingSettings.privacyPolicyUrl) ||
    readString(settings.privacy_policy_url as string) ||
    (website ? `${website.replace(/\/$/, '')}/privacy` : absoluteUrl('/privacy-policy'));

  const termsUrl =
    readString(brandingSettings.termsUrl) ||
    readString(settings.terms_url as string) ||
    (website ? `${website.replace(/\/$/, '')}/terms` : absoluteUrl('/terms-of-service'));

  const socialLinks: Array<{ label: string; url: string }> = [];
  if (readString(brandingSettings.linkedinUrl)) {
    socialLinks.push({ label: 'LinkedIn', url: brandingSettings.linkedinUrl! });
  }
  if (website) socialLinks.push({ label: 'Website', url: website });

  const signatureText = readString(emailSettings.signatureText) || readString(emailSettings.signature);

  return {
    tenantId,
    version: readString(brandingSettings.version) || 'tenant-v1',
    isPlatformFallback: false,
    brand: {
      id: tenantId,
      legalCompanyName: legalName,
      tradingName,
      logoUrl,
      logoAlt: tradingName,
      primaryColor: extracted.primaryColor || '#0f766e',
      textColor: '#1e293b',
      postalAddress: address,
      website,
      supportEmail,
    },
    senderDisplayName: readString(emailSettings.senderDisplayName) || tradingName,
    replyToEmail: replyTo,
    fromEmail: readString(emailSettings.fromEmail),
    privacyPolicyUrl,
    termsUrl,
    preferencesUrl: readString(emailSettings.preferencesUrl) || absoluteUrl('/settings/notifications'),
    unsubscribeConfigured: true,
    signatureText,
    signatureHtml: signatureText ? `<p style="margin:16px 0 0;color:#475569;">${signatureText.replace(/\n/g, '<br>')}</p>` : undefined,
    socialLinks,
  };
}
