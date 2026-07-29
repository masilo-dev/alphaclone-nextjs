'use client';

<<<<<<< HEAD
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  FilePlus, X, Send, Download, CheckCircle, Trash2,
  ArrowLeft, Search, ChevronRight, Receipt, Camera, Plus,
  TrendingDown, TrendingUp, Sparkles, Loader2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';
import { businessInvoiceService } from '../../services/businessInvoiceService';
import { User } from '../../types';
import toast from 'react-hot-toast';
import { DetailDrawer } from '../ui/DetailDrawer';
import { StatusBadge, invoiceStatusVariant, expenseStatusVariant } from '../ui/StatusBadge';
import { EnterpriseDataTable, type EnterpriseColumn } from '../ui/EnterpriseDataTable';
import { Input } from '../ui/UIComponents';
import EmptyState from '@/components/ui/EmptyState';
import { WORKSPACE } from '@/constants/design';
import { RecordHeader, AskBonnieButton } from '@/components/ui/os';
=======
import React, { useState, useEffect, useCallback } from 'react';
import {
  FilePlus, X, Send, Download, CheckCircle, Trash2,
  ArrowLeft, Search, ChevronRight, Receipt, Camera, Plus,
  ShoppingBag, TrendingDown, TrendingUp
} from 'lucide-react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';
import { User } from '../../types';
import toast from 'react-hot-toast';
>>>>>>> origin/main

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';
type ExpenseStatus = 'pending' | 'approved' | 'rejected';

interface Invoice { id: string; number?: string; client_name: string; client_email?: string; amount: number; status: InvoiceStatus; due_date?: string; created_at: string; tenant_id: string; }
interface Expense { id: string; description: string; amount: number; category: string; vendor?: string; date?: string; status: ExpenseStatus; tenant_id: string; created_at: string; }

interface FinanceTabProps { user: User; }

<<<<<<< HEAD
const INV_FILTERS: InvoiceStatus[] = ['draft', 'sent', 'paid', 'overdue'];
const EXP_CATS = ['All', 'Travel', 'Software', 'Office', 'Food', 'Other'];

const InvoiceDetailContent: React.FC<{
  invoice: Invoice;
  onSend: (id: string) => void;
  onMarkPaid: (id: string) => void;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
}> = ({ invoice, onSend, onMarkPaid, onDownload, onDelete }) => {
  const clientName = invoice.client_name?.trim() || 'Unnamed Client';
  const amountDisplay = invoice.amount && invoice.amount > 0 ? `$${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00 (Draft)';

  return (
    <div className="space-y-4 pb-6">
      <RecordHeader
        moduleId="invoicing"
        title={`Invoice #${invoice.number || invoice.id.slice(0, 8)}`}
        subtitle={clientName}
        status={<StatusBadge variant={invoiceStatusVariant(invoice.status)}>{invoice.status}</StatusBadge>}
        meta={
          <>
            <span className="font-mono text-[var(--brand-blue-400)]">{amountDisplay}</span>
            {invoice.due_date ? <span>Due {new Date(invoice.due_date).toLocaleDateString()}</span> : null}
            {invoice.client_email ? <span>{invoice.client_email}</span> : null}
          </>
        }
        actions={
          <AskBonnieButton
            compact
            mode="summarise"
            contexts={[
              { type: 'Invoice', id: invoice.id, label: `Invoice #${invoice.number || invoice.id.slice(0, 8)}` },
              { type: 'Client', label: clientName },
            ]}
          />
        }
      />
      <div className={`space-y-2 p-5 text-center ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}>
        <div className="text-[13px] text-slate-500">Amount due</div>
        <div className="text-[32px] font-bold text-[var(--brand-blue-400)]">{amountDisplay}</div>
      </div>
      <div className={`p-4 ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}>
        <div className="flex justify-between py-1.5 border-b border-white/5">
          <span className="text-[15px] text-slate-400">Subtotal</span>
          <span className="text-[15px] text-white font-mono">{amountDisplay}</span>
        </div>
        <div className="flex justify-between pt-2">
          <span className="text-[17px] font-bold text-white">Total</span>
          <span className="text-[20px] font-bold text-[var(--brand-blue-400)] font-mono">{amountDisplay}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => onSend(invoice.id)} className="min-h-11 flex flex-col items-center justify-center gap-1 rounded-xl border border-white/5 hover:bg-white/5 transition-colors">
          <Send className="w-4 h-4 text-sky-400" />
          <span className="text-[11px] text-slate-400 font-bold">Send</span>
        </button>
        <button onClick={() => onMarkPaid(invoice.id)} className="min-h-11 flex flex-col items-center justify-center gap-1 rounded-xl border border-white/5 hover:bg-white/5 transition-colors">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span className="text-[11px] text-slate-400 font-bold">Mark Paid</span>
        </button>
        <button onClick={() => onDownload(invoice.id)} className="min-h-11 flex flex-col items-center justify-center gap-1 rounded-xl border border-white/5 hover:bg-white/5 transition-colors">
          <Download className="w-4 h-4 text-slate-400" />
          <span className="text-[11px] text-slate-400 font-bold">PDF</span>
        </button>
        <button onClick={() => onDelete(invoice.id)} className="min-h-11 flex flex-col items-center justify-center gap-1 rounded-xl border border-red-500/20 hover:bg-red-500/10 transition-colors">
          <Trash2 className="w-4 h-4 text-red-400" />
          <span className="text-[11px] text-red-400 font-bold">Delete</span>
        </button>
      </div>
    </div>
  );
};

