'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { FileText, DollarSign, ExternalLink, Loader2, Receipt } from 'lucide-react';
import type { ClientFinancePortalData } from '@/services/finance/clientFinancePortalService';

export default function ClientFinancePortalPage() {
  const params = useParams();
  const token = params?.token as string;
  const [portal, setPortal] = useState<ClientFinancePortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'finance' | 'documents' | 'projects'>('finance');

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/client-finance/portal?token=${encodeURIComponent(token)}`, {
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok || !data.portal) {
          throw new Error(data.error || 'Portal not found');
        }
        setPortal(data.portal);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load portal');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500 mr-3" />
        Loading your finance portal...
      </div>
    );
  }

  if (error || !portal) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <h1 className="text-xl font-bold text-red-400 mb-2">Portal unavailable</h1>
          <p className="text-slate-400 text-sm">{error || 'This link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  const { branding, client, invoices, quotes, summary } = portal;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex flex-wrap items-center gap-4">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="" className="h-14 w-auto rounded-xl" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-teal-500/20 flex items-center justify-center text-2xl font-black text-teal-400">
              {branding.name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">{branding.name}</h1>
            <p className="text-slate-500 text-sm">Client portal · {client.name}</p>
          </div>
        </header>

        <div className="flex gap-2 border-b border-white/10 pb-2">
          {(['finance', 'documents', 'projects'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                activeTab === tab ? 'bg-teal-500/20 text-teal-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'documents' ? (
          <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-8 text-center">
            <FileText className="w-10 h-10 text-teal-400 mx-auto mb-3" aria-hidden="true" />
            <p className="text-slate-300 font-medium">Documents & contracts</p>
            <p className="text-slate-500 text-sm mt-1">Shared files and agreements will appear here.</p>
          </section>
        ) : activeTab === 'projects' ? (
          <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-8 text-center">
            <p className="text-slate-300 font-medium">Project updates</p>
            <p className="text-slate-500 text-sm mt-1">Milestones and deliverables will appear here when a project is active.</p>
          </section>
        ) : (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
            <p className="text-xs uppercase text-slate-500 font-bold">Open invoices</p>
            <p className="text-2xl font-black text-teal-400 mt-1">{summary.openInvoices}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
            <p className="text-xs uppercase text-slate-500 font-bold">Balance due</p>
            <p className="text-2xl font-black text-white mt-1">${summary.openBalance.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
            <p className="text-xs uppercase text-slate-500 font-bold">Pending quotes</p>
            <p className="text-2xl font-black text-slate-300 mt-1">{summary.pendingQuotes}</p>
          </div>
        </div>

        <section>
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Invoices
          </h2>
          {invoices.length === 0 ? (
            <p className="text-slate-500 text-sm">No open invoices.</p>
          ) : (
            <div className="space-y-3">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4"
                >
                  <div>
                    <p className="font-bold">{inv.invoiceNumber}</p>
                    <p className="text-xs text-slate-500">
                      Due {new Date(inv.dueDate).toLocaleDateString()} · {inv.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-teal-400">${inv.total.toFixed(2)}</span>
                    {inv.status !== 'paid' && inv.payUrl && (
                      <a
                        href={inv.payUrl}
                        className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold uppercase"
                      >
                        Pay <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Quotes
          </h2>
          {quotes.length === 0 ? (
            <p className="text-slate-500 text-sm">No quotes on file.</p>
          ) : (
            <div className="space-y-3">
              {quotes.map((q) => (
                <div
                  key={q.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4"
                >
                  <div>
                    <p className="font-bold">{q.name || q.quoteNumber}</p>
                    <p className="text-xs text-slate-500">
                      {q.quoteNumber} · {q.status}
                      {q.validUntil && ` · Valid until ${new Date(q.validUntil).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold">${q.totalAmount.toFixed(2)}</span>
                    {q.viewUrl && ['sent', 'viewed', 'draft'].includes(q.status) && (
                      <a
                        href={q.viewUrl}
                        className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-white/20 text-white text-xs font-bold uppercase"
                      >
                        Review <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        </>
        )}

        <footer className="text-center text-xs text-slate-600 pt-8 flex items-center justify-center gap-1">
          <Receipt className="w-3 h-3" /> Powered by AlphaClone native billing
        </footer>
      </div>
    </div>
  );
}
