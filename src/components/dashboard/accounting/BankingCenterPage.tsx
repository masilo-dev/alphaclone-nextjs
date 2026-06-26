'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Landmark, RefreshCw, Loader2, Plus, X } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import {
  accountingManagementClient,
  type BankAccount,
  type ReconciliationSession,
} from '@/services/accounting/accountingManagementClient';
import EmptyState from '@/components/ui/EmptyState';
import toast from 'react-hot-toast';

type AccountType = 'checking' | 'savings' | 'credit' | 'other';

const EMPTY_FORM = {
  name: '',
  bankName: '',
  accountNumberLast4: '',
  accountType: 'checking' as AccountType,
  currency: 'USD',
  openingBalance: '',
};

export default function BankingCenterPage() {
  const { currentTenant } = useTenant();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [sessions, setSessions] = useState<ReconciliationSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

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

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Account name is required');
      return;
    }
    setSaving(true);
    try {
      await accountingManagementClient.createBankAccount({
        name: form.name.trim(),
        bankName: form.bankName.trim() || undefined,
        accountNumberLast4: form.accountNumberLast4.trim() || undefined,
        accountType: form.accountType,
        currency: form.currency || 'USD',
        openingBalance: Number(form.openingBalance) || 0,
      });
      toast.success('Bank account added');
      setShowAddModal(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add bank account');
    } finally {
      setSaving(false);
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
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="h-9 px-3 rounded-xl bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Add account
        </button>
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
          onAction={() => setShowAddModal(true)}
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

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Add bank account</h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <label className="block">
                <span className="text-xs text-slate-400">Account name *</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-white text-sm"
                  placeholder="Operating checking"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-400">Bank name</span>
                <input
                  value={form.bankName}
                  onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-white text-sm"
                  placeholder="Chase"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-slate-400">Last 4 digits</span>
                  <input
                    maxLength={4}
                    value={form.accountNumberLast4}
                    onChange={(e) => setForm((f) => ({ ...f, accountNumberLast4: e.target.value.replace(/\D/g, '') }))}
                    className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-white text-sm"
                    placeholder="1234"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-400">Type</span>
                  <select
                    value={form.accountType}
                    onChange={(e) => setForm((f) => ({ ...f, accountType: e.target.value as AccountType }))}
                    className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-white text-sm"
                  >
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                    <option value="credit">Credit</option>
                    <option value="other">Other</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-slate-400">Opening balance</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.openingBalance}
                  onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-white text-sm"
                  placeholder="0.00"
                />
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 h-10 rounded-xl border border-white/10 text-slate-300 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 h-10 rounded-xl bg-teal-500 text-white text-sm font-bold disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Add account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
