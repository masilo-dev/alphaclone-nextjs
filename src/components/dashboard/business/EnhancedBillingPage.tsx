'use client';

import React, { useState, useEffect } from 'react';
import { 
    DollarSign, 
    FileText, 
    Download, 
    Eye, 
    Send, 
    Mail, 
    CheckCircle, 
    Clock, 
    AlertCircle, 
    Filter, 
    Plus,
    Edit,
    Trash2,
    RefreshCw,
    EyeOff,
    User,
    Calendar,
    Search,
    X,
    ChevronDown,
    FileCheck2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTenant } from '../../../contexts/TenantContext';
import { businessInvoiceService, BusinessInvoice } from '../../../services/businessInvoiceService';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import EnhancedInvoiceModal from '../EnhancedInvoiceModal';
import { Button } from '../../ui/UIComponents';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { ChartContainer } from '@/components/ui/ChartContainer';
import { generateEmailDraft } from '../../../services/unifiedAIService';

interface EnhancedBillingPageProps {
    user: any;
}

const EnhancedBillingPage: React.FC<EnhancedBillingPageProps> = ({ user }) => {
    const { currentTenant } = useTenant();
    const [invoices, setInvoices] = useState<BusinessInvoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'draft' | 'sent' | 'paid' | 'overdue'>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<BusinessInvoice | null>(null);
    const [showPDFPreview, setShowPDFPreview] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
    const [revenueData, setRevenueData] = useState<any[]>([]);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        pendingAmount: 0,
        overdueAmount: 0,
        draftCount: 0,
        sentCount: 0,
        paidCount: 0
    });
    const [statusMenuId, setStatusMenuId] = useState<string | null>(null);
    const [showSendModal, setShowSendModal] = useState(false);
    const [invoiceToSend, setInvoiceToSend] = useState<BusinessInvoice | null>(null);
    const [sendForm, setSendForm] = useState({ recipientEmail: '', subject: '', message: '' });
    const [sendingInvoice, setSendingInvoice] = useState(false);
    const [aiDraftingSend, setAiDraftingSend] = useState(false);
    const [aiSendInstructions, setAiSendInstructions] = useState('');

    useEffect(() => {
        if (currentTenant?.id) {
            loadInvoices();
        }
    }, [currentTenant?.id, dateRange]);

    // Cleanup Blob URLs to prevent memory leaks
    useEffect(() => {
        return () => {
            if (showPDFPreview && showPDFPreview.startsWith('blob:')) {
                URL.revokeObjectURL(showPDFPreview);
            }
        };
    }, [showPDFPreview]);

    const loadInvoices = async () => {
        if (!currentTenant?.id) return;
        try {
            setLoading(true);
            const { invoices: data, error } = await businessInvoiceService.getInvoices(currentTenant.id);
            if (error) {
                toast.error('Failed to load invoices');
                return;
            }
            setInvoices(data || []);
            calculateStats(data || []);
            loadRevenueData(data || []);
        } catch (error) {
            console.error('Error loading invoices:', error);
            toast.error('Failed to load invoices');
        } finally {
            setLoading(false);
        }
    };

    const loadRevenueData = async (invoiceData?: any[]) => {
        try {
            const source = invoiceData || invoices;
            // Build revenue per day from real paid invoices
            const revenueMap: Record<string, number> = {};
            source.forEach((inv: any) => {
                if (inv.status === 'paid' && inv.updated_at) {
                    const day = inv.updated_at.slice(0, 10);
                    revenueMap[day] = (revenueMap[day] || 0) + (inv.total || 0);
                }
            });
            const sorted = Object.entries(revenueMap)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, revenue]) => ({ date, revenue }));
            setRevenueData(sorted);
        } catch (error) {
            console.error('Error loading revenue data:', error);
        }
    };

    const calculateStats = (invoiceData: BusinessInvoice[]) => {
        const stats = {
            totalRevenue: 0,
            pendingAmount: 0,
            overdueAmount: 0,
            draftCount: 0,
            sentCount: 0,
            paidCount: 0
        };

        invoiceData.forEach(invoice => {
            if (invoice.status === 'paid') {
                stats.totalRevenue += invoice.total;
                stats.paidCount++;
            } else if (invoice.status === 'sent') {
                stats.pendingAmount += invoice.total;
                stats.sentCount++;
            } else if (invoice.status === 'overdue') {
                stats.overdueAmount += invoice.total;
            } else if (invoice.status === 'draft') {
                stats.draftCount++;
            }
        });

        setStats(stats);
    };

    const filteredInvoices = invoices.filter(invoice => {
        const matchesFilter = filter === 'all' || invoice.status === filter;
        const matchesSearch = searchTerm === '' || 
            invoice.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (invoice.clientId && invoice.clientId.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (invoice.projectId && invoice.projectId.toLowerCase().includes(searchTerm.toLowerCase()));
        
        return matchesFilter && matchesSearch;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'paid': return 'text-green-400 bg-green-400/10';
            case 'sent': return 'text-blue-400 bg-blue-400/10';
            case 'overdue': return 'text-red-400 bg-red-400/10';
            case 'draft': return 'text-yellow-400 bg-yellow-400/10';
            default: return 'text-gray-400 bg-gray-400/10';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'paid': return <CheckCircle className="w-4 h-4" />;
            case 'sent': return <Mail className="w-4 h-4" />;
            case 'overdue': return <AlertCircle className="w-4 h-4" />;
            case 'draft': return <Edit className="w-4 h-4" />;
            default: return <FileText className="w-4 h-4" />;
        }
    };

    const handleViewPDF = async (invoice: BusinessInvoice) => {
        try {
            if (!currentTenant) {
                toast.error('Organization details missing');
                return;
            }

            // Identify if it's a receipt and pass correct client info
            const metadata = businessInvoiceService.parseMetadata(invoice.notes);
            const client = invoice.clientId 
                ? { name: invoice.clientId, email: '' } 
                : (metadata?.clientName ? { name: metadata.clientName, email: metadata.clientEmail || '' } : undefined);
            
            const doc = businessInvoiceService.generatePDF(invoice, currentTenant, client);
            const pdfBlob = doc.output('blob');
            const pdfUrl = URL.createObjectURL(pdfBlob);
            setShowPDFPreview(pdfUrl);
        } catch (error) {
            console.error('Error generating PDF preview:', error);
            toast.error('Failed to generate PDF preview');
        }
    };

    const handleDownloadPDF = async (invoice: BusinessInvoice) => {
        try {
            if (!currentTenant) {
                toast.error('Organization details missing');
                return;
            }

            const metadata = businessInvoiceService.parseMetadata(invoice.notes);
            const client = invoice.clientId 
                ? { name: invoice.clientId, email: '' } 
                : (metadata?.clientName ? { name: metadata.clientName, email: metadata.clientEmail || '' } : undefined);

            const doc = businessInvoiceService.generatePDF(invoice, currentTenant, client);
            doc.save(`${(invoice.invoiceNumber || '').startsWith('REC-') ? 'Receipt' : 'Invoice'}-${invoice.invoiceNumber || invoice.id}.pdf`);
            toast.success('PDF downloaded successfully');
        } catch (error) {
            console.error('Error downloading PDF:', error);
            toast.error('Failed to download PDF');
        }
    };

    const handleMarkAsSent = async (invoice: BusinessInvoice) => {
        try {
            const { error: updateError } = await businessInvoiceService.updateInvoice(invoice.id, {
                status: 'sent',
                isPublic: true
            });

            if (updateError) {
                toast.error('Failed to update invoice status');
                return;
            }

            toast.success('Invoice marked as sent');
            loadInvoices();
        } catch (error) {
            console.error('Error marking invoice as sent:', error);
            toast.error('Failed to update status');
        }
    };

    const handleMarkAsDraft = async (invoice: BusinessInvoice) => {
        try {
            const { error: updateError } = await businessInvoiceService.updateInvoice(invoice.id, {
                status: 'draft',
                isPublic: false
            });

            if (updateError) {
                toast.error('Failed to mark as draft');
                return;
            }

            toast.success('Invoice marked as draft (Not Sent)');
            loadInvoices();
        } catch (error) {
            console.error('Error marking invoice as draft:', error);
            toast.error('Failed to update status');
        }
    };

    const getPaymentInstructions = (paymentMethod: string) => {
        switch (paymentMethod) {
            case 'stripe':
                return 'Pay securely online using the payment link in the invoice.';
            case 'bank':
                return 'Please make payment via bank transfer using the details provided in the invoice.';
            case 'mobile_money':
                return 'Pay using mobile money with the details provided in the invoice.';
            default:
                return 'Please follow the payment instructions in the invoice.';
        }
    };

    const handleMarkAsPaid = async (invoiceId: string) => {
        try {
            const { error } = await businessInvoiceService.updateInvoice(invoiceId, {
                status: 'paid'
            });

            if (error) {
                toast.error('Failed to mark as paid');
                return;
            }

            toast.success('Invoice marked as paid');
            loadInvoices();
        } catch (error) {
            console.error('Error marking as paid:', error);
            toast.error('Failed to mark as paid');
        }
    };

    const handleDeleteInvoice = async (invoiceId: string) => {
        if (!confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
            return;
        }

        try {
            const { error } = await businessInvoiceService.deleteInvoice(invoiceId);
            if (error) {
                toast.error('Failed to delete invoice');
                return;
            }

            toast.success('Invoice deleted successfully');
            loadInvoices();
        } catch (error) {
            console.error('Error deleting invoice:', error);
            toast.error('Failed to delete invoice');
        }
    };

    const handleSendReminder = async (invoice: BusinessInvoice) => {
        if (!currentTenant?.id) {
            toast.error('Organization details are missing');
            return;
        }
        try {
            const metadata = businessInvoiceService.parseMetadata(invoice.notes);
            const paymentMethod = String(metadata?.paymentMethod || 'bank').toLowerCase();
            const reminderMessage = [
                'Hello,',
                '',
                `This is a reminder that invoice ${invoice.invoiceNumber} is pending payment.`,
                `Amount due: ${formatCurrency(invoice.total)}`,
                `Due date: ${formatDate(invoice.dueDate)}`,
                '',
                getPaymentInstructions(paymentMethod),
                '',
                `Please contact us if you need a copy of invoice ${invoice.invoiceNumber} or updated payment details.`,
                '',
                `Regards,`,
                `${user?.name || 'Billing Team'}`,
            ].join('\n');

            const response = await fetch('/api/invoices/reminder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: currentTenant.id,
                    invoiceId: invoice.id,
                    recipientEmail: metadata?.clientEmail || '',
                    subject: `Payment reminder: Invoice ${invoice.invoiceNumber}`,
                    message: reminderMessage,
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload?.success) {
                throw new Error(payload?.error || 'Failed to send reminder');
            }
            toast.success('Reminder sent successfully');
            loadInvoices();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to send reminder');
        }
    };

    const openSendInvoiceModal = (invoice: BusinessInvoice) => {
        const metadata = businessInvoiceService.parseMetadata(invoice.notes);
        setInvoiceToSend(invoice);
        setSendForm({
            recipientEmail: metadata?.clientEmail || '',
            subject: `Invoice ${invoice.invoiceNumber}`,
            message: `Hello,\n\nPlease find attached invoice ${invoice.invoiceNumber}.\n\nBest regards,\n${user?.name || 'Team'}`,
        });
        setAiSendInstructions(
            `Write a professional invoice delivery email for invoice ${invoice.invoiceNumber} total ${formatCurrency(invoice.total)}.`
        );
        setShowSendModal(true);
    };

    const handleAiDraftSendMessage = async () => {
        if (!invoiceToSend) return;
        setAiDraftingSend(true);
        try {
            const instruction = aiSendInstructions.trim()
                ? aiSendInstructions.trim()
                : `Write a professional invoice delivery email for invoice ${invoiceToSend.invoiceNumber} total ${formatCurrency(invoiceToSend.total)}.`;
            const draft = await generateEmailDraft(
                instruction,
                sendForm.recipientEmail,
                sendForm.subject
            );
            if (draft) setSendForm(prev => ({ ...prev, message: draft }));
            else toast.error('Failed to generate AI draft');
        } catch {
            toast.error('Failed to generate AI draft');
        } finally {
            setAiDraftingSend(false);
        }
    };

    const handleSendInvoice = async () => {
        if (!invoiceToSend || !currentTenant?.id) return;
        if (!sendForm.recipientEmail.trim()) {
            toast.error('Recipient email is required');
            return;
        }

        setSendingInvoice(true);
        try {
            const res = await fetch('/api/invoices/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: currentTenant.id,
                    invoiceId: invoiceToSend.id,
                    recipients: [sendForm.recipientEmail.trim()],
                    subject: sendForm.subject,
                    message: sendForm.message,
                    userId: user?.id,
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok || !payload?.success) {
                throw new Error(payload?.error || 'Failed to send invoice');
            }
            toast.success('Invoice sent successfully');
            setShowSendModal(false);
            setInvoiceToSend(null);
            loadInvoices();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to send invoice');
        } finally {
            setSendingInvoice(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-12 bg-gray-700 rounded"></div>
                    <div className="h-32 bg-gray-700 rounded"></div>
                    <div className="h-64 bg-gray-700 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <DollarSign className="w-8 h-8 text-teal-400" />
                        Billing & Invoices
                    </h1>
                    <p className="text-slate-400 mt-1">Manage your invoices and track payments</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative group/dropdown">
                        <Button variant="outline" className="flex items-center gap-2">
                            Quick Actions
                            <Plus className="w-4 h-4" />
                        </Button>
                        <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl opacity-0 invisible group-hover/dropdown:opacity-100 group-hover/dropdown:visible transition-all z-20 overflow-hidden">
                            <button 
                                onClick={() => setShowCreateModal(true)}
                                className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-teal-500 hover:text-white transition-colors flex items-center gap-2 border-b border-slate-800"
                            >
                                <Plus className="w-4 h-4" />
                                New Empty Invoice
                            </button>
                            <button 
                                onClick={() => {
                                    // Could preset some values in modal or use a different modal
                                    setShowCreateModal(true);
                                }}
                                className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-teal-500 hover:text-white transition-colors flex items-center gap-2 border-b border-slate-800"
                            >
                                <Plus className="w-4 h-4" />
                                Standard Service
                            </button>
                            <button 
                                onClick={() => {
                                    setShowCreateModal(true);
                                }}
                                className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-teal-500 hover:text-white transition-colors flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Custom Project
                            </button>
                        </div>
                    </div>
                    <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Create Invoice
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-sm">Total Revenue</p>
                            <p className="text-2xl font-bold text-white">{formatCurrency(stats.totalRevenue)}</p>
                        </div>
                        <DollarSign className="w-8 h-8 text-green-400" />
                    </div>
                </div>
                
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-sm">Pending</p>
                            <p className="text-2xl font-bold text-white">{formatCurrency(stats.pendingAmount)}</p>
                        </div>
                        <Clock className="w-8 h-8 text-blue-400" />
                    </div>
                </div>
                
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-sm">Overdue</p>
                            <p className="text-2xl font-bold text-white">{formatCurrency(stats.overdueAmount)}</p>
                        </div>
                        <AlertCircle className="w-8 h-8 text-red-400" />
                    </div>
                </div>
                
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-sm">Draft Invoices</p>
                            <p className="text-2xl font-bold text-white">{stats.draftCount}</p>
                        </div>
                        <FileText className="w-8 h-8 text-yellow-400" />
                    </div>
                </div>
            </div>

            {/* Revenue Chart */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-bold">Revenue Overview</h3>
                    <div className="flex gap-2">
                        {(['week', 'month', 'quarter', 'year'] as const).map((range) => (
                            <button
                                key={range}
                                onClick={() => setDateRange(range)}
                                className={`px-3 py-1 rounded-lg text-sm capitalize ${
                                    dateRange === range
                                        ? 'bg-teal-600 text-white'
                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="h-64 min-h-[250px]">
                    <ChartContainer className="w-full h-full" minHeight={250}>
                    <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={250}>
                        <LineChart data={revenueData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="date" stroke="#9CA3AF" />
                            <YAxis stroke="#9CA3AF" />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: '#1F2937', 
                                    border: '1px solid #374151',
                                    borderRadius: '8px',
                                    color: '#F9FAFB'
                                }}
                            />
                            <Line type="monotone" dataKey="revenue" stroke="#14B8A6" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                    </ChartContainer>
                </div>
            </div>

            {/* Filters and Search */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex flex-wrap gap-2">
                    {(['all', 'draft', 'sent', 'paid', 'overdue'] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-4 py-2 rounded-lg text-sm capitalize flex items-center gap-2 ${
                                filter === status
                                    ? 'bg-teal-600 text-white'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                        >
                            {getStatusIcon(status)}
                            {status}
                        </button>
                    ))}
                </div>
                
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search invoices..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        />
                    </div>
                </div>
            </div>

            {/* Invoices List */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto min-w-0">
                    <table className="w-full min-w-[800px]">
                        <thead className="bg-slate-800/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Invoice</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Client</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Project</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Due Date</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {filteredInvoices.map((invoice) => (
                                <tr 
                                    key={invoice.id} 
                                    className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                                    onClick={() => handleViewPDF(invoice)}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            {(invoice.invoiceNumber || '').startsWith('REC-') ? (
                                                <div className="p-2 bg-amber-500/10 rounded-lg">
                                                    <FileCheck2 className="w-4 h-4 text-amber-400" />
                                                </div>
                                            ) : (
                                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                                    <FileText className="w-4 h-4 text-blue-400" />
                                                </div>
                                            )}
                                            <div>
                                                <div className="text-white font-medium">{invoice.invoiceNumber}</div>
                                                <div className="text-slate-400 text-xs">{formatDate(invoice.createdAt)}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4 text-slate-400" />
                                            <div>
                                                <div className="text-white">
                                                    {(() => {
                                                        if (invoice.clientId) return invoice.clientId;
                                                        const metadata = businessInvoiceService.parseMetadata(invoice.notes);
                                                        return metadata?.clientName || 'Walk-in Client';
                                                    })()}
                                                </div>
                                                <div className="text-slate-400 text-sm">
                                                    {invoice.clientId ? 'System Client' : 'Manual Receipt'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-white">{invoice.projectId || 'General Services'}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-white font-medium">{formatCurrency(invoice.total)}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-slate-400" />
                                            <div className="text-slate-300">{formatDate(invoice.dueDate)}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap relative">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setStatusMenuId(statusMenuId === invoice.id ? null : invoice.id);
                                            }}
                                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-all hover:scale-105 active:scale-95 ${getStatusColor(invoice.status)} border border-white/10`}
                                        >
                                            {getStatusIcon(invoice.status)}
                                            {invoice.status.toUpperCase()}
                                            <ChevronDown className={`w-3 h-3 transition-transform ${statusMenuId === invoice.id ? 'rotate-180' : ''}`} />
                                        </button>

                                        <AnimatePresence>
                                            {statusMenuId === invoice.id && (
                                                <>
                                                    <div 
                                                        className="fixed inset-0 z-[110]" 
                                                        onClick={() => setStatusMenuId(null)} 
                                                    />
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                        className="absolute left-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-[120] overflow-hidden p-1"
                                                    >
                                                        {(['draft', 'sent', 'paid', 'overdue'] as const).map((s) => (
                                                            <button
                                                                key={s}
                                                                onClick={async () => {
                                                                    if (s === 'paid') handleMarkAsPaid(invoice.id);
                                                                    else if (s === 'sent') handleMarkAsSent(invoice);
                                                                    else if (s === 'draft') handleMarkAsDraft(invoice);
                                                                    else {
                                                                        await businessInvoiceService.updateInvoice(invoice.id, { status: s });
                                                                        loadInvoices();
                                                                    }
                                                                    setStatusMenuId(null);
                                                                }}
                                                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${
                                                                    invoice.status === s 
                                                                        ? 'bg-teal-500/20 text-teal-400' 
                                                                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                                                }`}
                                                            >
                                                                {getStatusIcon(s)}
                                                                {s.toUpperCase()}
                                                            </button>
                                                        ))}
                                                    </motion.div>
                                                </>
                                            )}
                                        </AnimatePresence>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleViewPDF(invoice);
                                                }}
                                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                                title="View PDF"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDownloadPDF(invoice);
                                                }}
                                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                                title="Download PDF"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                            
                                            {invoice.status === 'draft' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedInvoice(invoice);
                                                        setShowCreateModal(true);
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg transition-colors"
                                                    title="Edit Invoice"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                            )}
                                            
                                            {invoice.status === 'draft' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleMarkAsSent(invoice);
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-teal-400 hover:bg-slate-700 rounded-lg transition-colors"
                                                    title="Mark as Sent"
                                                >
                                                    <Send className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openSendInvoiceModal(invoice);
                                                }}
                                                className="p-2 text-slate-400 hover:text-teal-400 hover:bg-slate-700 rounded-lg transition-colors"
                                                title="Send Invoice Email"
                                            >
                                                <Mail className="w-4 h-4" />
                                            </button>
                                            
                                            {invoice.status === 'sent' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleMarkAsDraft(invoice);
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-yellow-400 hover:bg-slate-700 rounded-lg transition-colors"
                                                    title="Mark as Not Sent (Draft)"
                                                >
                                                    <EyeOff className="w-4 h-4" />
                                                </button>
                                            )}
                                            
                                            {invoice.status === 'sent' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSendReminder(invoice);
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                                    title="Send Reminder"
                                                >
                                                    <Mail className="w-4 h-4" />
                                                </button>
                                            )}
                                            
                                            {invoice.status === 'sent' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleMarkAsPaid(invoice.id);
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                                    title="Mark as Paid"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                            )}
                                            
                                            {invoice.status === 'draft' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteInvoice(invoice.id);
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Delete Invoice"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    {filteredInvoices.length === 0 && (
                        <div className="text-center py-12">
                            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                            <h3 className="text-white text-lg mb-2">No invoices found</h3>
                            <p className="text-slate-400">
                                {searchTerm ? 'Try adjusting your search terms' : 'Create your first invoice to get started'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* PDF Preview Modal */}
            {showPDFPreview && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pt-safe pb-safe md:pl-64">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowPDFPreview(null)} />
                    <div className="bg-slate-900 border border-slate-800 shadow-2xl rounded-3xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col relative animate-fade-in overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-slate-800">
                            <div className="flex items-center gap-4">
                                <h3 className="text-lg font-semibold text-white">Document Preview</h3>
                                <div className="flex items-center gap-2">
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="h-8 text-xs gap-1"
                                        onClick={() => {
                                            const inv = invoices.find(i => showPDFPreview.includes(i.id));
                                            if (inv) handleMarkAsPaid(inv.id);
                                        }}
                                    >
                                        <CheckCircle className="w-3 h-3" />
                                        Mark as Paid
                                    </Button>
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="h-8 text-xs gap-1"
                                        onClick={() => {
                                            const inv = invoices.find(i => showPDFPreview.includes(i.id));
                                            if (inv) handleMarkAsSent(inv);
                                        }}
                                    >
                                        <Send className="w-3 h-3" />
                                        Mark as Sent
                                    </Button>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    if (showPDFPreview && showPDFPreview.startsWith('blob:')) {
                                        URL.revokeObjectURL(showPDFPreview);
                                    }
                                    setShowPDFPreview(null);
                                }}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <iframe
                                src={showPDFPreview}
                                className="w-full h-full border-0"
                                title="Invoice Preview"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Create/Edit Invoice Modal */}
            <EnhancedInvoiceModal
                isOpen={showCreateModal}
                onClose={() => {
                    setShowCreateModal(false);
                    setSelectedInvoice(null);
                }}
                onSuccess={loadInvoices}
                mode={selectedInvoice ? 'edit' : 'create'}
                invoice={selectedInvoice}
            />

            {showSendModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowSendModal(false)} />
                    <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                        <h3 className="text-lg font-semibold text-white">Send Invoice by Email</h3>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Recipient Email</label>
                            <input
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200"
                                value={sendForm.recipientEmail}
                                onChange={(e) => setSendForm(prev => ({ ...prev, recipientEmail: e.target.value }))}
                                placeholder="client@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Subject</label>
                            <input
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200"
                                value={sendForm.subject}
                                onChange={(e) => setSendForm(prev => ({ ...prev, subject: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">AI Instructions (What to write)</label>
                            <textarea
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 min-h-[90px]"
                                value={aiSendInstructions}
                                onChange={(e) => setAiSendInstructions(e.target.value)}
                                placeholder="Example: Keep this friendly, mention due date, and ask if they need a call."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Message</label>
                            <textarea
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 min-h-[140px]"
                                value={sendForm.message}
                                onChange={(e) => setSendForm(prev => ({ ...prev, message: e.target.value }))}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <Button variant="outline" onClick={handleAiDraftSendMessage} disabled={aiDraftingSend}>
                                {aiDraftingSend ? 'Drafting...' : 'AI Draft Message'}
                            </Button>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" onClick={() => setShowSendModal(false)}>Cancel</Button>
                                <Button onClick={handleSendInvoice} disabled={sendingInvoice}>
                                    {sendingInvoice ? 'Sending...' : 'Send Invoice'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnhancedBillingPage;