'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FilePlus, Send, CheckCircle, Trash2, ArrowLeft, ArrowRight, X } from 'lucide-react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';
import { User } from '../../types';
import toast from 'react-hot-toast';

type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

interface Quote { id: string; number?: string; client_name: string; amount: number; status: QuoteStatus; valid_until?: string; created_at: string; tenant_id: string; }

const STATUS_COLORS: Record<QuoteStatus, string> = {
  draft:    'bg-slate-500/15 text-slate-400 border-slate-500/20',
  sent:     'bg-blue-500/15 text-blue-400 border-blue-500/20',
  accepted: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/20',
  expired:  'bg-slate-500/15 text-slate-300 border-slate-500/20',
};

const FILTERS: QuoteStatus[] = ['draft', 'sent', 'accepted', 'rejected', 'expired'];

const QuoteRow: React.FC<{ quote: Quote; onDelete: (id: string) => void; onTap: (q: Quote) => void }> = ({ quote, onDelete, onTap }) => {
  const x = useMotionValue(0);
  const rOp = useTransform(x, [-80, 0], [1, 0]);
  const handleDragEnd = (_: any, info: any) => { if (info.offset.x < -80) onDelete(quote.id); x.set(0); };

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
            <span className="text-[15px] font-bold text-white truncate">{quote.client_name}</span>
          </div>
          {quote.valid_until && <span className="text-[13px] text-slate-500 opacity-55">Valid until {new Date(quote.valid_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-[15px] font-bold text-white">${(quote.amount || 0).toLocaleString()}</span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border capitalize ${STATUS_COLORS[quote.status]}`}>{quote.status}</span>
        </div>
      </motion.div>
    </div>
  );
};

const QuoteDetail: React.FC<{ quote: Quote; onBack: () => void; onConvert: (id: string) => void }> = ({ quote, onBack, onConvert }) => (
  <div className="relative flex flex-col h-full overflow-hidden">
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
      <button onClick={onBack} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center"><ArrowLeft className="w-4 h-4 text-slate-300" /></button>
      <span className="text-[15px] font-bold text-white">Quote Detail</span>
    </div>
    <div className="flex-1 overflow-y-auto p-4 pb-28 space-y-4">
      <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 text-center space-y-2">
        <div className="text-[13px] text-slate-500">Quote #{quote.number || quote.id.slice(0,8)}</div>
        <div className="text-[32px] font-bold text-teal-400">${(quote.amount || 0).toLocaleString()}</div>
        <span className={`inline-block text-[11px] font-bold px-3 py-1 rounded-full border capitalize ${STATUS_COLORS[quote.status]}`}>{quote.status}</span>
      </div>
      <div className="bg-slate-900 border border-white/5 rounded-2xl p-4">
        <div className="text-[15px] font-bold text-white">{quote.client_name}</div>
        {quote.valid_until && <div className="text-[13px] text-slate-400 opacity-55 mt-0.5">Valid until {new Date(quote.valid_until).toLocaleDateString()}</div>}
      </div>
      {quote.status === 'accepted' && (
        <button onClick={() => onConvert(quote.id)} className="w-full h-[52px] bg-teal-600 hover:bg-teal-500 text-white font-black uppercase tracking-wider rounded-2xl text-[13px] transition-colors flex items-center justify-center gap-2">
          <ArrowRight className="w-5 h-5" /> Convert to Invoice
        </button>
      )}
    </div>
    <div className="absolute bottom-0 left-0 right-0 bg-slate-950/95 border-t border-white/5 flex divide-x divide-white/5 native-bottom-bar">
      {['Send', 'Convert to Invoice', 'Delete'].map(lbl => (
        <button key={lbl} onClick={lbl === 'Convert to Invoice' ? () => onConvert(quote.id) : undefined} className={`flex-1 py-3.5 text-[12px] font-bold hover:bg-white/5 transition-colors ${lbl === 'Delete' ? 'text-red-400' : lbl === 'Convert to Invoice' ? 'text-teal-400' : 'text-slate-400'}`}>{lbl}</button>
      ))}
    </div>
  </div>
);

interface QuotesTabProps { user: User; }

const QuotesTab: React.FC<QuotesTabProps> = ({ user }) => {
  const { currentTenant } = useTenant();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<QuoteStatus | 'all'>('all');
  const [selected, setSelected] = useState<Quote | null>(null);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const { data } = await supabase.from('quotes').select('*').eq('tenant_id', currentTenant.id).order('created_at', { ascending: false });
    setQuotes((data as Quote[]) || []);
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => { load(); }, [load]);

  const deleteQuote = async (id: string) => {
    await supabase.from('quotes').delete().eq('id', id);
    setQuotes(p => p.filter(q => q.id !== id));
    toast.success('Quote deleted');
  };

  const convertToInvoice = async (id: string) => {
    toast.success('Converting to invoice...');
    setSelected(null);
  };

  if (selected) return <QuoteDetail quote={selected} onBack={() => setSelected(null)} onConvert={convertToInvoice} />;

  const filtered = quotes.filter(q => filter === 'all' || q.status === filter);

  return (
    <div className="relative flex flex-col h-full">
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide border-b border-white/5">
        {(['all', ...FILTERS] as (QuoteStatus | 'all')[]).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`flex-shrink-0 h-[34px] px-3.5 rounded-full text-[12px] font-bold capitalize transition-all ${filter === f ? 'bg-teal-500 text-white' : 'bg-slate-900 text-slate-400 border border-white/5'}`}>{f}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto pb-20 divide-y divide-white/5 bg-slate-950">
        {loading ? [...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-900/40 animate-pulse" />) :
          filtered.length === 0 ? <div className="py-12 text-center text-[13px] text-slate-500">No quotes found.</div> :
          filtered.map(q => <QuoteRow key={q.id} quote={q} onDelete={deleteQuote} onTap={setSelected} />)
        }
      </div>
      <button className="fixed bottom-20 right-4 w-14 h-14 bg-teal-600 rounded-full flex items-center justify-center shadow-lg shadow-teal-600/30 z-30">
        <FilePlus className="w-6 h-6 text-white" />
      </button>
    </div>
  );
};

export default QuotesTab;
