'use client';

import React from 'react';
import { useDocumentBranding, type TenantLikeInput } from './useDocumentBranding';
import { DocumentPrintStyles } from './DocumentPrintStyles';
import type { TenantBranding } from '@/lib/tenantBranding';

export interface DocumentLayoutProps {
  tenant?: TenantLikeInput | null;
  branding?: TenantBranding;
  children: React.ReactNode;
  className?: string;
  wrapperClassName?: string;
}

/**
 * Universal Master Document Layout canvas.
 * Resolves tenant branding dynamically from TenantContext or tenant prop.
 * Enforces strict SaaS document aesthetic:
 * - High contrast white paper background
 * - Professional print rules (@page margins, page-break prevention)
 * - Restrained typography and spacing
 */
export function DocumentLayout({
  tenant,
  branding: explicitBranding,
  children,
  className = '',
  wrapperClassName = '',
}: DocumentLayoutProps) {
  const resolved = useDocumentBranding(tenant);
  const branding = explicitBranding || resolved.branding;

  return (
    <div className={`doc-layout-root w-full min-h-screen py-6 sm:py-10 px-2 sm:px-6 font-sans antialiased text-slate-900 selection:bg-slate-200 ${wrapperClassName}`}>
      <DocumentPrintStyles />

      {/* Main Document Canvas */}
      <article
        className={`doc-page-container bg-white text-slate-900 border border-slate-200/80 rounded-2xl shadow-sm max-w-4xl mx-auto p-6 sm:p-10 md:p-12 relative overflow-hidden transition-all print:p-0 print:border-none print:shadow-none print:max-w-none print:m-0 ${className}`}
      >
        {children}
      </article>
    </div>
  );
}
