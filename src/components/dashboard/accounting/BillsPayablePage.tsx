'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Receipt, Loader2, RefreshCcw } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [billsRes, agingRes] = await Promise.all([
        accountingManagementClient.getBills(1, 100, filter === 'all' ? undefined : filter),
        accountingManagementClient.getApAging(),
      ]);
      setBills(billsRes.data?.bills || []);
      setAging(agingRes.data?.aging || []);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Failed to load bills payable');
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
    <div className="p-4 space-y-4 pb-24 ac-scroll-full ac-enterprise-module">
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
        <div className="ac-workspace-panel rounded-lg min-h-[240px] flex items-center justify-center">
          <div className="flex items-center gap-3 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
            <span className="text-sm font-medium">Loading bills payable...</span>
          </div>
        </div>
      ) : error ? (
        <EmptyState
          icon={RefreshCcw}
          title="Bills workspace unavailable"
          description={`${error}. Retry to reload vendor balances and due dates.`}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No bills to pay"
          description={
            filter === 'all' && !search
              ? 'Vendor bills and accounts payable will appear here once expenses are captured. Add bills from purchases or receipts so due dates and cash commitments stay visible.'
              : 'No bills match your current filters. Clear the search or switch the status filter to review the full payables queue.'
          }
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
