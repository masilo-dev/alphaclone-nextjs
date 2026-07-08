'use client';

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
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
import { ModulePageLayout } from '../../ui/ModulePageLayout';
import { DetailDrawer } from '../../ui/DetailDrawer';
import {
    ResponsiveTableDesktop,
    ResponsiveTableMobile,
    MobileDataCard,
} from '../../ui/ResponsiveTable';

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

    const loadEntries = useCallback(async () => {
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
    }, [filterStatus]);

    const loadAccounts = useCallback(async () => {
        const { accounts: data } = await chartOfAccountsService.getAccounts({ isActive: true });
        setAccounts(data);
    }, []);

    const handleViewEntry = useCallback(async (entryId: string) => {
        const { entry, error: err } = await journalEntryService.getEntry(entryId);

        if (err) {
            toast.error(`Error loading entry: ${err}`);
        } else {
            setViewingEntry(entry);
        }
    }, []);

    const handlePost = useCallback(async (entryId: string) => {
        if (!confirm('Post this journal entry? This action cannot be undone.')) return;

        const { success, error: err } = await journalEntryService.postEntry(entryId);

        if (err) {
            toast.error(`Error posting entry: ${err}`);
        } else {
            toast.success('Entry posted successfully!');
            loadEntries();
        }
    }, [loadEntries]);

    const handleVoid = useCallback(async (entryId: string) => {
        const reason = prompt('Enter reason for voiding this entry:');
        if (!reason) return;

        const { reversingEntryId, error: err } = await journalEntryService.voidEntry(entryId, reason);

        if (err) {
            toast.error(`Error voiding entry: ${err}`);
        } else {
            toast.success(`Entry voided. Reversing entry created: ${reversingEntryId}`);
            loadEntries();
        }
    }, [loadEntries]);

    const handleDelete = useCallback(async (entryId: string) => {
        if (!confirm('Delete this draft entry?')) return;

        const { error: err } = await journalEntryService.deleteEntry(entryId);

        if (err) {
            toast.error(`Error deleting entry: ${err}`);
        } else {
            loadEntries();
        }
    }, [loadEntries]);

    useEffect(() => {
        if (currentTenant) {
            loadEntries();
            loadAccounts();
        }
    }, [currentTenant, loadEntries, loadAccounts]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 ac-enterprise-module">
                <div className="text-slate-300">Loading journal entries...</div>
            </div>
        );
    }

    return (
        <div className="relative flex flex-col min-h-0 ac-scroll-full ac-enterprise-module p-4 md:p-6">
            <ModulePageLayout
                header={(
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 pb-2">
                        <div>
                            <h1 className="text-lg font-semibold text-white">Ledger Entries</h1>
                            <p className="text-sm text-slate-300">Review and post the manual entries shaping your books.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowCreateModal(true)}
                            className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500"
                        >
                            + New ledger entry
                        </button>
                    </div>
                )}
                toolbar={(
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as JournalStatus | 'all')}
                        className="px-3 py-2 bg-slate-900 border border-white/5 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/50"
                    >
                        <option value="all">All statuses</option>
                        <option value="draft">Draft</option>
                        <option value="posted">Posted</option>
                        <option value="void">Voided</option>
                    </select>
                )}
            >
                {error && (
                    <div className="mb-3 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
                        {error}
                    </div>
                )}

            {/* Entries List */}
            <div className="dashboard-panel-soft overflow-hidden min-w-0">
                <ResponsiveTableMobile>
                    {entries.map((entry) => (
                        <MobileDataCard
                            key={entry.id}
                            className={entry.status === 'void' ? 'opacity-60' : undefined}
                            onClick={() => handleViewEntry(entry.id)}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-white">{entry.entryNumber}</p>
                                    <p className="text-xs text-slate-400">{new Date(entry.entryDate).toLocaleDateString()}</p>
                                </div>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${entry.status === 'posted'
                                    ? 'bg-green-900/50 text-green-300'
                                    : entry.status === 'void'
                                        ? 'bg-red-900/50 text-red-300'
                                        : 'bg-yellow-900/50 text-yellow-300'
                                    }`}>
                                    {entry.status.toUpperCase()}
                                </span>
                            </div>
                            <p className="text-sm text-slate-200 leading-relaxed">{entry.description}</p>
                            {entry.reference ? (
                                <p className="text-xs text-slate-500">Ref: {entry.reference}</p>
                            ) : null}
                            <div className="grid grid-cols-2 gap-3 text-sm font-mono">
                                <div>
                                    <span className="block text-[10px] uppercase tracking-wider text-slate-500">Debits</span>
                                    <span className="text-white">${entry.totalDebits.toFixed(2)}</span>
                                </div>
                                <div className="text-right">
                                    <span className="block text-[10px] uppercase tracking-wider text-slate-500">Credits</span>
                                    <span className="text-white">${entry.totalCredits.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleViewEntry(entry.id); }}
                                    className="px-2.5 py-1.5 rounded-lg border border-blue-500/20 text-blue-300 text-xs font-semibold hover:bg-blue-500/10"
                                >
                                    View
                                </button>
                                {entry.status === 'draft' && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handlePost(entry.id); }}
                                            className="px-2.5 py-1.5 rounded-lg border border-green-500/20 text-green-300 text-xs font-semibold hover:bg-green-500/10"
                                        >
                                            Post
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                                            className="px-2.5 py-1.5 rounded-lg border border-red-500/20 text-red-300 text-xs font-semibold hover:bg-red-500/10"
                                        >
                                            Delete
                                        </button>
                                    </>
                                )}
                                {entry.status === 'posted' && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleVoid(entry.id); }}
                                        className="px-2.5 py-1.5 rounded-lg border border-red-500/20 text-red-300 text-xs font-semibold hover:bg-red-500/10"
                                    >
                                        Void
                                    </button>
                                )}
                            </div>
                        </MobileDataCard>
                    ))}
                </ResponsiveTableMobile>
                <ResponsiveTableDesktop>
                    <div className="overflow-x-auto min-w-0">
                        <table className="min-w-[880px] w-full divide-y divide-slate-700">
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
                            <tbody className="bg-slate-900/60 divide-y divide-white/5">
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
                </ResponsiveTableDesktop>
            </div>

            {entries.length === 0 && (
            <div className="text-center py-12 rounded-xl border border-white/5 bg-slate-900/40">
                    <p className="text-slate-300">No journal entries found</p>
                </div>
            )}
            </ModulePageLayout>

            <JournalEntryModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={loadEntries}
                accounts={accounts}
            />

            <DetailDrawer
                open={Boolean(viewingEntry)}
                onOpenChange={(open) => { if (!open) setViewingEntry(null); }}
                title={viewingEntry ? `Entry ${viewingEntry.entryNumber}` : 'Journal entry'}
                size="wide"
            >
                {viewingEntry && (
                    <div className="space-y-4 pb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Date</p>
                                <p className="font-medium text-white">{new Date(viewingEntry.entryDate).toLocaleDateString()}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Status</p>
                                <p className="font-medium text-white capitalize">{viewingEntry.status}</p>
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Description</p>
                                <p className="text-white">{viewingEntry.description}</p>
                            </div>
                        </div>
                        <div className="rounded-xl border border-white/5 overflow-x-auto">
                            <table className="min-w-[520px] w-full divide-y divide-white/5 text-sm">
                                <thead className="bg-slate-900/80">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs text-slate-400 uppercase">Account</th>
                                        <th className="px-4 py-2 text-left text-xs text-slate-400 uppercase">Description</th>
                                        <th className="px-4 py-2 text-right text-xs text-slate-400 uppercase">Debit</th>
                                        <th className="px-4 py-2 text-right text-xs text-slate-400 uppercase">Credit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {viewingEntry.lines.map((line) => (
                                        <tr key={line.id}>
                                            <td className="px-4 py-2 text-slate-200">{line.accountCode} - {line.accountName}</td>
                                            <td className="px-4 py-2 text-slate-300">{line.description}</td>
                                            <td className="px-4 py-2 text-right font-mono text-white">{line.debitAmount > 0 ? `$${line.debitAmount.toFixed(2)}` : '—'}</td>
                                            <td className="px-4 py-2 text-right font-mono text-white">{line.creditAmount > 0 ? `$${line.creditAmount.toFixed(2)}` : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-900/80">
                                    <tr>
                                        <td colSpan={2} className="px-4 py-2 text-right font-semibold text-white">Totals</td>
                                        <td className="px-4 py-2 text-right font-mono font-semibold text-white">${viewingEntry.totalDebits.toFixed(2)}</td>
                                        <td className="px-4 py-2 text-right font-mono font-semibold text-white">${viewingEntry.totalCredits.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}
            </DetailDrawer>
        </div>
    );
}

export default JournalEntriesPage;
