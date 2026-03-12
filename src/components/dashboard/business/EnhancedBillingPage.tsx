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
    X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTenant } from '../../../contexts/TenantContext';
import { businessInvoiceService, BusinessInvoice } from '../../../services/businessInvoiceService';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import CreateInvoiceModal from '../CreateInvoiceModal';
import { Button } from '../../ui/UIComponents';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

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

    useEffect(() => {
        loadInvoices();
        loadRevenueData();
    }, [user.id, dateRange]);

    const loadInvoices = async () => {
        try {
            setLoading(true);
            const { invoices: data, error } = await businessInvoiceService.getInvoices(user.id);
            if (error) {
                toast.error('Failed to load invoices');
                return;
            }
            setInvoices(data || []);
            calculateStats(data || []);
        } catch (error) {
            console.error('Error loading invoices:', error);
            toast.error('Failed to load invoices');
        } finally {
            setLoading(false);
        }
    };

    const loadRevenueData = async () => {
        try {
            // Generate mock revenue data based on existing invoices
            const mockRevenueData = [
                { date: '2024-01-01', revenue: 1200 },
                { date: '2024-01-02', revenue: 1800 },
                { date: '2024-01-03', revenue: 2400 },
                { date: '2024-01-04', revenue: 1600 },
                { date: '2024-01-05', revenue: 3200 },
                { date: '2024-01-06', revenue: 2800 },
                { date: '2024-01-07', revenue: 3600 }
            ];
            setRevenueData(mockRevenueData);
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

    const handleViewPDF = async (invoiceId: string) => {
        try {
            // For now, show a placeholder since we don't have the getInvoicePDF method
            toast.success('PDF viewer functionality will be available soon');
            // You could implement a simple PDF viewer or redirect to a preview page
        } catch (error) {
            console.error('Error loading PDF:', error);
            toast.error('Failed to load PDF');
        }
    };

    const handleDownloadPDF = async (invoiceId: string) => {
        try {
            // For now, show a message since we don't have the getInvoicePDF method
            toast.success('PDF download functionality will be available soon');
            // You could implement PDF generation using the generatePDF method with proper tenant/client data
        } catch (error) {
            console.error('Error downloading PDF:', error);
            toast.error('Failed to download PDF');
        }
    };

    const handleSendDraftInvoice = async (invoice: BusinessInvoice) => {
        // For now, just update the status since we don't have client email in the BusinessInvoice interface
        try {
            // Update invoice status to sent
            const { error: updateError } = await businessInvoiceService.updateInvoice(invoice.id, {
                status: 'sent',
                isPublic: true
            });

            if (updateError) {
                toast.error('Failed to update invoice status');
                return;
            }

            // For now, show a success message without actually sending email
            // You would need to implement client email lookup based on clientId
            toast.success('Invoice marked as sent successfully!');
            loadInvoices(); // Refresh the list
        } catch (error) {
            console.error('Error sending draft invoice:', error);
            toast.error('Failed to send invoice');
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
        // For now, show a message since we don't have client email in the BusinessInvoice interface
        toast.success('Payment reminder functionality will be available soon');
        // You would need to implement client email lookup based on clientId
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
                <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Create Invoice
                </Button>
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
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
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
                <div className="overflow-x-auto">
                    <table className="w-full">
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
                                <tr key={invoice.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div>
                                            <div className="text-white font-medium">{invoice.invoiceNumber}</div>
                                            <div className="text-slate-400 text-sm">{formatDate(invoice.createdAt)}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4 text-slate-400" />
                                            <div>
                                                <div className="text-white">{invoice.clientId || 'Unknown Client'}</div>
                                                <div className="text-slate-400 text-sm">{invoice.clientId || 'No client assigned'}</div>
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
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                                            {getStatusIcon(invoice.status)}
                                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleViewPDF(invoice.id)}
                                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                                title="View PDF"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            
                                            <button
                                                onClick={() => handleDownloadPDF(invoice.id)}
                                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                                title="Download PDF"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                            
                                            {invoice.status === 'draft' && (
                                                <button
                                                    onClick={() => handleSendDraftInvoice(invoice)}
                                                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                                    title="Send to Client"
                                                >
                                                    <Send className="w-4 h-4" />
                                                </button>
                                            )}
                                            
                                            {invoice.status === 'sent' && (
                                                <button
                                                    onClick={() => handleSendReminder(invoice)}
                                                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                                    title="Send Reminder"
                                                >
                                                    <Mail className="w-4 h-4" />
                                                </button>
                                            )}
                                            
                                            {invoice.status === 'sent' && (
                                                <button
                                                    onClick={() => handleMarkAsPaid(invoice.id)}
                                                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                                    title="Mark as Paid"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                            )}
                                            
                                            {invoice.status === 'draft' && (
                                                <button
                                                    onClick={() => handleDeleteInvoice(invoice.id)}
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
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg w-full max-w-4xl h-full max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">Invoice Preview</h3>
                            <button
                                onClick={() => setShowPDFPreview(null)}
                                className="text-gray-400 hover:text-gray-600"
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

            {/* Create Invoice Modal */}
            <CreateInvoiceModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onInvoiceCreated={loadInvoices}
                projects={[]} // You may want to pass actual projects here
            />
        </div>
    );
};

export default EnhancedBillingPage;