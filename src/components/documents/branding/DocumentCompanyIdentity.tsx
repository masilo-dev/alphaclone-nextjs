'use client';

import React from 'react';
import type { TenantBranding } from '@/lib/tenantBranding';

export interface DocumentCompanyIdentityProps {
  branding: TenantBranding;
  className?: string;
  showDetails?: boolean;
  align?: 'left' | 'right';
  compact?: boolean;
}

/**
 * Clean tenant company identity header component.
 * Displays logo constrained to 28-36px height with aspect-ratio preserved,
 * or a clean typographic wordmark in the exact same footprint if no logo exists.
 */
export function DocumentCompanyIdentity({
  branding,
  className = '',
  showDetails = true,
  align = 'left',
  compact = false,
}: DocumentCompanyIdentityProps) {
  const hasLogo = Boolean(
    branding.logoUrl &&
    typeof branding.logoUrl === 'string' &&
    branding.logoUrl.trim().length > 0
  );

  const displayName = branding.name || branding.companyName || 'Unconfigured Business';
  const brandColor = branding.primaryBrandColor || branding.primaryColor || '#0f172a';
  const addressLines = (branding.businessAddress || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const isRight = align === 'right';

  return (
    <div className={`doc-avoid-break ${isRight ? 'text-right' : 'text-left'} ${className}`}>
      {/* Logo or Wordmark Footprint (28-36px height, max-w ~160px) */}
      <div className={`flex items-center min-h-[32px] sm:min-h-[36px] mb-2 ${isRight ? 'justify-end' : 'justify-start'}`}>
        {hasLogo ? (
          <img
            src={branding.logoUrl}
            alt={displayName}
            className={`h-8 sm:h-9 max-h-[36px] max-w-[160px] w-auto object-contain ${
              isRight ? 'object-right' : 'object-left'
            }`}
          />
        ) : (
          <div
            className="h-8 sm:h-9 flex items-center font-bold text-lg sm:text-xl tracking-tight text-slate-900"
            style={{ color: brandColor !== '#ffffff' ? brandColor : '#0f172a' }}
          >
            {displayName}
          </div>
        )}
      </div>

      {/* Optional Details (Legal name, address, tax info, contact) */}
      {showDetails && (
        <div className={`space-y-0.5 text-xs text-slate-500 leading-normal ${compact ? 'text-[11px]' : ''}`}>
          {branding.legalName && branding.legalName !== displayName && (
            <div className="font-medium text-slate-700">{branding.legalName}</div>
          )}

          {addressLines.map((line, idx) => (
            <div key={idx}>{line}</div>
          ))}

          {(branding.taxNumber || branding.taxId) && (
            <div>Tax ID: {branding.taxNumber || branding.taxId}</div>
          )}

          {branding.registrationNumber && (
            <div>Reg No: {branding.registrationNumber}</div>
          )}

          {(branding.businessEmail || branding.supportEmail) && (
            <div>{branding.businessEmail || branding.supportEmail}</div>
          )}

          {branding.businessPhone && (
            <div>{branding.businessPhone}</div>
          )}

          {branding.website && (
            <div>{branding.website}</div>
          )}
        </div>
      )}
    </div>
  );
}
