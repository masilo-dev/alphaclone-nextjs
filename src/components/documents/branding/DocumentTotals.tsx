'use client';

import React from 'react';

export interface TaxItem {
  label?: string;
  rate?: number;
  amount: number;
}

export interface DiscountItem {
  label?: string;
  amount: number;
}

export interface DocumentTotalsProps {
  subtotal?: number;
  tax?: number | TaxItem | TaxItem[];
  discount?: number | DiscountItem;
  shipping?: number;
  total: number;
  amountPaid?: number;
  balanceDue?: number;
  currency?: string;
  brandColor?: string;
  className?: string;
  notes?: string;
}

function formatMoney(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function DocumentTotals({
  subtotal,
  tax,
  discount,
  shipping,
  total,
  amountPaid,
  balanceDue,
  currency = 'USD',
  brandColor = '#0f172a',
  className = '',
  notes,
}: DocumentTotalsProps) {
  // Normalize tax entries
  const taxEntries: TaxItem[] = [];
  if (typeof tax === 'number' && tax !== 0) {
    taxEntries.push({ label: 'Tax', amount: tax });
  } else if (Array.isArray(tax)) {
    taxEntries.push(...tax);
  } else if (tax && typeof tax === 'object') {
    taxEntries.push(tax);
  }

  // Normalize discount entry
  const discountEntry: DiscountItem | null =
    typeof discount === 'number' && discount > 0
      ? { label: 'Discount', amount: discount }
      : discount && typeof discount === 'object' && discount.amount > 0
      ? discount
      : null;

  const showPaid = amountPaid != null && amountPaid > 0;
  const showBalance = balanceDue != null;

  return (
    <div className={`doc-totals doc-avoid-break my-6 flex flex-col sm:flex-row justify-between items-start gap-8 ${className}`}>
      {/* Left side: Notes or Terms if present */}
      <div className="flex-1 text-xs text-slate-500 max-w-sm">
        {notes && (
          <div className="space-y-1">
            <span className="font-bold uppercase tracking-wider text-slate-400">Notes / Remarks</span>
            <p className="whitespace-pre-line leading-relaxed text-slate-600">{notes}</p>
          </div>
        )}
      </div>

      {/* Right side: Numerical breakdown */}
      <div className="w-full sm:w-80 space-y-2 text-sm text-slate-700">
        {subtotal != null && (
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-mono text-slate-900 font-medium">{formatMoney(subtotal, currency)}</span>
          </div>
        )}

        {discountEntry && (
          <div className="flex justify-between py-1 border-b border-slate-100 text-emerald-700">
            <span>{discountEntry.label || 'Discount'}</span>
            <span className="font-mono font-medium">−{formatMoney(discountEntry.amount, currency)}</span>
          </div>
        )}

        {taxEntries.map((t, idx) => (
          <div key={idx} className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
            <span>
              {t.label || 'Tax'}
              {t.rate != null ? ` (${t.rate}%)` : ''}
            </span>
            <span className="font-mono text-slate-900 font-medium">{formatMoney(t.amount, currency)}</span>
          </div>
        ))}

        {shipping != null && shipping > 0 && (
          <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
            <span>Shipping & Handling</span>
            <span className="font-mono text-slate-900 font-medium">{formatMoney(shipping, currency)}</span>
          </div>
        )}

        {/* Grand Total */}
        <div className="flex justify-between items-center py-3 border-t-2 border-b-2 border-slate-900 mt-2">
          <span className="text-base font-extrabold uppercase tracking-tight text-slate-900">Total</span>
          <span
            className="text-xl sm:text-2xl font-black font-mono tracking-tight"
            style={{ color: brandColor !== '#ffffff' ? brandColor : '#0f172a' }}
          >
            {formatMoney(total, currency)}
          </span>
        </div>

        {/* Amount Paid / Balance Due */}
        {showPaid && (
          <div className="flex justify-between py-1 text-slate-600 text-xs">
            <span>Amount Paid</span>
            <span className="font-mono font-medium">{formatMoney(amountPaid!, currency)}</span>
          </div>
        )}

        {showBalance && (
          <div className={`flex justify-between py-1.5 font-bold ${balanceDue! <= 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
            <span>Balance Due</span>
            <span className="font-mono text-base">{formatMoney(balanceDue!, currency)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
