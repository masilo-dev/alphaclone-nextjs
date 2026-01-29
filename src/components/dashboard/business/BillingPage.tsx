import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import { businessInvoiceService, BusinessInvoice } from '../../../services/businessInvoiceService';
import { businessClientService } from '../../../services/businessClientService';
import { businessProjectService } from '../../../services/businessProjectService';
import {
    Plus,
    Download,
    Send,
    DollarSign,
    FileText,
    X,
    Trash2,
    Share2,
    Globe,
    Lock
} from 'lucide-react';
import jsPDF from 'jspdf';

interface BillingPageProps {
    user: User;
}

const BillingPage: React.FC<BillingPageProps> = ({ user }) => {
    const { currentTenant } = useTenant();
    const [invoices, setInvoices] = useState<BusinessInvoice[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [filter, setFilter] = useState<string>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (currentTenant) {
            loadData();
        }
    }, [currentTenant]);

    const loadData = async () => {
        if (!currentTenant) return;

        setLoading(true);
        const { invoices: invData } = await businessInvoiceService.getInvoices(currentTenant.id);
        const { clients: clientData } = await businessClientService.getClients(currentTenant.id);
        const { projects: projectData } = await businessProjectService.getProjects(currentTenant.id);

        setInvoices(invData);
        setClients(clientData);
        setProjects(projectData);
        setLoading(false);
    };

    const handleCreateInvoice = async (invoiceData: Partial<BusinessInvoice>) => {
        if (!currentTenant) return;

        const { invoice, error } = await businessInvoiceService.createInvoice(currentTenant.id, invoiceData);
        if (!error && invoice) {
            setInvoices([invoice, ...invoices]);
            setShowCreateModal(false);
        }
    };

    const handleDownloadPDF = (invoice: BusinessInvoice) => {
        const doc = new jsPDF();

        // Add invoice content
        doc.setFontSize(20);
        doc.text('INVOICE', 20, 20);

        doc.setFontSize(12);
        doc.text(`Invoice #: ${invoice.invoiceNumber}`, 20, 40);
        doc.text(`Issue Date: ${invoice.issueDate}`, 20, 50);
        doc.text(`Due Date: ${invoice.dueDate}`, 20, 60);
        doc.text(`Status: ${invoice.status.toUpperCase()}`, 20, 70);

        doc.text(`Subtotal: $${invoice.subtotal.toFixed(2)}`, 20, 90);
        doc.text(`Tax: $${invoice.tax.toFixed(2)}`, 20, 100);
        doc.setFontSize(14);
        doc.text(`Total: $${invoice.total.toFixed(2)}`, 20, 110);

        doc.save(`invoice-${invoice.invoiceNumber}.pdf`);
    };

    const handleDeleteInvoice = async (invoiceId: string) => {
        if (!confirm('Are you sure you want to delete this invoice?')) return;

        const { error } = await businessInvoiceService.deleteInvoice(invoiceId);
        if (!error) {
            setInvoices(invoices.filter(inv => inv.id !== invoiceId));
        }
    };

    const filteredInvoices = filter === 'all'
        ? invoices
        : invoices.filter(inv => inv.status === filter);

    const stats = {
        total: invoices.reduce((sum, inv) => sum + inv.total, 0),
        paid: invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.total, 0),
        pending: invoices.filter(inv => inv.status !== 'paid').reduce((sum, inv) => sum + inv.total, 0)
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

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 shadow-sm">
                    <p className="text-sm font-medium text-slate-400 mb-1">Total Revenue</p>
                    <p className="text-2xl font-bold text-teal-400 tracking-tight">${stats.total.toLocaleString()}</p>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 shadow-sm">
                    <p className="text-sm font-medium text-slate-400 mb-1">Paid</p>
                    <p className="text-2xl font-bold text-green-400 tracking-tight">${stats.paid.toLocaleString()}</p>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 shadow-sm">
                    <p className="text-sm font-medium text-slate-400 mb-1">Pending</p>
                    <p className="text-2xl font-bold text-orange-400 tracking-tight">${stats.pending.toLocaleString()}</p>
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
                        onDelete={handleDeleteInvoice}
                    />
                ))}
            </div>

            {filteredInvoices.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                    No invoices found. Create your first invoice to get started!
                </div>
            )}

            {/* Create Invoice Modal */}
            {showCreateModal && (
                <CreateInvoiceModal
                    clients={clients}
                    projects={projects}
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleCreateInvoice}
                />
            )}
        </div>
    );
};

