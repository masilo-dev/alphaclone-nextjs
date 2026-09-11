'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, X, Loader2, TrendingUp, DollarSign, Calendar, 
  Target, AlertCircle, CheckCircle2, Clock, ArrowRight,
  Edit3, Trash2, GripVertical
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { dealService } from '@/services/dealService';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'react-hot-toast';
import { Button, Input, Modal } from '../../ui/UIComponents';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface Deal {
  id: string;
  tenant_id: string;
  name: string;
  value: number;
  stage: 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  probability: number;
  expected_close_date?: string;
  contact_name?: string;
  contact_email?: string;
  contact_id?: string;
  notes?: string;
  score?: number;
  created_at: string;
  updated_at: string;
}

interface DealPipelineProps {
  tenantId: string;
  onDealCreated?: () => void;
}

// ── Stage Configuration ────────────────────────────────────────────────────────
const STAGES: { key: Deal['stage']; label: string; color: string }[] = [
  { key: 'lead', label: 'Lead', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { key: 'qualified', label: 'Qualified', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  { key: 'proposal', label: 'Proposal', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  { key: 'negotiation', label: 'Negotiation', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { key: 'closed_won', label: 'Closed Won', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { key: 'closed_lost', label: 'Closed Lost', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
];

const STAGE_ORDER: Deal['stage'][] = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

// ── Deal Card Component ────────────────────────────────────────────────────────
const DealCard: React.FC<{
  deal: Deal;
  onEdit: (deal: Deal) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, newStage: Deal['stage']) => void;
}> = ({ deal, onEdit, onDelete, onMove }) => {
  const currentIndex = STAGE_ORDER.indexOf(deal.stage);
  const canMoveForward = currentIndex < STAGE_ORDER.length - 1;
  const canMoveBack = currentIndex > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="dashboard-panel-soft p-4 space-y-3 hover:border-teal-500/30 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-bold text-white truncate flex-1">{deal.name}</h4>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(deal)}
            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(deal.id)}
            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <DollarSign className="w-3.5 h-3.5 text-teal-400" />
        <span className="font-bold text-white">${deal.value.toLocaleString()}</span>
        <span className="text-slate-600">•</span>
        <Target className="w-3.5 h-3.5 text-purple-400" />
        <span>{deal.probability}%</span>
      </div>

      {deal.expected_close_date && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Calendar className="w-3 h-3" />
          <span>Close: {new Date(deal.expected_close_date).toLocaleDateString()}</span>
        </div>
      )}

      {deal.contact_name && (
        <div className="text-xs text-slate-500 truncate">
          Contact: {deal.contact_name}
        </div>
      )}

      <div className="flex items-center gap-1 pt-1">
        {canMoveBack && (
          <button
            onClick={() => onMove(deal.id, STAGE_ORDER[currentIndex - 1])}
            className="flex-1 py-1.5 text-[10px] font-bold text-slate-400 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
          >
            ← Back
          </button>
        )}
        {canMoveForward && (
          <button
            onClick={() => onMove(deal.id, STAGE_ORDER[currentIndex + 1])}
            className="flex-1 py-1.5 text-[10px] font-bold text-teal-400 bg-teal-500/10 rounded-lg hover:bg-teal-500/20 transition-colors"
          >
            Forward →
          </button>
        )}
      </div>
    </motion.div>
  );
};

// ── Create/Edit Deal Modal ─────────────────────────────────────────────────────
interface DealFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (deal: Partial<Deal>) => void;
  initialDeal?: Deal | null;
}

