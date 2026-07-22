'use client';

import React, { useState, useEffect } from 'react';
import { useBonnieDeepLinkFocus } from '@/hooks/useBonnieDeepLinkFocus';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { buildMailComposeUrl } from '@/lib/email/composeNavigation';

interface EnhancedBillingPageProps {
    user: any;
}

const EnhancedBillingPage: React.FC<EnhancedBillingPageProps> = ({ user }) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { currentTenant } = useTenant();
    const { isMobile, isTablet, isDesktop } = useBreakpoint();
    
    const [invoices, setInvoices] = useState<BusinessInvoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'draft' | 'sent' | 'paid' | 'overdue'>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState<BusinessInvoice | null>(null);
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
        setSelectedInvoiceIds((prev) => {
            const next = new Set(prev);
            if (next.has(inv.id)) next.delete(inv.id);
            else next.add(inv.id);
            return next;
        });
    };

    const handleBulkEmailInvoices = () => {
        if (selectedInvoiceIds.size === 0) return;
        const recipients = invoices
            .filter((inv) => selectedInvoiceIds.has(inv.id))
            .map((inv) => resolveInvoiceRecipient(inv)?.email?.trim() || '')
            .filter((email, index, arr) => email.length > 0 && arr.indexOf(email) === index);

        if (recipients.length === 0) {
            toast.error('Selected invoices do not have client email addresses.');
            return;
        }

        const subject = recipients.length === 1 ? 'Invoice follow-up' : 'Invoices follow-up';
        router.push(buildMailComposeUrl(recipients, subject));
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

    useEffect(() => {
        if (!searchParams) return;
        if (searchParams.get('create') === 'true' || searchParams.get('new') === 'true') {
            setShowCreateModal(true);
            router.replace('/dashboard/business/billing/manage', { scroll: false });
        }
    }, [searchParams, router]);

    useBonnieDeepLinkFocus({
        onFocus: ({ focus, recordId }) => {
            if (focus === 'overdue') setFilter('overdue');
            if (recordId) {
                const invoice = invoices.find((item) => item.id === recordId);
                if (invoice) {
                    setSelectedInvoiceForOptions(invoice);
                    setIsOptionsOpen(true);
                }
            }
        },
    });

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
        if (!currentTenant?.id) return;
        setShowPDFPreview(
          `/api/invoices/${encodeURIComponent(inv.id)}/pdf?tenantId=${encodeURIComponent(currentTenant.id)}`
        );
    };

    const handleDownloadPDF = (inv: BusinessInvoice) => {
        if (!currentTenant?.id) return;
        window.open(
          `/api/invoices/${encodeURIComponent(inv.id)}/pdf?tenantId=${encodeURIComponent(currentTenant.id)}&download=true`,
          '_blank'
        );
    };

    if (loading) {
        return (
            <div className={`space-y-5 pb-24 ${isMobile ? 'p-2' : 'p-6'}`}>
                <div className="ac-workspace-panel rounded-lg p-8 text-center text-slate-400">
                    Loading billing workspace...
                </div>
            </div>
        );
    }

    const ServicesCatalog = React.lazy(() => import('./ServicesCatalog').then(m => ({ default: m.ServicesCatalog })));

    return (
        <div className={`space-y-5 pb-24 ${isMobile ? 'p-2' : 'p-6'}`}>
            <OperationalWorkflowStrip moduleId="invoicing" userRole={user?.role} />
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase flex items-center gap-3">
                        <DollarSign className="text-teal-500" /> Revenue Workspace
                    </h1>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Invoices, recurring revenue, and follow-ups</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto rounded-full border border-white/5 bg-slate-900/60 p-1 shadow-inner">
                  <button 
                    onClick={() => setActiveTab('invoices')}
                    className={`flex-1 sm:flex-none h-8 px-3 rounded-full font-black uppercase text-[11px] tracking-widest border transition-all ${activeTab === 'invoices' ? 'bg-teal-600 border-teal-500 text-white shadow-sm' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'}`}
                  >
                    Billing
                  </button>
                  <button 
                    onClick={() => setActiveTab('recurring')}
                    className={`flex-1 sm:flex-none h-8 px-3 rounded-full font-black uppercase text-[11px] tracking-widest border transition-all ${activeTab === 'recurring' ? 'bg-teal-600 border-teal-500 text-white shadow-sm' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'}`}
                  >
                    Recurring
                  </button>
                  <button 
                    onClick={() => setActiveTab('services')}
                    className={`flex-1 sm:flex-none h-8 px-3 rounded-full font-black uppercase text-[11px] tracking-widest border transition-all ${activeTab === 'services' ? 'bg-teal-600 border-teal-500 text-white shadow-sm' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'}`}
                  >
                    Catalog
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
                    { label: 'Collected', value: stats.totalRevenue, color: 'text-teal-400' },
                    { label: 'Awaiting Payment', value: stats.pendingAmount, color: 'text-teal-400' },
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
                    <div className="flex gap-2 overflow-x-auto no-scrollbar rounded-full border border-white/5 bg-slate-900/60 p-1 shadow-inner">
                        {(['all', 'draft', 'sent', 'paid', 'overdue'] as const).map(s => (
                            <button key={s} onClick={() => setFilter(s)} className={`h-8 px-3 rounded-full text-[11px] font-black uppercase tracking-widest border transition-all ${filter === s ? 'bg-teal-600 border-teal-500 text-white shadow-sm' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'}`}>{s}</button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        {selectedInvoiceIds.size > 0 && (
                            <div className="flex items-center gap-1.5 rounded-full border border-white/5 bg-slate-900/60 p-1 shadow-inner">
                                <button
                                    type="button"
                                    onClick={() => setSelectedInvoiceIds(new Set())}
                                    className="h-7 px-3 rounded-full text-[11px] font-black uppercase tracking-widest border border-white/10 text-slate-500 transition-colors hover:text-slate-300"
                                >
                                    Clear
                                </button>
                                <button
                                    type="button"
                                    onClick={handleBulkEmailInvoices}
                                    className="h-7 px-3 rounded-full text-[11px] font-black uppercase tracking-widest border border-indigo-500/30 text-indigo-300 flex items-center gap-1.5 transition-colors hover:text-indigo-200"
                                >
                                    <Mail size={12} />
                                    {`Send Follow-up (${selectedInvoiceIds.size})`}
                                </button>
                                <button
                                    type="button"
                                    disabled={bulkDeletingInvoices}
                                    onClick={handleBulkDeleteInvoices}
                                    className="h-7 px-3 rounded-full text-[11px] font-black uppercase tracking-widest border border-rose-500/30 text-rose-300 flex items-center gap-1.5 transition-colors hover:text-rose-200 disabled:opacity-50"
                                >
                                    <Trash2 size={12} />
                                    {bulkDeletingInvoices ? 'Deleting…' : `Delete (${selectedInvoiceIds.size})`}
                                </button>
                            </div>
                        )}
                        <button onClick={() => setShowCreateModal(true)} className="flex-shrink-0 inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-teal-600 px-3 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-teal-900/20 transition-all hover:bg-teal-500">
                            <Plus size={12} /> Create Invoice
                        </button>
                    </div>
                </div>
                <p className="text-xs text-slate-500 -mt-2">
                    Tip: select invoices to send one follow-up to many clients at once. Only drafts can be bulk deleted.
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
                                        className="text-slate-500 hover:text-teal-400 shrink-0 transition-colors"
                                        aria-label={`Select ${inv.invoiceNumber}`}
                                    >
                                        {selectedInvoiceIds.has(inv.id)
                                            ? <CheckSquare size={14} className="text-teal-400" />
                                            : <Square size={14} />}
                                    </button>
                                    <div className={`p-2 rounded-full bg-white/5 ${getStatusStyles(inv.status)}`}><FileText size={14} /></div>
                                    <div>
                                        <p className="text-[12px] font-black text-white">{inv.invoiceNumber}</p>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.22em]">{inv.clientId && clientMap[inv.clientId]?.name ? clientMap[inv.clientId].name : 'Walk-in Client'}</p>
                                    </div>
                                </div>
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${getStatusStyles(inv.status)}`}>{inv.status}</span>
                            </div>
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.22em]">Due Date</p>
                                    <p className="text-[11px] font-bold text-gray-300">{new Date(inv.dueDate).toLocaleDateString()}</p>
                                    {Number(inv.amountPaid || 0) > 0 && (
                                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">
                                            Paid {Number(inv.amountPaid || 0).toLocaleString()} · Balance {Number(inv.balanceDue || 0).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                                <p className="text-[20px] font-black text-white font-mono tracking-tight leading-none">${inv.total.toLocaleString()}</p>
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
                            className="fixed inset-0 z-[1100] bg-black/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                            className="fixed inset-x-0 bottom-0 z-[1110] max-h-[92dvh] bg-slate-950 border-t border-white/10 rounded-t-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
                        >
                            <div className="flex justify-center py-2 shrink-0 cursor-grab bg-slate-900/40 border-b border-white/5">
                                <div className="w-10 h-1 bg-white/20 rounded-full" />
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar pb-10 space-y-5">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 font-mono">
                                            Invoice ID: #{selectedInvoiceForOptions.id.slice(0, 8).toUpperCase()}
                                        </span>
                                        <h3 className="text-base font-black text-white uppercase mt-1 tracking-tight">
                                            {selectedInvoiceForOptions.invoiceNumber}
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Client: {selectedInvoiceForOptions.clientId && clientMap[selectedInvoiceForOptions.clientId]?.name ? clientMap[selectedInvoiceForOptions.clientId].name : 'Walk-in Client'}
                                        </p>
                                    </div>
                                    <button onClick={() => setIsOptionsOpen(false)} className="h-8 w-8 p-0 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors flex items-center justify-center">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 text-center">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono mb-1">Total Amount Due</p>
                                    <p className="text-3xl font-black text-teal-400 tracking-tight font-mono">
                                        ${selectedInvoiceForOptions.total.toLocaleString()}
                                    </p>
                                    {Number(selectedInvoiceForOptions.amountPaid || 0) > 0 && (
                                        <div className="mt-3 grid grid-cols-2 gap-3 text-left">
                                            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-blue-200/80">Paid So Far</p>
                                                <p className="text-sm font-black text-blue-200">${Number(selectedInvoiceForOptions.amountPaid || 0).toLocaleString()}</p>
                                            </div>
                                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-200/80">Balance Due</p>
                                                <p className="text-sm font-black text-amber-200">${Number(selectedInvoiceForOptions.balanceDue || 0).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    )}
                                    <div className="mt-3 flex justify-center">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${getStatusStyles(selectedInvoiceForOptions.status)}`}>
                                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                            {selectedInvoiceForOptions.status}
                                        </span>
                                    </div>
                                    <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                        Auto follow-ups: {selectedInvoiceForOptions.autoFollowupEnabled === false ? 'Off' : 'On'}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    <button
                                        onClick={() => {
                                            setEditingInvoice(selectedInvoiceForOptions);
                                            setIsOptionsOpen(false);
                                        }}
                                        className="w-full flex items-center justify-between p-3.5 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl transition-all text-left text-sm text-slate-200"
                                    >
                                        <span className="flex items-center gap-2.5">
                                            <Edit className="w-4 h-4 text-violet-400" />
                                            <span>Edit Invoice &amp; Theme</span>
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono">DESIGN</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            handleViewPDF(selectedInvoiceForOptions);
                                            setIsOptionsOpen(false);
                                        }}
                                        className="w-full flex items-center justify-between p-3.5 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl transition-all text-left text-sm text-slate-200"
                                    >
                                        <span className="flex items-center gap-2.5">
                                            <Eye className="w-4 h-4 text-teal-400" />
                                            <span>Preview PDF Invoice</span>
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono">PDF PREVIEW</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            handleDownloadPDF(selectedInvoiceForOptions);
                                            setIsOptionsOpen(false);
                                        }}
                                        className="w-full flex items-center justify-between p-3.5 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl transition-all text-left text-sm text-slate-200"
                                    >
                                        <span className="flex items-center gap-2.5">
                                            <Download className="w-4 h-4 text-indigo-400" />
                                            <span>Download PDF File</span>
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono">PDF DOWNLOAD</span>
                                    </button>

                                    <button
                                        onClick={() => openInvoiceCompose(selectedInvoiceForOptions)}
                                        className="w-full flex items-center justify-between p-3.5 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl transition-all text-left text-sm text-slate-200"
                                    >
                                        <span className="flex items-center gap-2.5">
                                            <Mail className="w-4 h-4 text-teal-400" />
                                            <span>Compose Email to Client</span>
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono">ZOHO / OUTLOOK</span>
                                    </button>

                                    {currentTenant?.id && (
                                        <button
                                            onClick={async () => {
                                                const enabled = confirm('Enable automatic follow-ups for this invoice?\n\nOK = enable\nCancel = disable');
                                                const toastId = toast.loading('Updating follow-up settings...');
                                                try {
                                                    const res = await fetch(`/api/invoices/${selectedInvoiceForOptions.id}/followup-settings`, {
                                                        method: 'PATCH',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            tenantId: currentTenant.id,
                                                            autoFollowupEnabled: enabled,
                                                        }),
                                                    });
                                                    const data = await res.json().catch(() => ({}));
                                                    if (!res.ok) throw new Error(data.error || 'Failed to update follow-ups');
                                                    toast.success(
                                                        enabled ? 'Auto follow-ups enabled for this invoice.' : 'Auto follow-ups disabled for this invoice.',
                                                        { id: toastId }
                                                    );
                                                    setIsOptionsOpen(false);
                                                    void loadInvoices();
                                                } catch (err) {
                                                    toast.error(err instanceof Error ? err.message : 'Failed to update follow-ups', { id: toastId });
                                                }
                                            }}
                                            className="w-full flex items-center justify-between p-3.5 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl transition-all text-left text-sm text-slate-200"
                                        >
                                            <span className="flex items-center gap-2.5">
                                                <CheckCircle className="w-4 h-4 text-teal-400" />
                                                <span>Toggle Auto Follow-ups</span>
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-mono">REMINDERS</span>
                                        </button>
                                    )}

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
                                            className="w-full flex items-center justify-between p-3.5 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl transition-all text-left text-sm text-slate-200"
                                        >
                                            <span className="flex items-center gap-2.5">
                                                <User className="w-4 h-4 text-purple-400" />
                                                <span>Copy Client Finance Portal Link</span>
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-mono">INVOICES + QUOTES</span>
                                        </button>
                                    )}

                                    <button
                                        onClick={async () => {
                                            if (!selectedInvoiceForOptions) return;
                                            setIsOptionsOpen(false);
                                            const toastId = toast.loading('Starting invoice lifecycle...');
                                            try {
                                                const { callMcpTool } = await import('@/services/mcp/toolCaller');
                                                await callMcpTool('start_invoice_lifecycle', { invoice_id: selectedInvoiceForOptions.id });
                                                toast.success('Lifecycle started — email + reminders now automated.', { id: toastId });
                                            } catch (err: any) {
                                                toast.error(`Failed to start lifecycle: ${err.message}`, { id: toastId });
                                            }
                                        }}
                                        className="w-full flex items-center justify-between p-3.5 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl transition-all text-left text-sm text-slate-200"
                                    >
                                        <span className="flex items-center gap-2.5">
                                            <Send className="w-4 h-4 text-sky-400" />
                                            <span>Email Invoice to Client</span>
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono">EMAIL DISPATCH</span>
                                    </button>

                                    {selectedInvoiceForOptions.status !== 'paid' ? (
                                        <div className="space-y-2">
                                            <button
                                                onClick={async () => {
                                                    const toastId = toast.loading('Updating payment status...');
                                                    const { error } = await businessInvoiceService.markAsPaid(selectedInvoiceForOptions.id);
                                                    if (error) {
                                                        toast.error(error, { id: toastId });
                                                        return;
                                                    }
                                                    toast.success('Invoice marked as paid', { id: toastId });
                                                    setIsOptionsOpen(false);
                                                    void loadInvoices();
                                                }}
                                                className="w-full flex items-center justify-between p-3.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-2xl transition-all text-left text-sm text-emerald-200"
                                            >
                                                <span className="flex items-center gap-2.5">
                                                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                                                    <span>Mark as Paid</span>
                                                </span>
                                                <span className="text-[10px] text-emerald-500/80 font-mono">FULL PAYMENT</span>
                                            </button>

                                            <button
                                                onClick={async () => {
                                                    const raw = prompt('Record a payment amount (deposit/partial). Example: 250');
                                                    if (!raw) return;
                                                    const amount = Number(String(raw).replace(/[^0-9.]/g, ''));
                                                    const toastId = toast.loading('Recording payment...');
                                                    const { error, status, amountPaid } = await businessInvoiceService.recordPayment(
                                                        selectedInvoiceForOptions.id,
                                                        amount
                                                    );
                                                    if (error) {
                                                        toast.error(error, { id: toastId });
                                                        return;
                                                    }
                                                    toast.success(
                                                        status === 'paid'
                                                            ? 'Payment recorded — invoice is now paid.'
                                                            : `Deposit recorded — total paid now ${Number(amountPaid || 0).toFixed(2)}.`,
                                                        { id: toastId }
                                                    );
                                                    setIsOptionsOpen(false);
                                                    void loadInvoices();
                                                }}
                                                className="w-full flex items-center justify-between p-3.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-2xl transition-all text-left text-sm text-blue-200"
                                            >
                                                <span className="flex items-center gap-2.5">
                                                    <Clock className="w-4 h-4 text-blue-300" />
                                                    <span>Record Deposit / Partial</span>
                                                </span>
                                                <span className="text-[10px] text-blue-300/80 font-mono">AMOUNT PAID</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={async () => {
                                                const toastId = toast.loading('Updating payment status...');
                                                const { error } = await businessInvoiceService.updateInvoice(selectedInvoiceForOptions.id, { status: 'sent' });
                                                if (error) {
                                                    toast.error(error, { id: toastId });
                                                    return;
                                                }
                                                toast.success('Invoice marked as unpaid', { id: toastId });
                                                setIsOptionsOpen(false);
                                                void loadInvoices();
                                            }}
                                            className="w-full flex items-center justify-between p-3.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-2xl transition-all text-left text-sm text-amber-200"
                                        >
                                            <span className="flex items-center gap-2.5">
                                                <Clock className="w-4 h-4 text-amber-400" />
                                                <span>Mark as Unpaid</span>
                                            </span>
                                            <span className="text-[10px] text-amber-500/80 font-mono">MANUAL UPDATE</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* PDF Preview Modal */}
            <AnimatePresence>
                {showPDFPreview && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/90 backdrop-blur-md z-[1100] flex flex-col p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-white font-black uppercase tracking-widest text-sm">Invoice Preview</h3>
                            <button onClick={() => setShowPDFPreview(null)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white"><X size={20} /></button>
                        </div>
                        <iframe src={showPDFPreview} className="flex-1 w-full rounded-2xl border border-white/10" />
                        <div className="mt-4 flex gap-2">
                            <button
                                onClick={async () => {
                                    if (!selectedInvoiceForOptions) return;
                                    const toastId = toast.loading('Starting invoice lifecycle...');
                                    try {
                                        const { callMcpTool } = await import('@/services/mcp/toolCaller');
                                        await callMcpTool('start_invoice_lifecycle', { invoice_id: selectedInvoiceForOptions.id });
                                        toast.success('Lifecycle started — email + reminders now automated.', { id: toastId });
                                        setShowPDFPreview(null);
                                    } catch (err: any) {
                                        toast.error(`Failed to start lifecycle: ${err.message}`, { id: toastId });
                                    }
                                }}
                                className="flex-1 h-12 bg-teal-600 text-white rounded-xl font-black uppercase text-xs"
                            >
                                Start Lifecycle
                            </button>
                            <button
                                onClick={() => {
                                    if (!selectedInvoiceForOptions) return;
                                    handleDownloadPDF(selectedInvoiceForOptions);
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
            <EnhancedInvoiceModal
                isOpen={Boolean(editingInvoice)}
                onClose={() => setEditingInvoice(null)}
                mode="edit"
                invoice={editingInvoice || undefined}
                onSuccess={() => {
                    setEditingInvoice(null);
                    void loadInvoices();
                }}
            />

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
