'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { businessInvoiceService, BusinessInvoice } from '@/services/businessInvoiceService';
import { Card, Button, Badge } from '@/components/ui/UIComponents';
import { FileText, CreditCard, Calendar, Download, ShieldCheck, CheckCircle2 } from 'lucide-react';
import jsPDF from 'jspdf';

export default function PublicInvoicePage() {
    const params = useParams();
    const invoiceId = params?.id as string;
    const [invoice, setInvoice] = useState<BusinessInvoice | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (invoiceId) {
            loadInvoice();
        }
    }, [invoiceId]);

    const loadInvoice = async () => {
        try {
            const { invoice, error } = await businessInvoiceService.getPublicInvoice(invoiceId);
            if (error) {
                setError(error);
            } else {
                setInvoice(invoice);
            }
        } catch (err) {
            setError('Failed to load invoice details');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = () => {
        if (!invoice) return;
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.text('INVOICE', 20, 20);
        doc.setFontSize(12);
        doc.text(`Invoice #: ${invoice.invoiceNumber}`, 20, 40);
        doc.text(`Issue Date: ${invoice.issueDate}`, 20, 50);
        doc.text(`Due Date: ${invoice.dueDate}`, 20, 60);
        doc.text(`Status: ${invoice.status.toUpperCase()}`, 20, 70);
        doc.text(`Total: $${invoice.total.toFixed(2)}`, 20, 90);
        doc.save(`invoice-${invoice.invoiceNumber}.pdf`);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-mono text-sm tracking-widest uppercase">Initializing Secure Payment Gateway</p>
                </div>
            </div>
        );
    }

    if (error || !invoice) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
                <div className="text-center max-w-md bg-slate-950 border border-slate-800 p-8 rounded-2xl">
                    <h1 className="text-2xl font-bold text-red-500 mb-4">Invoice Not Found</h1>
                    <p className="text-slate-400 mb-8">This invoice payment link is no longer valid or has been disabled by the system.</p>
                    <Button variant="outline" onClick={() => window.location.href = '/'}>Return Home</Button>
                </div>
            </div>
        );
    }

    const isPaid = invoice.status === 'paid';

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 md:p-12 font-sans selection:bg-teal-500/30">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none opacity-20">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-500/20 blur-[150px] rounded-full"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 blur-[150px] rounded-full"></div>
            </div>

            <div className="max-w-5xl mx-auto grid md:grid-cols-5 gap-8 relative z-10">
                {/* Left: Invoice Details */}
                <div className="md:col-span-3 space-y-6">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-16 h-16 bg-white flex items-center justify-center rounded-2xl shadow-xl shadow-white/5">
                            <span className="text-black font-black text-2xl">A</span>
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">AlphaClone Systems</h1>
                            <p className="text-slate-500 text-sm font-mono">FINANCIAL SETTLEMENT PORTAL</p>
                        </div>
                    </div>

                    <Card className="p-8 border-slate-800 bg-slate-900/50 backdrop-blur-xl">
                        <div className="flex justify-between items-start mb-12">
                            <div>
                                <p className="text-slate-500 text-xs uppercase tracking-widest font-bold mb-1">Invoice Reference</p>
                                <h2 className="text-3xl font-mono font-bold text-white">{invoice.invoiceNumber}</h2>
                            </div>
                            <Badge variant={isPaid ? 'success' : 'neutral'} className="px-4 py-1.5 text-sm uppercase">
                                {invoice.status}
                            </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-8 mb-12">
                            <div>
                                <p className="text-slate-500 text-xs uppercase font-bold mb-2">Issue Date</p>
                                <p className="text-lg font-medium">{new Date(invoice.issueDate).toLocaleDateString()}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 text-xs uppercase font-bold mb-2">Due Date</p>
                                <p className="text-lg font-medium text-teal-400">{new Date(invoice.dueDate).toLocaleDateString()}</p>
                            </div>
                        </div>

                        {/* Line Items */}
                        <div className="space-y-4 border-t border-white/5 pt-8">
                            <p className="text-slate-500 text-xs uppercase font-bold mb-4">Billing Summary</p>
                            <div className="space-y-3">
                                {invoice.lineItems.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-slate-950/30 p-4 rounded-xl border border-white/5">
                                        <div>
                                            <p className="font-semibold text-slate-200">{item.description}</p>
                                            <p className="text-xs text-slate-500">Qty: {item.quantity} &times; ${item.rate.toFixed(2)}</p>
                                        </div>
                                        <p className="font-mono font-bold text-teal-400">${item.amount.toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Totals */}
                        <div className="mt-8 pt-8 border-t border-white/5 space-y-3">
                            <div className="flex justify-between text-slate-400">
                                <span>Subtotal</span>
                                <span className="font-mono">${invoice.subtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <span>Tax (0%)</span>
                                <span className="font-mono">$0.00</span>
                            </div>
                            <div className="flex justify-between items-center text-white pt-4">
                                <span className="text-xl font-bold">Total Amount Due</span>
                                <span className="text-4xl font-mono font-black text-teal-500">${invoice.total.toLocaleString()}</span>
                            </div>
                        </div>
                    </Card>

                    <div className="flex gap-4">
                        <Button variant="outline" className="flex-1 gap-2 border-slate-800 bg-slate-900/50" onClick={handleDownloadPDF}>
                            <Download className="w-4 h-4" /> Download Statement
                        </Button>
                        <Button variant="outline" className="flex-1 gap-2 border-slate-800 bg-slate-900/50">
                            <FileText className="w-4 h-4" /> Print Receipt
                        </Button>
                    </div>
                </div>

                {/* Right: Payment Sidebar */}
                <div className="md:col-span-2 space-y-6">
                    <div className="sticky top-12">
                        {isPaid ? (
                            <Card className="p-8 border-teal-500/30 bg-teal-500/10 text-center space-y-6">
                                <div className="w-20 h-20 bg-teal-500 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(20,184,166,0.5)]">
                                    <CheckCircle2 className="w-12 h-12 text-white" />
                                </div>
                                <h3 className="text-2xl font-bold">Payment Confirmed</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    Thank you for your business. Your payment for {invoice.invoiceNumber} has been successfully processed and verified on the blockchain.
                                </p>
                                <div className="pt-4 mt-4 border-t border-teal-500/20">
                                    <p className="text-xs text-teal-500 font-mono uppercase tracking-widest">Transaction Verified</p>
                                </div>
                            </Card>
                        ) : (
                            <div className="space-y-6">
                                <Card className="p-8 border-slate-800 bg-slate-900 shadow-2xl space-y-8">
                                    <div className="text-center">
                                        <h3 className="text-xl font-bold mb-2">Checkout Securely</h3>
                                        <p className="text-slate-500 text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                                            <ShieldCheck className="w-4 h-4 text-teal-500" /> AES-256 Encrypted
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="p-4 bg-slate-800 rounded-xl border border-slate-700 hover:border-teal-500/50 transition-colors group cursor-pointer">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-slate-950 rounded-lg flex items-center justify-center">
                                                    <CreditCard className="w-6 h-6 text-slate-400 group-hover:text-teal-400 transition-colors" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-bold">Pay with Stripe</p>
                                                    <p className="text-xs text-slate-500">Credit, Debit, or Digital Wallets</p>
                                                </div>
                                            </div>
                                        </div>

                                        <button className="w-full py-4 bg-teal-500 hover:bg-teal-400 text-black font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_10px_30px_rgba(20,184,166,0.3)] hover:-translate-y-1">
                                            Pay ${invoice.total.toLocaleString()} Now
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-center gap-4 opacity-30">
                                        <span className="text-xs">VISA</span>
                                        <span className="text-xs">MASTERCARD</span>
                                        <span className="text-xs">STRIPE</span>
                                        <span className="text-xs">EFT</span>
                                    </div>
                                </Card>

                                <div className="p-6 bg-slate-900/30 border border-slate-900 rounded-2xl">
                                    <p className="text-slate-500 text-xs italic text-center">
                                        By clicking &apos;Pay Now&apos;, you agree to AlphaClone&apos;s standard Terms of Service and Refund Policy.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Global Footer */}
            <div className="max-w-5xl mx-auto mt-24 pt-12 border-t border-slate-900 flex flex-col items-center gap-8 text-slate-600">
                <div className="flex items-center gap-4 font-mono text-xs uppercase tracking-widest">
                    <span>AlphaClone Core</span>
                    <span className="w-1 h-1 bg-slate-800 rounded-full"></span>
                    <span>Finance Engine v2.0</span>
                    <span className="w-1 h-1 bg-slate-800 rounded-full"></span>
                    <span>GDPR Compliant</span>
                </div>
                <p className="text-xs">&copy; {new Date().getFullYear()} AlphaClone. Dynamic Systems for Elite Operations.</p>
            </div>
        </div>
    );
}
