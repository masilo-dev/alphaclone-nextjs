'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FilePlus, Send, CheckCircle, Trash2, ArrowLeft, ArrowRight, X, Edit3, Plus, Minus, DollarSign, Trophy, Clock, FileText } from 'lucide-react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { ModuleStatCards, type ModuleStat } from './common/ModuleStatCards';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';
import { quoteService } from '../../services/quoteService';
import { User } from '../../types';
import toast from 'react-hot-toast';

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
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border capitalize ${STATUS_COLORS[quote.status]}`}>{quote.status}</span>
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
}> = ({ quote, onBack, onSend, onConvert, onEdit, onDelete }) => {
  const clientName = quote.client_name?.trim() || 'Unnamed Client';
  const amountDisplay = quote.amount && quote.amount > 0 ? `$${quote.amount.toLocaleString()}` : '$0.00 (Draft)';

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center"><ArrowLeft className="w-4 h-4 text-slate-300" /></button>
        <span className="text-[15px] font-bold text-white">Quote Detail</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 pb-28 space-y-4">
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 text-center space-y-2">
          <div className="text-[13px] text-slate-500">Quote #{quote.number || quote.id.slice(0,8)}</div>
          <div className="text-[32px] font-bold text-teal-400">{amountDisplay}</div>
          <span className={`inline-block text-[11px] font-bold px-3 py-1 rounded-full border capitalize ${STATUS_COLORS[quote.status]}`}>{quote.status}</span>
        </div>
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-4">
          <div className="text-[15px] font-bold text-white">{clientName}</div>
          {quote.client_email && <div className="text-[13px] text-slate-400 mt-0.5">{quote.client_email}</div>}
          {quote.valid_until && <div className="text-[13px] text-slate-400 opacity-55 mt-0.5">Valid until {new Date(quote.valid_until).toLocaleDateString()}</div>}
        </div>
        {quote.status === 'accepted' && (
          <button onClick={() => onConvert(quote)} className="w-full h-[52px] bg-teal-600 hover:bg-teal-500 text-white font-black uppercase tracking-wider rounded-2xl text-[13px] transition-colors flex items-center justify-center gap-2">
            <ArrowRight className="w-5 h-5" /> Convert to Invoice
          </button>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-slate-950/95 border-t border-white/5 flex divide-x divide-white/5 native-bottom-bar pb-safe">
        <button onClick={() => onEdit(quote)} className="flex-1 flex flex-col items-center justify-center h-[56px] gap-1 hover:bg-white/5 transition-colors text-slate-400">
          <Edit3 className="w-4 h-4 text-violet-400" />
          <span className="text-[11px] font-bold">Edit</span>
        </button>
        <button onClick={() => onSend(quote)} className="flex-1 flex flex-col items-center justify-center h-[56px] gap-1 hover:bg-white/5 transition-colors text-slate-400">
          <Send className="w-4 h-4 text-sky-400" />
          <span className="text-[11px] font-bold">Send Quote</span>
        </button>
        <button onClick={() => onConvert(quote)} className="flex-1 flex flex-col items-center justify-center h-[56px] gap-1 hover:bg-white/5 transition-colors text-slate-400">
          <CheckCircle className="w-4 h-4 text-teal-400" />
          <span className="text-[11px] font-bold">Convert</span>
        </button>
        <button onClick={() => onDelete(quote.id)} className="flex-1 flex flex-col items-center justify-center h-[56px] gap-1 hover:bg-white/5 transition-colors text-red-400">
          <Trash2 className="w-4 h-4 text-red-400" />
          <span className="text-[11px] font-bold">Delete</span>
        </button>
      </div>
    </div>
  );
};

const CreateQuoteModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  userId: string;
}> = ({ open, onClose, onCreated, userId }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Client or quote name is required');
      return;
    }
    setSaving(true);
    try {
      const { quote, error } = await quoteService.createQuote(userId, {
        name: name.trim(),
        notes: email.trim() ? `Recipient: ${email.trim()}` : undefined,
      });
      if (error || !quote) throw new Error(error || 'Failed to create quote');

      const amt = parseFloat(amount) || 0;
      const metaPatch: Record<string, unknown> = {
        ...(quote.metadata || {}),
        ...(email.trim() ? { client_email: email.trim() } : {}),
      };
      await supabase.from('quotes').update({
        ...(amt > 0 ? { total_amount: amt, subtotal: amt } : {}),
        metadata: metaPatch,
      }).eq('id', quote.id);

      if (amt > 0) {
        await quoteService.addQuoteItem(quote.id, {
          productName: name.trim(),
          description: 'Professional services',
          quantity: 1,
          unitPrice: amt,
        });
      }

      toast.success('Quote created');
      setName('');
      setEmail('');
      setAmount('');
      onCreated();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create quote';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">New Quote</h2>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Client or project name"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm"
            required
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
          <button
            type="submit"
            disabled={saving}
            className="w-full h-12 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Quote'}
          </button>
        </form>
      </div>
    </div>
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
}> = ({ open, quote, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<QuoteStatus>('draft');
  const [name, setName] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [items, setItems] = useState<EditableQuoteItem[]>([]);
  const [originalItemIds, setOriginalItemIds] = useState<string[]>([]);

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
      setOriginalItemIds((quoteItemsResult.items || []).map((item) => item.id));
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

  if (!open || !quote) return null;

  const total = items.reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const discountPercent = Number(item.discountPercent || 0);
    const taxPercent = Number(item.taxPercent || 0);
    const lineBase = quantity * unitPrice;
    const lineNet = lineBase * (1 - discountPercent / 100);
    return sum + (lineNet * (1 + taxPercent / 100));
  }, 0);

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
      const { error } = await quoteService.updateQuote(quote.id, {
        name: name.trim(),
        status,
        validUntil: validUntil || undefined,
        notes,
        termsAndConditions: terms,
        currency,
      });
      if (error) throw new Error(error);

      const seenIds = new Set<string>();
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (!item.productName.trim()) continue;
        const payload = {
          productName: item.productName.trim(),
          description: item.description.trim() || undefined,
          quantity: Number(item.quantity || 0) || 1,
          unitPrice: Number(item.unitPrice || 0) || 0,
          discountPercent: Number(item.discountPercent || 0) || 0,
          taxPercent: Number(item.taxPercent || 0) || 0,
          itemOrder: i + 1,
        };

        if (item.id) {
          seenIds.add(item.id);
          const { error: updateError } = await quoteService.updateQuoteItem(item.id, payload);
          if (updateError) throw new Error(updateError);
        } else {
          const { item: created, error: createError } = await quoteService.addQuoteItem(quote.id, payload);
          if (createError) throw new Error(createError);
          if (created?.id) seenIds.add(created.id);
        }
      }

      for (const itemId of originalItemIds) {
        if (!seenIds.has(itemId)) {
          const { error: deleteError } = await quoteService.deleteQuoteItem(itemId);
          if (deleteError) throw new Error(deleteError);
        }
      }

      await quoteService.recalculateQuoteTotals(quote.id);
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

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 p-4 overflow-y-auto">
      <div className="mx-auto my-4 max-w-5xl rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">Edit Quote</h2>
            <p className="text-xs text-slate-400">{quote.number || quote.id.slice(0, 8)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-800 p-2 text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Quote name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white" />
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
              className="w-full rounded-2xl bg-teal-500 px-4 py-3 text-sm font-black uppercase tracking-widest text-black disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Quote'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface QuotesTabProps { user: User; }

const QuotesTab: React.FC<QuotesTabProps> = ({ user }) => {
  const { currentTenant } = useTenant();
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<QuoteStatus | 'all'>('all');
  const [selected, setSelected] = useState<QuoteRow | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<QuoteRow | null>(null);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const { data } = await supabase.from('quotes').select('*').eq('tenant_id', currentTenant.id).order('created_at', { ascending: false });
    setQuotes((data || []).map((row: Record<string, unknown>) => mapQuoteRow(row)));
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => { load(); }, [load]);

  const deleteQuote = async (id: string) => {
    await supabase.from('quotes').delete().eq('id', id);
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
      const invoiceNum = `INV-${Date.now().toString(36).toUpperCase()}`;
      const amount = quote.amount || 0;
      const { data: inv, error } = await supabase.from('business_invoices').insert({
        tenant_id: currentTenant.id,
        invoice_number: invoiceNum,
        issue_date: new Date().toISOString(),
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'draft',
        subtotal: amount,
        tax_rate: 0,
        tax: 0,
        discount_amount: 0,
        total: amount,
        notes: `Converted from quote ${quote.number || quote.id}`,
        is_public: false,
      }).select('id').single();

      if (error) throw error;

      if (amount > 0 && inv?.id) {
        await supabase.from('invoice_line_items').insert({
          invoice_id: inv.id,
          tenant_id: currentTenant.id,
          description: quote.client_name || 'Services',
          quantity: 1,
          unit_price: amount,
          amount,
        });
      }

      await supabase.from('quotes').update({ status: 'accepted' }).eq('id', quote.id);
      setQuotes(p => p.map(q => q.id === quote.id ? { ...q, status: 'accepted' } : q));
      setSelected(null);
      toast.success('Converted to business invoice', { id: 'conv' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to convert';
      toast.error(message, { id: 'conv' });
    }
  };

  if (selected) {
    return (
      <>
        <QuoteDetail quote={selected} onBack={() => setSelected(null)} onSend={sendQuote} onConvert={convertToInvoice} onEdit={(q) => setEditing(q)} onDelete={deleteQuote} />
        <CreateQuoteModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={load} userId={user.id} />
        <QuoteEditModal open={Boolean(editing)} quote={editing} onClose={() => setEditing(null)} onSaved={load} />
      </>
    );
  }

  const filtered = quotes.filter(q => filter === 'all' || q.status === filter);

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

  return (
    <div className="relative flex flex-col h-full">
      {!loading && quotes.length > 0 && (
        <div className="p-4 border-b border-white/5 bg-slate-900/20">
          <ModuleStatCards stats={quoteStats} />
        </div>
      )}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide border-b border-white/5">
        {(['all', ...FILTERS] as (QuoteStatus | 'all')[]).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`flex-shrink-0 h-[34px] px-3.5 rounded-full text-[12px] font-bold capitalize transition-all ${filter === f ? 'bg-teal-500 text-white' : 'bg-slate-900 text-slate-400 border border-white/5'}`}>{f}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto pb-20 divide-y divide-white/5 bg-slate-950">
        {loading ? [...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-900/40 animate-pulse" />) :
          filtered.length === 0 ? <div className="py-12 text-center text-[13px] text-slate-500">No quotes found.</div> :
          filtered.map(q => <QuoteListRow key={q.id} quote={q} onDelete={deleteQuote} onTap={setSelected} />)
        }
      </div>
      <button
        type="button"
        onClick={() => setShowCreate(true)}
        className="fixed bottom-20 right-4 w-14 h-14 bg-teal-600 rounded-full flex items-center justify-center shadow-lg shadow-teal-600/30 z-30"
      >
        <FilePlus className="w-6 h-6 text-white" />
      </button>
      <CreateQuoteModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={load} userId={user.id} />
      <QuoteEditModal open={Boolean(editing)} quote={editing} onClose={() => setEditing(null)} onSaved={load} />
    </div>
  );
};

export default QuotesTab;