// ── Main FinanceTab ────────────────────────────────────────────────────────────
type MainTab = 'invoices' | 'expenses';

const FinanceTab: React.FC<FinanceTabProps> = ({ user }) => {
  const router = useRouter();
  const { currentTenant } = useTenant();
  const [mainTab, setMainTab] = useState<MainTab>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [invFilter, setInvFilter] = useState<InvoiceStatus | 'all'>('all');
  const [expCat, setExpCat] = useState('All');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [aiExpenseInsight, setAiExpenseInsight] = useState<string | null>(null);
  const [aiExpenseLoading, setAiExpenseLoading] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newExpense, setNewExpense] = useState({ description: '', amount: '', category: 'other', vendor: '' });
  const [savingExpense, setSavingExpense] = useState(false);

  const billingManagePath =
    user.role === 'tenant_admin'
      ? '/dashboard/business/billing/manage?create=true'
      : '/dashboard/finance/manage?create=true';

  const handleFabClick = () => {
    if (mainTab === 'invoices') {
      router.push(billingManagePath);
      return;
    }
    setShowAddExpense(true);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant?.id || !newExpense.description.trim()) return;
    setSavingExpense(true);
    try {
      const response = await fetch('/api/finance/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        action: 'create',
        tenantId: currentTenant.id,
        description: newExpense.description.trim(),
        amount: Number(newExpense.amount) || 0,
        vendor_name: newExpense.vendor.trim() || undefined,
        date: new Date().toISOString().split('T')[0],
      }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Failed to add expense');
      toast.success('Expense added');
      setShowAddExpense(false);
      setNewExpense({ description: '', amount: '', category: 'other', vendor: '' });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add expense');
    } finally {
      setSavingExpense(false);
    }
  };

  const handleAiExpenseReview = async () => {
    if (!currentTenant?.id || expenses.length === 0) {
      toast.error('Add expenses first to get AI insights');
      return;
    }
    setAiExpenseLoading(true);
    setAiExpenseInsight(null);
    try {
      const summary = expenses.slice(0, 20).map((e) =>
        `${e.description} | $${e.amount} | ${e.category} | ${e.vendor || 'no vendor'}`
      ).join('\n');
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          prompt: `Analyze these business expenses and return 3 bullet points: top spend category, one cost-saving tip, and one anomaly to review.\n\n${summary}`,
          systemPrompt: 'You are a CFO assistant. Be concise and actionable.',
          maxTokens: 300,
          temperature: 0.4,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.text) throw new Error(data.error || 'AI request failed');
      setAiExpenseInsight(String(data.text).trim());
      toast.success('AI expense review ready');
    } catch (err: any) {
      toast.error(err.message || 'AI expense review failed');
    } finally {
      setAiExpenseLoading(false);
    }
  };
=======
const INV_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft:   'bg-slate-500/15 text-slate-400 border-slate-500/20',
  sent:    'bg-blue-500/15 text-blue-400 border-blue-500/20',
  paid:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  overdue: 'bg-red-500/15 text-red-400 border-red-500/20',
};

