'use client';

import React, { useEffect, useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { generalLedgerService } from '@/services/accounting/generalLedgerService';
import { getOperationalFinancials } from '@/services/accounting/operationalAccountingService';
import { Loader2 } from 'lucide-react';

export function CashFlowStatement() {
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<{ label: string; amount: number }[]>([]);

  useEffect(() => {
    if (!currentTenant?.id) return;
    (async () => {
      setLoading(true);
      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      const [plRes, ops] = await Promise.all([
        generalLedgerService.getProfitLossData(yearStart, today),
        getOperationalFinancials(currentTenant.id, yearStart, today),
      ]);

      const netIncome = plRes.statement?.netIncome ?? ops.paidRevenue - ops.receiptExpenses;
      const operating = netIncome;
      const investing = 0;
      const financing = 0;
      const netChange = operating + investing + financing;

      setRows([
        { label: 'Net income (operating)', amount: operating },
        { label: 'Investing activities', amount: investing },
        { label: 'Financing activities', amount: financing },
        { label: 'Net change in cash', amount: netChange },
      ]);
      setLoading(false);
    })();
  }, [currentTenant?.id]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold text-white mb-4">Cash Flow Statement</h3>
      <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between px-4 py-3 border-b border-white/5 last:border-0 text-sm">
            <span className="text-slate-300">{r.label}</span>
            <span className={`font-bold ${r.amount >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
              ${r.amount.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-2">
        Derived from P&amp;L and operational invoice/receipt data. Formal GL cash flow classification coming soon.
      </p>
    </div>
  );
}

export default CashFlowStatement;
