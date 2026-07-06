'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { ChartOfAccount, chartOfAccountsService, AccountType } from '../../../services/accounting/chartOfAccountsService';
import { useTenant } from '../../../contexts/TenantContext';
import { ModulePageLayout } from '../../ui/ModulePageLayout';
import { DetailDrawer } from '../../ui/DetailDrawer';
import { EnterpriseDataTable, type EnterpriseColumn } from '../../ui/EnterpriseDataTable';
import { StatusBadge } from '../../ui/StatusBadge';
import { Input } from '../../ui/UIComponents';

export function ChartOfAccountsPage() {
    const { currentTenant } = useTenant();
    const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<AccountType | 'all'>('all');
    const [showInactive, setShowInactive] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        accountCode: '',
        accountName: '',
        accountType: 'asset' as AccountType,
        description: '',
        normalBalance: 'debit' as 'debit' | 'credit',
    });

    const loadAccounts = useCallback(async () => {
        setLoading(true);
        setError(null);

        const filters: any = {};
        if (filterType !== 'all') {
            filters.accountType = filterType;
        }
        if (!showInactive) {
            filters.isActive = true;
        }

        const { accounts: data, error: err } = await chartOfAccountsService.getAccounts(filters);

        if (err) {
            setError(err);
        } else {
            setAccounts(data);
        }

        setLoading(false);
    }, [filterType, showInactive]);

    const resetForm = useCallback(() => {
        setFormData({
            accountCode: '',
            accountName: '',
            accountType: 'asset',
            description: '',
            normalBalance: 'debit',
        });
    }, []);

    useEffect(() => {
        if (currentTenant) {
            loadAccounts();
        }
    }, [currentTenant, loadAccounts]);

    const handleCreate = useCallback(async () => {
        const { account, error: err } = await chartOfAccountsService.createAccount(formData);

        if (err) {
            toast.error(`Error creating account: ${err}`);
        } else {
            setShowCreateModal(false);
            resetForm();
            loadAccounts();
        }
    }, [formData, loadAccounts]);

    const handleUpdate = useCallback(async () => {
        if (!editingAccount) return;

        const { account, error: err } = await chartOfAccountsService.updateAccount(editingAccount.id, formData);

        if (err) {
            toast.error(`Error updating account: ${err}`);
        } else {
            setEditingAccount(null);
            resetForm();
            loadAccounts();
        }
    }, [editingAccount, formData, loadAccounts]);

    const handleDelete = useCallback(async (accountId: string) => {
        if (!confirm('Are you sure you want to delete this account?')) return;

        const { error: err } = await chartOfAccountsService.deleteAccount(accountId);

        if (err) {
            toast.error(`Error deleting account: ${err}`);
        } else {
            loadAccounts();
        }
    }, [loadAccounts]);

    const handleInitializeDefaults = useCallback(async () => {
        if (!confirm('Initialize default chart of accounts? This will create 20+ standard accounts.')) return;

        const { success, error: err } = await chartOfAccountsService.initializeDefaultAccounts();

        if (err) {
            toast.error(`Error initializing accounts: ${err}`);
        } else {
            toast.success('Default accounts created successfully!');
            loadAccounts();
        }
    }, [loadAccounts]);


    const openEditModal = (account: ChartOfAccount) => {
        setEditingAccount(account);
        setFormData({
            accountCode: account.accountCode,
            accountName: account.accountName,
            accountType: account.accountType,
            description: account.description || '',
            normalBalance: account.normalBalance,
        });
    };

    const filteredAccounts = accounts.filter(account => {
        const matchesSearch =
            account.accountCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            account.accountName.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    // Group accounts by type (legacy helper removed — table is flat via EnterpriseDataTable)

    const accountTypeLabels: Record<AccountType, string> = {
        asset: 'Assets',
        liability: 'Liabilities',
        equity: 'Equity',
        revenue: 'Revenue',
        expense: 'Expenses',
        other_income: 'Other Income',
        other_expense: 'Other Expenses',
    };

    const accountColumns = useMemo<EnterpriseColumn<ChartOfAccount>[]>(() => [
        {
            id: 'code',
            header: 'Code',
            mobilePrimary: true,
            sortable: true,
            sortValue: (a) => a.accountCode,
            accessor: (a) => (
                <div>
                    <span className="text-[13px] font-bold text-white font-mono block">{a.accountCode}</span>
                    {a.isSystemAccount && <span className="text-[10px] text-cyan-300">System</span>}
                </div>
            ),
        },
        {
            id: 'name',
            header: 'Account',
            sortable: true,
            sortValue: (a) => a.accountName,
            accessor: (a) => a.accountName,
        },
        {
            id: 'type',
            header: 'Type',
            accessor: (a) => <span className="capitalize text-slate-300">{accountTypeLabels[a.accountType]}</span>,
        },
        {
            id: 'balance',
            header: 'Balance',
            sortable: true,
            sortValue: (a) => a.currentBalance,
            accessor: (a) => <span className="font-mono">${a.currentBalance.toFixed(2)}</span>,
        },
        {
            id: 'status',
            header: 'Status',
            accessor: (a) => (
                <StatusBadge variant={a.isActive ? 'success' : 'neutral'}>
                    {a.isActive ? 'Active' : 'Inactive'}
                </StatusBadge>
            ),
        },
    ], []);

    const drawerOpen = showCreateModal || Boolean(editingAccount);

    const closeDrawer = () => {
        setShowCreateModal(false);
        setEditingAccount(null);
        resetForm();
    };

    return (
        <div className="relative flex flex-col min-h-0 ac-scroll-full ac-enterprise-module">
            <ModulePageLayout
                header={(
                    <div className="px-1 pb-2">
                        <h1 className="text-lg font-semibold text-white">Chart of Accounts</h1>
                        <p className="text-sm text-slate-300">Manage your accounting accounts</p>
                    </div>
                )}
                toolbar={(
                    <div className="flex flex-wrap gap-3 items-center px-1 py-2">
                        <input
                            type="text"
                            placeholder="Search accounts..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 min-w-[180px] px-3 py-2 bg-slate-900 border border-white/5 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                        />
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as AccountType | 'all')}
                            className="px-3 py-2 bg-slate-900 border border-white/5 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/50"
                        >
                            <option value="all">All types</option>
                            {Object.entries(accountTypeLabels).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                        <label className="flex items-center gap-2 text-sm text-slate-300">
                            <input
                                type="checkbox"
                                checked={showInactive}
                                onChange={(e) => setShowInactive(e.target.checked)}
                                className="rounded border-slate-600"
                            />
                            Show inactive
                        </label>
                        <button
                            type="button"
                            onClick={handleInitializeDefaults}
                            className="px-3 py-2 rounded-xl border border-white/10 text-slate-300 text-xs font-bold hover:bg-white/5"
                        >
                            Initialize defaults
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowCreateModal(true)}
                            className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500"
                        >
                            + New account
                        </button>
                    </div>
                )}
            >
                {error && (
                    <div className="mx-2 mb-3 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
                        {error}
                    </div>
                )}
                <div className="px-2 pb-20">
                    {loading ? (
                        <div className="divide-y divide-white/5">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-900/40 animate-pulse" />)}</div>
                    ) : (
                        <EnterpriseDataTable
                            columns={accountColumns}
                            data={filteredAccounts}
                            getRowId={(a) => a.id}
                            onRowClick={openEditModal}
                            emptyMessage={accounts.length === 0 ? 'No accounts yet. Initialize defaults or create your first account.' : 'No accounts match your filters.'}
                        />
                    )}
                </div>
            </ModulePageLayout>

            <DetailDrawer
                open={drawerOpen}
                onOpenChange={(open) => { if (!open) closeDrawer(); }}
                title={editingAccount ? 'Edit account' : 'Create account'}
            >
                <div className="space-y-4 pb-6">
                    <Input
                        label="Account code"
                        value={formData.accountCode}
                        onChange={(e) => setFormData({ ...formData, accountCode: e.target.value })}
                        placeholder="e.g. 1000"
                        disabled={editingAccount?.isSystemAccount}
                        validate={(v) => !v.trim() ? 'Account code is required' : undefined}
                    />
                    <Input
                        label="Account name"
                        value={formData.accountName}
                        onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                        placeholder="e.g. Cash"
                        validate={(v) => !v.trim() ? 'Account name is required' : undefined}
                    />
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Account type</label>
                        <select
                            value={formData.accountType}
                            onChange={(e) => setFormData({ ...formData, accountType: e.target.value as AccountType })}
                            className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500/50"
                        >
                            {Object.entries(accountTypeLabels).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Normal balance</label>
                        <select
                            value={formData.normalBalance}
                            onChange={(e) => setFormData({ ...formData, normalBalance: e.target.value as 'debit' | 'credit' })}
                            className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500/50"
                        >
                            <option value="debit">Debit</option>
                            <option value="credit">Credit</option>
                        </select>
                    </div>
                    <Input
                        label="Description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Optional notes"
                    />
                    <div className="flex gap-2 pt-2">
                        <button
                            type="button"
                            onClick={closeDrawer}
                            className="flex-1 min-h-11 rounded-xl border border-white/10 text-slate-300 text-sm font-semibold"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={editingAccount ? handleUpdate : handleCreate}
                            className="flex-1 min-h-11 rounded-xl bg-emerald-600 text-white text-sm font-semibold"
                        >
                            {editingAccount ? 'Save changes' : 'Create account'}
                        </button>
                    </div>
                    {editingAccount && !editingAccount.isSystemAccount && (
                        <button
                            type="button"
                            onClick={() => {
                                handleDelete(editingAccount.id);
                                closeDrawer();
                            }}
                            className="w-full min-h-11 rounded-xl border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/10"
                        >
                            Delete account
                        </button>
                    )}
                </div>
            </DetailDrawer>
        </div>
    );
}
