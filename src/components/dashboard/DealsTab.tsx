'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronRight, ArrowLeft, Plus, TrendingUp, Clock,
  User, Mail, Phone, FileText, CheckSquare, ArrowRight
} from 'lucide-react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';
import { User as UserType } from '../../types';
import toast from 'react-hot-toast';

type DealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';

const STAGES: DealStage[] = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

const STAGE_COLORS: Record<DealStage, { bg: string; text: string; border: string }> = {
  lead:          { bg: 'bg-slate-500/15',   text: 'text-slate-400',   border: 'border-slate-500/30' },
  qualified:     { bg: 'bg-blue-500/15',    text: 'text-blue-400',    border: 'border-blue-500/30' },
  proposal:      { bg: 'bg-yellow-500/15',  text: 'text-yellow-400',  border: 'border-yellow-500/30' },
  negotiation:   { bg: 'bg-orange-500/15',  text: 'text-orange-400',  border: 'border-orange-500/30' },
  closed_won:    { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  closed_lost:   { bg: 'bg-red-500/15',     text: 'text-red-400',     border: 'border-red-500/30' },
};

interface Deal {
  id: string;
  name: string;
  value: number;
  stage: DealStage;
  contact_name?: string;
  contact_email?: string;
  score?: number;
  created_at: string;
  updated_at?: string;
  description?: string;
  tenant_id: string;
}

interface DealsTabProps {
  user: UserType;
}

const daysInStage = (updated_at?: string) => {
  if (!updated_at) return 0;
  return Math.floor((Date.now() - new Date(updated_at).getTime()) / 86400000);
};

const scoreColor = (s: number) => s >= 8 ? 'text-emerald-400' : s >= 5 ? 'text-yellow-400' : 'text-red-400';

// ── Swipeable Deal Row ─────────────────────────────────────────────────────────
const SwipeableDealRow: React.FC<{
  deal: Deal;
  onAdvance: (id: string) => void;
  onRetreat: (id: string) => void;
  onTap: (deal: Deal) => void;
}> = ({ deal, onAdvance, onRetreat, onTap }) => {
  const x = useMotionValue(0);
  const leftOp  = useTransform(x, [0, 80],  [0, 1]);
  const rightOp = useTransform(x, [-80, 0], [1, 0]);
  const stageIdx = STAGES.indexOf(deal.stage);
  const canAdvance = stageIdx < STAGES.length - 1;
  const canRetreat = stageIdx > 0;
  const col = STAGE_COLORS[deal.stage];

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 80 && canAdvance) { onAdvance(deal.id); }
    else if (info.offset.x < -80 && canRetreat) { onRetreat(deal.id); }
    x.set(0);
  };

  const nextStage = canAdvance ? STAGES[stageIdx + 1] : null;
  const prevStage = canRetreat ? STAGES[stageIdx - 1] : null;

  return (
    <div className="relative overflow-hidden">
      <motion.div style={{ opacity: leftOp }} className="absolute inset-y-0 left-0 w-24 bg-emerald-500/80 flex flex-col items-center justify-center z-0 gap-1">
        <ArrowRight className="w-5 h-5 text-white" />
        <span className="text-[10px] text-white font-bold capitalize">{nextStage?.replace('_', ' ')}</span>
      </motion.div>
      <motion.div style={{ opacity: rightOp }} className="absolute inset-y-0 right-0 w-24 bg-orange-500/80 flex flex-col items-center justify-center z-0 gap-1">
        <ArrowLeft className="w-5 h-5 text-white" />
        <span className="text-[10px] text-white font-bold capitalize">{prevStage?.replace('_', ' ')}</span>
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 100 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        onClick={() => onTap(deal)}
        className="relative z-10 bg-slate-950 flex items-center gap-3 px-4 py-3 cursor-pointer"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[15px] font-bold text-white truncate">{deal.name}</span>
            {deal.score != null && (
              <span className={`text-[11px] font-bold flex-shrink-0 ${scoreColor(deal.score)}`}>●{deal.score}</span>
            )}
          </div>
          {deal.contact_name && <span className="text-[13px] text-slate-500 opacity-55 block truncate">{deal.contact_name}</span>}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-[15px] font-bold text-teal-400">${deal.value.toLocaleString()}</span>
          <span className="text-[11px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full">{daysInStage(deal.updated_at)}d</span>
        </div>
      </motion.div>
    </div>
  );
};