const InvoiceCard = ({ invoice, clients, onDownload, onDelete }: any) => {
    const client = clients.find((c: any) => c.id === invoice.clientId);

    const statusColors = {
        draft: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
        sent: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        paid: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
        overdue: 'bg-red-500/10 text-red-400 border-red-500/20'
    };

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
                        <span className={`text-xs px-3 py-1 rounded-full border ${statusColors[invoice.status as keyof typeof statusColors]}`}>
                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </span>

                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    const url = `${window.location.origin}/invoice/${invoice.id}`;
                                    navigator.clipboard.writeText(url);
                                    alert('Payment link copied to clipboard!');
                                }}
                                className={`p-2 rounded-lg transition-colors ${invoice.isPublic ? 'bg-teal-500/10 hover:bg-teal-500/20 text-teal-400' : 'bg-slate-800 text-slate-500'}`}
                                title={invoice.isPublic ? 'Copy Payment Link' : 'Invoice is Private'}
                            >
                                <Share2 className="w-4 h-4" />
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

const CreateInvoiceModal = ({ clients, projects, onClose, onCreate }: any) => {
    const [formData, setFormData] = useState({
        clientId: '',
        projectId: '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        lineItems: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
        notes: '',
        isPublic: true
    });

    const addLineItem = () => {
        setFormData({
            ...formData,
            lineItems: [...formData.lineItems, { description: '', quantity: 1, rate: 0, amount: 0 }]
        });
    };

    const updateLineItem = (index: number, field: string, value: any) => {
        const newItems = [...formData.lineItems];
        newItems[index] = { ...newItems[index], [field]: value };

        if (field === 'quantity' || field === 'rate') {
            newItems[index].amount = newItems[index].quantity * newItems[index].rate;
        }

        setFormData({ ...formData, lineItems: newItems });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const totals = businessInvoiceService.calculateTotals(formData.lineItems, 0);

        onCreate({
            ...formData,
            ...totals,
            status: 'draft'
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold">Create Invoice</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Client *</label>
                            <select
                                required
                                value={formData.clientId}
                                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                            >
                                <option value="">Select client</option>
                                {clients.map((client: any) => (
                                    <option key={client.id} value={client.id}>{client.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Due Date *</label>
                            <input
                                type="date"
                                required
                                value={formData.dueDate}
                                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                            />
                        </div>
                    </div>


                    <div>
                        <label className="block text-sm font-medium mb-2">Project (Optional)</label>
                        <select
                            value={formData.projectId}
                            onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        >
                            <option value="">Select project</option>
                            {projects.map((project: any) => (
                                <option key={project.id} value={project.id}>{project.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium">Line Items</label>
                            <button
                                type="button"
                                onClick={addLineItem}
                                className="text-sm text-teal-400 hover:text-teal-300"
                            >
                                + Add Item
                            </button>
                        </div>

                        {formData.lineItems.map((item, index) => (
                            <div key={index} className="grid grid-cols-12 gap-2 mb-2">
                                <input
                                    type="text"
                                    placeholder="Description"
                                    value={item.description}
                                    onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                                    className="col-span-6 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500 text-sm"
                                />
                                <input
                                    type="number"
                                    placeholder="Qty"
                                    value={item.quantity}
                                    onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                    className="col-span-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500 text-sm"
                                />
                                <input
                                    type="number"
                                    placeholder="Rate"
                                    value={item.rate}
                                    onChange={(e) => updateLineItem(index, 'rate', parseFloat(e.target.value) || 0)}
                                    className="col-span-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500 text-sm"
                                />
                                <div className="col-span-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm flex items-center">
                                    ${item.amount.toFixed(2)}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Notes</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                        <input
                            type="checkbox"
                            id="isPublicInv"
                            checked={formData.isPublic}
                            onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                            className="w-4 h-4 text-teal-500 bg-slate-950 border-slate-700 rounded focus:ring-teal-500"
                        />
                        <label htmlFor="isPublicInv" className="text-sm font-medium cursor-pointer">
                            Enable Online Payment Link
                            <p className="text-xs text-slate-500 font-normal">Clients can view and pay via this link without logging in</p>
                        </label>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors"
                        >
                            Create Invoice
                        </button>
                    </div>
                </form>
            </div >
        </div >
    );
};

export default BillingPage;
