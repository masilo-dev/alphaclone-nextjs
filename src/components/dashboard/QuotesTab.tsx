'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Send, CheckCircle, Trash2, ArrowLeft, ArrowRight, X, Edit3, Plus, Minus, DollarSign, Trophy, Clock, FileText, Mail } from 'lucide-react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { ModuleStatCards, type ModuleStat } from './common/ModuleStatCards';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';
import { quoteService } from '../../services/quoteService';
import { User } from '../../types';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { showActionNextSteps } from '../common/showActionNextSteps';
import { OperationalWorkflowStrip } from './OperationalWorkflowStrip';
import { CommunicationModal } from './crm/CommunicationModal';
import { DetailDrawer } from '../ui/DetailDrawer';
import { QuoteVersionPanel } from '@/components/documents/QuoteVersionPanel';
import { ModulePageLayout } from '../ui/ModulePageLayout';
import { PageHeader } from '@/components/dashboard/responsive/PageHeader';
import { EmptyState, EmptyStateFromPreset } from '../ui/EmptyState';
import { Input } from '../ui/UIComponents';
import { StatusBadge, quoteStatusVariant } from '../ui/StatusBadge';
import { EnterpriseDataTable, type EnterpriseColumn } from '../ui/EnterpriseDataTable';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import type { EmailRecipient } from './crm/emailRecipient';
import { buildMailComposeUrl } from '@/lib/email/composeNavigation';
import { DocumentThemePicker } from '@/components/documents/DocumentThemePicker';
import { DocumentQualityPanel } from '@/components/documents/DocumentQualityPanel';
import { DocumentPreview } from '@/components/documents/DocumentPreview';
import {
  buildQuoteDocumentInput,
  resolveDocumentThemeId,
} from '@/lib/documents/documentBuilders';
import type { DocumentThemeId } from '@/lib/documents/renderDocument';
import { QuoteDocumentPreview } from '@/components/documents/QuoteDocumentPreview';

type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';

interface QuoteRow {
  id: string;
  number?: string;
  client_name: string;
  client_email?: string;
  amount: number;
  status: QuoteStatus;
  valid_until?: string;
  created_at: string;
  tenant_id: string;
}

function extractClientEmail(raw: Record<string, unknown>): string | undefined {
  if (raw.client_email) return String(raw.client_email);
  const meta = (raw.metadata || {}) as Record<string, unknown>;
  if (meta.client_email) return String(meta.client_email);
  const notes = String(raw.notes || '');
  const match = notes.match(/Recipient:\s*([^\s]+@[^\s]+)/i);
  return match?.[1];
}

function mapQuoteRow(raw: Record<string, unknown>): QuoteRow {
  const status = String(raw.status || 'draft') as QuoteStatus;
  return {
    id: String(raw.id),
    number: raw.quote_number ? String(raw.quote_number) : undefined,
    client_name: String(raw.name || raw.client_name || 'Unnamed Client'),
    client_email: extractClientEmail(raw),
    amount: Number(raw.total_amount ?? raw.amount ?? 0),
    status: ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'].includes(status) ? status : 'draft',
    valid_until: raw.valid_until ? String(raw.valid_until) : undefined,
    created_at: String(raw.created_at || new Date().toISOString()),
    tenant_id: String(raw.tenant_id),
  };
}

const STATUS_COLORS: Record<QuoteStatus, string> = {
  draft:    'bg-slate-500/15 text-slate-400 border-slate-500/20',
  sent:     'bg-blue-500/15 text-blue-400 border-blue-500/20',
  accepted: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/20',
  expired:  'bg-slate-500/15 text-slate-300 border-slate-500/20',
  converted: 'bg-teal-500/15 text-teal-300 border-teal-500/20',
};

const FILTERS: QuoteStatus[] = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'];

