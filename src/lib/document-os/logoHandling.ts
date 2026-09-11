/**
 * Logo handling — preserve aspect ratio, never stretch/crop/blur/distort.
 * Never substitute another tenant's logo. Text fallback when missing.
 */

import type { DocumentBrandProfile, LogoPlacement } from './types';
import { brandDisplayName } from './brandProfile';
import { DOCUMENT_DESIGN_TOKENS, logoAlignment } from './designSystem';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function selectLogoUrl(
  brand: DocumentBrandProfile,
  options?: { monochrome?: boolean; preferSecondary?: boolean }
): string | undefined {
  if (options?.monochrome && brand.monochrome_logo_url) return brand.monochrome_logo_url;
  if (options?.preferSecondary && brand.secondary_logo_url) return brand.secondary_logo_url;
  return brand.primary_logo_url || brand.secondary_logo_url || brand.monochrome_logo_url;
}

/**
 * Render logo HTML with aspect-ratio preservation.
 * Uses object-fit: contain — never stretch, crop, blur, or distort.
 */
export function renderLogoHtml(
  brand: DocumentBrandProfile,
  options?: { monochrome?: boolean; placement?: LogoPlacement; className?: string }
): string {
  const url = selectLogoUrl(brand, options);
  const placement = options?.placement || brand.logo_placement;
  const name = escapeHtml(brandDisplayName(brand));

  if (!url) {
    return `<div class="doc-logo-wrap" style="justify-content:${logoAlignment(placement)};">
      <div class="doc-logo-fallback" style="font-family:${escapeHtml(brand.heading_font)};font-size:14pt;font-weight:600;color:${escapeHtml(brand.primary_colour)};">${name}</div>
    </div>`;
  }

  return `<div class="doc-logo-wrap ${options?.className || ''}" style="justify-content:${logoAlignment(placement)};padding:${DOCUMENT_DESIGN_TOKENS.logo.clearSpace};">
    <img
      class="doc-logo"
      src="${escapeHtml(url)}"
      alt="${name}"
      style="max-height:${DOCUMENT_DESIGN_TOKENS.logo.maxHeight};max-width:${DOCUMENT_DESIGN_TOKENS.logo.maxWidth};width:auto;height:auto;object-fit:contain;image-rendering:auto;"
    />
  </div>`;
}

/** Suggest whether a monochrome variant should be used for print. */
export function shouldUseMonochromeForPrint(printMode: boolean, hasMonochrome: boolean): boolean {
  return printMode && hasMonochrome;
}