const EXP_STATUS_COLORS: Record<ExpenseStatus, string> = {
  pending:  'bg-yellow-500/15 text-yellow-400',
  approved: 'bg-emerald-500/15 text-emerald-400',
  rejected: 'bg-red-500/15 text-red-400',
};

const EXP_CAT_COLORS: Record<string, string> = {
  travel:   'text-blue-400',
  software: 'text-purple-400',
  office:   'text-teal-400',
  food:     'text-orange-400',
  other:    'text-slate-400',
};

const INV_FILTERS: InvoiceStatus[] = ['draft', 'sent', 'paid', 'overdue'];
const EXP_CATS = ['All', 'Travel', 'Software', 'Office', 'Food', 'Other'];

const InvoiceRow: React.FC<{ invoice: Invoice; onDelete: (id: string) => void; onMarkPaid: (id: string) => void; onTap: (inv: Invoice) => void }> = ({ invoice, onDelete, onMarkPaid, onTap }) => {
  const x = useMotionValue(0);
  const lOp = useTransform(x, [0, 80], [0, 1]);
  const rOp = useTransform(x, [-80, 0], [1, 0]);
  const overdue = invoice.status === 'overdue';

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 80 && invoice.status === 'sent') { onMarkPaid(invoice.id); }
    else if (info.offset.x < -80) { onDelete(invoice.id); }
    x.set(0);
  };

  const clientName = invoice.client_name?.trim() || 'Unnamed Client';
  const amountDisplay = invoice.amount && invoice.amount > 0 ? `$${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00 (Draft)';

  return (
    <div className={`relative overflow-hidden ${overdue ? 'bg-red-500/5' : ''}`}>
      <motion.div style={{ opacity: lOp }} className="absolute inset-y-0 left-0 w-20 bg-emerald-500 flex items-center justify-center z-0">
        <CheckCircle className="w-5 h-5 text-white" />
      </motion.div>
      <motion.div style={{ opacity: rOp }} className="absolute inset-y-0 right-0 w-20 bg-red-500 flex items-center justify-center z-0">
        <Trash2 className="w-5 h-5 text-white" />
      </motion.div>
      <motion.div
        drag="x" dragConstraints={{ left: -100, right: 100 }} dragElastic={0.1}
        onDragEnd={handleDragEnd} style={{ x }}
        onClick={() => onTap(invoice)}
        className="relative z-10 bg-transparent flex items-center gap-3 px-4 py-3 cursor-pointer"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[13px] text-slate-500 opacity-55">#{invoice.number || invoice.id.slice(0,6)}</span>
            <span className="text-[15px] font-bold text-white truncate">{clientName}</span>
          </div>
          {invoice.due_date && <span className="text-[13px] text-slate-500 opacity-55">Due {new Date(invoice.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-[15px] font-bold text-white">{amountDisplay}</span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border capitalize ${INV_STATUS_COLORS[invoice.status]}`}>{invoice.status}</span>
        </div>
      </motion.div>
    </div>
  );
};

