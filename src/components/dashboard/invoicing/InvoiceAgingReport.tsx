'use client';

import React, { useState, useEffect } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Clock, DollarSign, AlertCircle, FileText } from 'lucide-react';

type AgingBucket = {
  range: string;
  label: string;
  count: number;
  totalAmount: number;
  color: string;
};

const BUCKET_CONFIG: AgingBucket[] = [
  { range: '0-30', label: '0–30 Days', count: 0, totalAmount: 0, color: '#3b82f6' },
  { range: '31-60', label: '31–60 Days', count: 0, totalAmount: 0, color: '#f59e0b' },
  { range: '61-90', label: '61–90 Days', count: 0, totalAmount: 0, color: '#f97316' },
  { range: '90+', label: '90+ Days (Critical)', count: 0, totalAmount: 0, color: '#ef4444' },
];

export function InvoiceAgingReport() {
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [buckets, setBuckets] = useState<AgingBucket[]>(BUCKET_CONFIG);
  const [totalOverdue, setTotalOverdue] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);

  useEffect(() => {
    if (!currentTenant) return;
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenant]);

  async function load() {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const now = new Date();
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('id, total_amount, due_date, lifecycle_status, status')
        .eq('tenant_id', currentTenant.id)
        .not('lifecycle_status', 'in', '("paid","cancelled")');

      if (error) throw error;

      const newBuckets = BUCKET_CONFIG.map(b => ({ ...b, count: 0, totalAmount: 0 }));
      let grandTotal = 0;
      let count = 0;

      for (const inv of invoices || []) {
        const dueDate = inv.due_date ? new Date(inv.due_date) : now;
        const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));
        const amount = Number(inv.total_amount || 0);

        if (diffDays <= 30) {
          newBuckets[0].count++;
          newBuckets[0].totalAmount += amount;
        } else if (diffDays <= 60) {
          newBuckets[1].count++;
          newBuckets[1].totalAmount += amount;
        } else if (diffDays <= 90) {
          newBuckets[2].count++;
          newBuckets[2].totalAmount += amount;
        } else {
          newBuckets[3].count++;
          newBuckets[3].totalAmount += amount;
        }

        grandTotal += amount;
        count++;
      }

      setBuckets(newBuckets);
      setTotalOverdue(grandTotal);
      setInvoiceCount(count);
    } catch (err) {
      console.error('[InvoiceAgingReport]', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
          <Clock className="text-amber-400" size={20} /> Invoice Aging Report
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">Accounts receivable breakdown by age of unpaid balance</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="ac-workspace-panel rounded-xl p-4">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <FileText size={13} className="text-slate-500" /> Outstanding Invoices
          </p>
          <p className="text-2xl font-black text-white mt-2">{invoiceCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Pending payment</p>
        </div>
        <div className="ac-workspace-panel rounded-xl p-4 border border-amber-500/20">
          <p className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
            <DollarSign size={13} /> Total Receivables
          </p>
          <p className="text-2xl font-black text-amber-300 mt-2">${totalOverdue.toLocaleString()}</p>
          <p className="text-[11px] text-slate-500 mt-1">Uncollected revenue</p>
        </div>
      </div>

      {loading ? (
        <div className="ac-workspace-panel rounded-xl p-8 flex items-center justify-center min-h-[280px]">
          <p className="text-slate-500 text-sm animate-pulse">Computing aging report...</p>
        </div>
      ) : (
        <>
          <div className="ac-workspace-panel rounded-xl p-4 sm:p-6">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Receivables by Age</p>
            <div className="min-h-[240px]">
              <ResponsiveContainer width="100%" height={240} minWidth={0}>
                <BarChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v: number) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as AgingBucket;
                      return (
                        <div className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs shadow-xl space-y-1">
                          <p className="font-black text-white">{d.label}</p>
                          <p className="text-slate-300">{d.count} invoice{d.count !== 1 ? 's' : ''}</p>
                          <p className="text-amber-400 font-bold">${d.totalAmount.toLocaleString()}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="totalAmount" radius={[6, 6, 0, 0]}>
                    {buckets.map(b => <Cell key={b.range} fill={b.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="ac-workspace-panel rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5 bg-[var(--ws-toolbar)]">
              <p className="text-xs font-black uppercase tracking-widest text-white">Aging Buckets</p>
            </div>
            <div className="divide-y divide-white/5">
              {buckets.map(b => (
                <div key={b.range} className="px-5 py-3 flex items-center gap-4">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                  <span className="text-sm text-slate-300 flex-1">{b.label}</span>
                  <span className="text-xs text-slate-500">{b.count} invoices</span>
                  <span className="text-sm font-black text-amber-300 w-28 text-right">${b.totalAmount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
