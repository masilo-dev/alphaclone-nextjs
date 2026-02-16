import React, { useState, useEffect } from 'react';
import { FileText, Plus, Eye, Check, X, DollarSign, Trash2, Download, Upload, Search } from 'lucide-react';
import { quoteService, Quote, QuoteItem } from '../../services/quoteService';
import { businessInvoiceService } from '../../services/businessInvoiceService';
import { useTenant } from '../../contexts/TenantContext';
import { fileUploadService } from '../../services/fileUploadService';
import { Button, Modal, Input } from '../ui/UIComponents';
import { CardSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import toast from 'react-hot-toast';

interface QuotesTabProps {
    userId: string;
    userRole: string;
}

const QuotesTab: React.FC<QuotesTabProps> = ({ userId, userRole }) => {
    const { currentTenant } = useTenant();
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'draft' | 'sent' | 'accepted'>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
    const [selectedQuoteItems, setSelectedQuoteItems] = useState<QuoteItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [storageUsage, setStorageUsage] = useState<number>(0);
    const MAX_STORAGE = 100 * 1024 * 1024; // 100MB

    // Create quote form state
    const [quoteForm, setQuoteForm] = useState({
        name: '',
        validForDays: '30',
        notes: '',
        currency: 'USD',
        contactId: '',
        dealId: ''
    });

    const [availableContacts, setAvailableContacts] = useState<any[]>([]);
    const [availableDeals, setAvailableDeals] = useState<any[]>([]);

    const [lineItems, setLineItems] = useState<Partial<QuoteItem>[]>([
        { productName: '', description: '', quantity: 1, unitPrice: 0 }
    ]);

    useEffect(() => {
        loadQuotes();
        if (userRole === 'admin' || userRole === 'tenant_admin') {
            loadAvailableResources();
        }
    }, [filter, userId, userRole]);

    const loadAvailableResources = async () => {
        try {
            const [dealsRes, leadsRes] = await Promise.all([
                require('../../services/dealService').dealService.getDeals(),
                require('../../services/leadService').leadService.getLeads()
            ]);

            if (!dealsRes.error) setAvailableDeals(dealsRes.deals);
            if (!leadsRes.error) setAvailableContacts(leadsRes.leads);
        } catch (err) {
            console.error('Failed to load resources for linking', err);
        }
    };

    const loadQuotes = async () => {
        setLoading(true);
        try {
            const filters: any = {};
            if (userRole === 'client') {
                filters.contactId = userId;
            }
            if (filter !== 'all') {
                filters.status = filter;
            }

            const { quotes: loadedQuotes, error } = await quoteService.getQuotes(filters);

            if (error) {
                toast.error(`Error loading quotes: ${error}`);
                setQuotes([]);
            } else {
                setQuotes(loadedQuotes);
            }

            // Load storage usage
            const usage = await fileUploadService.getUserStorageUsage(userId);
            setStorageUsage(usage);
        } catch (err) {
            toast.error('Failed to load quotes');
            setQuotes([]);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft':
                return 'bg-slate-500/10 text-slate-400';
            case 'sent':
                return 'bg-blue-500/10 text-blue-400';
            case 'viewed':
                return 'bg-purple-500/10 text-purple-400';
            case 'accepted':
                return 'bg-green-500/10 text-green-400';
            case 'rejected':
                return 'bg-red-500/10 text-red-400';
            case 'expired':
                return 'bg-orange-500/10 text-orange-400';
            default:
                return 'bg-slate-500/10 text-slate-400';
        }
    };

    const formatCurrency = (value: number, currency = 'USD') => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
    };

    const handleCreateQuote = async () => {
        if (!quoteForm.name.trim()) {
            toast.error('Quote name is required');
            return;
        }

        // Validate line items
        const validItems = lineItems.filter((item: Partial<QuoteItem>) => item.productName?.trim());
        if (validItems.length === 0) {
            toast.error('At least one item with a name is required');
            return;
        }

        setIsSubmitting(true);

        try {
            const { quote, error } = await quoteService.createQuote(userId, {
                name: quoteForm.name,
                validForDays: parseInt(quoteForm.validForDays) || 30,
                notes: quoteForm.notes || undefined,
                currency: quoteForm.currency,
                contactId: quoteForm.contactId || undefined,
                dealId: quoteForm.dealId || undefined
            });

            if (error) {
                toast.error(`Failed to create quote header: ${error}`);
                return;
            }

            if (quote) {
                // Add line items
                for (const item of validItems) {
                    await quoteService.addQuoteItem(quote.id, {
                        productName: item.productName!,
                        description: item.description,
                        quantity: item.quantity || 1,
                        unitPrice: item.unitPrice || 0
                    });
                }

                toast.success('Quote created with line items successfully!');
                setShowCreateModal(false);
                // Reset form
                setQuoteForm({
                    name: '',
                    validForDays: '30',
                    notes: '',
                    currency: 'USD',
                    contactId: '',
                    dealId: ''
                });
                setLineItems([{ productName: '', description: '', quantity: 1, unitPrice: 0 }]);
                loadQuotes();
            }
        } catch (err) {
            toast.error('Failed to create quote');
        } finally {
            setIsSubmitting(false);
        }
    };

    const addLineItem = () => {
        setLineItems([...lineItems, { productName: '', description: '', quantity: 1, unitPrice: 0 }]);
    };

    const removeLineItem = (index: number) => {
        if (lineItems.length > 1) {
            setLineItems(lineItems.filter((_: any, i: number) => i !== index));
        }
    };

    const updateLineItem = (index: number, field: keyof QuoteItem, value: any) => {
        const newItems = [...lineItems];
        newItems[index] = { ...newItems[index], [field]: value };
        setLineItems(newItems);
    };

    const calculateSubtotal = () => {
        return lineItems.reduce((sum: number, item: Partial<QuoteItem>) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
    };

    const handleViewQuote = async (quoteId: string) => {
        try {
            const { quote, error } = await quoteService.getQuoteById(quoteId);
            if (error) {
                toast.error(`Failed to load quote: ${error}`);
            } else if (quote) {
                setSelectedQuote(quote);

                // Load items
                const { items, error: itemsError } = await quoteService.getQuoteItems(quoteId);
                setSelectedQuoteItems(items || []);

                setShowViewModal(true);
            }
        } catch (err) {
            toast.error('Failed to load quote details');
        }
    };

    const handleDeleteQuote = async (quoteId: string) => {
        if (!window.confirm('Are you sure you want to delete this quote? This will also reclaim any associated file storage space.')) {
            return;
        }

        try {
            const { success, error } = await quoteService.deleteQuote(quoteId);
            if (error) {
                toast.error(`Failed to delete quote: ${error}`);
            } else {
                toast.success('Quote and associated documents deleted successfully');
                loadQuotes();
            }
        } catch (err) {
            toast.error('Failed to delete quote');
        }
    };

    const handleDownloadPDF = (quote: Quote) => {
        if (quote.pdfUrl) {
            window.open(quote.pdfUrl, '_blank');
        } else {
            toast.error('No PDF version available for this quote yet.');
        }
    };

    const handleConvertToInvoice = async () => {
        if (!selectedQuote) return;

        setIsSubmitting(true);
        try {
            // 1. Get items
            const { items, error: itemsError } = await quoteService.getQuoteItems(selectedQuote.id);
            if (itemsError) throw new Error(itemsError);

            // 2. Map to Invoice Line Items
            const lineItems = items.map(item => ({
                description: item.productName + (item.description ? ` - ${item.description}` : ''),
                quantity: item.quantity,
                rate: item.unitPrice,
                amount: item.lineTotal // Using the line total which already includes discounts/tax if calculated
            }));

            // 3. Create Invoice
            const { invoice, error: invError } = await businessInvoiceService.createInvoice(currentTenant?.id || '', {
                clientId: selectedQuote.contactId,
                status: 'draft',
                issueDate: new Date().toISOString().split('T')[0],
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +7 days default
                subtotal: selectedQuote.subtotal,
                total: selectedQuote.totalAmount,
                taxRate: selectedQuote.taxPercent,
                tax: selectedQuote.taxAmount,
                discountAmount: selectedQuote.discountAmount,
                lineItems: lineItems,
                notes: `Converted from Quote #${selectedQuote.quoteNumber}`
            });

            if (invError) throw new Error(invError);

            // 4. Update Quote Status
            await quoteService.updateQuote(selectedQuote.id, { status: 'converted' });

            toast.success('Quote converted to Invoice successfully!');
            setShowViewModal(false);
            loadQuotes();
        } catch (err: any) {
            toast.error(err.message || 'Failed to convert quote');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-violet-500 flex items-center gap-3">
                        <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-teal-400" /> Quotes & Proposals
                    </h2>
                    <p className="text-slate-400 mt-1 text-xs sm:text-sm">{quotes.length} quotes found</p>
                </div>
                <div className="flex gap-4 flex-wrap items-center">
                    {/* Storage Usage Indicator */}
                    <div className="hidden sm:flex items-center gap-3 bg-slate-900/50 border border-white/5 px-3 py-1.5 rounded-xl">
                        <div className="text-left min-w-[80px]">
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Storage</div>
                            <div className={`text-[10px] font-bold mt-1 ${storageUsage > MAX_STORAGE * 0.9 ? 'text-red-400' : 'text-teal-400'}`}>
                                {(storageUsage / 1024 / 1024).toFixed(1)}MB
                            </div>
                        </div>
                        <div className="w-16 h-1 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                            <div
                                className={`h-full transition-all duration-1000 ${storageUsage > MAX_STORAGE * 0.9 ? 'bg-red-500' : 'bg-teal-500'}`}
                                style={{ width: `${Math.min((storageUsage / MAX_STORAGE) * 100, 100)}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search quotes..."
                            className="w-full sm:w-64 bg-slate-950/50 border border-white/10 rounded-xl py-2 px-10 text-sm text-white focus:ring-2 focus:ring-teal-500/30 outline-none transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
                    {['all', 'draft', 'sent', 'accepted'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as any)}
                            className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter === f ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'bg-slate-950 text-slate-500 hover:text-white border border-white/5'}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                {(userRole === 'admin' || userRole === 'tenant_admin') && (
                    <Button onClick={() => setShowCreateModal(true)} className="shadow-lg shadow-teal-500/20">
                        <Plus className="w-5 h-5 mr-2" /> Create
                    </Button>
                )}
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <CardSkeleton key={i} />
                    ))}
                </div>
            ) : quotes.filter(q => q.name.toLowerCase().includes(searchQuery.toLowerCase()) || q.quoteNumber.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                <EmptyState
                    icon={Search}
                    title="No Matches Found"
                    description="Adjust your search or filter to find what you're looking for."
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {quotes
                        .filter(q => q.name.toLowerCase().includes(searchQuery.toLowerCase()) || q.quoteNumber.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((quote) => (
                            <div key={quote.id} className="glass-panel p-5 rounded-2xl border border-white/5 hover:border-teal-500/30 transition-all flex flex-col">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <div className="text-xs text-slate-500 mb-1">{quote.quoteNumber}</div>
                                        <h3 className="font-bold text-white text-lg">{quote.name}</h3>
                                    </div>
                                    <span className={`px-2 py-1 text-xs rounded-full font-bold uppercase ${getStatusColor(quote.status)}`}>
                                        {quote.status}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 text-teal-400 text-2xl font-bold mb-4">
                                    <DollarSign className="w-6 h-6" />
                                    {formatCurrency(quote.totalAmount, quote.currency)}
                                </div>

                                {quote.validUntil && (
                                    <div className="text-slate-400 text-xs mb-3">
                                        Valid until: {new Date(quote.validUntil).toLocaleDateString()}
                                    </div>
                                )}

                                {quote.viewCount > 0 && (
                                    <div className="flex items-center gap-2 text-slate-400 text-xs mb-3">
                                        <Eye className="w-4 h-4" />
                                        <span>Viewed {quote.viewCount} times</span>
                                    </div>
                                )}

                                {quote.acceptedAt && (
                                    <div className="flex items-center gap-2 text-green-400 text-xs mb-3">
                                        <Check className="w-4 h-4" />
                                        <span>Accepted on {new Date(quote.acceptedAt).toLocaleDateString()}</span>
                                    </div>
                                )}

                                {quote.rejectedAt && (
                                    <div className="flex items-center gap-2 text-red-400 text-xs mb-3">
                                        <X className="w-4 h-4" />
                                        <span>Rejected on {new Date(quote.rejectedAt).toLocaleDateString()}</span>
                                    </div>
                                )}

                                <div className="mt-auto pt-4 border-t border-white/5 flex gap-2">
                                    <Button className="flex-1" variant="secondary" onClick={() => handleViewQuote(quote.id)}>
                                        Details
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="p-2 border-white/10 hover:bg-slate-800"
                                        onClick={() => handleDownloadPDF(quote)}
                                        title="Download PDF"
                                    >
                                        <Download className="w-4 h-4 text-slate-400" />
                                    </Button>
                                    {(userRole === 'admin' || userRole === 'tenant_admin') && (
                                        <Button
                                            variant="outline"
                                            className="p-2 border-white/10 hover:bg-red-500/10 hover:border-red-500/30 group"
                                            onClick={() => handleDeleteQuote(quote.id)}
                                            title="Delete Quote"
                                        >
                                            <Trash2 className="w-4 h-4 text-slate-500 group-hover:text-red-400" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                </div>
            )}

            <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Quote">
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Quote Name *"
                            value={quoteForm.name}
                            onChange={(e) => setQuoteForm({ ...quoteForm, name: e.target.value })}
                            placeholder="e.g. Website Design Project"
                            required
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <Input
                                label="Valid For (Days)"
                                type="number"
                                value={quoteForm.validForDays}
                                onChange={(e) => setQuoteForm({ ...quoteForm, validForDays: e.target.value })}
                                min="1"
                            />
                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-slate-300">Currency</label>
                                <select
                                    value={quoteForm.currency}
                                    onChange={(e) => setQuoteForm({ ...quoteForm, currency: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                >
                                    <option value="USD">USD ($)</option>
                                    <option value="EUR">EUR (€)</option>
                                    <option value="GBP">GBP (£)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-slate-300">Link to Lead/Contact (Optional)</label>
                            <select
                                value={quoteForm.contactId}
                                onChange={(e) => setQuoteForm({ ...quoteForm, contactId: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                            >
                                <option value="">No Contact Linked</option>
                                {availableContacts.map(contact => (
                                    <option key={contact.id} value={contact.id}>{contact.businessName || contact.name || 'Unnamed Contact'}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-slate-300">Link to Deal (Optional)</label>
                            <select
                                value={quoteForm.dealId}
                                onChange={(e) => setQuoteForm({ ...quoteForm, dealId: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                            >
                                <option value="">No Deal Linked</option>
                                {availableDeals.map(deal => (
                                    <option key={deal.id} value={deal.id}>{deal.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Line Items Editor */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-teal-400 uppercase tracking-wider">Services & Pricing</h4>
                            <Button variant="outline" className="h-8 py-0 text-xs border-teal-500/30 text-teal-400" onClick={addLineItem}>
                                <Plus className="w-3.5 h-3.5 mr-1" /> Add Item
                            </Button>
                        </div>

                        <div className="space-y-3 border border-white/5 rounded-xl p-4 bg-slate-950/30">
                            {lineItems.map((item: Partial<QuoteItem>, index: number) => (
                                <div key={index} className="grid grid-cols-12 gap-3 items-start pb-3 border-b border-white/5 last:border-0 last:pb-0">
                                    <div className="col-span-12 md:col-span-5">
                                        <input
                                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-teal-500/50 outline-none transition-all"
                                            placeholder="Service name *"
                                            value={item.productName}
                                            onChange={(e) => updateLineItem(index, 'productName', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-4 md:col-span-2">
                                        <input
                                            type="number"
                                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-teal-500/50"
                                            placeholder="Qty"
                                            value={item.quantity}
                                            onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div className="col-span-6 md:col-span-4">
                                        <div className="relative">
                                            <span className="absolute left-3 top-2 text-slate-500 text-sm">
                                                {quoteForm.currency === 'EUR' ? '€' : quoteForm.currency === 'GBP' ? '£' : '$'}
                                            </span>
                                            <input
                                                type="number"
                                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-6 pr-3 py-2 text-sm text-slate-200 outline-none focus:border-teal-500/50"
                                                placeholder="Price"
                                                value={item.unitPrice}
                                                onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                    </div>
                                    <div className="col-span-2 md:col-span-1 flex justify-end">
                                        <button
                                            onClick={() => removeLineItem(index)}
                                            className="p-2 text-slate-600 hover:text-red-400 transition-colors"
                                            disabled={lineItems.length === 1}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="col-span-12">
                                        <input
                                            className="w-full bg-transparent border-none px-3 py-1 text-xs text-slate-500 placeholder-slate-700 outline-none"
                                            placeholder="Optional description..."
                                            value={item.description}
                                            onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end pt-2">
                            <div className="text-right">
                                <div className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Estimated Subtotal</div>
                                <div className="text-xl font-bold text-teal-400">{formatCurrency(calculateSubtotal(), quoteForm.currency)}</div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes & Terms</label>
                        <textarea
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all text-sm"
                            rows={2}
                            value={quoteForm.notes}
                            onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
                            placeholder="Optional notes for the client"
                        />
                    </div>

                    <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                        <Button onClick={handleCreateQuote} disabled={isSubmitting} className="min-w-[140px] shadow-lg shadow-teal-500/20">
                            {isSubmitting ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                    Processing...
                                </div>
                            ) : 'Generate Quote'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* View Quote Modal */}
            {showViewModal && selectedQuote && (
                <Modal isOpen={showViewModal} onClose={() => setShowViewModal(false)} title={`Quote: ${selectedQuote.quoteNumber}`}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Quote Name</label>
                                <p className="text-white font-medium">{selectedQuote?.name}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Status</label>
                                <span className={`px-2 py-1 text-xs rounded-full font-bold uppercase ${getStatusColor(selectedQuote?.status || '')}`}>
                                    {selectedQuote?.status}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Total Amount</label>
                                <p className="text-2xl text-teal-400 font-bold">{formatCurrency(selectedQuote?.totalAmount || 0, selectedQuote?.currency || 'USD')}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Valid Until</label>
                                <p className="text-white">{selectedQuote?.validUntil ? new Date(selectedQuote.validUntil).toLocaleDateString() : 'N/A'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">View Count</label>
                                <p className="text-white">{selectedQuote?.viewCount || 0} times</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Currency</label>
                                <p className="text-white">{selectedQuote?.currency}</p>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="border border-white/5 rounded-xl overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-900/80 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-white/5">
                                    <tr>
                                        <th className="px-4 py-3">Description</th>
                                        <th className="px-4 py-3 text-center">Qty</th>
                                        <th className="px-4 py-3 text-right">Price</th>
                                        <th className="px-4 py-3 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {selectedQuoteItems.map((item: QuoteItem) => (
                                        <tr key={item.id} className="text-slate-300">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-white">{item.productName}</div>
                                                {item.description && <div className="text-xs text-slate-500">{item.description}</div>}
                                            </td>
                                            <td className="px-4 py-3 text-center">{item.quantity}</td>
                                            <td className="px-4 py-3 text-right">{formatCurrency(item.unitPrice, selectedQuote?.currency || 'USD')}</td>
                                            <td className="px-4 py-3 text-right font-bold text-teal-400">{formatCurrency(item.lineTotal, selectedQuote?.currency || 'USD')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-900/40 border-t border-white/5 font-bold">
                                    <tr>
                                        <td colSpan={3} className="px-4 py-3 text-right text-slate-400">Subtotal</td>
                                        <td className="px-4 py-3 text-right text-white">{formatCurrency(selectedQuote?.subtotal || 0, selectedQuote?.currency || 'USD')}</td>
                                    </tr>
                                    <tr className="border-t border-white/5 bg-teal-500/5">
                                        <td colSpan={3} className="px-4 py-3 text-right text-teal-400 uppercase text-[10px] tracking-widest font-black">Total Due</td>
                                        <td className="px-4 py-3 text-right text-teal-400 text-lg">{formatCurrency(selectedQuote?.totalAmount || 0, selectedQuote?.currency || 'USD')}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {selectedQuote.notes && (
                            <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Notes & Terms</label>
                                <p className="text-slate-300 text-sm italic">"{selectedQuote.notes}"</p>
                            </div>
                        )}

                        {selectedQuote?.sentAt && (
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Sent At</label>
                                <p className="text-white">{selectedQuote?.sentAt ? new Date(selectedQuote.sentAt).toLocaleString() : 'N/A'}</p>
                            </div>
                        )}

                        {selectedQuote?.acceptedAt && (
                            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                                <label className="block text-sm font-medium text-green-400 mb-1">Accepted</label>
                                <p className="text-white">{selectedQuote?.acceptedAt ? new Date(selectedQuote.acceptedAt).toLocaleString() : 'N/A'}</p>
                            </div>
                        )}

                        {selectedQuote?.rejectedAt && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                                <label className="block text-sm font-medium text-red-400 mb-1">Rejected</label>
                                <p className="text-white">{selectedQuote?.rejectedAt ? new Date(selectedQuote.rejectedAt).toLocaleString() : 'N/A'}</p>
                                {selectedQuote?.rejectionReason && (
                                    <p className="text-slate-400 text-sm mt-1">Reason: {selectedQuote.rejectionReason}</p>
                                )}
                            </div>
                        )}

                        <div className="pt-4 flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setShowViewModal(false)}>Close</Button>
                            {selectedQuote?.status === 'accepted' && (
                                <Button
                                    onClick={handleConvertToInvoice}
                                    disabled={isSubmitting}
                                    className="bg-teal-500 hover:bg-teal-600 text-white"
                                >
                                    {isSubmitting ? 'Converting...' : 'Convert to Invoice'}
                                </Button>
                            )}
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default QuotesTab;
