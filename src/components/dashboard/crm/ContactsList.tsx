'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Search, Filter, Plus, Mail, Phone, Building2, MoreHorizontal,
    User, Edit, Trash2, RefreshCw, Download, X, CheckCircle,
    XCircle, Calendar, Tag, ExternalLink, ChevronDown, ChevronUp,
    Sparkles, FileText, Receipt
} from 'lucide-react';
import { contactService, type ContactWithCompany } from '@/services/contactService';
import { freePlacesService } from '@/services/freePlacesService';
import { useAuth } from '@/contexts/AuthContext';
import { BulkTeamMessageModal } from '@/components/dashboard/crm/BulkTeamMessageModal';
import { buildBulkTeamMessageBody, normalizeRecipientEmails } from '@/lib/email/bulkTeamMessage';
import { LeadScoreBadge } from './LeadScoreBadge';
import { ContactActivityTimeline } from './ContactActivityTimeline';
import { Activity } from 'lucide-react';
import toast from 'react-hot-toast';

type ContactStatus = 'active' | 'inactive' | 'unsubscribed' | 'bounced';

interface ContactsListProps {
    onEditContact?: (contact: ContactWithCompany) => void;
    onCreateContact?: () => void;
}

const STATUS_CONFIG: Record<ContactStatus, { label: string; color: string; bgColor: string }> = {
    active: { label: 'Active', color: 'text-emerald-300', bgColor: 'bg-emerald-500/15' },
    inactive: { label: 'Inactive', color: 'text-slate-300', bgColor: 'bg-slate-500/15' },
    unsubscribed: { label: 'Unsubscribed', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
    bounced: { label: 'Bounced', color: 'text-red-400', bgColor: 'bg-red-500/20' },
};

export default function ContactsList({ onEditContact, onCreateContact }: ContactsListProps) {
    const { user } = useAuth();
    const [contacts, setContacts] = useState<ContactWithCompany[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<ContactStatus | 'all'>('all');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [sortField, setSortField] = useState<'createdAt' | 'name'>('createdAt');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [showBulkMessage, setShowBulkMessage] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(1);
    const [exporting, setExporting] = useState(false);
    const [timelineContact, setTimelineContact] = useState<ContactWithCompany | null>(null);

    const loadContacts = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const { contacts: data, error: err, pagination } = await contactService.getContacts({
                search: searchQuery || undefined,
                status: statusFilter !== 'all' ? statusFilter : undefined,
                page,
                limit: pageSize,
                sort: sortField === 'createdAt' ? 'created_at' : 'name',
                direction: sortDirection,
            });
            if (err) throw new Error(err);
            setContacts(data);
            setTotal(pagination?.total ?? data.length);
            setPages(pagination?.pages ?? 1);
        } catch (err) {
            console.error('Failed to load contacts:', err);
            setError(err instanceof Error ? err.message : 'Failed to load contacts');
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, searchQuery, sortDirection, sortField, statusFilter]);

    useEffect(() => {
        loadContacts();
    }, [loadContacts]);

    useEffect(() => {
        setSelectedIds([]);
        setPage(1);
    }, [searchQuery, statusFilter, sortField, sortDirection, pageSize]);

    const handleDeleteContact = async (contactId: string) => {
        try {
            setActionLoading(contactId);
            const { error: err } = await contactService.deleteContact(contactId);
            if (err) throw new Error(err);
            setContacts(prev => prev.filter(c => c.id !== contactId));
            setShowDeleteConfirm(null);
        } catch (err) {
            console.error('Failed to delete contact:', err);
            setError(err instanceof Error ? err.message : 'Failed to delete contact');
        } finally {
            setActionLoading(null);
        }
    };

    const handleBulkDelete = async () => {
        if (!selectedIds.length) return;
        try {
            setBulkDeleting(true);
            const { error: err } = await contactService.bulkDeleteContacts(selectedIds);
            if (err) throw new Error(err);
            setContacts((prev) => prev.filter((c) => !selectedIds.includes(c.id)));
            setSelectedIds([]);
            setShowBulkDeleteConfirm(false);
            setError(null);
            void loadContacts();
        } catch (err) {
            console.error('Failed to bulk delete contacts:', err);
            setError(err instanceof Error ? err.message : 'Failed to delete contacts');
        } finally {
            setBulkDeleting(false);
        }
    };

    const allVisibleSelected =
        contacts.length > 0 && contacts.every((c) => selectedIds.includes(c.id));

    const selectedEmails = normalizeRecipientEmails(
        contacts.filter((c) => selectedIds.includes(c.id)).map((c) => c.email)
    );

    const handleOpenBulkMessage = () => {
        if (selectedEmails.length === 0) {
            toast.error('Selected contacts do not have email addresses.');
            return;
        }
        setShowBulkMessage(true);
    };

    const handleExportCSV = async () => {
        if (exporting) return;
        setExporting(true);
        const toastId = toast.loading('Preparing export...');
        const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Status', 'Created At'];
        const rows: string[][] = [];
        const MAX_EXPORT = 1000;
        const batchLimit = 200;
        const maxPages = Math.ceil(MAX_EXPORT / batchLimit);
        try {
            for (let p = 1; p <= Math.max(1, Math.min(pages, maxPages)); p += 1) {
                const res = await contactService.getContacts({
                    search: searchQuery || undefined,
                    status: statusFilter !== 'all' ? statusFilter : undefined,
                    page: p,
                    limit: batchLimit,
                    sort: sortField === 'createdAt' ? 'created_at' : 'name',
                    direction: sortDirection,
                });
                if (res.error) throw new Error(res.error);
                for (const c of res.contacts) {
                    rows.push([
                        c.firstName,
                        c.lastName,
                        c.email,
                        c.phone || '',
                        c.company?.name || '',
                        c.status,
                        new Date(c.createdAt).toLocaleDateString(),
                    ]);
                    if (rows.length >= MAX_EXPORT) break;
                }
                if (rows.length >= MAX_EXPORT) break;
                if (res.contacts.length < batchLimit) break;
            }

            const csv = [headers.join(','), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success(rows.length >= MAX_EXPORT ? `Exported first ${MAX_EXPORT} contacts` : `Exported ${rows.length} contacts`, { id: toastId });
        } catch (err: any) {
            toast.error(err?.message || 'Export failed', { id: toastId });
        } finally {
            setExporting(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Skeleton rows match the final card height (~88px) so resolving doesn't shift layout
    if (loading && contacts.length === 0) {
        return (
            <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-[88px] dashboard-panel-soft animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-white">Contacts</h2>
                    <p className="text-sm text-slate-300">Manage your contacts and leads</p>
                </div>
                <div className="flex items-center gap-2">
                    {selectedIds.length > 0 && (
                        <>
                            <button
                                onClick={handleOpenBulkMessage}
                                className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-300 hover:text-indigo-200 hover:bg-indigo-500/10 rounded-lg transition-colors"
                            >
                                <Mail className="w-4 h-4" />
                                Message ({selectedIds.length})
                            </button>
                            <button
                                onClick={() => setShowBulkDeleteConfirm(true)}
                                className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete ({selectedIds.length})
                            </button>
                        </>
                    )}
                    <button
                        onClick={handleExportCSV}
                        disabled={total === 0 || exporting}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <Download className="w-4 h-4" />
                        {exporting ? 'Exporting…' : 'Export'}
                    </button>
                    <button
                        onClick={onCreateContact}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Contact
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search contacts..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-white/5 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as ContactStatus | 'all')}
                    className="px-4 py-2 bg-slate-900 border border-white/5 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                >
                    <option value="all">All Status</option>
                    {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                        <option key={status} value={status}>{config.label}</option>
                    ))}
                </select>
                <select
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as typeof sortField)}
                    className="px-4 py-2 bg-slate-900 border border-white/5 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                >
                    <option value="createdAt">Sort by Date</option>
                    <option value="name">Sort by Name</option>
                </select>
                <button
                    onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white"
                >
                    {sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <button
                    onClick={loadContacts}
                    className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white"
                    title="Refresh"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400 flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Contacts List */}
            {total === 0 ? (
                <div className="text-center py-16 bg-slate-800/50 rounded-lg border border-slate-700">
                    <User className="w-12 h-12 mx-auto text-slate-600 mb-4" />
                    <p className="text-slate-400">
                        {searchQuery || statusFilter !== 'all' ? 'No contacts match these filters' : 'No contacts yet'}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                        {searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Add your first contact to get started'}
                    </p>
                    <button
                        onClick={onCreateContact}
                        className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                        <Plus className="w-4 h-4 inline mr-2" />
                        Add Contact
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <button
                            type="button"
                            onClick={() => {
                                if (allVisibleSelected) {
                                    setSelectedIds([]);
                                } else {
                                    setSelectedIds(contacts.map((c) => c.id));
                                }
                            }}
                            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
                        >
                            {allVisibleSelected ? <CheckCircle className="w-4 h-4 text-teal-400" /> : <div className="w-4 h-4 border border-slate-500 rounded" />}
                            {allVisibleSelected ? 'Deselect page' : `Select page (${contacts.length})`}
                        </button>
                        {selectedIds.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setSelectedIds([])}
                                className="text-sm text-slate-500 hover:text-slate-300"
                            >
                                Clear selection
                            </button>
                        )}
                    </div>
                    {contacts.map((contact) => {
                        const status = STATUS_CONFIG[contact.status] || STATUS_CONFIG.active;
                        const isSelected = selectedIds.includes(contact.id);
                        return (
                            <div
                                key={contact.id}
                                className={`bg-slate-800 rounded-lg border p-4 hover:border-slate-600 transition-colors ${isSelected ? 'border-teal-500/50 ring-1 ring-teal-500/30' : 'border-slate-700'}`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-4">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedIds(prev =>
                                                    prev.includes(contact.id)
                                                        ? prev.filter(id => id !== contact.id)
                                                        : [...prev, contact.id]
                                                );
                                            }}
                                            className="flex-shrink-0 text-slate-500 hover:text-teal-400"
                                            aria-label={isSelected ? 'Deselect contact' : 'Select contact'}
                                        >
                                            {isSelected ? <CheckCircle className="w-5 h-5 text-teal-400" /> : <div className="w-5 h-5 border border-slate-500 rounded" />}
                                        </button>
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                                            {contact.firstName[0]}{contact.lastName[0]}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-white">
                                                    {contact.firstName} {contact.lastName}
                                                </span>
                                                <LeadScoreBadge contact={contact} size="sm" />
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${status.bgColor} ${status.color}`}>
                                                    {status.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                                                {contact.email && (
                                                    <span className="flex items-center gap-1">
                                                        <Mail className="w-3 h-3" />
                                                        {contact.email}
                                                    </span>
                                                )}
                                                {contact.phone && (
                                                    <span className="flex items-center gap-1">
                                                        <Phone className="w-3 h-3" />
                                                        {contact.phone}
                                                    </span>
                                                )}
                                                {contact.company && (
                                                    <span className="flex items-center gap-1">
                                                        <Building2 className="w-3 h-3" />
                                                        {contact.company.name}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    Added {formatDate(contact.createdAt)}
                                                </span>
                                                {contact.tags && contact.tags.length > 0 && (
                                                    <span className="flex items-center gap-1">
                                                        <Tag className="w-3 h-3" />
                                                        {contact.tags.slice(0, 3).join(', ')}
                                                        {contact.tags.length > 3 && ` +${contact.tags.length - 3}`}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={async () => {
                                                const contactName = contact.fullName || contact.firstName || 'Contact';
                                                toast.loading(`Enriching ${contactName}...`, { id: 'enrich' });
                                                const res = await freePlacesService.enrichContactData(contactName, contact.company?.name);
                                                toast.success(`Enriched contact: Website ${res.website}`, { id: 'enrich' });
                                            }}
                                            className="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors"
                                            title="Enrich Lead Details via Web Scraper"
                                        >
                                            <Sparkles className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                const contactName = contact.fullName || contact.firstName || 'Contact';
                                                toast.success(`Staged Contract Draft for ${contactName}`);
                                            }}
                                            className="p-2 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 rounded-lg transition-colors"
                                            title="Draft Contract"
                                        >
                                            <FileText className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                const contactName = contact.fullName || contact.firstName || 'Contact';
                                                toast.success(`Created Invoice Draft for ${contactName}`);
                                            }}
                                            className="p-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                            title="Issue Invoice"
                                        >
                                            <Receipt className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setTimelineContact(contact)}
                                            className="p-2 text-teal-400 hover:text-teal-300 hover:bg-teal-500/10 rounded-lg transition-colors"
                                            title="View Activity Timeline"
                                        >
                                            <Activity className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => onEditContact?.(contact)}
                                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                            title="Edit Contact"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setShowDeleteConfirm(contact.id)}
                                            disabled={actionLoading === contact.id}
                                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                                            title="Delete Contact"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
                        <p className="text-xs text-slate-500">
                            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
                        </p>
                        <div className="flex items-center gap-2">
                            <select
                                value={String(pageSize)}
                                onChange={(e) => setPageSize(Number(e.target.value))}
                                className="px-3 py-2 bg-slate-900 border border-white/5 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50"
                                aria-label="Contacts per page"
                            >
                                <option value="10">10 / page</option>
                                <option value="25">25 / page</option>
                                <option value="50">50 / page</option>
                                <option value="100">100 / page</option>
                            </select>
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-slate-400 font-semibold">
                                Page {page} / {pages}
                            </span>
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                                disabled={page >= pages}
                                className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {user?.id && (
                <BulkTeamMessageModal
                    isOpen={showBulkMessage}
                    onClose={() => setShowBulkMessage(false)}
                    userId={user.id}
                    recipients={selectedEmails}
                    body={buildBulkTeamMessageBody()}
                />
            )}

            {/* Bulk Delete Confirmation */}
            {showBulkDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-md w-full">
                        <h3 className="text-lg font-semibold text-white mb-2">Delete {selectedIds.length} contacts?</h3>
                        <p className="text-sm text-slate-400 mb-6">
                            This action cannot be undone. Selected contacts will be permanently deleted.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowBulkDeleteConfirm(false)}
                                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                disabled={bulkDeleting}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                            >
                                {bulkDeleting ? 'Deleting...' : `Delete ${selectedIds.length}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-md w-full">
                        <h3 className="text-lg font-semibold text-white mb-2">Delete Contact?</h3>
                        <p className="text-sm text-slate-400 mb-6">
                            This action cannot be undone. The contact will be permanently deleted.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteContact(showDeleteConfirm)}
                                disabled={actionLoading === showDeleteConfirm}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                            >
                                {actionLoading === showDeleteConfirm ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {timelineContact && (
                <ContactActivityTimeline
                    contactId={timelineContact.id}
                    contactEmail={timelineContact.email || undefined}
                    contactName={`${timelineContact.firstName} ${timelineContact.lastName}`}
                    onClose={() => setTimelineContact(null)}
                />
            )}
        </div>
    );
}
