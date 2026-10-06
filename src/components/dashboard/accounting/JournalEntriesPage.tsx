'use client';

import { Select as AlphaCloneSelect } from '@/components/ui/select';


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
                <div className="text-[var(--ws-text-secondary)]">Loading journal entries...</div>
            </div>
        );
    }

    return (
        <div className="relative flex flex-col min-h-0 ac-scroll-full ac-enterprise-module p-4 md:p-6">
            <ModulePageLayout
                header={(
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 pb-2">
                        <div>
                            <h1 className="text-lg font-semibold text-[var(--ws-text-primary)]">Ledger Entries</h1>
                            <p className="type-card-description text-[var(--ws-text-secondary)]">Review and post the manual entries shaping your books.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowCreateModal(true)}
                            className="px-3 py-2 rounded-xl bg-emerald-600 text-[var(--text-inverse)] type-caption font-bold hover:bg-emerald-500"
                        >
                            + New ledger entry
                        </button>
                    </div>
                )}
                toolbar={(
                    <AlphaCloneSelect
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as JournalStatus | 'all')}
                        className="px-3 py-2"
                    >
                        <option value="all">All statuses</option>
                        <option value="draft">Draft</option>
                        <option value="posted">Posted</option>
                        <option value="void">Voided</option>
                    </AlphaCloneSelect>
                )}
            >
                {error && (
                    <div className="mb-3 bg-[var(--error-500)]/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl type-ui">
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
                                    <p className="type-card-description font-semibold text-[var(--ws-text-primary)]">{entry.entryNumber}</p>
                                    <p className="type-card-description text-[var(--ws-text-muted)]">{new Date(entry.entryDate).toLocaleDateString()}</p>
                                </div>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full type-caption font-medium ${entry.status === 'posted'
                                    ? 'bg-green-900/50 text-green-300'
                                    : entry.status === 'void'
                                        ? 'bg-red-900/50 text-[var(--error-text,var(--error-500))]'
                                        : 'bg-yellow-900/50 text-yellow-300'
                                    }`}>
                                    {entry.status.toUpperCase()}
                                </span>
                            </div>
                            <p className="type-card-description text-[var(--ws-text-secondary)] leading-relaxed">{entry.description}</p>
                            {entry.reference ? (
                                <p className="type-card-description text-[var(--ws-text-muted)]">Ref: {entry.reference}</p>
                            ) : null}
                            <div className="grid grid-cols-2 gap-3 type-ui font-mono">
                                <div>
                                    <span className="block type-caption uppercase tracking-wider text-[var(--ws-text-muted)]">Debits</span>
                                    <span className="text-[var(--ws-text-primary)]">${entry.totalDebits.toFixed(2)}</span>
                                </div>
                                <div className="text-right">
                                    <span className="block type-caption uppercase tracking-wider text-[var(--ws-text-muted)]">Credits</span>
                                    <span className="text-[var(--ws-text-primary)]">${entry.totalCredits.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleViewEntry(entry.id); }}
                                    className="px-2.5 py-1.5 rounded-lg border border-blue-500/20 text-blue-300 type-caption font-semibold hover:bg-blue-500/10"
                                >
                                    View
                                </button>
                                {entry.status === 'draft' && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handlePost(entry.id); }}
                                            className="px-2.5 py-1.5 rounded-lg border border-green-500/20 text-green-300 type-caption font-semibold hover:bg-green-500/10"
                                        >
                                            Post
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                                            className="px-2.5 py-1.5 rounded-lg border border-red-500/20 text-[var(--error-text,var(--error-500))] type-caption font-semibold hover:bg-[var(--error-500)]/10"
                                        >
                                            Delete
                                        </button>
                                    </>
                                )}
                                {entry.status === 'posted' && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleVoid(entry.id); }}
                                        className="px-2.5 py-1.5 rounded-lg border border-red-500/20 text-[var(--error-text,var(--error-500))] type-caption font-semibold hover:bg-[var(--error-500)]/10"
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
                            <thead className="bg-[var(--ws-panel)]">
                                <tr>
                                    <th className="px-4 md:px-6 py-3 text-left type-caption font-medium text-[var(--ws-text-muted)] uppercase">Entry #</th>
                                    <th className="px-4 md:px-6 py-3 text-left type-caption font-medium text-[var(--ws-text-muted)] uppercase">Date</th>
                                    <th className="px-4 md:px-6 py-3 text-left type-caption font-medium text-[var(--ws-text-muted)] uppercase">Description</th>
                                    <th className="px-4 md:px-6 py-3 text-right type-caption font-medium text-[var(--ws-text-muted)] uppercase">Debits</th>
                                    <th className="px-4 md:px-6 py-3 text-right type-caption font-medium text-[var(--ws-text-muted)] uppercase">Credits</th>
                                    <th className="px-4 md:px-6 py-3 text-left type-caption font-medium text-[var(--ws-text-muted)] uppercase">Status</th>
                                    <th className="px-4 md:px-6 py-3 text-right type-caption font-medium text-[var(--ws-text-muted)] uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-[var(--ws-panel)]/60 divide-y divide-white/5">
                                {entries.map((entry) => (
                                    <tr key={entry.id} className={entry.status === 'void' ? 'bg-[var(--ws-panel)]/50 opacity-60' : ''}>
                                        <td className="px-4 md:px-6 py-4 whitespace-nowrap type-table-cell font-medium text-[var(--ws-text-primary)]">
                                            {entry.entryNumber}
                                        </td>
                                        <td className="px-4 md:px-6 py-4 whitespace-nowrap type-table-cell text-[var(--ws-text-secondary)]">
                                            {new Date(entry.entryDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 md:px-6 py-4 type-table-cell text-[var(--ws-text-secondary)]">
                                            {entry.description}
                                            {entry.reference && (
                                                <span className="ml-2 type-caption text-[var(--ws-text-muted)]">({entry.reference})</span>
                                            )}
                                        </td>
                                        <td className="px-4 md:px-6 py-4 whitespace-nowrap type-table-cell text-right text-[var(--ws-text-primary)] font-mono">
                                            ${entry.totalDebits.toFixed(2)}
                                        </td>
                                        <td className="px-4 md:px-6 py-4 whitespace-nowrap type-table-cell text-right text-[var(--ws-text-primary)] font-mono">
                                            ${entry.totalCredits.toFixed(2)}
                                        </td>
                                        <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full type-caption font-medium ${entry.status === 'posted'
                                                ? 'bg-green-900/50 text-green-300'
                                                : entry.status === 'void'
                                                    ? 'bg-red-900/50 text-[var(--error-text,var(--error-500))]'
                                                    : 'bg-yellow-900/50 text-yellow-300'
                                                }`}>
                                                {entry.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right type-table-cell font-medium">
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
                                                        className="text-red-400 hover:text-[var(--error-text,var(--error-500))] transition-colors"
                                                    >
                                                        Delete
                                                    </button>
                                                </>
                                            )}
                                            {entry.status === 'posted' && (
                                                <button
                                                    onClick={() => handleVoid(entry.id)}
                                                    className="text-red-400 hover:text-[var(--error-text,var(--error-500))] transition-colors"
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
            <div className="text-center py-12 rounded-xl border border-[var(--ws-border)] bg-[var(--ws-panel)]/40">
                    <p className="text-[var(--ws-text-secondary)]">No journal entries found</p>
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
                                <p className="type-caption text-[var(--ws-text-muted)] uppercase tracking-wider mb-1">Date</p>
                                <p className="font-medium text-[var(--ws-text-primary)]">{new Date(viewingEntry.entryDate).toLocaleDateString()}</p>
                            </div>
                            <div>
                                <p className="type-caption text-[var(--ws-text-muted)] uppercase tracking-wider mb-1">Status</p>
                                <p className="font-medium text-[var(--ws-text-primary)] capitalize">{viewingEntry.status}</p>
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <p className="type-caption text-[var(--ws-text-muted)] uppercase tracking-wider mb-1">Description</p>
                                <p className="text-[var(--ws-text-primary)]">{viewingEntry.description}</p>
                            </div>
                        </div>
                        <div className="rounded-xl border border-[var(--ws-border)] overflow-x-auto">
                            <table className="min-w-[520px] w-full divide-y divide-white/5 type-ui">
                                <thead className="bg-[var(--ws-panel)]/80">
                                    <tr>
                                        <th className="px-4 py-2 text-left type-caption text-[var(--ws-text-muted)] uppercase">Account</th>
                                        <th className="px-4 py-2 text-left type-caption text-[var(--ws-text-muted)] uppercase">Description</th>
                                        <th className="px-4 py-2 text-right type-caption text-[var(--ws-text-muted)] uppercase">Debit</th>
                                        <th className="px-4 py-2 text-right type-caption text-[var(--ws-text-muted)] uppercase">Credit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {viewingEntry.lines.map((line) => (
                                        <tr key={line.id}>
                                            <td className="px-4 py-2 text-[var(--ws-text-secondary)]">{line.accountCode} - {line.accountName}</td>
                                            <td className="px-4 py-2 text-[var(--ws-text-secondary)]">{line.description}</td>
                                            <td className="px-4 py-2 text-right font-mono text-[var(--ws-text-primary)]">{line.debitAmount > 0 ? `$${line.debitAmount.toFixed(2)}` : '—'}</td>
                                            <td className="px-4 py-2 text-right font-mono text-[var(--ws-text-primary)]">{line.creditAmount > 0 ? `$${line.creditAmount.toFixed(2)}` : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-[var(--ws-panel)]/80">
                                    <tr>
                                        <td colSpan={2} className="px-4 py-2 text-right font-semibold text-[var(--ws-text-primary)]">Totals</td>
                                        <td className="px-4 py-2 text-right font-mono font-semibold text-[var(--ws-text-primary)]">${viewingEntry.totalDebits.toFixed(2)}</td>
                                        <td className="px-4 py-2 text-right font-mono font-semibold text-[var(--ws-text-primary)]">${viewingEntry.totalCredits.toFixed(2)}</td>
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
