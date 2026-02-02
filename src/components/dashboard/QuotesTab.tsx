import React, { useEffect, useState } from 'react';
import { FileText, Plus, Eye, Check, X, DollarSign } from 'lucide-react';
import { quoteService, Quote, QuoteItem } from '../../services/quoteService';
import { businessInvoiceService } from '../../services/businessInvoiceService';
import { useTenant } from '../../contexts/TenantContext';
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
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Create quote form state
    const [quoteForm, setQuoteForm] = useState({
        name: '',
        validForDays: '30',
        notes: ''
    });

    useEffect(() => {
        loadQuotes();
    }, [filter, userId, userRole]);

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

        setIsSubmitting(true);

        try {
            const { error } = await quoteService.createQuote(userId, {
                name: quoteForm.name,
                validForDays: parseInt(quoteForm.validForDays) || 30,
                notes: quoteForm.notes || undefined
            });

            if (error) {
                toast.error(`Failed to create quote: ${error}`);
            } else {
                toast.success('Quote created successfully!');
                setShowCreateModal(false);
                // Reset form
                setQuoteForm({
                    name: '',
                    validForDays: '30',
                    notes: ''
                });
                loadQuotes();
            }
        } catch (err) {
            toast.error('Failed to create quote');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleViewQuote = async (quoteId: string) => {
        try {
            const { quote, error } = await quoteService.getQuoteById(quoteId);
            if (error) {
                toast.error(`Failed to load quote: ${error}`);
            } else if (quote) {
                setSelectedQuote(quote);
                setShowViewModal(true);
            }
        } catch (err) {
            toast.error('Failed to load quote details');
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

            // Optional: Redirect to Invoice?
            // router.push('/dashboard/billing'); 
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
                <div className="flex gap-2 flex-wrap">
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as any)}
                        className="px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm"
                    >
                        <option value="all">All Quotes</option>
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="accepted">Accepted</option>
                    </select>
                    {userRole === 'admin' && (
                        <Button onClick={() => setShowCreateModal(true)}>
                            <Plus className="w-5 h-5 mr-2" /> Create Quote
                        </Button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <CardSkeleton key={i} />
                    ))}
                </div>
            ) : quotes.length === 0 ? (
                <EmptyState
                    icon={FileText}
                    title="No Quotes Found"
                    description="Create quotes and proposals to send to your clients."
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {quotes.map((quote) => (
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

                            <div className="mt-auto pt-4 border-t border-white/5">
                                <Button className="w-full" variant="secondary" onClick={() => handleViewQuote(quote.id)}>
                                    View Details
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Quote Modal */}
            {showCreateModal && (
                <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Quote">
                    <div className="space-y-4">
                        <Input
                            label="Quote Name *"
                            value={quoteForm.name}
                            onChange={(e) => setQuoteForm({ ...quoteForm, name: e.target.value })}
                            placeholder="Enter quote name"
                            required
                        />

                        <Input
                            label="Valid For (Days)"
                            type="number"
                            value={quoteForm.validForDays}
                            onChange={(e) => setQuoteForm({ ...quoteForm, validForDays: e.target.value })}
                            placeholder="30"
                            min="1"
                        />

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
                            <textarea
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                                rows={3}
                                value={quoteForm.notes}
                                onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
                                placeholder="Quote notes (optional)"
                            />
                        </div>

                        <div className="pt-4 flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                            <Button onClick={handleCreateQuote} disabled={isSubmitting}>
                                {isSubmitting ? 'Creating...' : 'Create Quote'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* View Quote Modal */}
            {showViewModal && selectedQuote && (
                <Modal isOpen={showViewModal} onClose={() => setShowViewModal(false)} title={`Quote: ${selectedQuote.quoteNumber}`}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Quote Name</label>
                                <p className="text-white font-medium">{selectedQuote.name}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Status</label>
                                <span className={`px-2 py-1 text-xs rounded-full font-bold uppercase ${getStatusColor(selectedQuote.status)}`}>
                                    {selectedQuote.status}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Total Amount</label>
                                <p className="text-2xl text-teal-400 font-bold">{formatCurrency(selectedQuote.totalAmount, selectedQuote.currency)}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Valid Until</label>
                                <p className="text-white">{selectedQuote.validUntil ? new Date(selectedQuote.validUntil).toLocaleDateString() : 'N/A'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">View Count</label>
                                <p className="text-white">{selectedQuote.viewCount} times</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Currency</label>
                                <p className="text-white">{selectedQuote.currency}</p>
                            </div>
                        </div>

                        {selectedQuote.notes && (
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Notes</label>
                                <p className="text-white text-sm">{selectedQuote.notes}</p>
                            </div>
                        )}

                        {selectedQuote.sentAt && (
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Sent At</label>
                                <p className="text-white">{new Date(selectedQuote.sentAt).toLocaleString()}</p>
                            </div>
                        )}

                        {selectedQuote.acceptedAt && (
                            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                                <label className="block text-sm font-medium text-green-400 mb-1">Accepted</label>
                                <p className="text-white">{new Date(selectedQuote.acceptedAt).toLocaleString()}</p>
                            </div>
                        )}

                        {selectedQuote.rejectedAt && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                                <label className="block text-sm font-medium text-red-400 mb-1">Rejected</label>
                                <p className="text-white">{new Date(selectedQuote.rejectedAt).toLocaleString()}</p>
                                {selectedQuote.rejectionReason && (
                                    <p className="text-slate-400 text-sm mt-1">Reason: {selectedQuote.rejectionReason}</p>
                                )}
                            </div>
                        )}

                        <div className="pt-4 flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setShowViewModal(false)}>Close</Button>
                            {selectedQuote.status === 'accepted' && (
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
