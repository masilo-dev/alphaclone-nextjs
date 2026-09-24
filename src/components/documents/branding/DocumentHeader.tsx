'use client';

import React from 'react';
import type { TenantBranding } from '@/lib/tenantBranding';
import { DocumentCompanyIdentity } from './DocumentCompanyIdentity';

export interface DocumentHeaderProps {
  title: string;
  documentNumber?: string;
  referenceNumber?: string;
  status?: string;
  statusVariant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  branding: TenantBranding;
  className?: string;
  showIssuerDetails?: boolean;
  children?: React.ReactNode;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  default: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  success: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  danger: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  info: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
};

function resolveStatusVariant(status?: string, override?: string): { bg: string; text: string; border: string } {
  if (override && STATUS_STYLES[override]) {
    return STATUS_STYLES[override];
  }
  const s = (status || '').toLowerCase();
  if (s.includes('paid') || s.includes('accepted') || s.includes('completed') || s.includes('active')) {
    return STATUS_STYLES.success;
  }
  if (s.includes('pending') || s.includes('awaiting') || s.includes('sent') || s.includes('viewed')) {
    return STATUS_STYLES.info;
  }
  if (s.includes('overdue') || s.includes('rejected') || s.includes('declined') || s.includes('disputed')) {
    return STATUS_STYLES.danger;
  }
  if (s.includes('draft')) {
    return STATUS_STYLES.default;
  }
  return STATUS_STYLES.default;
}

export function DocumentHeader({
  title,
  documentNumber,
  referenceNumber,
  status,
  statusVariant,
  branding,
  className = '',
  showIssuerDetails = true,
  children,
}: DocumentHeaderProps) {
  const brandColor = branding.primaryBrandColor || branding.primaryColor || '#0f172a';
  const badgeStyle = resolveStatusVariant(status, statusVariant);

  return (
    <div className={`doc-header doc-avoid-break border-b border-slate-200 pb-6 mb-8 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
        {/* Left: Company Identity (Constrained Logo or Wordmark fallback + Details) */}
        <div className="sm:max-w-[50%]">
          <DocumentCompanyIdentity
            branding={branding}
            showDetails={showIssuerDetails}
            align="left"
          />
        </div>

        {/* Right: Authoritative Document Title & Number (Dominant Hierarchy) */}
        <div className="text-left sm:text-right flex flex-col sm:items-end">
          {/* Main Document Title */}
          <h1
            className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-slate-900"
            style={{ color: brandColor !== '#ffffff' ? brandColor : '#0f172a' }}
          >
            {title}
          </h1>

          {/* Document Number */}
          {documentNumber && (
            <div className="text-sm font-mono font-semibold text-slate-600 mt-1">
              #{documentNumber}
            </div>
          )}

          {/* Reference Number if any */}
          {referenceNumber && referenceNumber !== documentNumber && (
            <div className="text-xs text-slate-500 font-mono mt-0.5">
              Ref: {referenceNumber}
            </div>
          )}

          {/* Status Badge */}
          {status && (
            <div className="mt-2.5">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
              >
                {status}
              </span>
            </div>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}
