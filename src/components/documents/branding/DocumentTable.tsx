'use client';

import React from 'react';

export interface DocumentLineItem {
  id?: string;
  itemNumber?: number | string;
  description: string;
  notes?: string;
  quantity?: number | string;
  rate?: number | string;
  amount: number | string;
  taxRate?: number | string;
}

export interface DocumentTableProps {
  items: DocumentLineItem[];
  currency?: string;
  showItemNumber?: boolean;
  className?: string;
  quantityLabel?: string;
  rateLabel?: string;
  amountLabel?: string;
  descriptionLabel?: string;
}

function formatMoney(amount: number | string, currency = 'USD'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return String(amount);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currency} ${num.toFixed(2)}`;
  }
}

export function DocumentTable({
  items,
  currency = 'USD',
  showItemNumber = false,
  className = '',
  quantityLabel = 'Qty',
  rateLabel = 'Unit Price',
  amountLabel = 'Amount',
  descriptionLabel = 'Description',
}: DocumentTableProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className={`doc-table-container overflow-x-auto my-6 ${className}`}>
      <table className="doc-table w-full text-left border-collapse">
        <thead>
          <tr className="border-b-2 border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-600">
            {showItemNumber && (
              <th scope="col" className="py-3 pr-4 w-12 text-center text-slate-400">
                #
              </th>
            )}
            <th scope="col" className="py-3 pr-4">
              {descriptionLabel}
            </th>
            <th scope="col" className="py-3 px-4 text-right w-20">
              {quantityLabel}
            </th>
            <th scope="col" className="py-3 px-4 text-right w-28">
              {rateLabel}
            </th>
            <th scope="col" className="py-3 pl-4 text-right w-32">
              {amountLabel}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
          {items.map((item, idx) => (
            <tr key={item.id || idx} className="doc-table-row break-inside-avoid">
              {showItemNumber && (
                <td className="py-3.5 pr-4 text-center text-xs text-slate-400 font-mono">
                  {item.itemNumber ?? idx + 1}
                </td>
              )}
              <td className="py-3.5 pr-4 align-top">
                <div className="font-semibold text-slate-900">{item.description}</div>
                {item.notes && (
                  <div className="text-xs text-slate-500 mt-0.5 whitespace-pre-line leading-relaxed">
                    {item.notes}
                  </div>
                )}
              </td>
              <td className="py-3.5 px-4 text-right align-top font-mono text-slate-700">
                {item.quantity ?? 1}
              </td>
              <td className="py-3.5 px-4 text-right align-top font-mono text-slate-700">
                {item.rate != null ? formatMoney(item.rate, currency) : '—'}
              </td>
              <td className="py-3.5 pl-4 text-right align-top font-mono font-semibold text-slate-900">
                {formatMoney(item.amount, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
