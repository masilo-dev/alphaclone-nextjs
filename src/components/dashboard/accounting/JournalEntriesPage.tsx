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
import { JournalEntryModal } from './JournalEntryModal';

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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-slate-300">Loading journal entries...</div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Journal Entries</h1>
                    <p className="text-slate-300 mt-1">Record manual accounting transactions</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                    + New Entry
                </button>
            </div>

            {error && (
                <div className="bg-red-900/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-4">
                    {error}
                </div>
            )}

            {/* Filters */}
            <div className="bg-slate-800 rounded-lg shadow-sm p-4 mb-6">
                <div className="flex gap-4">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as JournalStatus | 'all')}
                        className="px-4 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                        <option value="all">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="posted">Posted</option>
                        <option value="void">Voided</option>
                    </select>
                </div>
            </div>

            {/* Entries List */}
            <div className="bg-slate-800 rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-700">
                        <thead className="bg-slate-900">
                            <tr>
                                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Entry #</th>
                                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Date</th>
                                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Description</th>
                                <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase">Debits</th>
                                <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase">Credits</th>
                                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                                <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-slate-800 divide-y divide-slate-700">
                            {entries.map((entry) => (
                                <tr key={entry.id} className={entry.status === 'void' ? 'bg-slate-900/50 opacity-60' : ''}>
                                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                                        {entry.entryNumber}
                                    </td>
                                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-slate-200">
                                        {new Date(entry.entryDate).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 md:px-6 py-4 text-sm text-slate-200">
                                        {entry.description}
                                        {entry.reference && (
                                            <span className="ml-2 text-xs text-slate-400">({entry.reference})</span>
                                        )}
                                    </td>
                                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-right text-white font-mono">
                                        ${entry.totalDebits.toFixed(2)}
                                    </td>
                                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-right text-white font-mono">
                                        ${entry.totalCredits.toFixed(2)}
                                    </td>
                                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${entry.status === 'posted'
                                            ? 'bg-green-900/50 text-green-300'
                                            : entry.status === 'void'
                                                ? 'bg-red-900/50 text-red-300'
                                                : 'bg-yellow-900/50 text-yellow-300'
                                            }`}>
                                            {entry.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => handleViewEntry(entry.id)}
                                            className="text-blue-400 hover:text-blue-300 mr-3 transition-colors"
                                        >
                                            View
                                        </button>
                                        {entry.status === 'draft' && (
                                            <>
                                                <button
                                                    onClick={() => handlePost(entry.id)}
                                                    className="text-green-400 hover:text-green-300 mr-3 transition-colors"
                                                >
                                                    Post
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(entry.id)}
                                                    className="text-red-400 hover:text-red-300 transition-colors"
                                                >
                                                    Delete
                                                </button>
                                            </>
                                        )}
                                        {entry.status === 'posted' && (
                                            <button
                                                onClick={() => handleVoid(entry.id)}
                                                className="text-red-400 hover:text-red-300 transition-colors"
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
                <div className="text-center py-12 bg-slate-800 rounded-lg shadow-sm">
                    <p className="text-slate-300">No journal entries found</p>
                </div>
            )}

            {/* Create Entry Modal */}
            <JournalEntryModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={loadEntries}
                accounts={accounts}
            />

            {/* View Entry Modal */}
            {viewingEntry && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-white mb-4">
                            Journal Entry: {viewingEntry.entryNumber}
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div>
                                <p className="text-sm text-slate-400">Date</p>
                                <p className="font-medium text-white">{new Date(viewingEntry.entryDate).toLocaleDateString()}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-400">Status</p>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${viewingEntry.status === 'posted'
                                    ? 'bg-green-900/50 text-green-300'
                                    : viewingEntry.status === 'void'
                                        ? 'bg-red-900/50 text-red-300'
                                        : 'bg-yellow-900/50 text-yellow-300'
                                    }`}>
                                    {viewingEntry.status.toUpperCase()}
                                </span>
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <p className="text-sm text-slate-400">Description</p>
                                <p className="font-medium text-white">{viewingEntry.description}</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto mb-6">
                            <table className="min-w-full divide-y divide-slate-700">
                                <thead className="bg-slate-900">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Account</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Description</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-400 uppercase">Debit</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-400 uppercase">Credit</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-slate-800 divide-y divide-slate-700">
                                    {viewingEntry.lines.map((line) => (
                                        <tr key={line.id}>
                                            <td className="px-4 py-2 text-sm text-slate-200">
                                                {line.accountCode} - {line.accountName}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-slate-200">{line.description}</td>
                                            <td className="px-4 py-2 text-sm text-right font-mono text-white">
                                                {line.debitAmount > 0 ? `$${line.debitAmount.toFixed(2)}` : '-'}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-right font-mono text-white">
                                                {line.creditAmount > 0 ? `$${line.creditAmount.toFixed(2)}` : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-900">
                                    <tr>
                                        <td colSpan={2} className="px-4 py-2 text-right font-semibold text-white">Totals:</td>
                                        <td className="px-4 py-2 text-right font-mono font-semibold text-white">
                                            ${viewingEntry.totalDebits.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono font-semibold text-white">
                                            ${viewingEntry.totalCredits.toFixed(2)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <button
                            onClick={() => setViewingEntry(null)}
                            className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default JournalEntriesPage;
