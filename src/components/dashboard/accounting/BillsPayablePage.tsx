'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Receipt, Loader2 } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import {
  accountingManagementClient,
  type VendorBill,
  type ApAgingRow,
} from '@/services/accounting/accountingManagementClient';
import ListViewToolbar from '../crm/ListViewToolbar';
import EmptyState from '@/components/ui/EmptyState';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
];

export default function BillsPayablePage() {
  const { currentTenant } = useTenant();
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [aging, setAging] = useState<ApAgingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      const [billsRes, agingRes] = await Promise.all([
        accountingManagementClient.getBills(1, 100, filter === 'all' ? undefined : filter),
        accountingManagementClient.getApAging(),
      ]);
      setBills(billsRes.data?.bills || []);
      setAging(agingRes.data?.aging || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = bills.filter((b) =>
    !search || (b.vendor_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 space-y-4 overflow-y-auto pb-24">
      {aging.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {aging.slice(0, 4).map((a, i) => (
            <div key={i} className="bg-slate-900 border border-white/5 rounded-xl p-3">
              <div className="text-xs text-slate-500">{a.bucket || 'Bucket'}</div>
              <div className="text-lg font-bold text-violet-400">${Number(a.amount || 0).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      <ListViewToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search vendors..."
        filters={STATUS_FILTERS}
        activeFilter={filter}
        onFilterChange={setFilter}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No bills to pay"
          description="Vendor bills and accounts payable will appear here when recorded."
        />
      ) : (
        <div className="bg-slate-900 border border-white/5 rounded-2xl divide-y divide-white/5">
          {filtered.map((b) => (
            <div key={b.id} className="px-4 py-3 flex justify-between items-center">
              <div>
                <div className="text-sm font-bold text-white">{b.vendor_name || 'Vendor'}</div>
                <div className="text-xs text-slate-500">Due {b.due_date || '—'}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-teal-400">${Number(b.total || 0).toLocaleString()}</div>
                <div className="text-xs text-slate-500 capitalize">{b.status}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