const QuoteListRow: React.FC<{ quote: QuoteRow; onDelete: (id: string) => void; onTap: (q: QuoteRow) => void }> = ({ quote, onDelete, onTap }) => {
  const x = useMotionValue(0);
  const rOp = useTransform(x, [-80, 0], [1, 0]);
  const handleDragEnd = (_: unknown, info: { offset: { x: number } }) => { if (info.offset.x < -80) onDelete(quote.id); x.set(0); };

  const clientName = quote.client_name?.trim() || 'Unnamed Client';
  const amountDisplay = quote.amount && quote.amount > 0 ? `$${quote.amount.toLocaleString()}` : '$0.00 (Draft)';

  return (
    <div className="relative overflow-hidden">
      <motion.div style={{ opacity: rOp }} className="absolute inset-y-0 right-0 w-20 bg-red-500 flex items-center justify-center z-0">
        <Trash2 className="w-5 h-5 text-white" />
      </motion.div>
      <motion.div drag="x" dragConstraints={{ left: -100, right: 0 }} dragElastic={0.1} onDragEnd={handleDragEnd} style={{ x }}
        onClick={() => onTap(quote)} className="relative z-10 bg-slate-950 flex items-center gap-3 px-4 py-3 cursor-pointer">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[13px] text-slate-500 opacity-55">#{quote.number || quote.id.slice(0,6)}</span>
            <span className="text-[15px] font-bold text-white truncate">{clientName}</span>
          </div>
          {quote.valid_until && <span className="text-[13px] text-slate-500 opacity-55">Valid until {new Date(quote.valid_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-[15px] font-bold text-white">{amountDisplay}</span>
          <StatusBadge variant={quoteStatusVariant(quote.status)}>{quote.status}</StatusBadge>
        </div>
      </motion.div>
    </div>
  );
};

const QuoteDetail: React.FC<{
  quote: QuoteRow;
  onBack: () => void;
  onSend: (q: QuoteRow) => void;
  onConvert: (quote: QuoteRow) => void;
  onEdit: (quote: QuoteRow) => void;
  onDelete: (id: string) => void;
  onComposeEmail?: (recipient: EmailRecipient, subject: string) => void;
  inDrawer?: boolean;
}> = ({ quote, onBack, onSend, onConvert, onEdit, onDelete, onComposeEmail, inDrawer }) => {
  const clientName = quote.client_name?.trim() || 'Unnamed Client';
  const amountDisplay = quote.amount && quote.amount > 0 ? `$${quote.amount.toLocaleString()}` : '$0.00 (Draft)';

  const actions = (
    <div className={`grid grid-cols-2 gap-2 ${inDrawer ? 'pt-2 border-t border-white/5' : 'absolute bottom-0 left-0 right-0 bg-slate-950/95 border-t border-white/5 native-bottom-bar pb-safe grid-cols-4 divide-x divide-white/5'}`}>
      <button onClick={() => onEdit(quote)} className="min-h-11 flex flex-col items-center justify-center gap-1 rounded-xl border border-white/5 hover:bg-white/5 text-slate-400">
        <Edit3 className="w-4 h-4 text-violet-400" />
        <span className="text-[11px] font-bold">Edit</span>
      </button>
      <button onClick={() => onSend(quote)} className="min-h-11 flex flex-col items-center justify-center gap-1 rounded-xl border border-white/5 hover:bg-white/5 text-slate-400">
        <Send className="w-4 h-4 text-sky-400" />
        <span className="text-[11px] font-bold">Send</span>
      </button>
      <button onClick={() => onConvert(quote)} className="min-h-11 flex flex-col items-center justify-center gap-1 rounded-xl border border-white/5 hover:bg-white/5 text-slate-400">
        <CheckCircle className="w-4 h-4 text-teal-400" />
        <span className="text-[11px] font-bold">Convert</span>
      </button>
      <button onClick={() => onDelete(quote.id)} className="min-h-11 flex flex-col items-center justify-center gap-1 rounded-xl border border-red-500/20 hover:bg-red-500/10 text-red-400">
        <Trash2 className="w-4 h-4 text-red-400" />
        <span className="text-[11px] font-bold">Delete</span>
      </button>
    </div>
  );

  return (
    <div className={inDrawer ? 'space-y-4 pb-2' : 'relative flex flex-col min-h-0 ac-scroll-full overflow-hidden'}>
      {!inDrawer && (
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center"><ArrowLeft className="w-4 h-4 text-slate-300" /></button>
        <span className="text-[15px] font-bold text-white">Quote Detail</span>
      </div>
      )}
      <div className={inDrawer ? 'space-y-4' : 'flex-1 overflow-y-auto p-4 pb-28 space-y-4'}>
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 text-center space-y-2">
          <div className="text-[13px] text-slate-500">Quote #{quote.number || quote.id.slice(0,8)}</div>
          <div className="text-[32px] font-bold text-teal-400">{amountDisplay}</div>
          <StatusBadge variant={quoteStatusVariant(quote.status)}>{quote.status}</StatusBadge>
        </div>
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-4">
          <div className="text-[15px] font-bold text-white">{clientName}</div>
          {quote.client_email && (
            <div className="flex items-center justify-between gap-2 mt-1">
              <div className="text-[13px] text-slate-400">{quote.client_email}</div>
              {onComposeEmail && (
                <button
                  type="button"
                  onClick={() => onComposeEmail(
                    { name: clientName, email: quote.client_email! },
                    `Quote ${quote.number || quote.id.slice(0, 8)} — ${clientName}`
                  )}
                  className="text-xs font-bold text-teal-400 hover:text-teal-300 flex items-center gap-1"
                >
                  <Mail className="w-3.5 h-3.5" /> Compose
                </button>
              )}
            </div>
          )}
          {quote.valid_until && <div className="text-[13px] text-slate-400 opacity-55 mt-0.5">Valid until {new Date(quote.valid_until).toLocaleDateString()}</div>}
        </div>
        <QuoteDocumentPreview quoteId={quote.id} />
        {quote.status === 'accepted' && (
          <button onClick={() => onConvert(quote)} className="w-full h-[52px] bg-teal-600 hover:bg-teal-500 text-white font-black uppercase tracking-wider rounded-2xl text-[13px] transition-colors flex items-center justify-center gap-2">
            <ArrowRight className="w-5 h-5" /> Convert to Invoice
          </button>
        )}
      </div>
      {actions}
    </div>
  );
};

const CreateQuoteModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  tenantId: string;
}> = ({ open, onClose, onCreated, tenantId }) => {
  const { currentTenant } = useTenant();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [documentTheme, setDocumentTheme] = useState<DocumentThemeId>('executive');
  const [saving, setSaving] = useState(false);

  const previewInput = useMemo(() => {
    if (!currentTenant || !name.trim()) return null;
    return buildQuoteDocumentInput(
      {
        quote_number: 'DRAFT',
        name: name.trim(),
        created_at: new Date().toISOString(),
        total_amount: parseFloat(amount) || 0,
        status: 'draft',
        metadata: { document_theme: documentTheme, client_email: email || undefined },
      },
      amount
        ? [{
            product_name: name.trim(),
            description: 'Professional services',
            quantity: 1,
            unit_price: parseFloat(amount) || 0,
            line_total: parseFloat(amount) || 0,
          }]
        : [],
      currentTenant
    );
  }, [amount, currentTenant, documentTheme, email, name]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Client or quote name is required');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/tenant/${encodeURIComponent(tenantId)}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          amount: parseFloat(amount) || 0,
          documentTheme,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Failed to create quote');

      toast.success('Quote created');
      setName('');
      setEmail('');
      setAmount('');
      setDocumentTheme('executive');
      onCreated();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create quote';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <DetailDrawer open={open} onOpenChange={(o) => !o && onClose()} title="New Quote">
      <form onSubmit={handleSubmit} className="space-y-3 pb-6">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Client or project name"
          validate={(v) => !v.trim() ? 'Client or quote name is required' : undefined}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Recipient email (for sending)"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (USD)"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm"
        />
        <DocumentThemePicker value={documentTheme} onChange={setDocumentTheme} />
        <DocumentQualityPanel
          input={{
            type: 'quote',
            hasClientName: Boolean(name.trim()),
            hasPricing: Number(amount) > 0,
            hasTerms: true,
            clientEmail: email,
            hasLogo: Boolean(currentTenant && ((currentTenant as { logo_url?: string }).logo_url)),
          }}
        />
        {previewInput ? <DocumentPreview input={previewInput} /> : null}
        <button
          type="submit"
          disabled={saving}
          className="w-full min-h-11 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold disabled:opacity-50"
        >
          {saving ? 'Creating...' : 'Create Quote'}
        </button>
      </form>
    </DetailDrawer>
  );
};

type EditableQuoteItem = {
  id?: string;
  productName: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  taxPercent: string;
};

const QuoteEditModal: React.FC<{
  open: boolean;
  quote: QuoteRow | null;
  onClose: () => void;
  onSaved: () => void;
  tenantId: string;
  userId: string;
}> = ({ open, quote, onClose, onSaved, tenantId, userId }) => {
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<QuoteStatus>('draft');
  const [name, setName] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [documentTheme, setDocumentTheme] = useState<DocumentThemeId>('executive');
  const [items, setItems] = useState<EditableQuoteItem[]>([]);
  const [quoteNumber, setQuoteNumber] = useState('');
  const [createdAt, setCreatedAt] = useState('');

  useEffect(() => {
    if (!open || !quote) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      const [quoteResult, quoteItemsResult] = await Promise.all([
        quoteService.getQuoteById(quote.id),
        quoteService.getQuoteItems(quote.id),
      ]);

      if (cancelled) return;

      if (quoteResult.error || !quoteResult.quote) {
        toast.error(quoteResult.error || 'Failed to load quote');
        setLoading(false);
        return;
      }

      const fullQuote = quoteResult.quote;
      setStatus((fullQuote.status as QuoteStatus) || 'draft');
      setName(fullQuote.name || '');
      setValidUntil(fullQuote.validUntil ? String(fullQuote.validUntil).slice(0, 10) : '');
      setNotes(fullQuote.notes || '');
      setTerms(fullQuote.termsAndConditions || '');
      setCurrency(fullQuote.currency || 'USD');
      setDocumentTheme(resolveDocumentThemeId(fullQuote.metadata));
      setQuoteNumber(fullQuote.quoteNumber || quote.number || '');
      setCreatedAt(fullQuote.createdAt || quote.created_at);

      const loadedItems = (quoteItemsResult.items || []).map((item) => ({
        id: item.id,
        productName: item.productName || '',
        description: item.description || '',
        quantity: String(item.quantity ?? 1),
        unitPrice: String(item.unitPrice ?? 0),
        discountPercent: String(item.discountPercent ?? 0),
        taxPercent: String(item.taxPercent ?? 0),
      }));
      setItems(loadedItems.length > 0 ? loadedItems : [{
        productName: fullQuote.name || 'Service',
        description: '',
        quantity: '1',
        unitPrice: String(fullQuote.totalAmount || 0),
        discountPercent: '0',
        taxPercent: '0',
      }]);
      setLoading(false);
    })().catch((err) => {
      if (!cancelled) {
        toast.error(err instanceof Error ? err.message : 'Failed to load quote');
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, quote?.id]);

  const total = items.reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const discountPercent = Number(item.discountPercent || 0);
    const taxPercent = Number(item.taxPercent || 0);
    const lineBase = quantity * unitPrice;
    const lineNet = lineBase * (1 - discountPercent / 100);
    return sum + (lineNet * (1 + taxPercent / 100));
  }, 0);

  const previewInput = useMemo(() => {
    if (!currentTenant || !quote) return null;
    return buildQuoteDocumentInput(
      {
        quote_number: quoteNumber || quote.number,
        name,
        created_at: createdAt || quote.created_at,
        valid_until: validUntil || undefined,
        notes,
        status,
        total_amount: total,
        metadata: { document_theme: documentTheme },
      },
      items.map((item) => {
        const quantity = Number(item.quantity || 0);
        const unitPrice = Number(item.unitPrice || 0);
        const discountPercent = Number(item.discountPercent || 0);
        const taxPercent = Number(item.taxPercent || 0);
        const lineBase = quantity * unitPrice;
        const lineNet = lineBase * (1 - discountPercent / 100);
        const lineTotal = lineNet * (1 + taxPercent / 100);
        return {
          product_name: item.productName,
          description: item.description,
          quantity,
          unit_price: unitPrice,
          line_total: lineTotal,
        };
      }),
      currentTenant
    );
  }, [createdAt, currentTenant, documentTheme, items, name, notes, quote, quoteNumber, status, total, validUntil]);

  if (!open || !quote) return null;

  const updateItem = (index: number, patch: Partial<EditableQuoteItem>) => {
    setItems((prev) => prev.map((item, idx) => idx === index ? { ...item, ...patch } : item));
  };

  const addItem = () => {
    setItems((prev) => [...prev, {
      productName: '',
      description: '',
      quantity: '1',
      unitPrice: '0',
      discountPercent: '0',
      taxPercent: '0',
    }]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Quote name is required');
      return;
    }
    setSaving(true);
    try {
      const normalizedItems = items.filter((item) => item.productName.trim()).map((item, index) => ({
        productName: item.productName.trim(),
        description: item.description.trim() || undefined,
        quantity: Number(item.quantity || 0) || 1,
        unitPrice: Number(item.unitPrice || 0) || 0,
        discountPercent: Number(item.discountPercent || 0) || 0,
        taxPercent: Number(item.taxPercent || 0) || 0,
        itemOrder: index + 1,
      }));
      const response = await fetch(`/api/tenant/${encodeURIComponent(tenantId)}/quotes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        quoteId: quote.id,
        name: name.trim(),
        status,
        validUntil: validUntil || null,
        notes,
        termsAndConditions: terms,
        currency,
        items: normalizedItems,
        documentTheme,
      }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Failed to update quote');
      toast.success('Quote updated');
      onSaved();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update quote';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!open || !quote) return null;

  return (
    <DetailDrawer
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Edit Quote"
      description={quote.number || quote.id.slice(0, 8)}
      size="wide"
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] pb-6">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input
                  label="Quote name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  validate={(v) => !v.trim() ? 'Quote name is required' : undefined}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as QuoteStatus)} className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white">
                  {(['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'] as QuoteStatus[]).map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Currency</label>
                <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Valid until</label>
                <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Line items</h3>
                <button type="button" onClick={addItem} className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-white">
                  <Plus className="h-4 w-4" /> Add item
                </button>
              </div>
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={item.id || index} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Item {index + 1}</div>
                      <button type="button" onClick={() => removeItem(index)} className="inline-flex items-center gap-1 rounded-lg border border-slate-800 px-2 py-1 text-xs font-bold text-slate-400 hover:text-red-400">
                        <Minus className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>
                    <input value={item.productName} onChange={(e) => updateItem(index, { productName: e.target.value })} placeholder="Product or service" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white" />
                    <textarea value={item.description} onChange={(e) => updateItem(index, { description: e.target.value })} placeholder="Description" rows={2} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white resize-none" />
                    <div className="grid gap-3 sm:grid-cols-4">
                      <input type="number" min="0" step="1" value={item.quantity} onChange={(e) => updateItem(index, { quantity: e.target.value })} placeholder="Qty" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white" />
                      <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(index, { unitPrice: e.target.value })} placeholder="Unit price" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white" />
                      <input type="number" min="0" step="0.01" value={item.discountPercent} onChange={(e) => updateItem(index, { discountPercent: e.target.value })} placeholder="Discount %" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white" />
                      <input type="number" min="0" step="0.01" value={item.taxPercent} onChange={(e) => updateItem(index, { taxPercent: e.target.value })} placeholder="Tax %" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <DocumentThemePicker value={documentTheme} onChange={setDocumentTheme} />
            {previewInput ? <DocumentPreview input={previewInput} /> : null}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={6} className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white resize-none" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Terms & conditions</label>
              <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={8} className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white resize-none" />
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-400">
                <span>Estimated total</span>
                <span className="font-mono text-white">{Number(total).toFixed(2)} {currency || 'USD'}</span>
              </div>
              <p className="text-xs text-slate-500">Totals are recalculated from the current line items when you save.</p>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="w-full min-h-11 rounded-2xl bg-teal-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Quote'}
            </button>
            <QuoteVersionPanel quoteId={quote.id} userId={userId} />
          </div>
      </div>
    </DetailDrawer>
  );
};

interface QuotesTabProps { user: User; }

const QuotesTab: React.FC<QuotesTabProps> = ({ user }) => {
  const router = useRouter();
  const { currentTenant } = useTenant();
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<QuoteStatus | 'all'>('all');
  const [selected, setSelected] = useState<QuoteRow | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<QuoteRow | null>(null);
  const [emailCompose, setEmailCompose] = useState<{ recipient: EmailRecipient; subject: string } | null>(null);
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(40);
  const loadMoreQuotes = useCallback(() => setVisibleCount((c) => c + 30), []);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const { data } = await supabase.from('quotes').select('*').eq('tenant_id', currentTenant.id).order('created_at', { ascending: false });
    setQuotes((data || []).map((row: Record<string, unknown>) => mapQuoteRow(row)));
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => { load(); }, [load]);

  const deleteQuote = async (id: string) => {
    if (!currentTenant?.id) return;
    const response = await fetch(`/api/tenant/${encodeURIComponent(currentTenant.id)}/quotes?quoteId=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { toast.error(result.error || 'Quote could not be deleted'); return; }
    setQuotes(p => p.filter(q => q.id !== id));
    setSelected(null);
    toast.success('Quote deleted');
  };

  const sendQuote = async (quote: QuoteRow) => {
    if (!currentTenant?.id) return;
    const email = quote.client_email || window.prompt('Recipient email address');
    if (!email?.trim()) {
      toast.error('Email is required to send quote');
      return;
    }
    try {
      toast.loading('Sending quote...', { id: 'send-quote' });
      const res = await fetch('/api/quotes/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          quoteId: quote.id,
          recipients: [email.trim()],
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || 'Send failed');
      }
      setQuotes(p => p.map(q => q.id === quote.id ? { ...q, status: 'sent' as QuoteStatus } : q));
      if (selected?.id === quote.id) {
        setSelected(prev => prev ? { ...prev, status: 'sent' } : null);
      }
      toast.success('Quote sent by email', { id: 'send-quote' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send quote';
      toast.error(message, { id: 'send-quote' });
    }
  };

  const convertToInvoice = async (quote: QuoteRow) => {
    if (!currentTenant?.id) return;
    try {
      toast.loading('Converting to invoice...', { id: 'conv' });
      const response = await fetch('/api/quotes/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: quote.id, tenantId: currentTenant.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Conversion failed');
      }

      setQuotes(p => p.map(q => q.id === quote.id ? { ...q, status: 'accepted' } : q));
      setSelected(null);
      toast.success('Quote converted to invoice', { id: 'conv' });
      showActionNextSteps('quote_to_invoice', (path) => router.push(path));
      if (payload.invoiceId) {
        router.push(`/dashboard/business/billing/manage?invoiceId=${encodeURIComponent(payload.invoiceId)}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to convert quote';
      toast.error(message, { id: 'conv' });
    }
  };

  const quoteStats = useMemo<ModuleStat[]>(() => {
    const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`;
    const pipeline = quotes.reduce((s, q) => s + (q.amount || 0), 0);
    const wonQuotes = quotes.filter(q => q.status === 'accepted' || q.status === 'converted');
    const wonValue = wonQuotes.reduce((s, q) => s + (q.amount || 0), 0);
    const outstanding = quotes.filter(q => q.status === 'sent').reduce((s, q) => s + (q.amount || 0), 0);
    const decided = quotes.filter(q => ['accepted', 'converted', 'rejected'].includes(q.status)).length;
    const winRate = decided > 0 ? Math.round((wonQuotes.length / decided) * 100) : 0;
    return [
      { label: 'Pipeline Value', value: fmt(pipeline), sub: `${quotes.length} quotes`, Icon: DollarSign, accent: 'teal' },
      { label: 'Won', value: fmt(wonValue), sub: `${wonQuotes.length} accepted`, Icon: Trophy, accent: 'emerald' },
      { label: 'Outstanding', value: fmt(outstanding), sub: 'Sent, awaiting reply', Icon: Clock, accent: 'amber' },
      { label: 'Win Rate', value: `${winRate}%`, sub: `${decided} decided`, Icon: FileText, accent: 'purple' },
    ];
  }, [quotes]);

  const filtered = quotes.filter(q => filter === 'all' || q.status === filter);
  useInfiniteScroll(listRef, loadMoreQuotes, { enabled: filtered.length > visibleCount });
  const visibleQuotes = filtered.slice(0, visibleCount);
  const allVisibleSelected = visibleQuotes.length > 0 && visibleQuotes.every((quote) => selectedQuoteIds.has(quote.id));

  const toggleQuoteSelection = useCallback((quoteId: string) => {
    setSelectedQuoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(quoteId)) next.delete(quoteId);
      else next.add(quoteId);
      return next;
    });
  }, []);

  const handleBulkEmailQuotes = useCallback(() => {
    if (selectedQuoteIds.size === 0) return;
    const recipients = quotes
      .filter((quote) => selectedQuoteIds.has(quote.id))
      .map((quote) => quote.client_email?.trim() || '')
      .filter((email, index, arr) => email.length > 0 && arr.indexOf(email) === index);

    if (recipients.length === 0) {
      toast.error('Selected quotes do not have recipient email addresses.');
      return;
    }

    const subject = recipients.length === 1 ? 'Quote follow-up' : 'Quotes follow-up';
    router.push(buildMailComposeUrl(recipients, subject));
  }, [quotes, router, selectedQuoteIds]);

  const quoteColumns = useMemo<EnterpriseColumn<QuoteRow>[]>(() => [
    {
      id: 'select',
      header: (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (allVisibleSelected) {
              setSelectedQuoteIds(new Set());
            } else {
              setSelectedQuoteIds(new Set(visibleQuotes.map((quote) => quote.id)));
            }
          }}
          className="inline-flex items-center text-slate-400 hover:text-white"
          aria-label={allVisibleSelected ? 'Deselect all visible quotes' : 'Select all visible quotes'}
        >
          {allVisibleSelected ? (
            <CheckCircle className="w-4 h-4 text-teal-400" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </button>
      ),
      accessor: (q) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            toggleQuoteSelection(q.id);
          }}
          className="inline-flex items-center text-slate-400 hover:text-white"
          aria-label={selectedQuoteIds.has(q.id) ? 'Deselect quote' : 'Select quote'}
        >
          {selectedQuoteIds.has(q.id) ? (
            <CheckCircle className="w-4 h-4 text-teal-400" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </button>
      ),
    },
    {
      id: 'client',
      header: 'Quote',
      mobilePrimary: true,
      sortable: true,
      sortValue: (q) => q.client_name,
      accessor: (q) => (
        <div>
          <span className="text-[13px] font-bold text-white block">{q.client_name?.trim() || 'Unnamed Client'}</span>
          <span className="text-[11px] text-slate-500">#{q.number || q.id.slice(0, 6)}</span>
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      sortable: true,
      sortValue: (q) => q.amount,
      accessor: (q) => `$${q.amount.toLocaleString()}`,
    },
    {
      id: 'status',
      header: 'Status',
      accessor: (q) => <StatusBadge variant={quoteStatusVariant(q.status)}>{q.status}</StatusBadge>,
    },
    {
      id: 'valid',
      header: 'Valid until',
      sortable: true,
      sortValue: (q) => q.valid_until || '',
      accessor: (q) => q.valid_until ? new Date(q.valid_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
    },
  ], [allVisibleSelected, selectedQuoteIds, toggleQuoteSelection, visibleQuotes]);

  return (
    <div className="relative flex flex-col min-h-0 ac-scroll-full ac-enterprise-module">
      <ModulePageLayout
        header={(
          <>
            <div className="px-4 pt-3">
              <OperationalWorkflowStrip moduleId="invoicing" userRole={user.role} />
            </div>
            <PageHeader
              moduleLabel="Money"
              title="Quotes"
              description="Create proposals and convert accepted quotes to invoices"
              primaryAction={{ label: 'New Quote', onClick: () => setShowCreate(true), variant: 'primary' }}
            />
          </>
        )}
        toolbar={(
          <div className="flex flex-wrap gap-2 px-4 py-3 overflow-x-auto scrollbar-hide border-b border-white/5 items-center">
        {selectedQuoteIds.size > 0 && (
          <div className="flex items-center gap-1.5 mr-1 rounded-lg border border-white/5 bg-slate-900/60 p-1">
            <button
              type="button"
              onClick={() => setSelectedQuoteIds(new Set())}
              className="min-h-11 px-3 rounded-md text-xs font-semibold text-slate-500 border border-white/10 transition-colors hover:text-slate-300"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleBulkEmailQuotes}
              className="min-h-11 px-3 rounded-md text-xs font-semibold text-indigo-300 border border-indigo-500/30 transition-colors hover:text-indigo-200"
            >
              Follow-up ({selectedQuoteIds.size})
            </button>
          </div>
        )}
        {(['all', ...FILTERS] as (QuoteStatus | 'all')[]).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`flex-shrink-0 min-h-11 px-3.5 rounded-md text-xs font-semibold capitalize transition-all ${filter === f ? 'bg-teal-500 text-white' : 'bg-slate-900 text-slate-400 border border-white/5'}`}>{f}</button>
        ))}
          </div>
        )}
        stats={!loading && quotes.length > 0 ? (
          <div className="p-4 border-b border-white/5 bg-slate-900/20">
            <ModuleStatCards stats={quoteStats} />
          </div>
        ) : null}
      >
      <div ref={listRef} className="flex-1 ac-scroll-full pb-20 bg-slate-950 px-2">
        {loading ? (
          <div className="divide-y divide-white/5">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-900/40 animate-pulse" />)}</div>
        ) : quotes.length === 0 ? (
          <EmptyStateFromPreset
            moduleId="quotes"
            onAction={() => setShowCreate(true)}
          />
        ) : visibleQuotes.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No quotes match this filter"
            description="Try another status, or create a new quote."
            actionLabel="New Quote"
            onAction={() => setShowCreate(true)}
          />
        ) : (
          <EnterpriseDataTable
            columns={quoteColumns}
            data={visibleQuotes}
            getRowId={(q) => q.id}
            onRowClick={setSelected}
            emptyMessage="No quotes in this workspace yet."
          />
        )}
      </div>
      </ModulePageLayout>
      {currentTenant?.id && <CreateQuoteModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={load} tenantId={currentTenant.id} />}
      {currentTenant?.id && <QuoteEditModal open={Boolean(editing)} quote={editing} onClose={() => setEditing(null)} onSaved={load} tenantId={currentTenant.id} userId={user.id} />}

      <DetailDrawer
        open={Boolean(selected)}
        onOpenChange={(open) => { if (!open) setSelected(null); }}
        title={selected ? `Quote #${selected.number || selected.id.slice(0, 8)}` : 'Quote'}
        size="wide"
      >
        {selected && (
          <QuoteDetail
            quote={selected}
            onBack={() => setSelected(null)}
            onSend={sendQuote}
            onConvert={convertToInvoice}
            onEdit={(q) => setEditing(q)}
            onDelete={deleteQuote}
            onComposeEmail={(recipient, subject) => setEmailCompose({ recipient, subject })}
            inDrawer
          />
        )}
      </DetailDrawer>

      {emailCompose && (
        <CommunicationModal
          user={user}
          recipient={emailCompose.recipient}
          prefilledSubject={emailCompose.subject}
          onClose={() => setEmailCompose(null)}
          onSent={() => setEmailCompose(null)}
        />
      )}
    </div>
  );
};

export default QuotesTab;
