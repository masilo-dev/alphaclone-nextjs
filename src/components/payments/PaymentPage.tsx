import React, { useState, useEffect } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { stripePromise, paymentService, Invoice, Payment } from '../../services/paymentService';
import { CheckoutForm } from './CheckoutForm';
import { Card, Button, Badge } from '../ui/UIComponents';
import { CreditCard, History, FileText, Check, X, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { User } from '../../types';

interface PaymentPageProps {
    user: User;
}

const PaymentPage: React.FC<PaymentPageProps> = ({ user }) => {
    const [activeTab, setActiveTab] = useState<'invoices' | 'history'>('invoices');
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);

    // Checkout state
    const [showCheckout, setShowCheckout] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [clientSecret, setClientSecret] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, [user.id]);

    const loadData = async () => {
        setLoading(true);
        const { invoices: invData } = await paymentService.getUserInvoices(user.id);
        const { payments: payData } = await paymentService.getPaymentHistory(user.id);

        if (invData) setInvoices(invData);
        if (payData) setPayments(payData);
        setLoading(false);
    };

    const handlePayClick = async (invoice: Invoice) => {
        setSelectedInvoice(invoice);

        // Create PaymentIntent
        const { clientSecret: secret, error } = await paymentService.createPaymentIntent(invoice.id);

        if (secret) {
            setClientSecret(secret);
            setShowCheckout(true);
        } else {
            console.error('Failed to init payment:', error);
            // Show error notification here
        }
    };

    const handlePaymentSuccess = async (paymentIntentId: string) => {
        if (selectedInvoice) {
            await paymentService.markInvoicePaid(selectedInvoice.id, paymentIntentId);
            setShowCheckout(false);
            setClientSecret(null);
            setSelectedInvoice(null);
            loadData(); // Refresh list
            // Show success notification here
        }
    };

    const startCreateInvoice = () => {
        // For demo purposes - create a dummy invoice
        const dummyInvoice = {
            user_id: user.id,
            amount: 499.00,
            currency: 'usd',
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            description: 'Web Development Services - Milestone 1',
            items: [
                { description: 'Frontend Development', quantity: 1, unit_price: 299.00, amount: 299.00 },
                { description: 'UI Design', quantity: 1, unit_price: 200.00, amount: 200.00 }
            ]
        };

        paymentService.createInvoice(dummyInvoice).then(() => loadData());
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-400">Loading payments...</div>;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <CreditCard className="w-6 h-6 text-teal-400" />
                    Payments & Billing
                </h2>

                <div className="flex gap-2">
                    {/* Admin only button in real app */}
                    {user.role === 'admin' && (
                        <Button variant="outline" onClick={startCreateInvoice}>
                            + Create Test Invoice
                        </Button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-slate-700">
                <button
                    onClick={() => setActiveTab('invoices')}
                    className={`pb-3 px-1 text-sm font-medium transition-colors ${activeTab === 'invoices' ? 'text-teal-400 border-b-2 border-teal-400' : 'text-slate-400 hover:text-white'
                        }`}
                >
                    Invoices
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`pb-3 px-1 text-sm font-medium transition-colors ${activeTab === 'history' ? 'text-teal-400 border-b-2 border-teal-400' : 'text-slate-400 hover:text-white'
                        }`}
                >
                    Payment History
                </button>
            </div>

            {/* Invoices List */}
            {activeTab === 'invoices' && (
                <div className="space-y-4">
                    {invoices.length === 0 ? (
                        <Card className="p-8 text-center text-slate-400">
                            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            No invoices found.
                        </Card>
                    ) : (
                        invoices.map((invoice) => (
                            <Card key={invoice.id} className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="flex items-center gap-4 flex-1">
                                    <div className={`p-3 rounded-full ${invoice.status === 'paid' ? 'bg-green-500/10 text-green-500' : 'bg-slate-700 text-slate-300'}`}>
                                        <FileText className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white">{invoice.description}</h3>
                                        <div className="text-sm text-slate-400">Due: {format(new Date(invoice.due_date), 'MMM dd, yyyy')}</div>
                                        <div className="text-xs text-slate-500">ID: {invoice.id.slice(0, 8)}...</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <div className="text-xl font-bold text-white">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency.toUpperCase() }).format(invoice.amount)}
                                        </div>
                                        <div>
                                            {invoice.status === 'paid' && <Badge className="bg-green-500/20 text-green-400">PAID</Badge>}
                                            {invoice.status === 'sent' && <Badge className="bg-blue-500/20 text-blue-400">SENT</Badge>}
                                            {invoice.status === 'draft' && <Badge className="bg-slate-500/20 text-slate-400">DRAFT</Badge>}
                                        </div>
                                    </div>

                                    {invoice.status !== 'paid' && invoice.status !== 'draft' && (
                                        <Button onClick={() => handlePayClick(invoice)}>
                                            Pay Now
                                        </Button>
                                    )}
                                    {/* Allow paying drafts for testing */}
                                    {invoice.status === 'draft' && (
                                        <Button variant="outline" onClick={() => handlePayClick(invoice)}>
                                            Pay Draft (Test)
                                        </Button>
                                    )}
                                </div>
                            </Card>
                        ))
                    )}
                </div>
            )}

            {/* Payment History */}
            {activeTab === 'history' && (
                <div className="space-y-4">
                    {payments.length === 0 ? (
                        <Card className="p-8 text-center text-slate-400">
                            <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            No payment history yet.
                        </Card>
                    ) : (
                        payments.map((payment) => (
                            <Card key={payment.id} className="p-4 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-slate-700 rounded-full text-green-400">
                                        <Check className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-white">Payment via Stripe</div>
                                        <div className="text-sm text-slate-400">{format(new Date(payment.created_at), 'PPP p')}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-white">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: payment.currency.toUpperCase() }).format(payment.amount)}
                                    </div>
                                    <div className="text-xs text-green-400 uppercase">{payment.status}</div>
                                </div>
                            </Card>
                        ))
                    )}
                </div>
            )}

            {/* Checkout Modal */}
            {showCheckout && clientSecret && selectedInvoice && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-lg relative animate-fade-in-up max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setShowCheckout(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-white mb-1">Secure Payment</h3>
                            <p className="text-slate-400 text-sm">Complete your payment for invoice #{selectedInvoice.id.slice(0, 8)}</p>
                        </div>

                        <Elements stripe={stripePromise} options={{
                            clientSecret,
                            appearance: { theme: 'night', labels: 'floating' }
                        }}>
                            <CheckoutForm
                                amount={selectedInvoice.amount}
                                currency={selectedInvoice.currency}
                                onSuccess={handlePaymentSuccess}
                                onCancel={() => setShowCheckout(false)}
                            />
                        </Elements>

                        <div className="mt-4 pt-4 border-t border-slate-700 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                            <CheckCircle className="w-3 h-3" />
                            Payments secured by Stripe. End-to-end encrypted.
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default PaymentPage;