const InvoiceDetail: React.FC<{
  invoice: Invoice;
  onBack: () => void;
  onSend: (id: string) => void;
  onMarkPaid: (id: string) => void;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
}> = ({ invoice, onBack, onSend, onMarkPaid, onDownload, onDelete }) => {
  const clientName = invoice.client_name?.trim() || 'Unnamed Client';
  const amountDisplay = invoice.amount && invoice.amount > 0 ? `$${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00 (Draft)';

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center"><ArrowLeft className="w-4 h-4 text-slate-300" /></button>
        <span className="text-[15px] font-bold text-white">Invoice Detail</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 pb-28 space-y-4">
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 text-center space-y-2">
          <div className="text-[13px] text-slate-500">Invoice #{invoice.number || invoice.id.slice(0,8)}</div>
          <div className="text-[32px] font-bold text-teal-400">{amountDisplay}</div>
          <span className={`inline-block text-[11px] font-bold px-3 py-1 rounded-full border capitalize ${INV_STATUS_COLORS[invoice.status]}`}>{invoice.status}</span>
        </div>
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 space-y-1">
          <div className="text-[15px] font-bold text-white">{clientName}</div>
          {invoice.client_email && <div className="text-[13px] text-slate-400 opacity-55">{invoice.client_email}</div>}
        </div>
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-4">
          <div className="flex justify-between py-1.5 border-b border-white/5">
            <span className="text-[15px] text-slate-400">Subtotal</span>
            <span className="text-[15px] text-white font-mono">{amountDisplay}</span>
          </div>
          <div className="flex justify-between pt-2">
            <span className="text-[17px] font-bold text-white">Total</span>
            <span className="text-[20px] font-bold text-teal-400 font-mono">{amountDisplay}</span>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-slate-950/95 border-t border-white/5 flex divide-x divide-white/5 native-bottom-bar pb-safe">
        <button onClick={() => onSend(invoice.id)} className="flex-1 flex flex-col items-center justify-center h-[56px] gap-1 hover:bg-white/5 transition-colors">
          <Send className="w-4 h-4 text-sky-400" />
          <span className="text-[11px] text-slate-400 font-bold">Send Invoice</span>
        </button>
        <button onClick={() => onMarkPaid(invoice.id)} className="flex-1 flex flex-col items-center justify-center h-[56px] gap-1 hover:bg-white/5 transition-colors">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span className="text-[11px] text-slate-400 font-bold">Mark Paid</span>
        </button>
        <button onClick={() => onDownload(invoice.id)} className="flex-1 flex flex-col items-center justify-center h-[56px] gap-1 hover:bg-white/5 transition-colors">
          <Download className="w-4 h-4 text-slate-400" />
          <span className="text-[11px] text-slate-400 font-bold">Download PDF</span>
        </button>
        <button onClick={() => onDelete(invoice.id)} className="flex-1 flex flex-col items-center justify-center h-[56px] gap-1 hover:bg-white/5 transition-colors">
          <Trash2 className="w-4 h-4 text-red-400" />
          <span className="text-[11px] text-red-400 font-bold">Delete</span>
        </button>
      </div>
    </div>
  );
};

// ── Expense Row ────────────────────────────────────────────────────────────────
const ExpenseRow: React.FC<{ expense: Expense; onDelete: (id: string) => void }> = ({ expense, onDelete }) => {
  const x = useMotionValue(0);
  const rOp = useTransform(x, [-80, 0], [1, 0]);
  const handleDragEnd = (_: any, info: any) => { if (info.offset.x < -80) onDelete(expense.id); x.set(0); };
  const catColor = EXP_CAT_COLORS[expense.category.toLowerCase()] || 'text-slate-400';

  return (
    <div className="relative overflow-hidden">
      <motion.div style={{ opacity: rOp }} className="absolute inset-y-0 right-0 w-20 bg-red-500 flex items-center justify-center z-0">
        <Trash2 className="w-5 h-5 text-white" />
      </motion.div>
      <motion.div drag="x" dragConstraints={{ left: -100, right: 0 }} dragElastic={0.1} onDragEnd={handleDragEnd} style={{ x }}
        className="relative z-10 bg-slate-950 flex items-center gap-3 px-4 py-3">
        <div className={`w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center ${catColor} flex-shrink-0`}>
          <ShoppingBag className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] text-white truncate">{expense.description}</div>
          <div className="flex items-center gap-2 text-[13px] text-slate-500 opacity-55">
            {expense.vendor && <span>{expense.vendor}</span>}
            {expense.date && <span>· {new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-[15px] font-bold text-white">${expense.amount.toLocaleString()}</span>
          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${EXP_STATUS_COLORS[expense.status]}`}>{expense.status}</span>
        </div>
      </motion.div>
    </div>
  );
};

// ── Main FinanceTab ────────────────────────────────────────────────────────────
type MainTab = 'invoices' | 'expenses';

