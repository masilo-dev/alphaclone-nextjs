'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Landmark, RefreshCw, Loader2, Plus } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import {
  accountingManagementClient,
  type BankAccount,
  type ReconciliationSession,
} from '@/services/accounting/accountingManagementClient';
import EmptyState from '@/components/ui/EmptyState';
import toast from 'react-hot-toast';

export default function BankingCenterPage() {
  const { currentTenant } = useTenant();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [sessions, setSessions] = useState<ReconciliationSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      const [accRes, sessRes] = await Promise.all([
        accountingManagementClient.getBankAccounts(),
        accountingManagementClient.getReconciliationSessions(),
      ]);
      setAccounts(accRes.data?.accounts || []);
      setSessions(sessRes.data?.sessions || []);
    } catch (e) {
      toast.error('Failed to load banking data');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const startReconciliation = async (accountId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      await accountingManagementClient.createReconciliationSession({
        bankAccountId: accountId,
        statementStartDate: monthStart,
        statementEndDate: today,
        statementEndingBalance: 0,
        status: 'in_progress',
      });
      toast.success('Reconciliation session started');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to start reconciliation');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 overflow-y-auto pb-24">
      <div className="flex justify-end">
        <button onClick={load} className="p-2 rounded-xl border border-white/5 text-slate-400 hover:text-teal-400">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No bank accounts"
          description="Connect a bank account to reconcile transactions and match payments to invoices."
          actionLabel="Add bank account"
          onAction={() => toast('Bank account setup uses accounting API — add via MCP or admin')}
        />
      ) : (
        <div className="grid gap-3">
          {accounts.map((a) => (
            <div key={a.id} className="bg-slate-900 border border-white/5 rounded-2xl p-4 flex justify-between items-center">
              <div>
                <div className="font-bold text-white">{a.name}</div>
                <div className="text-xs text-slate-500 capitalize">{a.account_type || 'checking'}</div>
                <div className="text-lg font-bold text-teal-400 mt-1">
                  ${Number(a.current_balance || 0).toLocaleString()} {a.currency || 'USD'}
                </div>
              </div>
              <button
                onClick={() => startReconciliation(a.id)}
                className="h-9 px-3 rounded-xl bg-teal-500 text-white text-xs font-bold"
              >
                Reconcile
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <h3 className="text-sm font-bold text-white mb-3">Reconciliation history</h3>
        {sessions.length === 0 ? (
          <p className="text-sm text-slate-500">No reconciliation sessions yet.</p>
        ) : (
          <div className="bg-slate-900 border border-white/5 rounded-2xl divide-y divide-white/5">
            {sessions.map((s) => (
              <div key={s.id} className="px-4 py-3 flex justify-between text-sm">
                <span className="text-white">
                  {s.statement_start_date} → {s.statement_end_date}
                </span>
                <span className="text-teal-400 capitalize">{s.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
