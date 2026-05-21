'use client';

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

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';
type ExpenseStatus = 'pending' | 'approved' | 'rejected';

interface Invoice { id: string; number?: string; client_name: string; client_email?: string; amount: number; status: InvoiceStatus; due_date?: string; created_at: string; tenant_id: string; }
interface Expense { id: string; description: string; amount: number; category: string; vendor?: string; date?: string; status: ExpenseStatus; tenant_id: string; created_at: string; }

interface FinanceTabProps { user: User; }

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

// ── Invoice Swipeable Row ──────────────────────────────────────────────────────
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
            <span className="text-[15px] font-bold text-white truncate">{invoice.client_name}</span>
          </div>
          {invoice.due_date && <span className="text-[13px] text-slate-500 opacity-55">Due {new Date(invoice.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-[15px] font-bold text-white">${invoice.amount.toLocaleString()}</span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border capitalize ${INV_STATUS_COLORS[invoice.status]}`}>{invoice.status}</span>
        </div>
      </motion.div>
    </div>
  );
};

// ── Invoice Detail ─────────────────────────────────────────────────────────────
const InvoiceDetail: React.FC<{ invoice: Invoice; onBack: () => void }> = ({ invoice, onBack }) => (
  <div className="relative flex flex-col h-full overflow-hidden">
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
      <button onClick={onBack} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center"><ArrowLeft className="w-4 h-4 text-slate-300" /></button>
      <span className="text-[15px] font-bold text-white">Invoice Detail</span>
    </div>
    <div className="flex-1 overflow-y-auto p-4 pb-28 space-y-4">
      {/* Top card */}
      <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 text-center space-y-2">
        <div className="text-[13px] text-slate-500">Invoice #{invoice.number || invoice.id.slice(0,8)}</div>
        <div className="text-[32px] font-bold text-teal-400">${invoice.amount.toLocaleString()}</div>
        <span className={`inline-block text-[11px] font-bold px-3 py-1 rounded-full border capitalize ${INV_STATUS_COLORS[invoice.status]}`}>{invoice.status}</span>
      </div>
      {/* Client */}
      <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 space-y-1">
        <div className="text-[15px] font-bold text-white">{invoice.client_name}</div>
        {invoice.client_email && <div className="text-[13px] text-slate-400 opacity-55">{invoice.client_email}</div>}
      </div>
      {/* Totals */}
      <div className="bg-slate-900 border border-white/5 rounded-2xl p-4">
        <div className="flex justify-between py-1.5 border-b border-white/5">
          <span className="text-[15px] text-slate-400">Subtotal</span>
          <span className="text-[15px] text-white font-mono">${invoice.amount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between pt-2">
          <span className="text-[17px] font-bold text-white">Total</span>
          <span className="text-[20px] font-bold text-teal-400 font-mono">${invoice.amount.toLocaleString()}</span>
        </div>
      </div>
    </div>
    {/* Fixed action bar */}
    <div className="absolute bottom-0 left-0 right-0 bg-slate-950/95 border-t border-white/5 flex divide-x divide-white/5 native-bottom-bar">
      {['Send', 'Mark Paid', 'Download PDF'].map(lbl => (
        <button key={lbl} className="flex-1 flex flex-col items-center justify-center h-[52px] gap-1 hover:bg-white/5 transition-colors">
          {lbl === 'Send' && <Send className="w-4 h-4 text-sky-400" />}
          {lbl === 'Mark Paid' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
          {lbl === 'Download PDF' && <Download className="w-4 h-4 text-slate-400" />}
          <span className="text-[11px] text-slate-400 font-bold">{lbl}</span>
        </button>
      ))}
    </div>
  </div>
);

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

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const [{ data: invData }, { data: expData }] = await Promise.all([
      supabase.from('invoices').select('*').eq('tenant_id', currentTenant.id).order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').eq('tenant_id', currentTenant.id).order('created_at', { ascending: false }),
    ]);
    setInvoices((invData as Invoice[]) || []);
    setExpenses((expData as Expense[]) || []);
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => { load(); }, [load]);

  const deleteInvoice = async (id: string) => {
    await supabase.from('invoices').delete().eq('id', id);
    setInvoices(prev => prev.filter(i => i.id !== id));
    toast.success('Invoice deleted');
  };
  const markPaid = async (id: string) => {
    await supabase.from('invoices').update({ status: 'paid' }).eq('id', id);
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'paid' as InvoiceStatus } : i));
    toast.success('Invoice marked paid');
  };
  const deleteExpense = async (id: string) => {
    await supabase.from('expenses').delete().eq('id', id);
    setExpenses(prev => prev.filter(e => e.id !== id));
    toast.success('Expense deleted');
  };

  if (selectedInvoice) return <InvoiceDetail invoice={selectedInvoice} onBack={() => setSelectedInvoice(null)} />;

  const filteredInvoices = invoices.filter(i => invFilter === 'all' || i.status === invFilter);
  const filteredExpenses = expenses.filter(e => expCat === 'All' || e.category.toLowerCase() === expCat.toLowerCase());

  // Expense stats
  const thisMonth = expenses.filter(e => e.date && new Date(e.date).getMonth() === new Date().getMonth());
  const thisTotal = thisMonth.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="relative flex flex-col h-full">
      {/* Main tabs */}
      <div className="flex border-b border-white/5 bg-slate-950">
        {(['invoices', 'expenses'] as MainTab[]).map(t => (
          <button key={t} onClick={() => setMainTab(t)} className={`flex-1 py-3 text-[13px] font-bold capitalize ${mainTab === t ? 'text-teal-400 border-b-2 border-teal-400' : 'text-slate-500'}`}>{t}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-20 bg-slate-950">
        {mainTab === 'invoices' && (
          <>
            {/* Filter pills */}
            <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
              {(['all', ...INV_FILTERS] as (InvoiceStatus | 'all')[]).map(f => (
                <button key={f} onClick={() => setInvFilter(f)} className={`flex-shrink-0 h-[34px] px-3.5 rounded-full text-[12px] font-bold capitalize transition-all ${invFilter === f ? 'bg-teal-500 text-white' : 'bg-slate-900 text-slate-400 border border-white/5'}`}>{f}</button>
              ))}
            </div>
            <div className="divide-y divide-white/5">
              {loading ? [...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-900/40 animate-pulse" />) :
                filteredInvoices.length === 0 ? <div className="py-12 text-center text-[13px] text-slate-500">No invoices found.</div> :
                filteredInvoices.map(inv => <InvoiceRow key={inv.id} invoice={inv} onDelete={deleteInvoice} onMarkPaid={markPaid} onTap={setSelectedInvoice} />)
              }
            </div>
          </>
        )}

        {mainTab === 'expenses' && (
          <>
            {/* Monthly total card */}
            <div className="mx-4 mt-4 mb-3 bg-slate-900 border border-white/5 rounded-2xl p-4">
              <div className="text-[13px] text-slate-400 mb-1">This Month</div>
              <div className="text-[32px] font-bold text-white">${thisTotal.toLocaleString()}</div>
              <div className="text-[13px] text-slate-500 opacity-55 flex items-center gap-1 mt-0.5">
                <TrendingDown className="w-3 h-3" />
                <span>{thisMonth.length} transactions</span>
              </div>
            </div>
            {/* Category filter */}
            <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
              {EXP_CATS.map(c => (
                <button key={c} onClick={() => setExpCat(c)} className={`flex-shrink-0 h-[34px] px-3.5 rounded-full text-[12px] font-bold transition-all ${expCat === c ? 'bg-teal-500 text-white' : 'bg-slate-900 text-slate-400 border border-white/5'}`}>{c}</button>
              ))}
            </div>
            <div className="divide-y divide-white/5">
              {loading ? [...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-900/40 animate-pulse" />) :
                filteredExpenses.length === 0 ? <div className="py-12 text-center text-[13px] text-slate-500">No expenses found.</div> :
                filteredExpenses.map(exp => <ExpenseRow key={exp.id} expense={exp} onDelete={deleteExpense} />)
              }
            </div>
          </>
        )}
      </div>

      {/* FAB */}
      <button className={`fixed bottom-20 right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-30 ${mainTab === 'invoices' ? 'bg-green-600 shadow-green-600/30' : 'bg-rose-600 shadow-rose-600/30'}`}>
        {mainTab === 'invoices' ? <FilePlus className="w-6 h-6 text-white" /> : <Receipt className="w-6 h-6 text-white" />}
      </button>
    </div>
  );
};

export default FinanceTab;
