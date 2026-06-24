'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Search, Filter, Plus, Send, Eye, Trash2, CheckCircle, XCircle,
    FileText, Download, MoreHorizontal, Calendar, DollarSign,
    Clock, AlertCircle, ChevronDown, ChevronUp, RefreshCw, Mail,
    FileDown, Printer, X, Building2, User
} from 'lucide-react';
import { businessInvoiceService, type BusinessInvoice } from '@/services/businessInvoiceService';
import { tenantService } from '@/services/tenancy/TenantService';
import { useAuth } from '@/contexts/AuthContext';
import { jsPDF } from 'jspdf';

type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue' | 'disputed' | 'void' | 'cancelled';

// Extended status for comparisons
const VOID_STATUSES: string[] = ['void', 'cancelled'];

interface InvoiceStats {
    total: number;
    draft: number;
    sent: number;
    paid: number;
    overdue: number;
    void: number;
    totalAmount: number;
    paidAmount: number;
    overdueAmount: number;
}

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
    draft: { label: 'Draft', color: 'text-slate-400', bgColor: 'bg-slate-500/20', icon: <FileText className="w-3 h-3" /> },
    sent: { label: 'Sent', color: 'text-blue-400', bgColor: 'bg-blue-500/20', icon: <Mail className="w-3 h-3" /> },
    viewed: { label: 'Viewed', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', icon: <Eye className="w-3 h-3" /> },
    partially_paid: { label: 'Partially Paid', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', icon: <DollarSign className="w-3 h-3" /> },
    paid: { label: 'Paid', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', icon: <CheckCircle className="w-3 h-3" /> },
    overdue: { label: 'Overdue', color: 'text-red-400', bgColor: 'bg-red-500/20', icon: <AlertCircle className="w-3 h-3" /> },
    disputed: { label: 'Disputed', color: 'text-orange-400', bgColor: 'bg-orange-500/20', icon: <XCircle className="w-3 h-3" /> },
    void: { label: 'Void', color: 'text-slate-500', bgColor: 'bg-slate-600/20', icon: <XCircle className="w-3 h-3" /> },
    cancelled: { label: 'Cancelled', color: 'text-slate-500', bgColor: 'bg-slate-600/20', icon: <XCircle className="w-3 h-3" /> },
};

export default function InvoicesTab() {
    const { user } = useAuth();
    const [invoices, setInvoices] = useState<BusinessInvoice[]>([]);
    const [filteredInvoices, setFilteredInvoices] = useState<BusinessInvoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
    const [selectedInvoice, setSelectedInvoice] = useState<BusinessInvoice | null>(null);
    const [showDetails, setShowDetails] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [stats, setStats] = useState<InvoiceStats | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [sortField, setSortField] = useState<'createdAt' | 'dueDate' | 'total' | 'invoiceNumber'>('createdAt');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // New invoice form state
    const [newInvoice, setNewInvoice] = useState({
        clientName: '',
        clientEmail: '',
        invoiceNumber: '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        lineItems: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
        notes: '',
        subtotal: 0,
        taxRate: 0,
        tax: 0,
        total: 0,
    });

    const loadInvoices = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) {
                setError('No tenant selected');
                return;
            }
            const { invoices: data, error: err } = await businessInvoiceService.getInvoices(tenantId);
            if (err) throw new Error(err);
            setInvoices(data);
            calculateStats(data);
        } catch (err) {
            console.error('Failed to load invoices:', err);
            setError(err instanceof Error ? err.message : 'Failed to load invoices');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadInvoices();
    }, [loadInvoices]);

    useEffect(() => {
        let filtered = [...invoices];
        
        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(inv => 
                inv.invoiceNumber.toLowerCase().includes(query) ||
                (inv.notes && inv.notes.toLowerCase().includes(query))
            );
        }
        
        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(inv => inv.status === statusFilter);
        }
        
        // Sort
        filtered.sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'createdAt':
                    comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                    break;
                case 'dueDate':
                    comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                    break;
                case 'total':
                    comparison = a.total - b.total;
                    break;
                case 'invoiceNumber':
                    comparison = a.invoiceNumber.localeCompare(b.invoiceNumber);
                    break;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
        
        setFilteredInvoices(filtered);
    }, [invoices, searchQuery, statusFilter, sortField, sortDirection]);

    const calculateStats = (data: BusinessInvoice[]) => {
        const stats: InvoiceStats = {
            total: data.length,
            draft: 0,
            sent: 0,
            paid: 0,
            overdue: 0,
            void: 0,
            totalAmount: 0,
            paidAmount: 0,
            overdueAmount: 0,
        };
        
        data.forEach(inv => {
            stats.totalAmount += inv.total;
            if (inv.status === 'draft') stats.draft++;
            if (inv.status === 'sent') stats.sent++;
            if (inv.status === 'paid') {
                stats.paid++;
                stats.paidAmount += inv.total;
            }
            if (inv.status === 'overdue') {
                stats.overdue++;
                stats.overdueAmount += inv.total;
            }
            if (VOID_STATUSES.includes(inv.status)) stats.void++;
        });
        
        setStats(stats);
    };

    const handleSendInvoice = async (invoiceId: string) => {
        try {
            setActionLoading(invoiceId);
            const res = await fetch('/api/invoices/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoiceId, tenantId: tenantService.getCurrentTenantId() }),
            });
            if (!res.ok) throw new Error('Failed to send invoice');
            await loadInvoices();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send invoice');
        } finally {
            setActionLoading(null);
        }
    };

    const handleMarkAsPaid = async (invoiceId: string) => {
        try {
            setActionLoading(invoiceId);
            const { error: err } = await businessInvoiceService.updateInvoice(invoiceId, { status: 'paid' });
            if (err) throw new Error(err);
            await loadInvoices();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to mark as paid');
        } finally {
            setActionLoading(null);
        }
    };

    const handleVoidInvoice = async (invoiceId: string) => {
        if (!confirm('Are you sure you want to void this invoice? This cannot be undone.')) return;
        try {
            setActionLoading(invoiceId);
            const res = await fetch(`/api/invoices/${invoiceId}/void`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId: tenantService.getCurrentTenantId() }),
            });
            if (!res.ok) throw new Error('Failed to void invoice');
            await loadInvoices();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to void invoice');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteInvoice = async (invoiceId: string) => {
        if (!confirm('Are you sure you want to delete this invoice? This cannot be undone.')) return;
        try {
            setActionLoading(invoiceId);
            const { error: err } = await businessInvoiceService.deleteInvoice(invoiceId);
            if (err) throw new Error(err);
            await loadInvoices();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete invoice');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDownloadPDF = (invoice: BusinessInvoice) => {
        try {
            const doc = new jsPDF();
            doc.setFontSize(20);
            doc.text(`Invoice ${invoice.invoiceNumber}`, 20, 30);
            doc.setFontSize(12);
            doc.text(`Date: ${new Date(invoice.issueDate).toLocaleDateString()}`, 20, 50);
            doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, 20, 60);
            doc.text(`Status: ${invoice.status.toUpperCase()}`, 20, 70);
            doc.text(`Total: $${invoice.total.toFixed(2)}`, 20, 90);
            doc.save(`invoice-${invoice.invoiceNumber}.pdf`);
        } catch (err) {
            console.error('PDF generation failed:', err);
            setError('Failed to generate PDF');
        }
    };

    const updateLineItem = (index: number, field: string, value: string | number) => {
        const items = [...newInvoice.lineItems];
        items[index] = { ...items[index], [field]: value };
        
        // Recalculate amount
        if (field === 'quantity' || field === 'rate') {
            items[index].amount = items[index].quantity * items[index].rate;
        }
        
        const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
        const tax = subtotal * (newInvoice.taxRate / 100);
        const total = subtotal + tax;
        
        setNewInvoice(prev => ({
            ...prev,
            lineItems: items,
            subtotal,
            tax,
            total,
        }));
    };

    const addLineItem = () => {
        setNewInvoice(prev => ({
            ...prev,
            lineItems: [...prev.lineItems, { description: '', quantity: 1, rate: 0, amount: 0 }],
        }));
    };

    const removeLineItem = (index: number) => {
        if (newInvoice.lineItems.length <= 1) return;
        const items = newInvoice.lineItems.filter((_, i) => i !== index);
        const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
        const tax = subtotal * (newInvoice.taxRate / 100);
        const total = subtotal + tax;
        
        setNewInvoice(prev => ({
            ...prev,
            lineItems: items,
            subtotal,
            tax,
            total,
        }));
    };

    const handleCreateInvoice = async () => {
        if (!user) {
            setError('You must be logged in');
            return;
        }
        if (!newInvoice.clientName || newInvoice.lineItems.some(item => !item.description)) {
            setError('Please fill in all required fields');
            return;
        }
        
        try {
            setActionLoading('create');
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) throw new Error('No tenant selected');
            
            const { invoice, error: err } = await businessInvoiceService.createInvoice(tenantId, {
                invoiceNumber: newInvoice.invoiceNumber || undefined,
                issueDate: newInvoice.issueDate,
                dueDate: newInvoice.dueDate,
                status: 'draft',
                subtotal: newInvoice.subtotal,
                taxRate: newInvoice.taxRate,
                tax: newInvoice.tax,
                total: newInvoice.total,
                lineItems: newInvoice.lineItems,
                notes: newInvoice.notes,
            });
            
            if (err || !invoice) throw new Error(err || 'Failed to create invoice');
            
            setShowCreateModal(false);
            setNewInvoice({
                clientName: '',
                clientEmail: '',
                invoiceNumber: '',
                issueDate: new Date().toISOString().split('T')[0],
                dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                lineItems: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
                notes: '',
                subtotal: 0,
                taxRate: 0,
                tax: 0,
                total: 0,
            });
            await loadInvoices();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create invoice');
        } finally {
            setActionLoading(null);
        }
    };

    const isOverdue = (invoice: BusinessInvoice) => {
        if (invoice.status === 'paid' || VOID_STATUSES.includes(invoice.status)) return false;
        return new Date(invoice.dueDate) < new Date();
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    if (loading) {
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
                    <h2 className="text-xl font-semibold text-white">Invoices</h2>
                    <p className="text-sm text-slate-400">Manage and track your invoices</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Create Invoice
                </button>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                        <p className="text-xs text-slate-400 mb-1">Total</p>
                        <p className="text-xl font-semibold text-white">{stats.total}</p>
                        <p className="text-xs text-slate-500">{formatCurrency(stats.totalAmount)}</p>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                        <p className="text-xs text-slate-400 mb-1">Draft</p>
                        <p className="text-xl font-semibold text-slate-300">{stats.draft}</p>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                        <p className="text-xs text-slate-400 mb-1">Sent</p>
                        <p className="text-xl font-semibold text-blue-400">{stats.sent}</p>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                        <p className="text-xs text-slate-400 mb-1">Paid</p>
                        <p className="text-xl font-semibold text-emerald-400">{stats.paid}</p>
                        <p className="text-xs text-emerald-500">{formatCurrency(stats.paidAmount)}</p>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                        <p className="text-xs text-slate-400 mb-1">Overdue</p>
                        <p className="text-xl font-semibold text-red-400">{stats.overdue}</p>
                        <p className="text-xs text-red-500">{formatCurrency(stats.overdueAmount)}</p>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                        <p className="text-xs text-slate-400 mb-1">Void</p>
                        <p className="text-xl font-semibold text-slate-500">{stats.void}</p>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search invoices..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | 'all')}
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
                    <option value="dueDate">Sort by Due Date</option>
                    <option value="total">Sort by Amount</option>
                    <option value="invoiceNumber">Sort by Number</option>
                </select>
                <button
                    onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white"
                >
                    {sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <button
                    onClick={loadInvoices}
                    className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white"
                    title="Refresh"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Invoice List */}
            {filteredInvoices.length === 0 ? (
                <div className="text-center py-16 bg-slate-800/50 rounded-lg border border-slate-700">
                    <FileText className="w-12 h-12 mx-auto text-slate-600 mb-4" />
                    <p className="text-slate-400">No invoices found</p>
                    <p className="text-sm text-slate-500 mt-1">
                        {searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first invoice to get started'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredInvoices.map((invoice) => {
                        const status = STATUS_CONFIG[invoice.status as InvoiceStatus] || STATUS_CONFIG.draft;
                        const overdue = isOverdue(invoice);
                        
                        return (
                            <div
                                key={invoice.id}
                                className={`bg-slate-800 rounded-lg border ${overdue ? 'border-red-500/30' : 'border-slate-700'} p-4 hover:border-slate-600 transition-colors`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-lg ${status.bgColor}`}>
                                            {status.icon}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-white">{invoice.invoiceNumber}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${status.bgColor} ${status.color}`}>
                                                    {status.label}
                                                </span>
                                                {overdue && (
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                                                        Overdue
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {formatDate(invoice.issueDate)}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    Due {formatDate(invoice.dueDate)}
                                                </span>
                                                {invoice.clientId && (
                                                    <span className="flex items-center gap-1">
                                                        <User className="w-3 h-3" />
                                                        Client
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="font-semibold text-white">{formatCurrency(invoice.total)}</p>
                                            <p className="text-xs text-slate-500">
                                                {invoice.lineItems.length} item{invoice.lineItems.length !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => {
                                                    setSelectedInvoice(invoice);
                                                    setShowDetails(true);
                                                }}
                                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                                title="View Details"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            {invoice.status === 'draft' && (
                                                <button
                                                    onClick={() => handleSendInvoice(invoice.id)}
                                                    disabled={actionLoading === invoice.id}
                                                    className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded-lg transition-colors"
                                                    title="Send Invoice"
                                                >
                                                    {actionLoading === invoice.id ? (
                                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Send className="w-4 h-4" />
                                                    )}
                                                </button>
                                            )}
                                            {(invoice.status === 'sent' || invoice.status === 'overdue' || invoice.status === 'viewed') && (
                                                <button
                                                    onClick={() => handleMarkAsPaid(invoice.id)}
                                                    disabled={actionLoading === invoice.id}
                                                    className="p-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10 rounded-lg transition-colors"
                                                    title="Mark as Paid"
                                                >
                                                    {actionLoading === invoice.id ? (
                                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <CheckCircle className="w-4 h-4" />
                                                    )}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDownloadPDF(invoice)}
                                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                                title="Download PDF"
                                            >
                                                <FileDown className="w-4 h-4" />
                                            </button>
                                            {(invoice.status === 'draft' || invoice.status === 'sent') && (
                                                <button
                                                    onClick={() => handleVoidInvoice(invoice.id)}
                                                    disabled={actionLoading === invoice.id}
                                                    className="p-2 text-orange-400 hover:text-orange-300 hover:bg-orange-400/10 rounded-lg transition-colors"
                                                    title="Void Invoice"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                </button>
                                            )}
                                            {invoice.status === 'draft' && (
                                                <button
                                                    onClick={() => handleDeleteInvoice(invoice.id)}
                                                    disabled={actionLoading === invoice.id}
                                                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                                                    title="Delete Invoice"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Invoice Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white">Create New Invoice</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Invoice Number</label>
                                    <input
                                        type="text"
                                        placeholder="Auto-generated if empty"
                                        value={newInvoice.invoiceNumber}
                                        onChange={(e) => setNewInvoice(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div />
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Issue Date</label>
                                    <input
                                        type="date"
                                        value={newInvoice.issueDate}
                                        onChange={(e) => setNewInvoice(prev => ({ ...prev, issueDate: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Due Date</label>
                                    <input
                                        type="date"
                                        value={newInvoice.dueDate}
                                        onChange={(e) => setNewInvoice(prev => ({ ...prev, dueDate: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Line Items</label>
                                <div className="space-y-2">
                                    {newInvoice.lineItems.map((item, index) => (
                                        <div key={index} className="flex gap-2 items-start">
                                            <input
                                                type="text"
                                                placeholder="Description"
                                                value={item.description}
                                                onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                                                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                                            />
                                            <input
                                                type="number"
                                                placeholder="Qty"
                                                value={item.quantity}
                                                onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                className="w-20 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                            />
                                            <input
                                                type="number"
                                                placeholder="Rate"
                                                value={item.rate}
                                                onChange={(e) => updateLineItem(index, 'rate', parseFloat(e.target.value) || 0)}
                                                className="w-28 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                            />
                                            <div className="w-28 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 text-right">
                                                {formatCurrency(item.amount)}
                                            </div>
                                            <button
                                                onClick={() => removeLineItem(index)}
                                                className="p-2 text-red-400 hover:text-red-300"
                                                disabled={newInvoice.lineItems.length <= 1}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={addLineItem}
                                    className="mt-2 text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Line Item
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Tax Rate (%)</label>
                                    <input
                                        type="number"
                                        value={newInvoice.taxRate}
                                        onChange={(e) => {
                                            const rate = parseFloat(e.target.value) || 0;
                                            const tax = newInvoice.subtotal * (rate / 100);
                                            setNewInvoice(prev => ({
                                                ...prev,
                                                taxRate: rate,
                                                tax,
                                                total: prev.subtotal + tax,
                                            }));
                                        }}
                                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Notes</label>
                                    <textarea
                                        value={newInvoice.notes}
                                        onChange={(e) => setNewInvoice(prev => ({ ...prev, notes: e.target.value }))}
                                        rows={3}
                                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                                    />
                                </div>
                            </div>

                            <div className="border-t border-slate-700 pt-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Subtotal:</span>
                                    <span className="text-white">{formatCurrency(newInvoice.subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-sm mt-2">
                                    <span className="text-slate-400">Tax ({newInvoice.taxRate}%):</span>
                                    <span className="text-white">{formatCurrency(newInvoice.tax)}</span>
                                </div>
                                <div className="flex justify-between text-lg font-semibold mt-2">
                                    <span className="text-white">Total:</span>
                                    <span className="text-emerald-400">{formatCurrency(newInvoice.total)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateInvoice}
                                disabled={actionLoading === 'create'}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2"
                            >
                                {actionLoading === 'create' ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Plus className="w-4 h-4" />
                                )}
                                Create Invoice
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Invoice Details Modal */}
            {showDetails && selectedInvoice && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-white">Invoice {selectedInvoice.invoiceNumber}</h3>
                                <p className="text-sm text-slate-400">
                                    Created {formatDate(selectedInvoice.createdAt)}
                                </p>
                            </div>
                            <button onClick={() => { setShowDetails(false); setSelectedInvoice(null); }} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-2">
                                <span className={`px-3 py-1 rounded-full text-sm ${STATUS_CONFIG[selectedInvoice.status as InvoiceStatus]?.bgColor} ${STATUS_CONFIG[selectedInvoice.status as InvoiceStatus]?.color}`}>
                                    {STATUS_CONFIG[selectedInvoice.status as InvoiceStatus]?.label || selectedInvoice.status}
                                </span>
                                {isOverdue(selectedInvoice) && (
                                    <span className="px-3 py-1 rounded-full text-sm bg-red-500/20 text-red-400">
                                        Overdue
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-slate-400">Issue Date</p>
                                    <p className="text-white">{formatDate(selectedInvoice.issueDate)}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400">Due Date</p>
                                    <p className="text-white">{formatDate(selectedInvoice.dueDate)}</p>
                                </div>
                            </div>

                            <div className="border-t border-slate-700 pt-4">
                                <h4 className="text-sm font-medium text-white mb-3">Line Items</h4>
                                <div className="space-y-2">
                                    {selectedInvoice.lineItems.map((item, index) => (
                                        <div key={index} className="flex justify-between text-sm">
                                            <div>
                                                <p className="text-white">{item.description}</p>
                                                <p className="text-slate-500">{item.quantity} x {formatCurrency(item.rate)}</p>
                                            </div>
                                            <p className="text-white">{formatCurrency(item.amount)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t border-slate-700 pt-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Subtotal:</span>
                                    <span className="text-white">{formatCurrency(selectedInvoice.subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-sm mt-2">
                                    <span className="text-slate-400">Tax ({selectedInvoice.taxRate}%):</span>
                                    <span className="text-white">{formatCurrency(selectedInvoice.tax)}</span>
                                </div>
                                <div className="flex justify-between text-lg font-semibold mt-2">
                                    <span className="text-white">Total:</span>
                                    <span className="text-emerald-400">{formatCurrency(selectedInvoice.total)}</span>
                                </div>
                            </div>

                            {selectedInvoice.notes && (
                                <div className="border-t border-slate-700 pt-4">
                                    <h4 className="text-sm font-medium text-white mb-2">Notes</h4>
                                    <p className="text-sm text-slate-400 whitespace-pre-wrap">{selectedInvoice.notes}</p>
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
                            <button
                                onClick={() => handleDownloadPDF(selectedInvoice)}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center gap-2"
                            >
                                <FileDown className="w-4 h-4" />
                                Download PDF
                            </button>
                            {selectedInvoice.status === 'draft' && (
                                <button
                                    onClick={() => {
                                        handleSendInvoice(selectedInvoice.id);
                                        setShowDetails(false);
                                    }}
                                    disabled={actionLoading === selectedInvoice.id}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Send className="w-4 h-4" />
                                    Send Invoice
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