const FinanceTab: React.FC<FinanceTabProps> = ({ user }) => {
  const { currentTenant } = useTenant();
  const [mainTab, setMainTab] = useState<MainTab>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [invFilter, setInvFilter] = useState<InvoiceStatus | 'all'>('all');
  const [expCat, setExpCat] = useState('All');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
>>>>>>> origin/main

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
<<<<<<< HEAD
    const [{ invoices: bizInvoices }, { data: expData }] = await Promise.all([
      businessInvoiceService.getInvoices(currentTenant.id),
      supabase.from('expenses').select('*').eq('tenant_id', currentTenant.id).order('created_at', { ascending: false }),
    ]);
    const mapped: Invoice[] = (bizInvoices || []).map((inv) => ({
      id: inv.id,
      number: inv.invoiceNumber,
      client_name: inv.senderName || 'Client',
      amount: inv.total,
      status: (['draft', 'sent', 'paid', 'overdue'].includes(inv.status) ? inv.status : 'draft') as InvoiceStatus,
      due_date: inv.dueDate,
      created_at: inv.createdAt,
      tenant_id: currentTenant.id,
    }));
    setInvoices(mapped);
=======
    const [{ data: invData }, { data: expData }] = await Promise.all([
      supabase.from('invoices').select('*').eq('tenant_id', currentTenant.id).order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').eq('tenant_id', currentTenant.id).order('created_at', { ascending: false }),
    ]);
    setInvoices((invData as Invoice[]) || []);
>>>>>>> origin/main
    setExpenses((expData as Expense[]) || []);
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => { load(); }, [load]);

  const deleteInvoice = async (id: string) => {
<<<<<<< HEAD
    const { error } = await businessInvoiceService.deleteInvoice(id);
    if (error) {
      toast.error(error);
      return;
    }
=======
    await supabase.from('invoices').delete().eq('id', id);
>>>>>>> origin/main
    setInvoices(prev => prev.filter(i => i.id !== id));
    toast.success('Invoice deleted');
  };
  const markPaid = async (id: string) => {
<<<<<<< HEAD
    const { error } = await businessInvoiceService.updateInvoice(id, { status: 'paid' });
    if (error) {
      toast.error(error);
      return;
    }
=======
    await supabase.from('invoices').update({ status: 'paid' }).eq('id', id);
>>>>>>> origin/main
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'paid' as InvoiceStatus } : i));
    toast.success('Invoice marked paid');
  };
  const deleteExpense = async (id: string) => {
<<<<<<< HEAD
    if (!currentTenant?.id) return;
    const response = await fetch(`/api/finance/expenses?tenantId=${encodeURIComponent(currentTenant.id)}&expenseId=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { toast.error(result.error || 'Expense could not be deleted'); return; }
=======
    await supabase.from('expenses').delete().eq('id', id);
>>>>>>> origin/main
    setExpenses(prev => prev.filter(e => e.id !== id));
    toast.success('Expense deleted');
  };

<<<<<<< HEAD
  const filteredInvoices = invoices.filter(i => invFilter === 'all' || i.status === invFilter);
  const filteredExpenses = expenses.filter(e => expCat === 'All' || e.category.toLowerCase() === expCat.toLowerCase());

  const invoiceColumns = useMemo<EnterpriseColumn<Invoice>[]>(() => [
    {
      id: 'number',
      header: 'Invoice',
      mobilePrimary: true,
      sortable: true,
      sortValue: (i) => i.number || i.id,
      accessor: (i) => (
        <div>
          <span className="text-[13px] font-bold text-white block">{i.client_name?.trim() || 'Unnamed Client'}</span>
          <span className="text-[11px] text-slate-500">#{i.number || i.id.slice(0, 6)}</span>
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      sortable: true,
      sortValue: (i) => i.amount,
      accessor: (i) => `$${i.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      id: 'status',
      header: 'Status',
      accessor: (i) => <StatusBadge variant={invoiceStatusVariant(i.status)}>{i.status}</StatusBadge>,
    },
    {
      id: 'due',
      header: 'Due',
      sortable: true,
      sortValue: (i) => i.due_date || '',
      accessor: (i) => i.due_date ? new Date(i.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
    },
  ], []);

  const expenseColumns = useMemo<EnterpriseColumn<Expense>[]>(() => [
    {
      id: 'description',
      header: 'Description',
      mobilePrimary: true,
      sortable: true,
      sortValue: (e) => e.description,
      accessor: (e) => (
        <div>
          <span className="text-[13px] font-bold text-white block">{e.description}</span>
          {e.vendor && <span className="text-[11px] text-slate-500">{e.vendor}</span>}
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      sortable: true,
      sortValue: (e) => e.amount,
      accessor: (e) => `$${e.amount.toLocaleString()}`,
    },
    {
      id: 'category',
      header: 'Category',
      accessor: (e) => <span className="capitalize text-slate-300">{e.category}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      accessor: (e) => <StatusBadge variant={expenseStatusVariant(e.status)}>{e.status}</StatusBadge>,
    },
    {
      id: 'date',
      header: 'Date',
      sortable: true,
      sortValue: (e) => e.date || e.created_at,
      accessor: (e) => e.date ? new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
    },
  ], []);

=======
  if (selectedInvoice) return (
    <InvoiceDetail
      invoice={selectedInvoice}
      onBack={() => setSelectedInvoice(null)}
      onSend={async (id) => {
        await supabase.from('invoices').update({ status: 'sent' }).eq('id', id);
        setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'sent' } : i));
        setSelectedInvoice(prev => prev ? { ...prev, status: 'sent' } : null);
        toast.success('Invoice marked as sent');
      }}
      onMarkPaid={async (id) => {
        await markPaid(id);
        setSelectedInvoice(prev => prev ? { ...prev, status: 'paid' } : null);
      }}
      onDownload={(id) => {
        window.open(`/api/pdf/invoice/${id}`, '_blank');
        toast.success('Downloading invoice PDF');
      }}
      onDelete={async (id) => {
        await deleteInvoice(id);
        setSelectedInvoice(null);
      }}
    />
  );

  const filteredInvoices = invoices.filter(i => invFilter === 'all' || i.status === invFilter);
  const filteredExpenses = expenses.filter(e => expCat === 'All' || e.category.toLowerCase() === expCat.toLowerCase());

