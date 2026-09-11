'use client';

import React, { useState, useEffect } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { Clock, DollarSign, FileText } from 'lucide-react';
import { WrapChart } from '@/lib/chartWrapper';
import { CHART_COLORS, SEMANTIC } from '@/constants/brand';

type AgingBucket = {
  range: string;
  label: string;
  count: number;
  totalAmount: number;
  color: string;
};

const BUCKET_CONFIG: AgingBucket[] = [
  { range: '0-30', label: '0–30 Days', count: 0, totalAmount: 0, color: CHART_COLORS.invoice.sent },
  { range: '31-60', label: '31–60 Days', count: 0, totalAmount: 0, color: SEMANTIC.warning[500] },
  { range: '61-90', label: '61–90 Days', count: 0, totalAmount: 0, color: '#DE6A28' },
  { range: '90+', label: '90+ Days (Critical)', count: 0, totalAmount: 0, color: CHART_COLORS.invoice.overdue },
];

const OPEN_STATUSES = ['draft', 'sent', 'viewed', 'partially_paid', 'overdue', 'disputed'];

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
        .from('business_invoices')
        .select('id, total, amount_paid, due_date, status')
        .eq('tenant_id', currentTenant.id)
        .in('status', OPEN_STATUSES);

      if (error) throw error;

      const newBuckets = BUCKET_CONFIG.map(b => ({ ...b, count: 0, totalAmount: 0 }));
      let grandTotal = 0;
      let count = 0;

      for (const inv of invoices || []) {
        const dueDate = inv.due_date ? new Date(inv.due_date) : now;
        const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));
        const amount = Math.max(0, Number(inv.total || 0) - Number(inv.amount_paid || 0));
        if (amount <= 0) continue;

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
    <section className="space-y-6" aria-labelledby="invoice-aging-heading">
      <div>
        <h3 id="invoice-aging-heading" className="flex items-center gap-2 text-[18px] font-semibold leading-[26px] tracking-tight text-[var(--ws-text-primary)]">
          <Clock className="text-[var(--warning)]" size={20} aria-hidden="true" /> Invoice Aging Report
        </h3>
        <p className="mt-0.5 text-xs text-[var(--ws-text-secondary)]">Accounts receivable breakdown by age of unpaid balance</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="ac-workspace-panel p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ws-text-tertiary)]">
            <FileText size={13} aria-hidden="true" /> Outstanding Invoices
          </p>
          <p className="mt-2 text-[28px] font-bold leading-[34px] text-[var(--ws-text-primary)]">{invoiceCount}</p>
          <p className="mt-1 text-[11px] text-[var(--ws-text-tertiary)]">Pending payment</p>
        </div>
        <div className="ac-workspace-panel border-[color-mix(in_srgb,var(--warning)_28%,var(--ws-border))] p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--warning)]">
            <DollarSign size={13} aria-hidden="true" /> Total Receivables
          </p>
          <p className="mt-2 text-[28px] font-bold leading-[34px] text-[var(--warning)]">${totalOverdue.toLocaleString()}</p>
          <p className="mt-1 text-[11px] text-[var(--ws-text-tertiary)]">Uncollected revenue</p>
        </div>
      </div>

      {loading ? (
        <div className="ac-workspace-panel flex min-h-[280px] items-center justify-center p-8" role="status">
          <p className="animate-pulse text-sm text-[var(--ws-text-secondary)]">Computing aging report...</p>
        </div>
      ) : (
        <>
          <div className="ac-workspace-panel p-4 sm:p-6">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ws-text-tertiary)]">Receivables by Age</p>
            <div className="min-h-[240px]">
              <WrapChart height={240}>
                <BarChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.16)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#8491A6', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#8491A6', fontSize: 11 }} tickFormatter={(v: number) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as AgingBucket;
                      return (
                        <div className="ac-workspace-panel space-y-1 px-3 py-2 text-xs shadow-xl">
                          <p className="font-semibold text-[var(--ws-text-primary)]">{d.label}</p>
                          <p className="text-[var(--ws-text-secondary)]">{d.count} invoice{d.count !== 1 ? 's' : ''}</p>
                          <p className="font-semibold text-[var(--warning)]">${d.totalAmount.toLocaleString()}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="totalAmount" radius={[6, 6, 0, 0]}>
                    {buckets.map(b => <Cell key={b.range} fill={b.color} />)}
                  </Bar>
                </BarChart>
              </WrapChart>
            </div>
          </div>

          <div className="ac-workspace-panel overflow-hidden p-0">
            <div className="border-b border-[var(--ws-border)] bg-[var(--ws-toolbar)] px-5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ws-text-primary)]">Aging Buckets</p>
            </div>
            <div className="divide-y divide-[var(--ws-border)]">
              {buckets.map(b => (
                <div key={b.range} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-[var(--ws-hover)]">
                  <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: b.color }} />
                  <span className="flex-1 text-sm text-[var(--ws-text-secondary)]">{b.label}</span>
                  <span className="text-xs text-[var(--ws-text-tertiary)]">{b.count} invoices</span>
                  <span className="w-28 text-right text-sm font-semibold text-[var(--warning)]">${b.totalAmount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
