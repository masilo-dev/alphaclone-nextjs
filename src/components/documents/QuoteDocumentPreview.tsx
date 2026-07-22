'use client';

import React, { useEffect, useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { quoteService } from '@/services/quoteService';
import { DocumentPreview } from '@/components/documents/DocumentPreview';
import { buildQuoteDocumentInput } from '@/lib/documents/documentBuilders';

type QuoteDocumentPreviewProps = {
  quoteId: string;
  className?: string;
};

/** Loads quote line items and renders a themed live preview. */
export function QuoteDocumentPreview({ quoteId, className }: QuoteDocumentPreviewProps) {
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewInput, setPreviewInput] = useState<ReturnType<typeof buildQuoteDocumentInput> | null>(null);

  useEffect(() => {
    if (!quoteId || !currentTenant) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const [quoteResult, itemsResult] = await Promise.all([
        quoteService.getQuoteById(quoteId),
        quoteService.getQuoteItems(quoteId),
      ]);

      if (cancelled) return;

      if (quoteResult.error || !quoteResult.quote) {
        setError(quoteResult.error || 'Could not load quote preview');
        setLoading(false);
        return;
      }

      const quote = quoteResult.quote;
      setPreviewInput(
        buildQuoteDocumentInput(
          {
            quote_number: quote.quoteNumber,
            name: quote.name,
            created_at: quote.createdAt,
            valid_until: quote.validUntil,
            notes: quote.notes,
            status: quote.status,
            total_amount: quote.totalAmount,
            metadata: quote.metadata,
          },
          (itemsResult.items || []).map((item) => ({
            product_name: item.productName,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            line_total: item.lineTotal,
          })),
          currentTenant
        )
      );
      setLoading(false);
    })().catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Preview failed');
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [quoteId, currentTenant]);

  if (loading) {
    return <p className="text-xs text-slate-500">Loading document preview…</p>;
  }
  if (error || !previewInput) {
    return <p className="text-xs text-slate-500">{error || 'Preview unavailable'}</p>;
  }

  return <DocumentPreview input={previewInput} className={className} />;
}
