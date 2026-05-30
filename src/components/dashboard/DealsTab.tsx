'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronRight, ArrowLeft, Plus, TrendingUp, Clock,
  User, Mail, Phone, FileText, CheckSquare, ArrowRight,
  LayoutGrid, List, Smartphone, Search, ArrowUpDown, Filter
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
          <span className="text-[15px] font-bold text-teal-400">${(deal.value || 0).toLocaleString()}</span>
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
          <span className="text-[32px] font-extrabold text-teal-400">${(deal.value || 0).toLocaleString()}</span>
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

  // View mode states
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'mobile-stage'>('board');

  // Table List View Search/Filter/Sort states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'value' | 'created_at'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Create Deal modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDealName, setNewDealName] = useState('');
  const [newDealValue, setNewDealValue] = useState('');
  const [newDealStage, setNewDealStage] = useState<DealStage>('lead');
  const [newDealContactName, setNewDealContactName] = useState('');
  const [newDealContactEmail, setNewDealContactEmail] = useState('');
  const [newDealDescription, setNewDealDescription] = useState('');
  const [savingNewDeal, setSavingNewDeal] = useState(false);

  // Detect responsive view mode on load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 768) {
        setViewMode('mobile-stage');
      } else {
        setViewMode('board');
      }
    }
  }, []);

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

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDealName.trim()) {
      toast.error('Deal Name is required');
      return;
    }
    if (!currentTenant?.id) {
      toast.error('No tenant context found');
      return;
    }

    setSavingNewDeal(true);
    try {
      const { data, error } = await supabase
        .from('deals')
        .insert({
          name: newDealName.trim(),
          value: parseFloat(newDealValue) || 0,
          stage: newDealStage,
          contact_name: newDealContactName.trim() || null,
          contact_email: newDealContactEmail.trim() || null,
          description: newDealDescription.trim() || null,
          tenant_id: currentTenant.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Deal created successfully');
      setDeals((prev) => [data as Deal, ...prev]);
      setShowCreateModal(false);
      // Reset form
      setNewDealName('');
      setNewDealValue('');
      setNewDealStage('lead');
      setNewDealContactName('');
      setNewDealContactEmail('');
      setNewDealDescription('');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error creating deal');
    } finally {
      setSavingNewDeal(false);
    }
  };

  // Group by stage for Board / mobile views
  const grouped = useMemo(() => {
    return STAGES.reduce<Record<string, Deal[]>>((acc, s) => {
      acc[s] = deals.filter(d => d.stage === s);
      return acc;
    }, {} as Record<string, Deal[]>);
  }, [deals]);

  // Calculate total pipeline value
  const totalPipelineValue = useMemo(() => {
    return deals.reduce((sum, d) => sum + (d.value || 0), 0);
  }, [deals]);

  // Filtered and sorted deals for Table view
  const filteredDeals = useMemo(() => {
    return deals
      .filter((deal) => {
        const matchesSearch =
          deal.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (deal.contact_name && deal.contact_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (deal.contact_email && deal.contact_email.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesStage = filterStage === 'all' || deal.stage === filterStage;

        return matchesSearch && matchesStage;
      })
      .sort((a, b) => {
        let fieldA = a[sortBy] || 0;
        let fieldB = b[sortBy] || 0;
        if (sortBy === 'created_at') {
          fieldA = new Date(a.created_at).getTime();
          fieldB = new Date(b.created_at).getTime();
        }
        if (sortOrder === 'asc') {
          return fieldA > fieldB ? 1 : -1;
        } else {
          return fieldA < fieldB ? 1 : -1;
        }
      });
  }, [deals, searchTerm, filterStage, sortBy, sortOrder]);

  if (selectedDeal) {
    return <DealDetail deal={selectedDeal} onBack={() => setSelectedDeal(null)} onStageChange={handleStageChange} />;
  }

  // ── RENDER BOARD VIEW ──────────────────────────────────────────────────────────
  const renderBoard = () => (
    <div className="flex gap-4 p-4 overflow-x-auto h-[calc(100vh-210px)] select-none">
      {STAGES.map((stage) => {
        const stageDeals = grouped[stage] || [];
        const col = STAGE_COLORS[stage];
        const totalVal = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);

        return (
          <div
            key={stage}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData('text/plain');
              if (id) handleStageChange(id, stage);
            }}
            className="flex-1 min-w-[280px] max-w-[320px] bg-slate-900/25 border border-white/5 rounded-2xl flex flex-col h-full overflow-hidden"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between p-3.5 border-b border-white/5 bg-slate-900/40 shrink-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${col.text} bg-current`} />
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">{stage.replace('_', ' ')}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${col.bg} ${col.text}`}>{stageDeals.length}</span>
              </div>
              <span className="text-[11px] font-bold text-slate-500 opacity-60">${totalVal.toLocaleString()}</span>
            </div>

            {/* Column Cards */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-none">
              {stageDeals.length === 0 ? (
                <div className="h-28 border border-dashed border-white/5 rounded-xl flex items-center justify-center p-4 text-center">
                  <p className="text-[10px] text-slate-650 font-medium">Drag deals here</p>
                </div>
              ) : (
                stageDeals.map((deal) => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', deal.id);
                    }}
                    onClick={() => setSelectedDeal(deal)}
                    className="bg-slate-950 border border-white/5 hover:border-slate-800 p-4 rounded-xl cursor-pointer hover:shadow-lg transition-all flex flex-col gap-3 group relative overflow-hidden active:scale-[0.98]"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-[13px] font-bold text-white group-hover:text-teal-400 transition-colors leading-tight truncate">{deal.name}</h4>
                        {deal.score != null && (
                          <span className={`text-[10px] font-extrabold flex-shrink-0 px-1.5 py-0.5 rounded-md ${scoreColor(deal.score)} bg-white/5`}>
                            ★ {deal.score}
                          </span>
                        )}
                      </div>
                      {deal.contact_name && (
                        <span className="text-[11px] text-slate-500 mt-1 block truncate">{deal.contact_name}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1 shrink-0">
                      <span className="text-[13px] font-extrabold text-teal-400">${(deal.value || 0).toLocaleString()}</span>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-550" />
                        <span className="text-[10px] text-slate-550 font-semibold">{daysInStage(deal.updated_at)}d</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── RENDER TABLE LIST VIEW ──────────────────────────────────────────────────────
  const renderList = () => (
    <div className="p-4 space-y-4">
      {/* Table Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900/20 border border-white/5 rounded-2xl p-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search deals or contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950/60 border border-white/5 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {/* Stage filter */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="bg-slate-950/60 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500/50 capitalize"
            >
              <option value="all">All Stages</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          {/* Sort Value */}
          <button
            onClick={() => {
              if (sortBy === 'value') {
                setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
              } else {
                setSortBy('value');
                setSortOrder('desc');
              }
            }}
            className={`flex items-center gap-1 px-3 py-1.5 bg-slate-950/60 border border-white/5 rounded-xl text-xs shrink-0 ${
              sortBy === 'value' ? 'text-teal-400 border-teal-500/20' : 'text-slate-400'
            }`}
          >
            <ArrowUpDown className="w-3 h-3" />
            <span>Value {sortBy === 'value' && (sortOrder === 'asc' ? '↑' : '↓')}</span>
          </button>

          {/* Sort Created */}
          <button
            onClick={() => {
              if (sortBy === 'created_at') {
                setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
              } else {
                setSortBy('created_at');
                setSortOrder('desc');
              }
            }}
            className={`flex items-center gap-1 px-3 py-1.5 bg-slate-950/60 border border-white/5 rounded-xl text-xs shrink-0 ${
              sortBy === 'created_at' ? 'text-teal-400 border-teal-500/20' : 'text-slate-400'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>Created {sortBy === 'created_at' && (sortOrder === 'asc' ? '↑' : '↓')}</span>
          </button>
        </div>
      </div>

      {/* Table grid */}
      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-950/30">
        <table className="w-full border-collapse text-left min-w-[700px]">
          <thead>
            <tr className="border-b border-white/5 bg-slate-900/20">
              <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Deal Name</th>
              <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Stage</th>
              <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Value</th>
              <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Contact</th>
              <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Score</th>
              <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Age</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredDeals.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500 text-xs">
                  No deals found matching search criteria.
                </td>
              </tr>
            ) : (
              filteredDeals.map((deal) => {
                const col = STAGE_COLORS[deal.stage];
                return (
                  <tr
                    key={deal.id}
                    onClick={() => setSelectedDeal(deal)}
                    className="hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <td className="p-4">
                      <span className="text-[13px] font-bold text-white block">{deal.name}</span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-full capitalize ${col.bg} ${col.text} border ${col.border}`}>
                        {deal.stage.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-[13px] font-black text-teal-400">${(deal.value || 0).toLocaleString()}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] text-slate-350 font-semibold">{deal.contact_name || '-'}</span>
                        {deal.contact_email && <span className="text-[10px] text-slate-500">{deal.contact_email}</span>}
                      </div>
                    </td>
                    <td className="p-4">
                      {deal.score != null ? (
                        <span className={`text-xs font-black ${scoreColor(deal.score)}`}>
                          ★ {deal.score}/10
                        </span>
                      ) : (
                        <span className="text-slate-550 text-xs">-</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-xs text-slate-500 font-semibold font-mono">{daysInStage(deal.updated_at)} days</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── RENDER STAGES LIST VIEW (Existing Swipe view) ────────────────────────────────
  const renderMobileStageList = () => (
    <div className="flex-grow overflow-y-auto pb-20">
      {STAGES.map(stage => {
        const stageDeals = grouped[stage] || [];
        if (stageDeals.length === 0) return null;
        const col = STAGE_COLORS[stage];
        const total = stageDeals.reduce((s, d) => s + (d.value || 0), 0);
        return (
          <div key={stage}>
            {/* Stage header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/60 border-b border-white/5 sticky top-[57px] sm:top-[73px] z-10">
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
      })}
    </div>
  );

  return (
    <div className="relative flex flex-col h-full bg-slate-950">
      {/* View Switcher Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4 py-3 border-b border-white/5 bg-slate-950/80 sticky top-0 z-20 backdrop-blur-md shrink-0">
        <div>
          <h1 className="text-[15px] font-black text-white">Deals Pipeline</h1>
          <p className="text-[11px] text-slate-500 mt-0.5 font-semibold">
            Total Pipeline: <span className="text-teal-400 font-bold">${totalPipelineValue.toLocaleString()}</span> • {deals.length} deals
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Switcher pills */}
          <div className="flex bg-slate-900/60 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'board'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Board</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'list'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              onClick={() => setViewMode('mobile-stage')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'mobile-stage'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Stages</span>
            </button>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-[11px] font-black rounded-lg transition-all shadow-md shadow-emerald-500/10 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Deal</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="space-y-px">{[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-slate-900/40 animate-pulse" />)}</div>
        ) : (
          <>
            {viewMode === 'board' && renderBoard()}
            {viewMode === 'list' && renderList()}
            {viewMode === 'mobile-stage' && renderMobileStageList()}
          </>
        )}
      </div>

      {/* Create Deal Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <h3 className="text-sm font-bold text-white">Create New Deal</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateDeal} className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Deal Name *</label>
                <input
                  type="text"
                  required
                  value={newDealName}
                  onChange={(e) => setNewDealName(e.target.value)}
                  placeholder="e.g. Acme Enterprise SaaS"
                  className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Value ($) *</label>
                  <input
                    type="number"
                    required
                    value={newDealValue}
                    onChange={(e) => setNewDealValue(e.target.value)}
                    placeholder="e.g. 15000"
                    className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Stage *</label>
                  <select
                    value={newDealStage}
                    onChange={(e) => setNewDealStage(e.target.value as DealStage)}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500/50 capitalize"
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contact Name</label>
                <input
                  type="text"
                  value={newDealContactName}
                  onChange={(e) => setNewDealContactName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500/50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contact Email</label>
                <input
                  type="email"
                  value={newDealContactEmail}
                  onChange={(e) => setNewDealContactEmail(e.target.value)}
                  placeholder="e.g. john@acme.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500/50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description</label>
                <textarea
                  value={newDealDescription}
                  onChange={(e) => setNewDealDescription(e.target.value)}
                  placeholder="Add brief details about the deal..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500/50 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={savingNewDeal}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-emerald-500/10 mt-2"
              >
                {savingNewDeal ? 'Saving...' : 'Create Deal'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DealsTab;
