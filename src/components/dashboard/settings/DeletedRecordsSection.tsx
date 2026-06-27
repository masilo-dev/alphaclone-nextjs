'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Archive, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';

type DeletedRecord = {
  id: string;
  name: string;
  email: string | null;
  deletedAt: string;
  type: 'contact' | 'client';
};

export default function DeletedRecordsSection() {
  const { currentTenant } = useTenant();
  const [records, setRecords] = useState<DeletedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/data/deleted-records?tenantId=${currentTenant.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setRecords([...(data.contacts || []), ...(data.clients || [])]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load deleted records');
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleAction = async (record: DeletedRecord, action: 'restore' | 'purge') => {
    if (!currentTenant?.id) return;
    if (action === 'purge' && !confirm(`Permanently delete ${record.name}? This cannot be undone.`)) {
      return;
    }
    setActing(`${action}-${record.id}`);
    try {
      const res = await fetch('/api/data/deleted-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          action,
          type: record.type,
          id: record.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      toast.success(action === 'restore' ? 'Record restored' : 'Record permanently deleted');
      await loadRecords();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
        </div>
      ) : records.length === 0 ? (
        <p className="text-xs text-slate-500 py-4 text-center">No deleted contacts or clients.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {records.map((record) => (
            <div
              key={`${record.type}-${record.id}`}
              className="flex items-center justify-between gap-3 p-3 bg-slate-950 rounded-xl border border-white/5"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{record.name}</p>
                <p className="text-[10px] text-slate-500 truncate">
                  {record.email || 'No email'} · {record.type} ·{' '}
                  {new Date(record.deletedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleAction(record, 'restore')}
                  disabled={acting !== null}
                  className="p-1.5 rounded-lg bg-teal-600/20 text-teal-400 hover:bg-teal-600/30 disabled:opacity-50"
                  title="Restore"
                >
                  {acting === `restore-${record.id}` ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                </button>
                {record.type === 'contact' && (
                  <button
                    onClick={() => handleAction(record, 'purge')}
                    disabled={acting !== null}
                    className="p-1.5 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 disabled:opacity-50"
                    title="Permanently delete"
                  >
                    {acting === `purge-${record.id}` ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