// ── Deal Detail ────────────────────────────────────────────────────────────────
const DealDetail: React.FC<{ deal: Deal; onBack: () => void; onStageChange: (id: string, stage: DealStage) => void }> = ({ deal, onBack, onStageChange }) => {
  const col = STAGE_COLORS[deal.stage];
  const stageIdx = STAGES.indexOf(deal.stage);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-slate-300" />
        </button>
        <span className="text-[15px] font-bold text-white flex-1">Deal Detail</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
        {/* Value hero */}
        <div className="flex flex-col items-center py-4 gap-2">
          <span className="text-[32px] font-extrabold text-teal-400">${deal.value.toLocaleString()}</span>
          <button
            onClick={() => {
              const next = stageIdx < STAGES.length - 1 ? STAGES[stageIdx + 1] : deal.stage;
              onStageChange(deal.id, next);
            }}
            className={`px-4 py-1.5 rounded-full text-[13px] font-bold border capitalize ${col.bg} ${col.text} ${col.border}`}
          >
            {deal.stage.replace('_', ' ')} → advance
          </button>
          {deal.score != null && (
            <span className={`text-[20px] font-black ${scoreColor(deal.score)}`}>Score: {deal.score}/10</span>
          )}
        </div>

        {/* Contact */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl divide-y divide-white/5">
          {deal.contact_name && <div className="flex items-center gap-3 p-4"><User className="w-5 h-5 text-slate-500" /><span className="text-[15px] text-slate-300">{deal.contact_name}</span></div>}
          {deal.contact_email && <div className="flex items-center gap-3 p-4"><Mail className="w-5 h-5 text-slate-500" /><span className="text-[15px] text-slate-300">{deal.contact_email}</span></div>}
        </div>

        {deal.description && (
          <div className="bg-slate-900 border border-white/5 rounded-2xl p-4">
            <p className="text-[15px] text-slate-300 leading-relaxed">{deal.description}</p>
          </div>
        )}
      </div>

      {/* Fixed actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 border-t border-white/5 flex divide-x divide-white/5 pb-[env(safe-area-inset-bottom,0px)]">
        {['Edit', 'Log Activity', 'Create Invoice'].map(lbl => (
          <button key={lbl} className="flex-1 py-3.5 text-[13px] text-slate-400 font-bold hover:bg-white/5 transition-colors">{lbl}</button>
        ))}
      </div>
    </div>
  );
};

// ── Main DealsTab ──────────────────────────────────────────────────────────────
const DealsTab: React.FC<DealsTabProps> = ({ user }) => {
  const { currentTenant } = useTenant();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('deals')
      .select('*')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false });
    setDeals((data as Deal[]) || []);
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => { load(); }, [load]);

  const advanceStage = async (id: string) => {
    const deal = deals.find(d => d.id === id);
    if (!deal) return;
    const idx = STAGES.indexOf(deal.stage);
    if (idx >= STAGES.length - 1) return;
    const newStage = STAGES[idx + 1];
    await supabase.from('deals').update({ stage: newStage, updated_at: new Date().toISOString() }).eq('id', id);
    setDeals(prev => prev.map(d => d.id === id ? { ...d, stage: newStage } : d));
    toast.success(`Moved to ${newStage.replace('_', ' ')}`);
  };

  const retreatStage = async (id: string) => {
    const deal = deals.find(d => d.id === id);
    if (!deal) return;
    const idx = STAGES.indexOf(deal.stage);
    if (idx <= 0) return;
    const newStage = STAGES[idx - 1];
    await supabase.from('deals').update({ stage: newStage, updated_at: new Date().toISOString() }).eq('id', id);
    setDeals(prev => prev.map(d => d.id === id ? { ...d, stage: newStage } : d));
    toast.success(`Moved back to ${newStage.replace('_', ' ')}`);
  };

  const handleStageChange = async (id: string, stage: DealStage) => {
    await supabase.from('deals').update({ stage, updated_at: new Date().toISOString() }).eq('id', id);
    setDeals(prev => prev.map(d => d.id === id ? { ...d, stage } : d));
    if (selectedDeal?.id === id) setSelectedDeal(prev => prev ? { ...prev, stage } : prev);
    toast.success(`Stage updated`);
  };

  if (selectedDeal) {
    return <DealDetail deal={selectedDeal} onBack={() => setSelectedDeal(null)} onStageChange={handleStageChange} />;
  }

  // Group by stage
  const grouped = STAGES.reduce<Record<string, Deal[]>>((acc, s) => {
    acc[s] = deals.filter(d => d.stage === s);
    return acc;
  }, {} as Record<string, Deal[]>);

  return (
    <div className="relative flex flex-col h-full">
      <div className="flex-1 overflow-y-auto pb-20">
        {loading ? (
          <div className="space-y-px">{[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-slate-900/40 animate-pulse" />)}</div>
        ) : (
          STAGES.map(stage => {
            const stageDeals = grouped[stage] || [];
            if (stageDeals.length === 0) return null;
            const col = STAGE_COLORS[stage];
            const total = stageDeals.reduce((s, d) => s + d.value, 0);
            return (
              <div key={stage}>
                {/* Stage header */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/60 border-b border-white/5 sticky top-0 z-10">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-black uppercase tracking-wider text-slate-400">{stage.replace('_', ' ')}</span>
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${col.bg} ${col.text}`}>{stageDeals.length}</span>
                  </div>
                  <span className="text-[13px] text-slate-500 opacity-55">${total.toLocaleString()}</span>
                </div>
                {/* Deals */}
                <div className="divide-y divide-white/5">
                  {stageDeals.map(deal => (
                    <SwipeableDealRow
                      key={deal.id}
                      deal={deal}
                      onAdvance={advanceStage}
                      onRetreat={retreatStage}
                      onTap={setSelectedDeal}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FAB */}
      <button className="fixed bottom-20 right-4 w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 z-30">
        <Plus className="w-6 h-6 text-white" />
      </button>
    </div>
  );
};

export default DealsTab;