const DealFormModal: React.FC<DealFormModalProps> = ({ isOpen, onClose, onSave, initialDeal }) => {
  const [name, setName] = useState(initialDeal?.name || '');
  const [value, setValue] = useState(String(initialDeal?.value || ''));
  const [stage, setStage] = useState<Deal['stage']>(initialDeal?.stage || 'lead');
  const [probability, setProbability] = useState(String(initialDeal?.probability || '10'));
  const [expectedCloseDate, setExpectedCloseDate] = useState(
    initialDeal?.expected_close_date?.split('T')[0] || ''
  );
  const [contactName, setContactName] = useState(initialDeal?.contact_name || '');
  const [contactEmail, setContactEmail] = useState(initialDeal?.contact_email || '');
  const [notes, setNotes] = useState(initialDeal?.notes || '');

  useEffect(() => {
    if (initialDeal) {
      setName(initialDeal.name);
      setValue(String(initialDeal.value));
      setStage(initialDeal.stage);
      setProbability(String(initialDeal.probability));
      setExpectedCloseDate(initialDeal.expected_close_date?.split('T')[0] || '');
      setContactName(initialDeal.contact_name || '');
      setContactEmail(initialDeal.contact_email || '');
      setNotes(initialDeal.notes || '');
    }
  }, [initialDeal]);

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Deal name is required');
      return;
    }
    onSave({
      name: name.trim(),
      value: parseFloat(value) || 0,
      stage,
      probability: parseInt(probability) || 0,
      expected_close_date: expectedCloseDate || undefined,
      contact_name: contactName || undefined,
      contact_email: contactEmail || undefined,
      notes: notes || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="dashboard-panel w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">
            {initialDeal ? 'Edit Deal' : 'Create Deal'}
          </h3>
          <button onClick={onClose} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Deal Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Acme Corp - Q4 Contract"
              className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Value ($)</label>
              <input
                type="number"
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="25000"
                className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Probability (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={probability}
                onChange={e => setProbability(e.target.value)}
                placeholder="50"
                className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Stage</label>
            <select
              value={stage}
              onChange={e => setStage(e.target.value as Deal['stage'])}
              className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-teal-500/50"
            >
              {STAGES.map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Expected Close Date</label>
            <input
              type="date"
              value={expectedCloseDate}
              onChange={e => setExpectedCloseDate(e.target.value)}
              className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contact Name</label>
            <input
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              placeholder="e.g. John Smith"
              className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contact Email</label>
            <input
              type="email"
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              placeholder="john@acme.com"
              className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any additional context..."
              rows={3}
              className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50 resize-none"
            />
          </div>
        </div>

        <div className="p-4 border-t border-white/5 bg-slate-950/40 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-xs font-bold text-slate-400 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 text-xs font-bold text-white bg-teal-500 rounded-xl hover:bg-teal-400 transition-colors shadow-lg shadow-teal-500/10"
          >
            {initialDeal ? 'Update Deal' : 'Create Deal'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Pipeline Component ────────────────────────────────────────────────────
export const DealPipeline: React.FC<DealPipelineProps> = ({ tenantId, onDealCreated }) => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadDeals = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDeals(data || []);
    } catch (err: any) {
      console.error('Failed to load deals:', err);
      toast.error('Failed to load deals');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadDeals();
  }, [loadDeals]);

  const handleCreateDeal = async (dealData: Partial<Deal>) => {
    try {
      const { data, error } = await supabase
        .from('deals')
        .insert({
          tenant_id: tenantId,
          name: dealData.name,
          value: dealData.value || 0,
          stage: dealData.stage || 'lead',
          probability: dealData.probability || 10,
          expected_close_date: dealData.expected_close_date,
          contact_name: dealData.contact_name,
          contact_email: dealData.contact_email,
          notes: dealData.notes,
          score: dealData.probability || 10,
        })
        .select()
        .single();

      if (error) throw error;

      setDeals(prev => [data, ...prev]);
      setIsFormOpen(false);
      toast.success('Deal created successfully');
      onDealCreated?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create deal');
    }
  };

  const handleUpdateDeal = async (dealData: Partial<Deal>) => {
    if (!editingDeal) return;

    try {
      const { error } = await supabase
        .from('deals')
        .update({
          name: dealData.name,
          value: dealData.value,
          stage: dealData.stage,
          probability: dealData.probability,
          expected_close_date: dealData.expected_close_date,
          contact_name: dealData.contact_name,
          contact_email: dealData.contact_email,
          notes: dealData.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingDeal.id);

      if (error) throw error;

      setDeals(prev =>
        prev.map(d =>
          d.id === editingDeal.id
            ? { ...d, ...dealData, updated_at: new Date().toISOString() }
            : d
        )
      );
      setEditingDeal(null);
      setIsFormOpen(false);
      toast.success('Deal updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update deal');
    }
  };

  const handleDeleteDeal = async (id: string) => {
    try {
      const { success, error } = await dealService.deleteDeal(id);
      if (!success || error) throw new Error(error || 'Failed to delete deal');

      setDeals(prev => prev.filter(d => d.id !== id));
      toast.success('Deal deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete deal');
    }
  };

  const handleMoveDeal = async (id: string, newStage: Deal['stage']) => {
    // Optimistic update
    setDeals(prev =>
      prev.map(d =>
        d.id === id ? { ...d, stage: newStage, updated_at: new Date().toISOString() } : d
      )
    );

    try {
      const { error } = await supabase
        .from('deals')
        .update({ stage: newStage, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    } catch (err: any) {
      // Revert on failure
      loadDeals();
      toast.error('Failed to move deal');
    }
  };

  const filteredDeals = deals.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.contact_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.contact_email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group deals by stage
  const groupedDeals = STAGES.map(stage => ({
    ...stage,
    deals: filteredDeals.filter(d => d.stage === stage.key),
    totalValue: filteredDeals
      .filter(d => d.stage === stage.key)
      .reduce((sum, d) => sum + d.value, 0),
  }));

  const totalPipelineValue = filteredDeals.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Deal Pipeline</h2>
          <p className="text-xs text-slate-400">
            {filteredDeals.length} deals · ${totalPipelineValue.toLocaleString()} total value
          </p>
        </div>
        <button
          onClick={() => {
            setEditingDeal(null);
            setIsFormOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-slate-950 rounded-xl text-xs font-bold hover:bg-teal-400 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Deal
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search deals..."
          className="w-full bg-slate-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50"
        />
      </div>

      {/* Pipeline Columns */}
      {loading ? (
        <div className="grid grid-cols-6 gap-3">
          {STAGES.map(stage => (
            <div key={stage.key} className="space-y-2">
              <div className="h-8 bg-slate-800/50 rounded-lg animate-pulse" />
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-slate-800/30 rounded-xl animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-6 gap-3 overflow-x-auto pb-4">
          {groupedDeals.map(stage => (
            <div key={stage.key} className="min-w-[200px] space-y-2">
              {/* Stage Header */}
              <div className={`px-3 py-2 rounded-lg text-xs font-bold ${stage.color}`}>
                <div className="flex items-center justify-between">
                  <span>{stage.label}</span>
                  <span className="text-slate-500">{stage.deals.length}</span>
                </div>
                {stage.deals.length > 0 && (
                  <div className="text-[10px] text-slate-400 mt-1">
                    ${stage.totalValue.toLocaleString()}
                  </div>
                )}
              </div>

              {/* Deal Cards */}
              <AnimatePresence>
                {stage.deals.map(deal => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    onEdit={(d) => {
                      setEditingDeal(d);
                      setIsFormOpen(true);
                    }}
                    onDelete={handleDeleteDeal}
                    onMove={handleMoveDeal}
                  />
                ))}
              </AnimatePresence>

              {stage.deals.length === 0 && (
                <div className="text-center py-8 text-slate-600 text-xs border border-dashed border-slate-700/50 rounded-xl">
                  No deals
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <DealFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingDeal(null);
        }}
        onSave={editingDeal ? handleUpdateDeal : handleCreateDeal}
        initialDeal={editingDeal}
      />
    </div>
  );
};