>>>>>>> origin/main
  // Expense stats
  const thisMonth = expenses.filter(e => e.date && new Date(e.date).getMonth() === new Date().getMonth());
  const thisTotal = thisMonth.reduce((s, e) => s + e.amount, 0);

  return (
<<<<<<< HEAD
    <div className="relative flex flex-col min-h-0 ac-scroll-full ac-enterprise-module">
      {/* Main tabs */}
      <div className="flex border-b border-white/5 bg-slate-950">
        {(['invoices', 'expenses'] as MainTab[]).map(t => (
          <button key={t} onClick={() => setMainTab(t)} className={`flex-1 py-3 text-[13px] font-bold capitalize ${mainTab === t ? 'text-[var(--brand-blue-400)] border-b-2 border-[var(--brand-blue-400)]' : 'text-slate-500'}`}>{t}</button>
        ))}
      </div>

      <div className="flex-1 ac-scroll-full pb-20 bg-slate-950">
=======
    <div className="relative flex flex-col h-full">
      {/* Main tabs */}
      <div className="flex border-b border-white/5 bg-slate-950">
        {(['invoices', 'expenses'] as MainTab[]).map(t => (
          <button key={t} onClick={() => setMainTab(t)} className={`flex-1 py-3 text-[13px] font-bold capitalize ${mainTab === t ? 'text-teal-400 border-b-2 border-teal-400' : 'text-slate-500'}`}>{t}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-20 bg-slate-950">
>>>>>>> origin/main
        {mainTab === 'invoices' && (
          <>
            {/* Filter pills */}
            <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
              {(['all', ...INV_FILTERS] as (InvoiceStatus | 'all')[]).map(f => (
<<<<<<< HEAD
                <button key={f} onClick={() => setInvFilter(f)} className={`flex-shrink-0 h-[34px] px-3.5 rounded-full text-[12px] font-bold capitalize transition-all ${invFilter === f ? 'bg-[var(--brand-blue-500)] text-white' : 'bg-slate-900 text-slate-400 border border-white/5'}`}>{f}</button>
              ))}
            </div>
            {loading ? (
              <div className="divide-y divide-white/5">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-900/40 animate-pulse" />)}</div>
            ) : (
              <div className="px-2">
                <EnterpriseDataTable
                  columns={invoiceColumns}
                  data={filteredInvoices}
                  getRowId={(i) => i.id}
                  onRowClick={setSelectedInvoice}
                  emptyMessage="No invoices match this filter. Clear the filter or create a new invoice."
                />
              </div>
            )}
=======
                <button key={f} onClick={() => setInvFilter(f)} className={`flex-shrink-0 h-[34px] px-3.5 rounded-full text-[12px] font-bold capitalize transition-all ${invFilter === f ? 'bg-teal-500 text-white' : 'bg-slate-900 text-slate-400 border border-white/5'}`}>{f}</button>
              ))}
            </div>
            <div className="divide-y divide-white/5">
              {loading ? [...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-900/40 animate-pulse" />) :
                filteredInvoices.length === 0 ? <div className="py-12 text-center text-[13px] text-slate-500">No invoices found.</div> :
                filteredInvoices.map(inv => <InvoiceRow key={inv.id} invoice={inv} onDelete={deleteInvoice} onMarkPaid={markPaid} onTap={setSelectedInvoice} />)
              }
            </div>
>>>>>>> origin/main
          </>
        )}

        {mainTab === 'expenses' && (
          <>
            {/* Monthly total card */}
<<<<<<< HEAD
            <div className={`mx-4 mt-4 mb-3 p-4 ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[13px] text-slate-400 mb-1">This Month</div>
                  <div className="text-2xl sm:text-[32px] font-bold text-white">${thisTotal.toLocaleString()}</div>
                  <div className="text-[13px] text-slate-500 opacity-55 flex items-center gap-1 mt-0.5">
                    <TrendingDown className="w-3 h-3" />
                    <span>{thisMonth.length} transactions</span>
                  </div>
                </div>
              <button
                onClick={handleAiExpenseReview}
                disabled={aiExpenseLoading}
                className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/15 px-3 py-2 text-xs font-bold text-purple-300 hover:bg-purple-500/25 disabled:opacity-50"
              >
                  {aiExpenseLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  AI Review
                </button>
              </div>
              {aiExpenseInsight && (
                <div className="mt-3 border-t border-[var(--ws-border)] pt-3 text-xs leading-relaxed whitespace-pre-wrap text-slate-300">
                  {aiExpenseInsight}
                </div>
              )}
=======
            <div className="mx-4 mt-4 mb-3 bg-slate-900 border border-white/5 rounded-2xl p-4">
              <div className="text-[13px] text-slate-400 mb-1">This Month</div>
              <div className="text-[32px] font-bold text-white">${thisTotal.toLocaleString()}</div>
              <div className="text-[13px] text-slate-500 opacity-55 flex items-center gap-1 mt-0.5">
                <TrendingDown className="w-3 h-3" />
                <span>{thisMonth.length} transactions</span>
              </div>
>>>>>>> origin/main
            </div>
            {/* Category filter */}
            <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
              {EXP_CATS.map(c => (
<<<<<<< HEAD
                <button key={c} onClick={() => setExpCat(c)} className={`flex-shrink-0 h-[34px] px-3.5 rounded-full text-[12px] font-bold transition-all ${expCat === c ? 'bg-[var(--brand-blue-500)] text-white' : 'bg-slate-900 text-slate-400 border border-white/5'}`}>{c}</button>
              ))}
            </div>
            <div className="px-2">
              {loading ? (
                <div className="divide-y divide-white/5">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-900/40 animate-pulse" />)}</div>
              ) : (
                <EnterpriseDataTable
                  columns={expenseColumns}
                  data={filteredExpenses}
                  getRowId={(e) => e.id}
                  onRowClick={setSelectedExpense}
                  emptyMessage="No expenses found."
                />
              )}
=======
                <button key={c} onClick={() => setExpCat(c)} className={`flex-shrink-0 h-[34px] px-3.5 rounded-full text-[12px] font-bold transition-all ${expCat === c ? 'bg-teal-500 text-white' : 'bg-slate-900 text-slate-400 border border-white/5'}`}>{c}</button>
              ))}
            </div>
            <div className="divide-y divide-white/5">
              {loading ? [...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-900/40 animate-pulse" />) :
                filteredExpenses.length === 0 ? <div className="py-12 text-center text-[13px] text-slate-500">No expenses found.</div> :
                filteredExpenses.map(exp => <ExpenseRow key={exp.id} expense={exp} onDelete={deleteExpense} />)
              }
>>>>>>> origin/main
            </div>
          </>
        )}
      </div>

      {/* FAB */}
<<<<<<< HEAD
      <button
        type="button"
        onClick={handleFabClick}
        aria-label={mainTab === 'invoices' ? 'Create invoice' : 'Add expense'}
        className={`fixed bottom-20 right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-30 ${mainTab === 'invoices' ? 'bg-green-600 shadow-green-600/30' : 'bg-rose-600 shadow-rose-600/30'}`}
      >
        {mainTab === 'invoices' ? <FilePlus className="w-6 h-6 text-white" /> : <Receipt className="w-6 h-6 text-white" />}
      </button>

      <DetailDrawer open={showAddExpense} onOpenChange={setShowAddExpense} title="Add expense">
          <form onSubmit={handleAddExpense} className="space-y-4 pb-6">
            <Input
              label="Description"
              value={newExpense.description}
              onChange={(e) => setNewExpense((f) => ({ ...f, description: e.target.value }))}
              placeholder="What was this expense for?"
              validate={(v) => !v.trim() ? 'Description is required' : undefined}
            />
            <Input
              label="Amount"
              type="number"
              step="0.01"
              value={newExpense.amount}
              onChange={(e) => setNewExpense((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
              validate={(v) => !v.trim() || Number(v) <= 0 ? 'Enter a valid amount' : undefined}
            />
            <Input
              label="Vendor (optional)"
              value={newExpense.vendor}
              onChange={(e) => setNewExpense((f) => ({ ...f, vendor: e.target.value }))}
              placeholder="Vendor name"
            />
            <button
              type="submit"
              disabled={savingExpense}
            className="w-full min-h-11 rounded-lg bg-rose-600 text-sm font-semibold text-white disabled:opacity-50"
            >
              {savingExpense ? 'Saving…' : 'Save expense'}
            </button>
          </form>
      </DetailDrawer>

      <DetailDrawer
        open={Boolean(selectedInvoice)}
        onOpenChange={(open) => { if (!open) setSelectedInvoice(null); }}
        title={selectedInvoice ? `Invoice #${selectedInvoice.number || selectedInvoice.id.slice(0, 8)}` : 'Invoice'}
      >
        {selectedInvoice && (
          <InvoiceDetailContent
            invoice={selectedInvoice}
            onSend={async (id) => {
              const { error } = await businessInvoiceService.updateInvoice(id, { status: 'sent' });
              if (error) {
                toast.error(error);
                return;
              }
              setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'sent' } : i));
              setSelectedInvoice(prev => prev ? { ...prev, status: 'sent' } : null);
              toast.success('Invoice marked as sent');
            }}
            onMarkPaid={async (id) => {
              await markPaid(id);
              setSelectedInvoice(prev => prev ? { ...prev, status: 'paid' } : null);
            }}
            onDownload={(id) => {
              window.open(`/api/pdf/invoice/${id}`, '_blank');
              toast.success('Downloading invoice PDF');
            }}
            onDelete={async (id) => {
              await deleteInvoice(id);
              setSelectedInvoice(null);
            }}
          />
        )}
      </DetailDrawer>

      <DetailDrawer
        open={Boolean(selectedExpense)}
        onOpenChange={(open) => { if (!open) setSelectedExpense(null); }}
        title={selectedExpense?.description || 'Expense'}
      >
        {selectedExpense && (
          <div className="space-y-4 pb-6">
            <div className={`space-y-2 p-5 text-center ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}>
              <div className="text-[32px] font-bold text-rose-400">${selectedExpense.amount.toLocaleString()}</div>
              <StatusBadge variant={expenseStatusVariant(selectedExpense.status)}>{selectedExpense.status}</StatusBadge>
            </div>
            <div className={`space-y-2 p-4 text-sm ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}>
              <div className="flex justify-between"><span className="text-slate-400">Category</span><span className="text-white capitalize">{selectedExpense.category}</span></div>
              {selectedExpense.vendor && <div className="flex justify-between"><span className="text-slate-400">Vendor</span><span className="text-white">{selectedExpense.vendor}</span></div>}
              {selectedExpense.date && <div className="flex justify-between"><span className="text-slate-400">Date</span><span className="text-white">{new Date(selectedExpense.date).toLocaleDateString()}</span></div>}
            </div>
            <button
              type="button"
              onClick={async () => {
                await deleteExpense(selectedExpense.id);
                setSelectedExpense(null);
              }}
              className="w-full min-h-11 rounded-lg border border-red-500/30 text-sm font-semibold text-red-400 hover:bg-red-500/10"
            >
              Delete expense
            </button>
          </div>
        )}
      </DetailDrawer>
=======
      <button className={`fixed bottom-20 right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-30 ${mainTab === 'invoices' ? 'bg-green-600 shadow-green-600/30' : 'bg-rose-600 shadow-rose-600/30'}`}>
        {mainTab === 'invoices' ? <FilePlus className="w-6 h-6 text-white" /> : <Receipt className="w-6 h-6 text-white" />}
      </button>
>>>>>>> origin/main
    </div>
  );
};

export default FinanceTab;
