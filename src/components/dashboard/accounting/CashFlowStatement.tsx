'use client';

import React, { useEffect, useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { generalLedgerService } from '@/services/accounting/generalLedgerService';
import { getOperationalFinancials } from '@/services/accounting/operationalAccountingService';
import { Loader2 } from 'lucide-react';

export function CashFlowStatement() {
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<{ label: string; amount: number | null; tracked: boolean }[]>([]);

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
      // Investing / financing cash-flow lines are not tracked in the ledger yet.
      // Never present 0 as a real figure — mark explicitly as not tracked.
      setRows([
        { label: 'Net income (operating)', amount: operating, tracked: true },
        { label: 'Investing activities', amount: null, tracked: false },
        { label: 'Financing activities', amount: null, tracked: false },
        { label: 'Net change in cash (operating only)', amount: operating, tracked: true },
      ]);
      setLoading(false);
    })();
  }, [currentTenant?.id]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold text-white mb-4">Cash Flow Statement</h3>
      <div className="dashboard-panel-soft overflow-hidden">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between px-4 py-3 border-b border-white/5 last:border-0 text-sm gap-3">
            <span className="text-slate-200">{r.label}</span>
            {!r.tracked || r.amount == null ? (
              <span className="font-medium text-slate-500 text-right">Not tracked yet</span>
            ) : (
              <span className={`font-bold tabular-nums ${r.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                ${r.amount.toLocaleString()}
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-300 mt-2">
        Operating cash flow is derived from the workspace P&amp;L plus invoice and receipt activity.
        Investing and financing activities are not tracked in the ledger yet, so they are shown as unavailable rather than zero.
      </p>
    </div>
  );
}

export default CashFlowStatement;
