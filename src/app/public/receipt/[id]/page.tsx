'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, Download, Receipt } from 'lucide-react';
import { Card, Button } from '@/components/ui/UIComponents';
import type { TenantBranding } from '@/lib/tenantBranding';

export default function PublicReceiptPage() {
  const params = useParams();
  const receiptId = params?.id as string;
  const [receipt, setReceipt] = useState<Record<string, unknown> | null>(null);
  const [branding, setBranding] = useState<TenantBranding>({ name: 'Your Business' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!receiptId) return;
    void fetch(`/api/accounting/receipts/${receiptId}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((payload) => {
        if (payload.receipt || payload.data) {
          setReceipt(payload.receipt || payload.data);
          setBranding(payload.branding || { name: 'Your Business' });
        } else {
          setError('Receipt not found');
        }
      })
      .catch(() => setError('Failed to load receipt'))
      .finally(() => setLoading(false));
  }, [receiptId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Loading receipt…</p>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <Card className="p-8 text-center max-w-md">
          <p className="text-slate-300">{error || 'Receipt not found'}</p>
        </Card>
      </div>
    );
  }

  const amount = Number(receipt.amount ?? receipt.total ?? 0);
  const receiptNumber = String(receipt.receipt_number ?? receipt.receiptNumber ?? receiptId.slice(0, 8));
  const clientName = String(receipt.client_name ?? receipt.clientName ?? 'Client');
  const paidAt = receipt.paid_at ?? receipt.paidAt ?? receipt.created_at;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <Card className="overflow-hidden border-teal-500/20">
          <div className="bg-teal-600 px-6 py-8 text-center text-white">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-90" aria-hidden="true" />
            <h1 className="text-2xl font-bold">Payment received</h1>
            <p className="text-teal-100 mt-1">{branding.name}</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Receipt</span>
              <span className="font-mono text-sm text-slate-300">#{receiptNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">From</span>
              <span className="text-white font-medium">{clientName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Date</span>
              <span className="text-white">
                {paidAt ? new Date(String(paidAt)).toLocaleDateString() : '—'}
              </span>
            </div>
            <div className="border-t border-white/10 pt-4 flex justify-between items-center">
              <span className="text-slate-400">Amount paid</span>
              <span className="text-3xl font-bold text-teal-400">${amount.toFixed(2)}</span>
            </div>
            <Button className="w-full mt-4 flex items-center justify-center gap-2">
              <Download className="w-4 h-4" aria-hidden="true" />
              Download PDF
            </Button>
          </div>
        </Card>
        <p className="text-center text-slate-500 text-xs mt-6 flex items-center justify-center gap-1">
          <Receipt className="w-3 h-3" aria-hidden="true" />
          Secure receipt from {branding.name}
        </p>
      </div>
    </div>
  );
}
