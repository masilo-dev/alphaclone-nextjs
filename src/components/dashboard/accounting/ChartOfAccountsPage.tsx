'use client';

import React, { useState, useEffect } from 'react';
import { ChartOfAccount, chartOfAccountsService, AccountType } from '../../../services/accounting/chartOfAccountsService';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenant } from '../../../contexts/TenantContext';

export function ChartOfAccountsPage() {
    const { user } = useAuth();
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

    useEffect(() => {
        if (currentTenant) {
            loadAccounts();
        }
    }, [currentTenant, filterType, showInactive]);

    const loadAccounts = async () => {
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
    };

    const handleCreate = async () => {
        const { account, error: err } = await chartOfAccountsService.createAccount(formData);

        if (err) {
            alert(`Error creating account: ${err}`);
        } else {
            setShowCreateModal(false);
            resetForm();
            loadAccounts();
        }
    };

    const handleUpdate = async () => {
        if (!editingAccount) return;

        const { account, error: err } = await chartOfAccountsService.updateAccount(editingAccount.id, formData);

        if (err) {
            alert(`Error updating account: ${err}`);
        } else {
            setEditingAccount(null);
            resetForm();
            loadAccounts();
        }
    };

    const handleDelete = async (accountId: string) => {
        if (!confirm('Are you sure you want to delete this account?')) return;

        const { error: err } = await chartOfAccountsService.deleteAccount(accountId);

        if (err) {
            alert(`Error deleting account: ${err}`);
        } else {
            loadAccounts();
        }
    };

    const handleInitializeDefaults = async () => {
        if (!confirm('Initialize default chart of accounts? This will create 20+ standard accounts.')) return;

        const { success, error: err } = await chartOfAccountsService.initializeDefaultAccounts();

        if (err) {
            alert(`Error initializing accounts: ${err}`);
        } else {
            alert('Default accounts created successfully!');
            loadAccounts();
        }
    };

    const resetForm = () => {
        setFormData({
            accountCode: '',
            accountName: '',
            accountType: 'asset',
            description: '',
            normalBalance: 'debit',
        });
    };

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

    // Group accounts by type
    const groupedAccounts = filteredAccounts.reduce((acc, account) => {
        if (!acc[account.accountType]) {
            acc[account.accountType] = [];
        }
        acc[account.accountType].push(account);
        return acc;
    }, {} as Record<AccountType, ChartOfAccount[]>);

    const accountTypeLabels: Record<AccountType, string> = {
        asset: 'Assets',
        liability: 'Liabilities',
        equity: 'Equity',
        revenue: 'Revenue',
        expense: 'Expenses',
        other_income: 'Other Income',
        other_expense: 'Other Expenses',
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-slate-300">Loading accounts...</div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Chart of Accounts</h1>
                    <p className="text-slate-300 mt-1">Manage your accounting accounts</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    {accounts.length === 0 && (
                        <button
                            onClick={handleInitializeDefaults}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Initialize Default Accounts
                        </button>
                    )}
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                        + New Account
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-900/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-4">
                    {error}
                </div>
            )}

            {/* Filters */}
            <div className="bg-slate-800 rounded-lg shadow-sm p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <input
                            type="text"
                            placeholder="Search accounts..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as AccountType | 'all')}
                            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                            <option value="all">All Types</option>
                            <option value="asset">Assets</option>
                            <option value="liability">Liabilities</option>
                            <option value="equity">Equity</option>
                            <option value="revenue">Revenue</option>
                            <option value="expense">Expenses</option>
                            <option value="other_income">Other Income</option>
                            <option value="other_expense">Other Expenses</option>
                        </select>
                    </div>
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="showInactive"
                            checked={showInactive}
                            onChange={(e) => setShowInactive(e.target.checked)}
                            className="mr-2 rounded border-slate-600"
                        />
                        <label htmlFor="showInactive" className="text-slate-300">
                            Show inactive accounts
                        </label>
                    </div>
                </div>
            </div>

            {/* Accounts List */}
            <div className="space-y-6">
                {Object.entries(groupedAccounts).map(([type, accountList]) => (
                    <div key={type} className="bg-slate-800 rounded-lg shadow-sm overflow-hidden">
                        <div className="bg-slate-900 px-6 py-3 border-b border-slate-700">
                            <h2 className="text-lg font-semibold text-white">
                                {accountTypeLabels[type as AccountType]}
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-700">
                                <thead className="bg-slate-900">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Code</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Account Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Type</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase">Balance</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-slate-800 divide-y divide-slate-700">
                                    {accountList.map((account) => (
                                        <tr key={account.id} className={!account.isActive ? 'bg-slate-900/50 opacity-60' : ''}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                                                {account.accountCode}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-200">
                                                {account.accountName}
                                                {account.isSystemAccount && (
                                                    <span className="ml-2 text-xs text-blue-400">(System)</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                                {account.normalBalance === 'debit' ? 'DR' : 'CR'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-white font-mono">
                                                ${account.currentBalance.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                    account.isActive ? 'bg-green-900/50 text-green-300' : 'bg-slate-700 text-slate-400'
                                                }`}>
                                                    {account.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => openEditModal(account)}
                                                    className="text-blue-400 hover:text-blue-300 mr-3 transition-colors"
                                                >
                                                    Edit
                                                </button>
                                                {!account.isSystemAccount && (
                                                    <button
                                                        onClick={() => handleDelete(account.id)}
                                                        className="text-red-400 hover:text-red-300 transition-colors"
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>

            {filteredAccounts.length === 0 && (
                <div className="text-center py-12 bg-slate-800 rounded-lg shadow-sm">
                    <p className="text-slate-300">No accounts found</p>
                    {accounts.length === 0 && (
                        <button
                            onClick={handleInitializeDefaults}
                            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Initialize Default Accounts
                        </button>
                    )}
                </div>
            )}

            {/* Create/Edit Modal */}
            {(showCreateModal || editingAccount) && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-white mb-4">
                            {editingAccount ? 'Edit Account' : 'Create New Account'}
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Account Code *
                                </label>
                                <input
                                    type="text"
                                    value={formData.accountCode}
                                    onChange={(e) => setFormData({ ...formData, accountCode: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder="e.g., 1000"
                                    disabled={editingAccount?.isSystemAccount}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Account Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.accountName}
                                    onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    placeholder="e.g., Cash"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Account Type *
                                </label>
                                <select
                                    value={formData.accountType}
                                    onChange={(e) => setFormData({ ...formData, accountType: e.target.value as AccountType })}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                >
                                    <option value="asset">Asset</option>
                                    <option value="liability">Liability</option>
                                    <option value="equity">Equity</option>
                                    <option value="revenue">Revenue</option>
                                    <option value="expense">Expense</option>
                                    <option value="other_income">Other Income</option>
                                    <option value="other_expense">Other Expense</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Normal Balance *
                                </label>
                                <select
                                    value={formData.normalBalance}
                                    onChange={(e) => setFormData({ ...formData, normalBalance: e.target.value as 'debit' | 'credit' })}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                >
                                    <option value="debit">Debit</option>
                                    <option value="credit">Credit</option>
                                </select>
                                <p className="text-xs text-slate-400 mt-1">
                                    Assets, Expenses: Debit | Liabilities, Equity, Revenue: Credit
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    rows={3}
                                    placeholder="Optional description..."
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setEditingAccount(null);
                                    resetForm();
                                }}
                                className="flex-1 px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={editingAccount ? handleUpdate : handleCreate}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                {editingAccount ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
