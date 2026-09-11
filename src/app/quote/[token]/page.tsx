'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { SignaturePad } from '@/components/contracts/SignaturePad';
import { extractTenantBranding } from '@/lib/tenantBranding';
import { DocumentPreview } from '@/components/documents/DocumentPreview';
import { buildQuoteDocumentInput } from '@/lib/documents/documentBuilders';

type QuotePayload = {
    quoteNumber: string;
    name: string;
    status: string;
    totalAmount: number;
    currency: string;
    validUntil?: string;
    termsAndConditions?: string;
    notes?: string;
    metadata?: Record<string, unknown>;
    tenantName?: string;
    tenantSettings?: Record<string, unknown> | null;
    tenantLogoUrl?: string | null;
    tenantBrandColor?: string | null;
};

type QuoteItem = {
    productName: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
};

export default function PublicQuotePage() {
    const params = useParams();
    const token = params?.token as string;

    const [quote, setQuote] = useState<QuotePayload | null>(null);
    const [items, setItems] = useState<QuoteItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [responding, setResponding] = useState(false);
    const [responded, setResponded] = useState<'accepted' | 'rejected' | null>(null);
    const [note, setNote] = useState('');
    const [acceptedBy, setAcceptedBy] = useState('');
    const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
    const [invoiceLink, setInvoiceLink] = useState<string | null>(null);

    useEffect(() => {
        if (token) loadQuote();
    }, [token]);

    const loadQuote = async () => {
        try {
            const response = await fetch(`/api/quotes/respond?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.quote) {
                throw new Error(payload.error || 'Quote not found');
            }
            setQuote(payload.quote);
            setItems(payload.items || []);
            if (payload.quote.status === 'accepted') setResponded('accepted');
            if (payload.quote.status === 'rejected') setResponded('rejected');
        } catch (err: any) {
            toast.error(err.message || 'Failed to load quote');
        } finally {
            setLoading(false);
        }
    };

    const handleRespond = async (action: 'accept' | 'reject') => {
        if (action === 'accept' && !acceptedBy.trim()) {
            toast.error('Please enter your name to accept');
            return;
        }
        setResponding(true);
        try {
            const response = await fetch('/api/quotes/respond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    action,
                    note: note.trim(),
                    acceptedBy: acceptedBy.trim(),
                    signatureUrl: action === 'accept' ? signatureUrl : undefined,
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.success) {
                throw new Error(payload.error || 'Failed to submit response');
            }
            setResponded(action === 'accept' ? 'accepted' : 'rejected');
            if (payload.invoiceId) {
                setInvoiceLink(`/invoice/${payload.invoiceId}`);
            }
            toast.success(action === 'accept' ? 'Quote accepted — thank you!' : 'Response recorded');
        } catch (err: any) {
            toast.error(err.message || 'Something went wrong');
        } finally {
            setResponding(false);
        }
    };

    const previewInput = useMemo(() => {
        if (!quote) return null;
        return buildQuoteDocumentInput(
            {
                quote_number: quote.quoteNumber,
                name: quote.name,
                valid_until: quote.validUntil,
                notes: quote.notes,
                status: quote.status,
                total_amount: quote.totalAmount,
                metadata: quote.metadata,
            },
            items.map((item) => ({
                product_name: item.productName,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                line_total: item.lineTotal,
            })),
            {
                name: quote.tenantName,
                logo_url: quote.tenantLogoUrl,
                brand_color_primary: quote.tenantBrandColor,
                settings: quote.tenantSettings,
            }
        );
    }, [quote, items]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
            </div>
        );
    }

    if (!quote) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
                Quote not found or link expired.
            </div>
        );
    }

    const isFinal = responded || quote.status === 'accepted' || quote.status === 'rejected';
    const branding = extractTenantBranding({
        name: quote.tenantName,
        logo_url: quote.tenantLogoUrl,
        settings: quote.tenantSettings,
    });
    const pdfUrl = `/api/quotes/${encodeURIComponent(token)}/pdf`;

    return (
        <div className="min-h-screen overflow-x-hidden bg-slate-950 text-slate-200 py-6 sm:py-8 px-4">
            <Toaster position="top-center" />
            <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-6 sm:p-7 border-b border-slate-800 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4" style={{ borderTopColor: branding.primaryColor, borderTopWidth: 3 }}>
                    <div className="flex items-center gap-3">
                    {branding.logoUrl ? (
                        <img src={branding.logoUrl} alt="" className="h-10 w-auto object-contain" />
                    ) : (
                        <div className="p-3 bg-teal-500/10 rounded-xl">
                            <FileText className="w-7 h-7 text-teal-400" />
                        </div>
                    )}
                        <div>
                            <h1 className="text-xl font-bold text-white">Quote {quote.quoteNumber}</h1>
                            <p className="text-sm text-slate-400">{quote.name} · {branding.name}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <a
                            href={pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-bold text-slate-200 hover:border-teal-500/50 hover:text-white"
                        >
                            View PDF
                        </a>
                        <a
                            href={pdfUrl}
                            download
                            className="inline-flex items-center justify-center rounded-xl bg-teal-500 px-4 py-2 text-sm font-black text-black hover:bg-teal-400"
                        >
                            Download PDF
                        </a>
                    </div>
                </div>

                <div className="p-6 sm:p-8 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                            <div className="text-[10px] uppercase tracking-widest text-slate-500">Status</div>
                            <div className="mt-1 text-lg font-bold text-white capitalize">{quote.status}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                            <div className="text-[10px] uppercase tracking-widest text-slate-500">Total</div>
                            <div className="mt-1 text-lg font-bold text-teal-400">
                                {Number(quote.totalAmount).toFixed(2)} {quote.currency || 'USD'}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                            <div className="text-[10px] uppercase tracking-widest text-slate-500">Valid until</div>
                            <div className="mt-1 text-lg font-bold text-white">
                                {quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : 'Open'}
                            </div>
                        </div>
                    </div>

                    {previewInput ? <DocumentPreview input={previewInput} /> : null}

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-slate-500 border-b border-slate-800">
                                    <th className="py-2 pr-4">Item</th>
                                    <th className="py-2 pr-4 text-right">Qty</th>
                                    <th className="py-2 pr-4 text-right">Price</th>
                                    <th className="py-2 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, i) => (
                                    <tr key={i} className="border-b border-slate-800/50">
                                        <td className="py-3 pr-4">
                                            <div className="font-medium text-white">{item.productName}</div>
                                            {item.description && <div className="text-xs text-slate-500">{item.description}</div>}
                                        </td>
                                        <td className="py-3 pr-4 text-right">{item.quantity}</td>
                                        <td className="py-3 pr-4 text-right">{Number(item.unitPrice).toFixed(2)}</td>
                                        <td className="py-3 text-right font-medium">{Number(item.lineTotal).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="text-right text-lg font-bold text-white">
                        Total: {Number(quote.totalAmount).toFixed(2)} {quote.currency || 'USD'}
                    </div>
                    {quote.validUntil && (
                        <p className="text-sm text-slate-500">Valid until {new Date(quote.validUntil).toLocaleDateString()}</p>
                    )}
                    {quote.termsAndConditions && (
                        <div className="text-xs text-slate-500 border-t border-slate-800 pt-4 whitespace-pre-wrap">
                            {quote.termsAndConditions}
                        </div>
                    )}
                </div>

                {isFinal ? (
                    <div className="p-6 border-t border-slate-800 text-center">
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
                            (responded || quote.status) === 'accepted'
                                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                            {(responded || quote.status) === 'accepted' ? (
                                <><CheckCircle className="w-5 h-5" /> Quote accepted</>
                            ) : (
                                <><XCircle className="w-5 h-5" /> Quote declined</>
                            )}
                        </div>
                        {invoiceLink && (
                            <a href={invoiceLink} className="mt-4 inline-block text-teal-400 font-bold hover:underline">
                                View & pay your invoice →
                            </a>
                        )}
                    </div>
                ) : (
                    <div className="p-6 border-t border-slate-800 space-y-4 bg-slate-950/40">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Your name (required to accept)</label>
                            <input
                                type="text"
                                value={acceptedBy}
                                onChange={(e) => setAcceptedBy(e.target.value)}
                                placeholder="Full name"
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Signature (required to accept)</label>
                            <SignaturePad
                                onSave={(dataUrl) => setSignatureUrl(dataUrl)}
                                onClear={() => setSignatureUrl(null)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Note (optional)</label>
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Questions, requested changes, or reason for declining..."
                                className="w-full h-24 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white resize-none"
                            />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => {
                                    if (!signatureUrl) {
                                        toast.error('Please sign to accept the quote');
                                        return;
                                    }
                                    handleRespond('accept');
                                }}
                                disabled={responding}
                                className="flex-1 py-3 px-4 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-xl font-bold text-white flex items-center justify-center gap-2"
                            >
                                {responding ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                                Accept Quote
                            </button>
                            <button
                                onClick={() => handleRespond('reject')}
                                disabled={responding}
                                className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-xl font-bold text-slate-200 flex items-center justify-center gap-2"
                            >
                                <XCircle className="w-5 h-5" />
                                Decline
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
