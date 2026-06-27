'use client';

import React, { useEffect, useState } from 'react';
import { Receipt, Loader2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

type UnbilledExpense = {
  id: string;
  expenseNumber: string;
  date: string;
  description: string;
  total: number;
  currency: string;
};

export default function BillableExpensesPicker({
  tenantId,
  clientId,
  invoiceId,
  onAttached,
}: {
  tenantId: string;
  clientId: string;
  invoiceId?: string | null;
  onAttached?: () => void;
}) {
  const [expenses, setExpenses] = useState<UnbilledExpense[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [attaching, setAttaching] = useState(false);

  useEffect(() => {
    if (!tenantId || !clientId) {
      setExpenses([]);
      return;
    }
    setLoading(true);
    fetch(
      `/api/finance/unbilled-expenses?tenantId=${encodeURIComponent(tenantId)}&clientId=${encodeURIComponent(clientId)}`
    )
      .then((r) => r.json())
      .then((data) => setExpenses(data.expenses || []))
      .catch(() => setExpenses([]))
      .finally(() => setLoading(false));
  }, [tenantId, clientId]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const attach = async () => {
    if (!invoiceId) {
      toast.error('Save the invoice as a draft first, then attach expenses.');
      return;
    }
    if (selected.size === 0) return;

    setAttaching(true);
    try {
      const res = await fetch('/api/finance/attach-expenses-to-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          invoiceId,
          expenseIds: [...selected],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to attach');
      toast.success(`Added ${data.attached} expense(s) — $${Number(data.lineTotal).toFixed(2)}`);
      setSelected(new Set());
      setExpenses((prev) => prev.filter((e) => !selected.has(e.id)));
      onAttached?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to attach expenses');
    } finally {
      setAttaching(false);
    }
  };

  if (!clientId) return null;
  if (loading) {
    return (
      <div className="text-xs text-slate-500 flex items-center gap-2 py-2">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading billable expenses...
      </div>
    );
  }
  if (expenses.length === 0) return null;

  const selectedTotal = expenses
    .filter((e) => selected.has(e.id))
    .reduce((s, e) => s + e.total, 0);

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
      <p className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
        <Receipt className="w-4 h-4" /> Unbilled expenses
      </p>
      <ul className="space-y-2 max-h-40 overflow-y-auto">
        {expenses.map((exp) => (
          <li key={exp.id}>
            <label className="flex items-start gap-3 cursor-pointer text-sm text-slate-300">
              <input
                type="checkbox"
                checked={selected.has(exp.id)}
                onChange={() => toggle(exp.id)}
                className="mt-1"
              />
              <span className="flex-1">
                {exp.description}
                <span className="block text-xs text-slate-500">
                  {exp.date} · ${exp.total.toFixed(2)}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {selected.size > 0 && (
        <button
          type="button"
          disabled={attaching}
          onClick={attach}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-bold uppercase disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {invoiceId
            ? attaching
              ? 'Adding...'
              : `Add ${selected.size} to invoice ($${selectedTotal.toFixed(2)})`
            : `Save draft first to add $${selectedTotal.toFixed(2)}`}
        </button>
      )}
    </div>
  );
}
