import React, { useState, useEffect, useCallback } from 'react';
import { User } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import { businessInvoiceService, BusinessInvoice } from '../../../services/businessInvoiceService';
import { businessClientService } from '../../../services/businessClientService';
import { projectService } from '../../../services/projectService';
import { contractService } from '../../../services/contractService';
import {
    Plus,
    Download,
    DollarSign,
    FileText,
    X,
    Trash2,
    TrendingUp,
    Link as LinkIcon,
    Eye,
    ChevronLeft
} from 'lucide-react';
import { DocumentViewer } from '../../contracts/DocumentViewer';
import jsPDF from 'jspdf';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import CreateInvoiceModal from '../EnhancedCreateInvoiceModal';

interface BillingPageProps {
    user: User;
}

const BillingPage: React.FC<BillingPageProps> = ({ user }) => {
    const { currentTenant } = useTenant();
    const [invoices, setInvoices] = useState<BusinessInvoice[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [contracts, setContracts] = useState<any[]>([]);
    const [filter, setFilter] = useState<string>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedInvoice, setSelectedInvoice] = useState<BusinessInvoice | null>(null);
    const [viewerUrl, setViewerUrl] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        if (!currentTenant) return;

        setLoading(true);
        const { invoices: invData } = await businessInvoiceService.getInvoices(currentTenant.id);
        const { clients: clientData } = await businessClientService.getClients(currentTenant.id);
        const { projects: projectData } = await projectService.getProjects(user.id, user.role);
        const { contracts: contractData } = await contractService.getUserContracts(user.id, 'tenant_admin');

        setInvoices(invData);
        setClients(clientData);
        setProjects(projectData);
        setContracts(contractData || []);
        setLoading(false);
    }, [currentTenant, user.id, user.role]);

    useEffect(() => {
        if (currentTenant) {
            loadData();
        }
    }, [currentTenant, loadData]);

    const handleInvoiceCreated = useCallback(() => {
        loadData();
        setShowCreateModal(false);
    }, [loadData]);

    const handleDownloadPDF = useCallback((invoice: BusinessInvoice) => {
        const client = clients.find(c => c.id === invoice.clientId) || {};
        const tenant = currentTenant || { name: 'AlphaClone Business' };

        try {
            const doc = businessInvoiceService.generatePDF(invoice, tenant, client);
            doc.save(`invoice-${invoice.invoiceNumber}.pdf`);
            toast.success('Invoice downloaded');
        } catch (e) {
            console.error('PDF Generation Error:', e);
            toast.error('Failed to generate PDF');
        }
    }, [clients, currentTenant]);

    const handleViewInvoice = useCallback((invoice: BusinessInvoice) => {
        const client = clients.find(c => c.id === invoice.clientId) || {};
        const tenant = currentTenant || { name: 'AlphaClone Business' };

        try {
            const doc = businessInvoiceService.generatePDF(invoice, tenant, client);
            // Use output('blob') directly for rendering in the viewer
            const pdfBlob = doc.output('blob');
            const url = URL.createObjectURL(pdfBlob);
            setViewerUrl(url);
            setSelectedInvoice(invoice);
        } catch (e) {
            console.error('PDF Preview Error:', e);
            toast.error('Failed to generate preview');
        }
    }, [clients, currentTenant]);

    const handleDeleteInvoice = useCallback(async (invoiceId: string) => {
        if (!confirm('Are you sure you want to delete this invoice?')) return;

        const { error } = await businessInvoiceService.deleteInvoice(invoiceId);
        if (error) {
            toast.error(`Failed to delete invoice: ${error}`);
        } else {
            setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
            toast.success('Invoice deleted');
        }
    }, []);

    // Status order for forward-only progression
    const STATUS_ORDER = ['draft', 'sent', 'paid', 'overdue'];

    const handleUpdateInvoiceStatus = useCallback(async (invoiceId: string, newStatus: string) => {
        const { error } = await businessInvoiceService.updateInvoice(invoiceId, { status: newStatus as any });
        if (error) {
            toast.error(`Failed to update status: ${error}`);
        } else {
            setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: newStatus as any } : inv));
            toast.success(`Invoice marked as "${newStatus}"`);
        }
    }, []);

    const filteredInvoices = filter === 'all'
        ? invoices
        : invoices.filter(inv => inv.status === filter);

    const stats = {
        total: Math.round(invoices.reduce((sum, inv) => sum + (inv.total || 0), 0) * 100) / 100,
        paid: Math.round(invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.total || 0), 0) * 100) / 100,
        pending: Math.round(invoices.filter(inv => inv.status !== 'paid').reduce((sum, inv) => sum + (inv.total || 0), 0) * 100) / 100
    };

    if (loading) {
        return <div className="flex items-center justify-center h-full"><div className="text-slate-400">Loading invoices...</div></div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Invoices & Billing</h2>
                    <p className="text-slate-400 mt-1">{invoices.length} total invoices</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Create Invoice</span>
                </button>
            </div>

            {/* Stats & Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Financial Summary Cards */}
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
                        <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Total Revenue</p>
                        <p className="text-2xl font-bold text-white">${stats.total.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
                        <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Outstanding</p>
                        <p className="text-2xl font-bold text-orange-400">${stats.pending.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
                        <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Expenses (Est)</p>
                        <p className="text-2xl font-bold text-red-400 flex items-center gap-2">
                            ${(stats.paid * 0.3).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            <span className="text-xs text-slate-500 font-normal bg-slate-800 px-1.5 py-0.5 rounded">Est. 30%</span>
                        </p>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <DollarSign className="w-12 h-12 text-teal-400" />
                        </div>
                        <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Net Profit</p>
                        <p className="text-2xl font-bold text-teal-400">
                            ${(stats.paid * 0.7).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                    </div>
                </div>

                {/* Chart Section */}
                <div className="lg:col-span-3 bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-teal-400" /> Revenue Performance
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
                            <AreaChart data={[
                                { name: 'Jan', revenue: stats.paid * 0.1, expenses: stats.paid * 0.05 },
                                { name: 'Feb', revenue: stats.paid * 0.2, expenses: stats.paid * 0.08 },
                                { name: 'Mar', revenue: stats.paid * 0.15, expenses: stats.paid * 0.04 },
                                { name: 'Apr', revenue: stats.paid * 0.3, expenses: stats.paid * 0.1 },
                                { name: 'May', revenue: stats.paid * 0.25, expenses: stats.paid * 0.07 },
                                { name: 'Jun', revenue: stats.paid * 0.4, expenses: stats.paid * 0.12 }
                            ]}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value: number) => `$${value}`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                                    itemStyle={{ color: '#e2e8f0' }}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#14b8a6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
                                <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpenses)" name="Expenses" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                {['all', 'draft', 'sent', 'paid', 'overdue'].map(status => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`px-5 py-2.5 rounded-xl font-medium transition-all text-sm ${filter === status
                            ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                            }`}
                    >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                ))}
            </div>

            {/* Invoice List */}
            <div className="space-y-3">
                {filteredInvoices.map(invoice => (
                    <InvoiceCard
                        key={invoice.id}
                        invoice={invoice}
                        clients={clients}
                        onDownload={handleDownloadPDF}
                        onView={handleViewInvoice}
                        onDelete={handleDeleteInvoice}
                        onStatusUpdate={handleUpdateInvoiceStatus}
                        statusOrder={STATUS_ORDER}
                    />
                ))}
            </div>

            {/* Document Viewer Modal */}
            {selectedInvoice && viewerUrl && (
                <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900 shrink-0 shadow-2xl">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => { setSelectedInvoice(null); setViewerUrl(null); }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all text-sm font-bold"
                            >
                                <ChevronLeft className="w-4 h-4" /> Close Viewer
                            </button>
                            <div className="w-px h-6 bg-white/10" />
                            <span className="text-white font-bold text-sm">{selectedInvoice.invoiceNumber}</span>
                        </div>
                        <button
                            onClick={() => handleDownloadPDF(selectedInvoice)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shadow-lg shadow-teal-500/20"
                        >
                            <Download className="w-4 h-4" /> Download PDF
                        </button>
                    </div>
                    <div className="flex-1 overflow-hidden p-4 sm:p-8 bg-slate-950">
                        <DocumentViewer
                            url={viewerUrl}
                            userName={user.name || 'User'}
                            onDownload={() => handleDownloadPDF(selectedInvoice)}
                        />
                    </div>
                </div>
            )}

            {filteredInvoices.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                    No invoices found. Create your first invoice to get started!
                </div>
            )}

            {/* Create Invoice Modal */}
            {showCreateModal && (
                <CreateInvoiceModal
                    isOpen={showCreateModal}
                    projects={projects}
                    onClose={() => setShowCreateModal(false)}
                    onInvoiceCreated={handleInvoiceCreated}
                />
            )}
        </div>
    );
};

const InvoiceCard = ({ invoice, clients, onDownload, onView, onDelete, onStatusUpdate, statusOrder }: any) => {
    const client = clients.find((c: any) => c.id === invoice.clientId);

    const statusColors: Record<string, string> = {
        draft: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
        sent: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        paid: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
        overdue: 'bg-red-500/10 text-red-400 border-red-500/20'
    };

    // Forward-only: only show options at the current level or ahead
    const currentIndex = (statusOrder as string[]).indexOf(invoice.status);
    const availableStatuses = (statusOrder as string[]).filter((_: string, i: number) => i >= currentIndex);

    const isPaid = invoice.status === 'paid';

    return (
        <div className="bg-slate-900/50 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition-all group shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-teal-500/10 border border-teal-500/20 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-6 h-6 text-teal-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold break-all">{invoice.invoiceNumber}</h3>
                        <p className="text-sm text-slate-400">{client?.name || 'No client'}</p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center gap-4 border-t md:border-t-0 border-slate-800 pt-4 md:pt-0">
                    <div className="flex items-center justify-between md:block md:text-right">
                        <div className="md:hidden text-sm text-slate-400">Total</div>
                        <div>
                            <p className="text-2xl font-bold text-teal-400">${invoice.total.toLocaleString()}</p>
                            <p className="text-xs text-slate-500 text-right">Due: {invoice.dueDate}</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-3">
                        {/* Status dropdown — forward-only (no going back) */}
                        {isPaid ? (
                            <span className={`text-xs px-3 py-1 rounded-full border font-bold uppercase ${statusColors[invoice.status]}`}>
                                Paid
                            </span>
                        ) : (
                            <select
                                value={invoice.status}
                                onChange={(e) => onStatusUpdate(invoice.id, e.target.value)}
                                className={`text-xs font-bold uppercase rounded-full px-3 py-1 border cursor-pointer outline-none bg-slate-900 ${statusColors[invoice.status]}`}
                                title="Update invoice status"
                            >
                                {availableStatuses.map((s: string) => (
                                    <option key={s} value={s} className="bg-slate-900 text-slate-200 normal-case">
                                        {s.charAt(0).toUpperCase() + s.slice(1)}
                                    </option>
                                ))}
                            </select>
                        )}

                        <div className="flex gap-2 relative">
                            {invoice.isPublic && (
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(`${window.location.origin}/invoice/${invoice.id}`);
                                        toast.success('Payment link copied');
                                    }}
                                    className="p-2 bg-slate-800 hover:bg-teal-500/20 text-slate-400 hover:text-teal-400 rounded-lg transition-colors"
                                    title="Copy Payment Link"
                                >
                                    <LinkIcon className="w-4 h-4" />
                                </button>
                            )}
                            <button
                                onClick={() => onView(invoice)}
                                className="p-2 bg-slate-800 hover:bg-teal-500/20 text-slate-400 hover:text-teal-400 rounded-lg transition-colors"
                                title="View Invoice"
                            >
                                <Eye className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => onDownload(invoice)}
                                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                                title="Download PDF"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => onDelete(invoice.id)}
                                className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                                title="Delete"
                            >
                                <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BillingPage;
