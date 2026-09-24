'use client';

import React from 'react';

export interface PartyInfo {
  name: string;
  companyName?: string;
  attention?: string;
  address?: string;
  email?: string;
  phone?: string;
  taxId?: string;
}

export interface DocumentMetadataProps {
  fromParty?: PartyInfo;
  toParty?: PartyInfo;
  issueDate?: string | Date;
  dueDate?: string | Date;
  expiryDate?: string | Date;
  poNumber?: string;
  currency?: string;
  paymentTerms?: string;
  customFields?: Array<{ label: string; value: React.ReactNode }>;
  className?: string;
}

function formatDate(val?: string | Date): string | null {
  if (!val) return null;
  try {
    const d = typeof val === 'string' ? new Date(val) : val;
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(val);
  }
}

export function DocumentMetadata({
  fromParty,
  toParty,
  issueDate,
  dueDate,
  expiryDate,
  poNumber,
  currency,
  paymentTerms,
  customFields,
  className = '',
}: DocumentMetadataProps) {
  const formattedIssue = formatDate(issueDate);
  const formattedDue = formatDate(dueDate);
  const formattedExpiry = formatDate(expiryDate);

  const addressLines = (toParty?.address || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const fromAddressLines = (fromParty?.address || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className={`doc-party-info doc-avoid-break grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-sm text-slate-800 mb-8 ${className}`}>
      {/* Recipient / Client Details */}
      {toParty && (
        <div className="space-y-1">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Billed To / Recipient
          </div>
          <div className="font-semibold text-slate-900 text-base">
            {toParty.name}
          </div>
          {toParty.companyName && toParty.companyName !== toParty.name && (
            <div className="text-slate-600 font-medium">{toParty.companyName}</div>
          )}
          {toParty.attention && (
            <div className="text-xs text-slate-500">Attn: {toParty.attention}</div>
          )}
          {addressLines.map((line, idx) => (
            <div key={idx} className="text-xs text-slate-600">
              {line}
            </div>
          ))}
          {toParty.taxId && (
            <div className="text-xs text-slate-500">Tax ID: {toParty.taxId}</div>
          )}
          {toParty.email && (
            <div className="text-xs text-slate-600">{toParty.email}</div>
          )}
          {toParty.phone && (
            <div className="text-xs text-slate-600">{toParty.phone}</div>
          )}
        </div>
      )}

      {/* Optional Separate From Column if specified */}
      {fromParty && (
        <div className="space-y-1">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            From / Issuer
          </div>
          <div className="font-semibold text-slate-900 text-base">
            {fromParty.name}
          </div>
          {fromParty.companyName && fromParty.companyName !== fromParty.name && (
            <div className="text-slate-600 font-medium">{fromParty.companyName}</div>
          )}
          {fromAddressLines.map((line, idx) => (
            <div key={idx} className="text-xs text-slate-600">
              {line}
            </div>
          ))}
          {fromParty.taxId && (
            <div className="text-xs text-slate-500">Tax ID: {fromParty.taxId}</div>
          )}
          {fromParty.email && (
            <div className="text-xs text-slate-600">{fromParty.email}</div>
          )}
        </div>
      )}

      {/* Key Dates & Document Parameters */}
      <div className={`space-y-2 sm:text-right ${!fromParty ? 'sm:col-span-1 md:col-span-2' : ''}`}>
        <div className="space-y-1.5 inline-block text-left sm:text-right">
          {formattedIssue && (
            <div className="flex sm:justify-end gap-3 text-xs">
              <span className="font-medium text-slate-500">Date Issued:</span>
              <span className="font-semibold text-slate-900">{formattedIssue}</span>
            </div>
          )}

          {formattedDue && (
            <div className="flex sm:justify-end gap-3 text-xs">
              <span className="font-medium text-slate-500">Payment Due:</span>
              <span className="font-semibold text-slate-900">{formattedDue}</span>
            </div>
          )}

          {formattedExpiry && (
            <div className="flex sm:justify-end gap-3 text-xs">
              <span className="font-medium text-slate-500">Valid Until:</span>
              <span className="font-semibold text-slate-900">{formattedExpiry}</span>
            </div>
          )}

          {poNumber && (
            <div className="flex sm:justify-end gap-3 text-xs">
              <span className="font-medium text-slate-500">PO Number:</span>
              <span className="font-mono font-semibold text-slate-900">{poNumber}</span>
            </div>
          )}

          {currency && (
            <div className="flex sm:justify-end gap-3 text-xs">
              <span className="font-medium text-slate-500">Currency:</span>
              <span className="font-semibold text-slate-900 uppercase">{currency}</span>
            </div>
          )}

          {paymentTerms && (
            <div className="flex sm:justify-end gap-3 text-xs">
              <span className="font-medium text-slate-500">Terms:</span>
              <span className="font-semibold text-slate-900">{paymentTerms}</span>
            </div>
          )}

          {customFields?.map((f, i) => (
            <div key={i} className="flex sm:justify-end gap-3 text-xs">
              <span className="font-medium text-slate-500">{f.label}:</span>
              <span className="font-semibold text-slate-900">{f.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
