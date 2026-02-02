import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import { businessInvoiceService, BusinessInvoice } from '../../../services/businessInvoiceService';
import { businessClientService } from '../../../services/businessClientService';
import { projectService } from '../../../services/projectService';
import { contractService } from '../../../services/contractService';
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
    Lock,
    TrendingUp,
    TrendingDown
} from 'lucide-react';
import jsPDF from 'jspdf';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
        const { projects: projectData } = await projectService.getProjects(user.id, user.role);
        const { contracts: contractData } = await contractService.getUserContracts(user.id, 'tenant_admin');

        setInvoices(invData);
        setClients(clientData);
        setProjects(projectData);
        setContracts(contractData || []);
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
        const client = clients.find(c => c.id === invoice.clientId) || {};
        const tenant = currentTenant || { name: 'AlphaClone Business' };

        const doc = businessInvoiceService.generatePDF(invoice, tenant, client);
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
                        <ResponsiveContainer width="100%" height="100%">
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
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
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
                    contracts={contracts}
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

const CreateInvoiceModal = ({ clients, projects, contracts, onClose, onCreate }: any) => {
    const props = { contracts }; // Capture for logic usage
    const [formData, setFormData] = useState({
        clientId: '',
        projectId: '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        lineItems: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
        taxRate: 0,
        discountAmount: 0,
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

        // ENFORCEMENT: Block invoice if no contract
        if (formData.clientId) {
            // @ts-ignore - contracts passed via parent props but not clearly typed on modal yet (quick fix)
            const hasContract = (props.contracts || []).some((c: any) =>
                c.client_id === formData.clientId &&
                (c.status === 'fully_signed' || c.status === 'client_signed')
            );

            if (!hasContract) {
                alert('Action Blocked: You cannot bill a client without a signed contract.');
                return;
            }
        }

        const totals = businessInvoiceService.calculateTotals(
            formData.lineItems,
            formData.taxRate,
            formData.discountAmount
        );

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

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Discount Amount ($)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.discountAmount}
                                onChange={(e) => setFormData({ ...formData, discountAmount: parseFloat(e.target.value) || 0 })}
                                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Tax Rate (%)</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={formData.taxRate}
                                onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
                                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                            />
                        </div>
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
