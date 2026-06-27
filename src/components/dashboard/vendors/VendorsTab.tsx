'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { ModulePageLayout } from '@/components/ui/ModulePageLayout';
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
      .select('vendor_name, total_amount, status, due_date, created_at')
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
    for (const row of data || []) {
      const name = String(row.vendor_name || 'Unknown vendor').trim();
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
      <div className="grid gap-3 ac-scroll-full pb-24">
        {loading ? (
          <p className="text-sm text-slate-500 p-4">Loading vendors…</p>
        ) : vendors.length === 0 ? (
          <p className="text-sm text-slate-500 p-4">No vendor bills yet. Add bills in Accounting → Bills Payable.</p>
        ) : (
          vendors.map((v) => (
            <div key={v.vendor_name} className="bg-slate-900 border border-white/5 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-teal-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{v.vendor_name}</p>
                <p className="text-xs text-slate-500 mt-1">{v.bill_count} bill{v.bill_count === 1 ? '' : 's'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-amber-300">{format(v.open_total)}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Open AP</p>
              </div>
            </div>
          ))
        )}
      </div>
    </ModulePageLayout>
  );
}
