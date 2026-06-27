'use client';

import React, { useState, useEffect } from 'react';
import { 
    DollarSign, FileText, Download, Eye, Send, Mail, CheckCircle, Clock, 
    AlertCircle, Filter, Plus, Edit, Trash2, RefreshCw, User, Calendar, 
    Search, X, ChevronDown, FileCheck2, ArrowLeft, MoreVertical, CheckSquare, Square
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTenant } from '../../../contexts/TenantContext';
import { businessInvoiceService, BusinessInvoice } from '../../../services/businessInvoiceService';
import { businessClientService } from '../../../services/businessClientService';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import EnhancedInvoiceModal from '../EnhancedInvoiceModal';
import { Button, Card } from '../../ui/UIComponents';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { CommunicationModal } from '../crm/CommunicationModal';
import type { EmailRecipient } from '../crm/emailRecipient';
import { OperationalWorkflowStrip } from '../OperationalWorkflowStrip';
import RecurringInvoicesPanel from '../invoicing/RecurringInvoicesPanel';

interface EnhancedBillingPageProps {
    user: any;
}

const EnhancedBillingPage: React.FC<EnhancedBillingPageProps> = ({ user }) => {
    const { currentTenant } = useTenant();
    const { isMobile, isTablet, isDesktop } = useBreakpoint();
    
    const [invoices, setInvoices] = useState<BusinessInvoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'draft' | 'sent' | 'paid' | 'overdue'>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<BusinessInvoice | null>(null);
    const [showPDFPreview, setShowPDFPreview] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedInvoiceForOptions, setSelectedInvoiceForOptions] = useState<BusinessInvoice | null>(null);
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);
    const [revenueData, setRevenueData] = useState<any[]>([]);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        pendingAmount: 0,
        overdueAmount: 0,
        draftCount: 0,
        sentCount: 0,
        paidCount: 0
    });
    const [clientMap, setClientMap] = useState<Record<string, { name: string; email?: string }>>({});
    const [emailCompose, setEmailCompose] = useState<{ recipient: EmailRecipient; subject: string; body?: string } | null>(null);
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
    const [bulkDeletingInvoices, setBulkDeletingInvoices] = useState(false);

    const toggleInvoiceSelection = (inv: BusinessInvoice) => {
        if (inv.status !== 'draft') {
            toast.error('Only draft invoices can be deleted. Sent or paid invoices must stay on file.');
            return;
        }
        setSelectedInvoiceIds((prev) => {
            const next = new Set(prev);
            if (next.has(inv.id)) next.delete(inv.id);
            else next.add(inv.id);
            return next;
        });
    };

    const handleBulkDeleteInvoices = async () => {
        const ids = [...selectedInvoiceIds];
        if (!ids.length) return;
        if (!confirm(`Delete ${ids.length} draft invoice(s)? This cannot be undone.`)) return;

        setBulkDeletingInvoices(true);
        const toastId = toast.loading(`Deleting ${ids.length} invoice(s)...`);
        try {
            const { error, count, skipped } = await businessInvoiceService.bulkDeleteInvoices(ids);
            if (error) throw new Error(error);
            setInvoices((prev) => prev.filter((inv) => !selectedInvoiceIds.has(inv.id)));
            setSelectedInvoiceIds(new Set());
            if (skipped > 0) {
                toast.success(`Deleted ${count} draft(s). ${skipped} non-draft invoice(s) were skipped.`, { id: toastId });
            } else {
                toast.success(`Deleted ${count} invoice(s)`, { id: toastId });
            }
            await loadInvoices();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Bulk delete failed', { id: toastId });
        } finally {
            setBulkDeletingInvoices(false);
        }
    };

    useEffect(() => {
        if (currentTenant?.id) {
            loadInvoices();
            loadClients();
        }
    }, [currentTenant?.id]);

    const loadClients = async () => {
        if (!currentTenant?.id) return;
        const { clients } = await businessClientService.getClients(currentTenant.id);
        if (clients) {
            const map: Record<string, { name: string; email?: string }> = {};
            clients.forEach((c) => {
                map[c.id] = { name: c.name, email: c.email || undefined };
            });
            setClientMap(map);
        }
    };

    const resolveInvoiceRecipient = (inv: BusinessInvoice): EmailRecipient | null => {
        const metadata = businessInvoiceService.parseMetadata(inv.notes);
        const clientInfo = inv.clientId ? clientMap[inv.clientId] : null;
        const email = clientInfo?.email || metadata?.clientEmail || metadata?.email;
        if (!email) return null;
        return {
            id: inv.clientId,
            name: clientInfo?.name || metadata?.clientName || 'Client',
            email,
            description: `Invoice ${inv.invoiceNumber} — ${inv.total.toFixed(2)} due ${inv.dueDate}`,
        };
    };

    const openInvoiceCompose = (inv: BusinessInvoice) => {
        const recipient = resolveInvoiceRecipient(inv);
        if (!recipient) {
            toast.error('No client email on file for this invoice.');
            return;
        }
        setIsOptionsOpen(false);
        setEmailCompose({
            recipient,
            subject: `Invoice ${inv.invoiceNumber} from ${currentTenant?.name || 'AlphaClone'}`,
            body: `Hello ${recipient.name.split(' ')[0]},\n\nPlease find details for invoice ${inv.invoiceNumber} (total ${inv.total.toFixed(2)}, due ${inv.dueDate}).\n\nThank you for your business.`,
        });
    };

    const loadInvoices = async () => {
        if (!currentTenant?.id) return;
        setLoading(true);
        const { invoices: data } = await businessInvoiceService.getInvoices(currentTenant.id);
        if (data) {
            setInvoices(data);
            calculateStats(data);
            loadRevenueData(data);
        }
        setLoading(false);
    };

    const calculateStats = (invoiceData: BusinessInvoice[]) => {
        const s = { totalRevenue: 0, pendingAmount: 0, overdueAmount: 0, draftCount: 0, sentCount: 0, paidCount: 0 };
        invoiceData.forEach(inv => {
            if (inv.status === 'paid') { s.totalRevenue += inv.total; s.paidCount++; }
            else if (inv.status === 'sent') { s.pendingAmount += inv.total; s.sentCount++; }
            else if (inv.status === 'overdue') { s.overdueAmount += inv.total; }
            else if (inv.status === 'draft') s.draftCount++;
        });
        setStats(s);
    };

    const loadRevenueData = (source: BusinessInvoice[]) => {
        const revenueMap: Record<string, number> = {};
        source.forEach(inv => {
            if (inv.status === 'paid') {
                const day = (inv.updatedAt || inv.issueDate || new Date().toISOString()).slice(0, 10);
                revenueMap[day] = (revenueMap[day] || 0) + inv.total;
            }
        });
        const sorted = Object.entries(revenueMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, revenue]) => ({ date, revenue }));
        setRevenueData(sorted.length ? sorted : [{ date: 'Today', revenue: 0 }]);
    };

    const [activeTab, setActiveTab] = useState<'invoices' | 'recurring' | 'services'>('invoices');

    const filteredInvoices = invoices.filter(inv => {
        const matchesFilter = filter === 'all' || inv.status === filter;
        const matchesSearch = searchTerm === '' || inv.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'paid': return 'text-teal-400 bg-teal-400/10 border-teal-500/20';
            case 'sent': return 'text-teal-400 bg-teal-400/10 border-teal-500/20';
            case 'overdue': return 'text-rose-400 bg-rose-400/10 border-rose-500/20';
            default: return 'text-slate-400 bg-slate-400/10 border-slate-500/20';
        }
    };

    const handleViewPDF = (inv: BusinessInvoice) => {
        const metadata = businessInvoiceService.parseMetadata(inv.notes);
        const client = inv.clientId
            ? { name: clientMap[inv.clientId]?.name || inv.clientId, email: clientMap[inv.clientId]?.email || '' }
            : { name: metadata?.clientName || 'Walk-in', email: metadata?.clientEmail || metadata?.email || '' };
        const doc = businessInvoiceService.generatePDF(inv, currentTenant!, client);
        const pdfUrl = URL.createObjectURL(doc.output('blob'));
        setShowPDFPreview(pdfUrl);
    };

    if (loading) return <div className="p-8 text-slate-400">Loading Billing Data...</div>;

    const ServicesCatalog = React.lazy(() => import('./ServicesCatalog').then(m => ({ default: m.ServicesCatalog })));

    return (
        <div className={`space-y-6 pb-24 ${isMobile ? 'p-2' : 'p-6'}`}>
            <OperationalWorkflowStrip moduleId="invoicing" userRole={user?.role} />
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase flex items-center gap-3">
                        <DollarSign className="text-teal-500" /> Billing Hub
                    </h1>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Invoice Management & Collections</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => setActiveTab('invoices')}
                    className={`flex-1 sm:flex-none h-10 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest border transition-all ${activeTab === 'invoices' ? 'bg-teal-600 border-teal-500 text-white' : 'bg-white/5 border-white/5 text-slate-500'}`}
                  >
                    Invoices
                  </button>
                  <button 
                    onClick={() => setActiveTab('recurring')}
                    className={`flex-1 sm:flex-none h-10 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest border transition-all ${activeTab === 'recurring' ? 'bg-teal-600 border-teal-500 text-white' : 'bg-white/5 border-white/5 text-slate-500'}`}
                  >
                    Recurring
                  </button>
                  <button 
                    onClick={() => setActiveTab('services')}
                    className={`flex-1 sm:flex-none h-10 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest border transition-all ${activeTab === 'services' ? 'bg-teal-600 border-teal-500 text-white' : 'bg-white/5 border-white/5 text-slate-500'}`}
                  >
                    Services
                  </button>
                </div>
            </div>

            {activeTab === 'services' ? (
                <React.Suspense fallback={<div className="p-12 text-center text-slate-500">Loading Catalog...</div>}>
                    <ServicesCatalog />
                </React.Suspense>
            ) : activeTab === 'recurring' ? (
                currentTenant?.id ? (
                    <RecurringInvoicesPanel
                        tenantId={currentTenant.id}
                        clients={Object.entries(clientMap).map(([id, c]) => ({ id, name: c.name, email: c.email }))}
                    />
                ) : null
            ) : (
                <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: 'Revenue', value: stats.totalRevenue, color: 'text-teal-400' },
                    { label: 'Pending', value: stats.pendingAmount, color: 'text-teal-400' },
                    { label: 'Overdue', value: stats.overdueAmount, color: 'text-rose-400' },
                    { label: 'Drafts', value: stats.draftCount, color: 'text-slate-400' }
                ].map(s => (
                    <Card key={s.label} className="p-4 bg-slate-900/40 border-white/5">
                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">{s.label}</p>
                        <p className={`text-lg font-black ${s.color}`}>${s.value.toLocaleString()}</p>
                    </Card>
                ))}
            </div>

            {/* Chart */}
            {!isMobile && (
                <Card className="p-6 bg-slate-900/40 border-white/5 h-80">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
                        <LineChart data={revenueData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                            <XAxis 
                                dataKey="date" 
                                stroke="#4b5563" 
                                fontSize={10} 
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis 
                                stroke="#4b5563" 
                                fontSize={10} 
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(val: number) => `$${val}`}
                            />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '8px' }}
                                itemStyle={{ color: '#14b8a6' }}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="revenue" 
                                stroke="#14b8a6" 
                                strokeWidth={2} 
                                dot={false} 
                                activeDot={{ r: 4, strokeWidth: 0 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </Card>
            )}

            {/* Invoices List */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        {(['all', 'draft', 'sent', 'paid', 'overdue'] as const).map(s => (
                            <button key={s} onClick={() => setFilter(s)} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${filter === s ? 'bg-teal-600 border-teal-500 text-white' : 'bg-white/5 border-white/5 text-gray-500'}`}>{s}</button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        {selectedInvoiceIds.size > 0 && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setSelectedInvoiceIds(new Set())}
                                    className="h-10 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 text-slate-400"
                                >
                                    Clear
                                </button>
                                <button
                                    type="button"
                                    disabled={bulkDeletingInvoices}
                                    onClick={handleBulkDeleteInvoices}
                                    className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border border-rose-500/30 text-rose-300 flex items-center gap-2 disabled:opacity-50"
                                >
                                    <Trash2 size={14} />
                                    {bulkDeletingInvoices ? 'Deleting…' : `Delete (${selectedInvoiceIds.size})`}
                                </button>
                            </>
                        )}
                        <button onClick={() => setShowCreateModal(true)} className="flex-shrink-0 h-10 px-6 bg-teal-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-teal-900/20 flex items-center justify-center gap-2 transition-all hover:bg-teal-500">
                            <Plus size={16} /> New Invoice
                        </button>
                    </div>
                </div>
                <p className="text-xs text-slate-500 -mt-2">
                    Tip: select draft invoices to bulk-delete. Sent and paid invoices are protected for your books.
                </p>

                <div className="space-y-3">
                    {filteredInvoices.map(inv => (
                        <Card 
                            key={inv.id} 
                            onClick={() => { setSelectedInvoiceForOptions(inv); setIsOptionsOpen(true); }} 
                            className={`p-4 sm:p-5 bg-slate-900/40 border-white/5 hover:bg-white/[0.03] transition-all cursor-pointer ${
                                selectedInvoiceIds.has(inv.id) ? 'ring-1 ring-teal-500/40' : ''
                            }`}
                        >
                            <div className="flex justify-between items-start mb-3 gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleInvoiceSelection(inv);
                                        }}
                                        className={inv.status === 'draft' ? 'text-slate-400 hover:text-teal-400 shrink-0' : 'text-slate-700 cursor-not-allowed shrink-0'}
                                        aria-label={inv.status === 'draft' ? `Select ${inv.invoiceNumber}` : 'Only drafts can be selected'}
                                    >
                                        {selectedInvoiceIds.has(inv.id)
                                            ? <CheckSquare size={18} className="text-teal-400" />
                                            : <Square size={18} />}
                                    </button>
                                    <div className={`p-2 rounded-lg bg-white/5 ${getStatusStyles(inv.status)}`}><FileText size={18} /></div>
                                    <div>
                                        <p className="text-sm font-black text-white">{inv.invoiceNumber}</p>
                                        <p className="text-xs text-gray-500 font-bold uppercase">{inv.clientId && clientMap[inv.clientId]?.name ? clientMap[inv.clientId].name : 'Walk-in Client'}</p>
                                    </div>
                                </div>
                                <span className={`text-[11px] font-bold uppercase px-2.5 py-1 rounded-full border ${getStatusStyles(inv.status)}`}>{inv.status}</span>
                            </div>
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Due Date</p>
                                    <p className="text-xs font-bold text-gray-300">{new Date(inv.dueDate).toLocaleDateString()}</p>
                                </div>
                                <p className="text-[24px] font-black text-white font-mono tracking-tight leading-none">${inv.total.toLocaleString()}</p>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Invoice Options Bottom Sheet */}
            <AnimatePresence>
                {isOptionsOpen && selectedInvoiceForOptions && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.7 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOptionsOpen(false)}
                            className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                            className="fixed inset-x-0 bottom-0 z-[150] max-h-[92dvh] bg-slate-950 border-t border-white/10 rounded-t-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
                        >
                            <div className="flex justify-center py-3 shrink-0 cursor-grab bg-slate-900/40 border-b border-white/5">
                                <div className="w-12 h-1 bg-white/20 rounded-full" />
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar pb-12 space-y-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
                                            Invoice ID: #{selectedInvoiceForOptions.id.slice(0, 8).toUpperCase()}
                                        </span>
                                        <h3 className="text-lg font-black text-white uppercase mt-1 tracking-tight">
                                            {selectedInvoiceForOptions.invoiceNumber}
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Client: {selectedInvoiceForOptions.clientId && clientMap[selectedInvoiceForOptions.clientId]?.name ? clientMap[selectedInvoiceForOptions.clientId].name : 'Walk-in Client'}
                                        </p>
                                    </div>
                                    <button onClick={() => setIsOptionsOpen(false)} className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 text-center">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono mb-1">Total Amount Due</p>
                                    <p className="text-3xl font-black text-teal-400 tracking-tight font-mono">
                                        ${selectedInvoiceForOptions.total.toLocaleString()}
                                    </p>
                                    <div className="mt-3 flex justify-center">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${getStatusStyles(selectedInvoiceForOptions.status)}`}>
                                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                            {selectedInvoiceForOptions.status}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    <button
                                        onClick={() => {
                                            handleViewPDF(selectedInvoiceForOptions);
                                            setIsOptionsOpen(false);
                                        }}
                                        className="w-full flex items-center justify-between p-4 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl transition-all text-left text-sm text-slate-200"
                                    >
                                        <span className="flex items-center gap-3">
                                            <Eye className="w-5 h-5 text-teal-400" />
                                            <span>Preview PDF Invoice</span>
                                        </span>
                                        <span className="text-xs text-slate-500 font-mono">PDF PREVIEW</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            const metadata = businessInvoiceService.parseMetadata(selectedInvoiceForOptions.notes);
                                            const client = selectedInvoiceForOptions.clientId
                                                ? { name: clientMap[selectedInvoiceForOptions.clientId]?.name || selectedInvoiceForOptions.clientId, email: clientMap[selectedInvoiceForOptions.clientId]?.email || '' }
                                                : { name: metadata?.clientName || 'Walk-in', email: metadata?.clientEmail || metadata?.email || '' };
                                            const doc = businessInvoiceService.generatePDF(selectedInvoiceForOptions, currentTenant!, client);
                                            doc.save(`${selectedInvoiceForOptions.invoiceNumber}.pdf`);
                                            setIsOptionsOpen(false);
                                        }}
                                        className="w-full flex items-center justify-between p-4 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl transition-all text-left text-sm text-slate-200"
                                    >
                                        <span className="flex items-center gap-3">
                                            <Download className="w-5 h-5 text-indigo-400" />
                                            <span>Download PDF File</span>
                                        </span>
                                        <span className="text-xs text-slate-500 font-mono">PDF DOWNLOAD</span>
                                    </button>

                                    <button
                                        onClick={() => openInvoiceCompose(selectedInvoiceForOptions)}
                                        className="w-full flex items-center justify-between p-4 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl transition-all text-left text-sm text-slate-200"
                                    >
                                        <span className="flex items-center gap-3">
                                            <Mail className="w-5 h-5 text-teal-400" />
                                            <span>Compose Email to Client</span>
                                        </span>
                                        <span className="text-xs text-slate-500 font-mono">ZOHO / OUTLOOK</span>
                                    </button>

                                    {selectedInvoiceForOptions.clientId && currentTenant?.id && (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const res = await fetch(
                                                        `/api/client-finance/portal-link/${selectedInvoiceForOptions.clientId}?tenantId=${encodeURIComponent(currentTenant.id)}`
                                                    );
                                                    const data = await res.json();
                                                    if (!res.ok || !data.url) throw new Error(data.error || 'Failed');
                                                    await navigator.clipboard.writeText(data.url);
                                                    toast.success('Client finance portal link copied');
                                                } catch (err) {
                                                    toast.error(err instanceof Error ? err.message : 'Failed to copy portal link');
                                                }
                                            }}
                                            className="w-full flex items-center justify-between p-4 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl transition-all text-left text-sm text-slate-200"
                                        >
                                            <span className="flex items-center gap-3">
                                                <User className="w-5 h-5 text-purple-400" />
                                                <span>Copy Client Finance Portal Link</span>
                                            </span>
                                            <span className="text-xs text-slate-500 font-mono">INVOICES + QUOTES</span>
                                        </button>
                                    )}

                                    <button
                                        onClick={async () => {
                                            setIsOptionsOpen(false);
                                            const toastId = toast.loading('Sending invoice...');
                                            try {
                                                const { callMcpTool } = await import('@/services/mcp/toolCaller');
                                                await callMcpTool('send_invoice', { invoice_id: selectedInvoiceForOptions.id });
                                                toast.success('Invoice dispatched successfully!', { id: toastId });
                                            } catch (err: any) {
                                                toast.error(`Failed: ${err.message}`, { id: toastId });
                                            }
                                        }}
                                        className="w-full flex items-center justify-between p-4 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl transition-all text-left text-sm text-slate-200"
                                    >
                                        <span className="flex items-center gap-3">
                                            <Send className="w-5 h-5 text-sky-400" />
                                            <span>Email Invoice to Client</span>
                                        </span>
                                        <span className="text-xs text-slate-500 font-mono">EMAIL DISPATCH</span>
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* PDF Preview Modal */}
            <AnimatePresence>
                {showPDFPreview && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex flex-col p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-white font-black uppercase tracking-widest text-sm">Invoice Preview</h3>
                            <button onClick={() => setShowPDFPreview(null)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white"><X size={20} /></button>
                        </div>
                        <iframe src={showPDFPreview} className="flex-1 w-full rounded-2xl border border-white/10" />
                        <div className="mt-4 flex gap-2">
                            <button
                                onClick={async () => {
                                    if (!selectedInvoiceForOptions) return;
                                    const toastId = toast.loading('Sending invoice...');
                                    try {
                                        const { callMcpTool } = await import('@/services/mcp/toolCaller');
                                        await callMcpTool('send_invoice', { invoice_id: selectedInvoiceForOptions.id });
                                        toast.success('Invoice dispatched successfully!', { id: toastId });
                                        setShowPDFPreview(null);
                                    } catch (err: any) {
                                        toast.error(`Failed: ${err.message}`, { id: toastId });
                                    }
                                }}
                                className="flex-1 h-12 bg-teal-600 text-white rounded-xl font-black uppercase text-xs"
                            >
                                Send Invoice
                            </button>
                            <button
                                onClick={() => {
                                    if (!selectedInvoiceForOptions) return;
                                    const metadata = businessInvoiceService.parseMetadata(selectedInvoiceForOptions.notes);
                                    const client = selectedInvoiceForOptions.clientId
                                        ? { name: clientMap[selectedInvoiceForOptions.clientId]?.name || selectedInvoiceForOptions.clientId, email: clientMap[selectedInvoiceForOptions.clientId]?.email || '' }
                                        : { name: metadata?.clientName || 'Walk-in', email: metadata?.clientEmail || metadata?.email || '' };
                                    const doc = businessInvoiceService.generatePDF(selectedInvoiceForOptions, currentTenant!, client);
                                    doc.save(`${selectedInvoiceForOptions.invoiceNumber}.pdf`);
                                }}
                                className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-white"
                            >
                                <Download size={20} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <EnhancedInvoiceModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} mode="create" onSuccess={loadInvoices} />

            {emailCompose && user && (
                <CommunicationModal
                    user={user}
                    recipient={emailCompose.recipient}
                    prefilledSubject={emailCompose.subject}
                    prefilledBody={emailCompose.body}
                    onClose={() => setEmailCompose(null)}
                    onSent={() => setEmailCompose(null)}
                />
            )}
                </>
            )}
        </div>
    );
};

export default EnhancedBillingPage;
