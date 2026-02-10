'use client';

import React, { useState, useEffect } from 'react';
import {
    JournalEntry,
    JournalEntryWithLines,
    journalEntryService,
    JournalStatus,
} from '../../../services/accounting/journalEntryService';
import { ChartOfAccount, chartOfAccountsService } from '../../../services/accounting/chartOfAccountsService';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenant } from '../../../contexts/TenantContext';

export function JournalEntriesPage() {
    const { user } = useAuth();
    const { currentTenant } = useTenant();
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<JournalStatus | 'all'>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [viewingEntry, setViewingEntry] = useState<JournalEntryWithLines | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        entryDate: new Date().toISOString().split('T')[0],
        description: '',
        reference: '',
        lines: [
            { accountId: '', debitAmount: 0, creditAmount: 0, description: '' },
            { accountId: '', debitAmount: 0, creditAmount: 0, description: '' },
        ],
    });

    useEffect(() => {
        if (currentTenant) {
            loadEntries();
            loadAccounts();
        }
    }, [currentTenant, filterStatus]);

    const loadEntries = async () => {
        setLoading(true);
        setError(null);

        const filters: any = {};
        if (filterStatus !== 'all') {
            filters.status = filterStatus;
        }

        const { entries: data, error: err } = await journalEntryService.getEntries(filters);

        if (err) {
            setError(err);
        } else {
            setEntries(data);
        }

        setLoading(false);
    };

    const loadAccounts = async () => {
        const { accounts: data } = await chartOfAccountsService.getAccounts({ isActive: true });
        setAccounts(data);
    };

    const handleViewEntry = async (entryId: string) => {
        const { entry, error: err } = await journalEntryService.getEntry(entryId);

        if (err) {
            alert(`Error loading entry: ${err}`);
        } else {
            setViewingEntry(entry);
        }
    };

    const handleCreate = async () => {
        // Validate lines
        const totalDebits = formData.lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
        const totalCredits = formData.lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);

        if (Math.abs(totalDebits - totalCredits) > 0.01) {
            alert(`Entry not balanced! Debits: $${totalDebits.toFixed(2)}, Credits: $${totalCredits.toFixed(2)}`);
            return;
        }

        const { entry, error: err } = await journalEntryService.createEntry({
            entryDate: formData.entryDate,
            description: formData.description,
            reference: formData.reference || undefined,
            lines: formData.lines.filter(line => line.accountId),
        });

        if (err) {
            alert(`Error creating entry: ${err}`);
        } else {
            // Auto-post the entry
            if (entry) {
                const { success, error: postErr } = await journalEntryService.postEntry(entry.id);
                if (postErr) {
                    alert(`Entry created but posting failed: ${postErr}`);
                }
            }

            setShowCreateModal(false);
            resetForm();
            loadEntries();
        }
    };

    const handlePost = async (entryId: string) => {
        if (!confirm('Post this journal entry? This action cannot be undone.')) return;

        const { success, error: err } = await journalEntryService.postEntry(entryId);

        if (err) {
            alert(`Error posting entry: ${err}`);
        } else {
            alert('Entry posted successfully!');
            loadEntries();
        }
    };

    const handleVoid = async (entryId: string) => {
        const reason = prompt('Enter reason for voiding this entry:');
        if (!reason) return;

        const { reversingEntryId, error: err } = await journalEntryService.voidEntry(entryId, reason);

        if (err) {
            alert(`Error voiding entry: ${err}`);
        } else {
            alert(`Entry voided. Reversing entry created: ${reversingEntryId}`);
            loadEntries();
        }
    };

    const handleDelete = async (entryId: string) => {
        if (!confirm('Delete this draft entry?')) return;

        const { error: err } = await journalEntryService.deleteEntry(entryId);

        if (err) {
            alert(`Error deleting entry: ${err}`);
        } else {
            loadEntries();
        }
    };

    const resetForm = () => {
        setFormData({
            entryDate: new Date().toISOString().split('T')[0],
            description: '',
            reference: '',
            lines: [
                { accountId: '', debitAmount: 0, creditAmount: 0, description: '' },
                { accountId: '', debitAmount: 0, creditAmount: 0, description: '' },
            ],
        });
    };

    const addLine = () => {
        setFormData({
            ...formData,
            lines: [...formData.lines, { accountId: '', debitAmount: 0, creditAmount: 0, description: '' }],
        });
    };

    const removeLine = (index: number) => {
        const newLines = formData.lines.filter((_, i) => i !== index);
        setFormData({ ...formData, lines: newLines });
    };

    const updateLine = (index: number, field: string, value: any) => {
        const newLines = [...formData.lines];
        (newLines[index] as any)[field] = value;
        setFormData({ ...formData, lines: newLines });
    };

    const totalDebits = formData.lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
    const totalCredits = formData.lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-600">Loading journal entries...</div>
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Journal Entries</h1>
                    <p className="text-gray-600 mt-1">Record manual accounting transactions</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                    + New Entry
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                    {error}
                </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                <div className="flex gap-4">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as JournalStatus | 'all')}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="posted">Posted</option>
                        <option value="void">Voided</option>
                    </select>
                </div>
            </div>

            {/* Entries List */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entry #</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debits</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credits</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {entries.map((entry) => (
                                <tr key={entry.id} className={entry.status === 'void' ? 'bg-gray-50 opacity-60' : ''}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {entry.entryNumber}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {new Date(entry.entryDate).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900">
                                        {entry.description}
                                        {entry.reference && (
                                            <span className="ml-2 text-xs text-gray-500">({entry.reference})</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-mono">
                                        ${entry.totalDebits.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-mono">
                                        ${entry.totalCredits.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            entry.status === 'posted'
                                                ? 'bg-green-100 text-green-800'
                                                : entry.status === 'void'
                                                ? 'bg-red-100 text-red-800'
                                                : 'bg-yellow-100 text-yellow-800'
                                        }`}>
                                            {entry.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => handleViewEntry(entry.id)}
                                            className="text-blue-600 hover:text-blue-900 mr-3"
                                        >
                                            View
                                        </button>
                                        {entry.status === 'draft' && (
                                            <>
                                                <button
                                                    onClick={() => handlePost(entry.id)}
                                                    className="text-green-600 hover:text-green-900 mr-3"
                                                >
                                                    Post
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(entry.id)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    Delete
                                                </button>
                                            </>
                                        )}
                                        {entry.status === 'posted' && (
                                            <button
                                                onClick={() => handleVoid(entry.id)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                Void
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {entries.length === 0 && (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                    <p className="text-gray-500">No journal entries found</p>
                </div>
            )}

            {/* Create Entry Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl my-8">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Create Journal Entry</h2>

                        <div className="space-y-4 mb-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.entryDate}
                                        onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Reference
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.reference}
                                        onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g., INV-001"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description *
                                </label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g., Record monthly rent expense"
                                />
                            </div>
                        </div>

                        {/* Entry Lines */}
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-lg font-semibold text-gray-900">Entry Lines</h3>
                                <button
                                    onClick={addLine}
                                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                >
                                    + Add Line
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Debit</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Credit</th>
                                            <th className="px-3 py-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {formData.lines.map((line, index) => (
                                            <tr key={index}>
                                                <td className="px-3 py-2">
                                                    <select
                                                        value={line.accountId}
                                                        onChange={(e) => updateLine(index, 'accountId', e.target.value)}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                    >
                                                        <option value="">Select account...</option>
                                                        {accounts.map(account => (
                                                            <option key={account.id} value={account.id}>
                                                                {account.accountCode} - {account.accountName}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="text"
                                                        value={line.description}
                                                        onChange={(e) => updateLine(index, 'description', e.target.value)}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                        placeholder="Line description..."
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={line.debitAmount || ''}
                                                        onChange={(e) => {
                                                            updateLine(index, 'debitAmount', parseFloat(e.target.value) || 0);
                                                            updateLine(index, 'creditAmount', 0);
                                                        }}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right"
                                                        placeholder="0.00"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={line.creditAmount || ''}
                                                        onChange={(e) => {
                                                            updateLine(index, 'creditAmount', parseFloat(e.target.value) || 0);
                                                            updateLine(index, 'debitAmount', 0);
                                                        }}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right"
                                                        placeholder="0.00"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    {formData.lines.length > 2 && (
                                                        <button
                                                            onClick={() => removeLine(index)}
                                                            className="text-red-600 hover:text-red-900 text-sm"
                                                        >
                                                            Remove
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50">
                                        <tr>
                                            <td colSpan={2} className="px-3 py-2 text-right font-semibold">Totals:</td>
                                            <td className="px-3 py-2 text-right font-mono font-semibold">
                                                ${totalDebits.toFixed(2)}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono font-semibold">
                                                ${totalCredits.toFixed(2)}
                                            </td>
                                            <td className="px-3 py-2"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={5} className="px-3 py-2 text-center">
                                                {isBalanced ? (
                                                    <span className="text-green-600 font-semibold">✓ Entry is balanced</span>
                                                ) : (
                                                    <span className="text-red-600 font-semibold">
                                                        ⚠ Entry not balanced (difference: ${Math.abs(totalDebits - totalCredits).toFixed(2)})
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    resetForm();
                                }}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={!isBalanced}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Create & Post Entry
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Entry Modal */}
            {viewingEntry && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">
                            Journal Entry: {viewingEntry.entryNumber}
                        </h2>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <p className="text-sm text-gray-600">Date</p>
                                <p className="font-medium">{new Date(viewingEntry.entryDate).toLocaleDateString()}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Status</p>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    viewingEntry.status === 'posted'
                                        ? 'bg-green-100 text-green-800'
                                        : viewingEntry.status === 'void'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                    {viewingEntry.status.toUpperCase()}
                                </span>
                            </div>
                            <div className="col-span-2">
                                <p className="text-sm text-gray-600">Description</p>
                                <p className="font-medium">{viewingEntry.description}</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto mb-6">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Debit</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Credit</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {viewingEntry.lines.map((line) => (
                                        <tr key={line.id}>
                                            <td className="px-4 py-2 text-sm">
                                                {line.accountCode} - {line.accountName}
                                            </td>
                                            <td className="px-4 py-2 text-sm">{line.description}</td>
                                            <td className="px-4 py-2 text-sm text-right font-mono">
                                                {line.debitAmount > 0 ? `$${line.debitAmount.toFixed(2)}` : '-'}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-right font-mono">
                                                {line.creditAmount > 0 ? `$${line.creditAmount.toFixed(2)}` : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-50">
                                    <tr>
                                        <td colSpan={2} className="px-4 py-2 text-right font-semibold">Totals:</td>
                                        <td className="px-4 py-2 text-right font-mono font-semibold">
                                            ${viewingEntry.totalDebits.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono font-semibold">
                                            ${viewingEntry.totalCredits.toFixed(2)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <button
                            onClick={() => setViewingEntry(null)}
                            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
