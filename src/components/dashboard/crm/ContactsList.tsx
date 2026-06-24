'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Search, Filter, Plus, Mail, Phone, Building2, MoreHorizontal,
    User, Edit, Trash2, RefreshCw, Download, X, CheckCircle,
    XCircle, Calendar, Tag, ExternalLink, ChevronDown, ChevronUp
} from 'lucide-react';
import { contactService, type ContactWithCompany } from '@/services/contactService';
import { tenantService } from '@/services/tenancy/TenantService';

type ContactStatus = 'active' | 'inactive' | 'unsubscribed' | 'bounced';

interface ContactsListProps {
    onEditContact?: (contact: ContactWithCompany) => void;
    onCreateContact?: () => void;
}

const STATUS_CONFIG: Record<ContactStatus, { label: string; color: string; bgColor: string }> = {
    active: { label: 'Active', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
    inactive: { label: 'Inactive', color: 'text-slate-400', bgColor: 'bg-slate-500/20' },
    unsubscribed: { label: 'Unsubscribed', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
    bounced: { label: 'Bounced', color: 'text-red-400', bgColor: 'bg-red-500/20' },
};

export default function ContactsList({ onEditContact, onCreateContact }: ContactsListProps) {
    const [contacts, setContacts] = useState<ContactWithCompany[]>([]);
    const [filteredContacts, setFilteredContacts] = useState<ContactWithCompany[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<ContactStatus | 'all'>('all');
    const [selectedContact, setSelectedContact] = useState<ContactWithCompany | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [sortField, setSortField] = useState<'createdAt' | 'name' | 'company'>('createdAt');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    const loadContacts = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) {
                setError('No tenant selected');
                return;
            }
            const { contacts: data, error: err } = await contactService.getContacts({
                search: searchQuery || undefined,
                status: statusFilter !== 'all' ? statusFilter : undefined,
            });
            if (err) throw new Error(err);
            setContacts(data);
        } catch (err) {
            console.error('Failed to load contacts:', err);
            setError(err instanceof Error ? err.message : 'Failed to load contacts');
        } finally {
            setLoading(false);
        }
    }, [searchQuery, statusFilter]);

    useEffect(() => {
        loadContacts();
    }, [loadContacts]);

    useEffect(() => {
        let filtered = [...contacts];

        // Search filter (local if not already filtered by API)
        if (searchQuery && !contacts.some(c => 
            c.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.email.toLowerCase().includes(searchQuery.toLowerCase())
        )) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(contact =>
                contact.firstName.toLowerCase().includes(query) ||
                contact.lastName.toLowerCase().includes(query) ||
                contact.email.toLowerCase().includes(query) ||
                contact.company?.name.toLowerCase().includes(query)
            );
        }

        // Sort
        filtered.sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'createdAt':
                    comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                    break;
                case 'name':
                    comparison = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
                    break;
                case 'company':
                    comparison = (a.company?.name || '').localeCompare(b.company?.name || '');
                    break;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });

        setFilteredContacts(filtered);
    }, [contacts, searchQuery, statusFilter, sortField, sortDirection]);

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

    const handleExportCSV = () => {
        const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Status', 'Created At'];
        const rows = filteredContacts.map(c => [
            c.firstName,
            c.lastName,
            c.email,
            c.phone || '',
            c.company?.name || '',
            c.status,
            new Date(c.createdAt).toLocaleDateString(),
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    if (loading && contacts.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-white">Contacts</h2>
                    <p className="text-sm text-slate-400">Manage your contacts and leads</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportCSV}
                        disabled={filteredContacts.length === 0}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                    <button
                        onClick={onCreateContact}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
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
                        className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as ContactStatus | 'all')}
                    className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                    <option value="all">All Status</option>
                    {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                        <option key={status} value={status}>{config.label}</option>
                    ))}
                </select>
                <select
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as typeof sortField)}
                    className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                    <option value="createdAt">Sort by Date</option>
                    <option value="name">Sort by Name</option>
                    <option value="company">Sort by Company</option>
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
            {filteredContacts.length === 0 ? (
                <div className="text-center py-16 bg-slate-800/50 rounded-lg border border-slate-700">
                    <User className="w-12 h-12 mx-auto text-slate-600 mb-4" />
                    <p className="text-slate-400">No contacts found</p>
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
                    {filteredContacts.map((contact) => {
                        const status = STATUS_CONFIG[contact.status] || STATUS_CONFIG.active;
                        return (
                            <div
                                key={contact.id}
                                className="bg-slate-800 rounded-lg border border-slate-700 p-4 hover:border-slate-600 transition-colors"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                                            {contact.firstName[0]}{contact.lastName[0]}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-white">
                                                    {contact.firstName} {contact.lastName}
                                                </span>
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
        </div>
    );
}
