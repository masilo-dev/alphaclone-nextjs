'use client';

import React from 'react';
import type { TenantBranding } from '@/lib/tenantBranding';

export interface PaymentDetails {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  routingNumber?: string;
  sortCode?: string;
  iban?: string;
  swift?: string;
  instructions?: string;
}

export interface DocumentFooterProps {
  branding: TenantBranding;
  paymentDetails?: PaymentDetails;
  notes?: string;
  customFooterText?: string;
  showPlatformAttribution?: boolean;
  className?: string;
}

export function DocumentFooter({
  branding,
  paymentDetails,
  notes,
  customFooterText,
  showPlatformAttribution = false,
  className = '',
}: DocumentFooterProps) {
  const displayName = branding.name || branding.companyName || 'Unconfigured Business';
  const hasPaymentDetails = Boolean(
    paymentDetails &&
    (paymentDetails.bankName ||
     paymentDetails.accountNumber ||
     paymentDetails.iban ||
     paymentDetails.instructions)
  );

  return (
    <footer className={`doc-footer doc-avoid-break mt-12 pt-6 border-t border-slate-200 text-xs text-slate-500 space-y-4 ${className}`}>
      {/* Payment / Remittance Information */}
      {hasPaymentDetails && (
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 space-y-2 text-slate-700">
          <div className="font-bold uppercase tracking-wider text-slate-900 text-[11px]">
            Payment & Bank Transfer Details
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            {paymentDetails?.bankName && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Bank Name</span>
                <span className="font-medium text-slate-900">{paymentDetails.bankName}</span>
              </div>
            )}
            {paymentDetails?.accountName && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Account Name</span>
                <span className="font-medium text-slate-900">{paymentDetails.accountName}</span>
              </div>
            )}
            {paymentDetails?.accountNumber && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Account Number</span>
                <span className="font-mono font-medium text-slate-900">{paymentDetails.accountNumber}</span>
              </div>
            )}
            {paymentDetails?.routingNumber && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Routing / BSB</span>
                <span className="font-mono font-medium text-slate-900">{paymentDetails.routingNumber}</span>
              </div>
            )}
            {paymentDetails?.sortCode && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Sort Code</span>
                <span className="font-mono font-medium text-slate-900">{paymentDetails.sortCode}</span>
              </div>
            )}
            {paymentDetails?.iban && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">IBAN</span>
                <span className="font-mono font-medium text-slate-900">{paymentDetails.iban}</span>
              </div>
            )}
            {paymentDetails?.swift && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">SWIFT / BIC</span>
                <span className="font-mono font-medium text-slate-900">{paymentDetails.swift}</span>
              </div>
            )}
          </div>
          {paymentDetails?.instructions && (
            <p className="text-[11px] text-slate-600 mt-2 italic leading-relaxed">
              {paymentDetails.instructions}
            </p>
          )}
        </div>
      )}

      {/* Optional Footnote / Remarks */}
      {notes && (
        <p className="text-slate-500 text-[11px] leading-relaxed">
          {notes}
        </p>
      )}

      {/* Tenant Legal & Registration Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 text-[11px] text-slate-400">
        <div>
          {customFooterText || branding.documentFooterText ? (
            <span>{customFooterText || branding.documentFooterText}</span>
          ) : (
            <span>
              {branding.legalName || displayName}
              {branding.registrationNumber ? ` · Reg: ${branding.registrationNumber}` : ''}
              {(branding.taxNumber || branding.taxId) ? ` · Tax ID: ${branding.taxNumber || branding.taxId}` : ''}
              {branding.businessEmail ? ` · ${branding.businessEmail}` : ''}
            </span>
          )}
        </div>

        {/* Discreet Platform Attribution if enabled */}
        {showPlatformAttribution && (
          <div className="text-slate-400 text-[10px]">
            Powered by <span className="font-semibold text-slate-500">AlphaClone Systems</span>
          </div>
        )}
      </div>
    </footer>
  );
}
