'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { ModulePageLayout } from '@/components/ui/ModulePageLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  MobileDataCard,
  ResponsiveTableDesktop,
  ResponsiveTableMobile,
} from '@/components/ui/ResponsiveTable';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/lib/supabase';
import { useCurrency } from '@/hooks/useCurrency';
import Link from 'next/link';

type VendorRow = {
  vendor_name: string;
  bill_count: number;
  open_total: number;
  last_bill_at: string | null;
};

export default function VendorsTab() {
  const { currentTenant } = useTenant();
  const { format } = useCurrency();
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('vendor_bills')
      .select('vendor_id, total_amount, status, due_date, created_at, contacts(first_name, last_name)')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error(error);
      setVendors([]);
      setLoading(false);
      return;
    }

    const map = new Map<string, VendorRow>();
    for (const row of (data as any[]) || []) {
      const contact = row.contacts as { first_name?: string; last_name?: string } | null;
      const name = contact
        ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Unknown vendor'
        : 'Unknown vendor';
      const existing = map.get(name) || {
        vendor_name: name,
        bill_count: 0,
        open_total: 0,
        last_bill_at: null,
      };
      existing.bill_count += 1;
      if (String(row.status).toLowerCase() !== 'paid') {
        existing.open_total += Number(row.total_amount || 0);
      }
      if (!existing.last_bill_at || row.created_at > existing.last_bill_at) {
        existing.last_bill_at = row.created_at;
      }
      map.set(name, existing);
    }
    setVendors([...map.values()].sort((a, b) => b.open_total - a.open_total));
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => { void load(); }, [load]);

  return (
    <ModulePageLayout
      header={
        <div className="px-1 pb-2 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-white">Vendors & Suppliers</h1>
            <p className="text-sm text-slate-400">AP vendors rolled up from bills payable</p>
          </div>
          <Link
            href="/dashboard/accounting/bills"
            className="text-xs font-semibold text-teal-400 hover:text-teal-300"
          >
            Open bills payable →
          </Link>
        </div>
      }
    >
      <div className="ac-scroll-full pb-24">
        {loading ? (
          <p className="text-sm text-slate-500 p-4">Loading vendors…</p>
        ) : vendors.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No vendors yet"
            description="Add bills in Accounting → Bills Payable to see vendor rollups here."
            actionLabel="Open bills payable"
            onAction={() => { window.location.href = '/dashboard/accounting/bills'; }}
          />
        ) : (
          <>
            <ResponsiveTableMobile>
              {vendors.map((v) => (
                <MobileDataCard key={v.vendor_name} className="ac-workspace-panel">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[var(--ws-active)] flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-teal-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-white truncate">{v.vendor_name}</p>
                      <p className="text-[11px] text-[var(--ws-text-tertiary)]">{v.bill_count} bill{v.bill_count === 1 ? '' : 's'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-amber-300">{format(v.open_total)}</p>
                      <p className="text-[10px] text-[var(--ws-text-tertiary)] uppercase">Open AP</p>
                    </div>
                  </div>
                </MobileDataCard>
              ))}
            </ResponsiveTableMobile>
            <ResponsiveTableDesktop className="ac-workspace-panel overflow-hidden">
              <table className="w-full min-w-[560px] text-sm ac-data-table">
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Bills</th>
                    <th className="text-right">Open AP</th>
                    <th>Last bill</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v) => (
                    <tr key={v.vendor_name}>
                      <td className="font-medium text-white">{v.vendor_name}</td>
                      <td className="text-[var(--ws-text-secondary)]">{v.bill_count}</td>
                      <td className="text-right font-semibold text-amber-300">{format(v.open_total)}</td>
                      <td className="text-[var(--ws-text-tertiary)] text-xs">
                        {v.last_bill_at ? new Date(v.last_bill_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTableDesktop>
          </>
        )}
      </div>
    </ModulePageLayout>
  );
}
