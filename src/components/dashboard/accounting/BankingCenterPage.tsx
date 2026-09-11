'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Landmark, RefreshCw, Loader2, Plus } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import {
  accountingManagementClient,
  type BankAccount,
  type ReconciliationSession,
} from '@/services/accounting/accountingManagementClient';
import EmptyState from '@/components/ui/EmptyState';
import { ModulePageLayout } from '@/components/ui/ModulePageLayout';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { EnterpriseDataTable, type EnterpriseColumn } from '@/components/ui/EnterpriseDataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Input } from '@/components/ui/UIComponents';
import { ModuleStatCards, type ModuleStat } from '../common/ModuleStatCards';
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

function reconciliationVariant(status: string) {
  if (status === 'completed' || status === 'reconciled') return 'success' as const;
  if (status === 'in_progress') return 'info' as const;
  if (status === 'failed') return 'error' as const;
  return 'neutral' as const;
}

export default function BankingCenterPage() {
  const { currentTenant } = useTenant();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [sessions, setSessions] = useState<ReconciliationSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
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
      setShowAddDrawer(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add bank account');
    } finally {
      setSaving(false);
    }
  };

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.current_balance || 0), 0);
  const activeSessions = sessions.filter((s) => s.status === 'in_progress').length;

  const bankStats = useMemo<ModuleStat[]>(() => [
    { label: 'Bank accounts', value: accounts.length, Icon: Landmark, accent: 'teal' },
    { label: 'Total balance', value: `$${totalBalance.toLocaleString()}`, Icon: Landmark, accent: 'emerald' },
    { label: 'Reconciliations', value: sessions.length, sub: `${activeSessions} in progress`, Icon: RefreshCw, accent: 'sky' },
  ], [accounts.length, totalBalance, sessions.length, activeSessions]);

  const accountColumns = useMemo<EnterpriseColumn<BankAccount>[]>(() => [
    {
      id: 'name',
      header: 'Account',
      mobilePrimary: true,
      sortable: true,
      sortValue: (a) => a.name,
      accessor: (a) => (
        <div>
          <span className="text-[13px] font-bold text-white block">{a.name}</span>
          <span className="text-[11px] text-slate-500 capitalize">{a.account_type || 'checking'}</span>
        </div>
      ),
    },
    {
      id: 'balance',
      header: 'Balance',
      sortable: true,
      sortValue: (a) => Number(a.current_balance || 0),
      accessor: (a) => (
        <span className="font-mono text-teal-400">
          ${Number(a.current_balance || 0).toLocaleString()} {a.currency || 'USD'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      accessor: (a) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); void startReconciliation(a.id); }}
          className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-500"
        >
          Reconcile
        </button>
      ),
    },
  ], []);

  const sessionColumns = useMemo<EnterpriseColumn<ReconciliationSession>[]>(() => [
    {
      id: 'period',
      header: 'Period',
      mobilePrimary: true,
      sortable: true,
      sortValue: (s) => s.statement_start_date,
      accessor: (s) => (
        <span className="text-sm text-white">
          {s.statement_start_date} → {s.statement_end_date}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessor: (s) => (
        <StatusBadge variant={reconciliationVariant(s.status)}>
          {s.status.replace('_', ' ')}
        </StatusBadge>
      ),
    },
    {
      id: 'balance',
      header: 'Statement balance',
      accessor: (s) => `$${Number(s.statement_ending_balance || 0).toLocaleString()}`,
    },
  ], []);

  return (
    <div className="relative flex flex-col min-h-0 ac-scroll-full ac-enterprise-module">
      <ModulePageLayout
        header={(
          <div className="px-1 pb-2">
            <h1 className="text-lg font-semibold text-white">Banking Workspace</h1>
            <p className="text-sm text-slate-400">Track balances, manage accounts, and run reconciliations from one place.</p>
          </div>
        )}
        toolbar={(
          <div className="flex items-center gap-2 px-1 py-2">
            <button
              type="button"
              onClick={() => setShowAddDrawer(true)}
              className="h-9 px-3 rounded-xl bg-teal-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-teal-500"
            >
              <Plus className="w-4 h-4" />
              Add Bank Account
            </button>
            <button
              type="button"
              onClick={load}
              className="p-2 rounded-xl border border-white/5 text-slate-400 hover:text-teal-400"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
        stats={!loading ? (
          <div className="px-1">
            <ModuleStatCards stats={bankStats} />
          </div>
        ) : null}
      >
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="No bank accounts"
            description="Add your operating accounts to reconcile transactions and match payments against invoices."
            actionLabel="Add Bank Account"
            onAction={() => setShowAddDrawer(true)}
          />
        ) : (
          <div className="px-2 pb-6 space-y-6">
            <EnterpriseDataTable
              columns={accountColumns}
              data={accounts}
              getRowId={(a) => a.id}
              onRowClick={(a) => void startReconciliation(a.id)}
              emptyMessage="No bank accounts."
            />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 px-1">Reconciliation Sessions</h3>
              {sessions.length === 0 ? (
                <p className="text-sm text-slate-500 px-1">No reconciliation sessions yet.</p>
              ) : (
                <EnterpriseDataTable
                  columns={sessionColumns}
                  data={sessions}
                  getRowId={(s) => s.id}
                  emptyMessage="No sessions."
                />
              )}
            </div>
          </div>
        )}
      </ModulePageLayout>

      <DetailDrawer
        open={showAddDrawer}
        onOpenChange={setShowAddDrawer}
        title="Add Bank Account"
      >
        <form onSubmit={handleCreateAccount} className="space-y-4 pb-6">
          <Input
            label="Account name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Operating checking"
            validate={(v) => !v.trim() ? 'Account name is required' : undefined}
          />
          <Input
            label="Bank name"
            value={form.bankName}
            onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
            placeholder="Chase"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Last 4 digits"
              value={form.accountNumberLast4}
              onChange={(e) => setForm((f) => ({ ...f, accountNumberLast4: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
              placeholder="1234"
              validate={(v) => v.trim() && v.trim().length !== 4 ? 'Enter exactly 4 digits' : undefined}
            />
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Type</label>
              <select
                value={form.accountType}
                onChange={(e) => setForm((f) => ({ ...f, accountType: e.target.value as AccountType }))}
                className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500/50"
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="credit">Credit</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <Input
            label="Opening balance"
            type="number"
            step="0.01"
            value={form.openingBalance}
            onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))}
            placeholder="0.00"
          />
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddDrawer(false)}
              className="flex-1 min-h-11 rounded-xl border border-white/10 text-slate-300 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 min-h-11 rounded-xl bg-teal-600 text-white text-sm font-bold disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Add account'}
            </button>
          </div>
        </form>
      </DetailDrawer>
    </div>
  );
}
