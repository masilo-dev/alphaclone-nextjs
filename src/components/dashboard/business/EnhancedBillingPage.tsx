'use client';

import React, { useState, useEffect } from 'react';
import { 
    DollarSign, FileText, Download, Eye, Send, Mail, CheckCircle, Clock, 
    AlertCircle, Filter, Plus, Edit, Trash2, RefreshCw, User, Calendar, 
    Search, X, ChevronDown, FileCheck2, ArrowLeft, MoreVertical
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
    const [revenueData, setRevenueData] = useState<any[]>([]);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        pendingAmount: 0,
        overdueAmount: 0,
        draftCount: 0,
        sentCount: 0,
        paidCount: 0
    });
    const [clientMap, setClientMap] = useState<Record<string, string>>({});

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
            const map: Record<string, string> = {};
            clients.forEach(c => { map[c.id] = c.name; });
            setClientMap(map);
        }
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
        const client = inv.clientId ? { name: clientMap[inv.clientId] || inv.clientId, email: '' } : { name: metadata?.clientName || 'Walk-in', email: '' };
        const doc = businessInvoiceService.generatePDF(inv, currentTenant!, client);
        const pdfUrl = URL.createObjectURL(doc.output('blob'));
        setShowPDFPreview(pdfUrl);
    };

    if (loading) return <div className="p-8 text-slate-400">Loading Billing Data...</div>;

    return (
        <div className={`space-y-6 pb-24 ${isMobile ? 'p-2' : 'p-6'}`}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase flex items-center gap-3">
                        <DollarSign className="text-teal-500" /> Billing Hub
                    </h1>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Invoice Management & Collections</p>
                </div>
                <button onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto h-12 px-8 bg-teal-600 text-white rounded-xl font-black uppercase text-xs shadow-lg shadow-teal-900/20 flex items-center justify-center gap-2">
                    <Plus size={18} /> New Invoice
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: 'Revenue', value: stats.totalRevenue, color: 'text-teal-400' },
                    { label: 'Pending', value: stats.pendingAmount, color: 'text-teal-400' },
                    { label: 'Overdue', value: stats.overdueAmount, color: 'text-rose-400' },
                    { label: 'Drafts', value: stats.draftCount, color: 'text-slate-400' }
                ].map(s => (
                    <Card key={s.label} className="p-4 bg-slate-900/40 border-white/5">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{s.label}</p>
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
                                tickFormatter={(val) => `$${val}`}
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
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                    {(['all', 'draft', 'sent', 'paid', 'overdue'] as const).map(s => (
                        <button key={s} onClick={() => setFilter(s)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${filter === s ? 'bg-teal-600 border-teal-500 text-white' : 'bg-white/5 border-white/5 text-gray-500'}`}>{s}</button>
                    ))}
                </div>

                <div className="space-y-3">
                    {filteredInvoices.map(inv => (
                        <Card key={inv.id} onClick={() => handleViewPDF(inv)} className="p-4 sm:p-5 bg-slate-900/40 border-white/5 hover:bg-white/[0.03] transition-all cursor-pointer">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg bg-white/5 ${getStatusStyles(inv.status)}`}><FileText size={18} /></div>
                                    <div>
                                        <p className="text-sm font-black text-white">{inv.invoiceNumber}</p>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase">{inv.clientId && clientMap[inv.clientId] ? clientMap[inv.clientId] : 'Walk-in Client'}</p>
                                    </div>
                                </div>
                                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border ${getStatusStyles(inv.status)}`}>{inv.status}</span>
                            </div>
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Due Date</p>
                                    <p className="text-xs font-bold text-gray-300">{new Date(inv.dueDate).toLocaleDateString()}</p>
                                </div>
                                <p className="text-lg font-black text-white">${inv.total.toLocaleString()}</p>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>

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
                            <button className="flex-1 h-12 bg-teal-600 text-white rounded-xl font-black uppercase text-xs">Send Invoice</button>
                            <button className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-white"><Download size={20} /></button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <EnhancedInvoiceModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} mode="create" onSuccess={loadInvoices} />
        </div>
    );
};

export default EnhancedBillingPage;