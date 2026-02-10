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
                <div className="text-gray-600">Loading accounts...</div>
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Chart of Accounts</h1>
                    <p className="text-gray-600 mt-1">Manage your accounting accounts</p>
                </div>
                <div className="flex gap-3">
                    {accounts.length === 0 && (
                        <button
                            onClick={handleInitializeDefaults}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            Initialize Default Accounts
                        </button>
                    )}
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                        + New Account
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                    {error}
                </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <input
                            type="text"
                            placeholder="Search accounts..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as AccountType | 'all')}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                            className="mr-2"
                        />
                        <label htmlFor="showInactive" className="text-gray-700">
                            Show inactive accounts
                        </label>
                    </div>
                </div>
            </div>

            {/* Accounts List */}
            <div className="space-y-6">
                {Object.entries(groupedAccounts).map(([type, accountList]) => (
                    <div key={type} className="bg-white rounded-lg shadow-sm overflow-hidden">
                        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-900">
                                {accountTypeLabels[type as AccountType]}
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {accountList.map((account) => (
                                        <tr key={account.id} className={!account.isActive ? 'bg-gray-50 opacity-60' : ''}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {account.accountCode}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {account.accountName}
                                                {account.isSystemAccount && (
                                                    <span className="ml-2 text-xs text-blue-600">(System)</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {account.normalBalance === 'debit' ? 'DR' : 'CR'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-mono">
                                                ${account.currentBalance.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                    account.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {account.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => openEditModal(account)}
                                                    className="text-blue-600 hover:text-blue-900 mr-3"
                                                >
                                                    Edit
                                                </button>
                                                {!account.isSystemAccount && (
                                                    <button
                                                        onClick={() => handleDelete(account.id)}
                                                        className="text-red-600 hover:text-red-900"
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
                <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                    <p className="text-gray-500">No accounts found</p>
                    {accounts.length === 0 && (
                        <button
                            onClick={handleInitializeDefaults}
                            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            Initialize Default Accounts
                        </button>
                    )}
                </div>
            )}

            {/* Create/Edit Modal */}
            {(showCreateModal || editingAccount) && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">
                            {editingAccount ? 'Edit Account' : 'Create New Account'}
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Account Code *
                                </label>
                                <input
                                    type="text"
                                    value={formData.accountCode}
                                    onChange={(e) => setFormData({ ...formData, accountCode: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g., 1000"
                                    disabled={editingAccount?.isSystemAccount}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Account Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.accountName}
                                    onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g., Cash"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Account Type *
                                </label>
                                <select
                                    value={formData.accountType}
                                    onChange={(e) => setFormData({ ...formData, accountType: e.target.value as AccountType })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Normal Balance *
                                </label>
                                <select
                                    value={formData.normalBalance}
                                    onChange={(e) => setFormData({ ...formData, normalBalance: e.target.value as 'debit' | 'credit' })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="debit">Debit</option>
                                    <option value="credit">Credit</option>
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    Assets, Expenses: Debit | Liabilities, Equity, Revenue: Credit
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={editingAccount ? handleUpdate : handleCreate}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
