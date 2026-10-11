'use client';

import { Input as AlphaCloneInput } from '@/components/ui/input';
import { Select as AlphaCloneSelect } from '@/components/ui/select';
import { Textarea as AlphaCloneTextarea } from '@/components/ui/textarea';


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

import { CRM_DEALS_BOARD_DEFINITION } from '@/lib/kanban/boardDefinitions';

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
  next_action?: string;
  next_action_date?: string;
  is_blocked?: boolean;
  blocked_reason?: string;
  class_of_service?: 'expedite' | 'fixed_date' | 'standard' | 'intangible';
  entered_column_at?: string;
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

export const DEFAULT_STAGE_PROBABILITIES: Record<Deal['stage'], number> = {
  lead: 10,
  qualified: 25,
  proposal: 50,
  negotiation: 75,
  closed_won: 100,
  closed_lost: 0,
};

// ── Deal Card Component ────────────────────────────────────────────────────────
const DealCard: React.FC<{
  deal: Deal;
  onEdit: (deal: Deal) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, newStage: Deal['stage']) => void;
}> = ({ deal, onEdit, onDelete, onMove }) => {
  const currentIndex = STAGE_ORDER.indexOf(deal.stage);
  const canMoveForward = currentIndex < STAGE_ORDER.length - 1 && deal.stage !== 'closed_won' && deal.stage !== 'closed_lost';
  const canMoveBack = currentIndex > 0 && deal.stage !== 'closed_won' && deal.stage !== 'closed_lost';
  const isOpenDeal = deal.stage !== 'closed_won' && deal.stage !== 'closed_lost';
  const hasNextAction = Boolean(deal.next_action && deal.next_action.trim());

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`dashboard-panel-soft p-4 space-y-3 transition-colors group ${
        deal.is_blocked ? 'border-rose-500/50 bg-rose-500/5' : 'hover:border-teal-500/30'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="type-ui font-bold text-[var(--ws-text-primary)] truncate">{deal.name}</h4>
            {deal.class_of_service === 'expedite' && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-500/20 text-rose-300 rounded border border-rose-500/30">
                EXPEDITE
              </span>
            )}
            {deal.is_blocked && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-500 text-white rounded">
                BLOCKED
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(deal)}
            className="p-1.5 rounded-lg hover:bg-[var(--ws-surface-tertiary)] text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)] transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(deal.id)}
            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-[var(--ws-text-muted)] hover:text-rose-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 type-caption text-[var(--ws-text-muted)]">
        <DollarSign className="w-3.5 h-3.5 text-teal-400" />
        <span className="font-bold text-[var(--ws-text-primary)]">${deal.value.toLocaleString()}</span>
        <span className="text-slate-600">•</span>
        <Target className="w-3.5 h-3.5 text-purple-400" />
        <span>{deal.probability}%</span>
      </div>

      {deal.is_blocked && deal.blocked_reason && (
        <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-xs">
          <strong>Blocker:</strong> {deal.blocked_reason}
        </div>
      )}

      {isOpenDeal && (
        <div className="text-xs pt-0.5 border-t border-[var(--ws-border)]/50">
          {hasNextAction ? (
            <div className="flex items-center gap-1.5 text-teal-400/90 truncate">
              <Clock className="w-3 h-3 shrink-0" />
              <span className="truncate">{deal.next_action}</span>
              {deal.next_action_date && (
                <span className="text-[var(--ws-text-muted)] shrink-0">
                  ({new Date(deal.next_action_date).toLocaleDateString()})
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-400 font-medium">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>Needs scheduled touch</span>
            </div>
          )}
        </div>
      )}

      {deal.expected_close_date && (
        <div className="flex items-center gap-1.5 type-caption text-[var(--ws-text-muted)]">
          <Calendar className="w-3 h-3" />
          <span>Close: {new Date(deal.expected_close_date).toLocaleDateString()}</span>
        </div>
      )}

      {(deal.contact_name || deal.contact_email) && (
        <div className="type-caption text-[var(--ws-text-muted)] truncate">
          Contact: <span className="text-[var(--ws-text-secondary)] font-medium">{deal.contact_name || deal.contact_email}</span>
        </div>
      )}

      <div className="flex items-center gap-1 pt-1">
        {canMoveBack && (
          <button
            onClick={() => onMove(deal.id, STAGE_ORDER[currentIndex - 1])}
            className="flex-1 py-1.5 type-ui font-bold text-[var(--ws-text-muted)] bg-[var(--ws-surface-secondary)] rounded-lg hover:bg-[var(--ws-surface-tertiary)] transition-colors"
          >
            ← Back
          </button>
        )}
        {canMoveForward && (
          <button
            onClick={() => onMove(deal.id, STAGE_ORDER[currentIndex + 1])}
            className="flex-1 py-1.5 type-ui font-bold text-teal-400 bg-teal-500/10 rounded-lg hover:bg-teal-500/20 transition-colors"
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
        <div className="p-4 border-b border-[var(--ws-border)] flex items-center justify-between">
          <h3 className="type-ui font-bold text-[var(--ws-text-primary)]">
            {initialDeal ? 'Edit Deal' : 'Create Deal'}
          </h3>
          <button onClick={onClose} className="p-1 rounded bg-[var(--ws-surface-secondary)] text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-1">
            <label className="block type-caption font-bold text-[var(--ws-text-muted)] uppercase tracking-wider">Deal Name *</label>
            <AlphaCloneInput
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Acme Corp - Q4 Contract"
              className="w-full px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block type-caption font-bold text-[var(--ws-text-muted)] uppercase tracking-wider">Value ($)</label>
              <AlphaCloneInput
                type="number"
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="25000"
                className="w-full px-3 py-2"
              />
            </div>
            <div className="space-y-1">
              <label className="block type-caption font-bold text-[var(--ws-text-muted)] uppercase tracking-wider">Probability (%)</label>
              <AlphaCloneInput
                type="number"
                min="0"
                max="100"
                value={probability}
                onChange={e => setProbability(e.target.value)}
                placeholder="50"
                className="w-full px-3 py-2"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block type-caption font-bold text-[var(--ws-text-muted)] uppercase tracking-wider">Stage</label>
            <AlphaCloneSelect
              value={stage}
              onChange={e => {
                const nextStage = e.target.value as Deal['stage'];
                setStage(nextStage);
                setProbability(String(DEFAULT_STAGE_PROBABILITIES[nextStage] ?? 50));
              }}
              className="w-full px-3 py-2"
            >
              {STAGES.map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </AlphaCloneSelect>
          </div>

          <div className="space-y-1">
            <label className="block type-caption font-bold text-[var(--ws-text-muted)] uppercase tracking-wider">Expected Close Date</label>
            <AlphaCloneInput
              type="date"
              value={expectedCloseDate}
              onChange={e => setExpectedCloseDate(e.target.value)}
              className="w-full px-3 py-2"
            />
          </div>

          <div className="space-y-1">
            <label className="block type-caption font-bold text-[var(--ws-text-muted)] uppercase tracking-wider">Contact Name</label>
            <AlphaCloneInput
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              placeholder="e.g. John Smith"
              className="w-full px-3 py-2"
            />
          </div>

          <div className="space-y-1">
            <label className="block type-caption font-bold text-[var(--ws-text-muted)] uppercase tracking-wider">Contact Email</label>
            <AlphaCloneInput
              type="email"
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              placeholder="john@acme.com"
              className="w-full px-3 py-2"
            />
          </div>

          <div className="space-y-1">
            <label className="block type-caption font-bold text-[var(--ws-text-muted)] uppercase tracking-wider">Notes</label>
            <AlphaCloneTextarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any additional context..."
              rows={3}
              className="w-full px-3 py-2 resize-none"
            />
          </div>
        </div>

        <div className="p-4 border-t border-[var(--ws-border)] bg-[var(--ws-canvas)]/40 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 type-caption font-bold text-[var(--ws-text-muted)] bg-[var(--ws-surface-secondary)] rounded-xl hover:bg-[var(--ws-surface-tertiary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 type-caption font-bold text-[var(--text-inverse)] bg-teal-500 rounded-xl hover:bg-[var(--brand-blue-400)] transition-colors shadow-lg shadow-teal-500/10"
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
      const response = await fetch(`/api/tenant/${encodeURIComponent(tenantId)}/deals`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: dealData.name, value: dealData.value || 0, stage: dealData.stage || 'lead', probability: dealData.probability || 10, expectedCloseDate: dealData.expected_close_date, contactName: dealData.contact_name, contactEmail: dealData.contact_email, notes: dealData.notes }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to create deal');
      const data = payload.deal;

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
      const response = await fetch(`/api/tenant/${encodeURIComponent(tenantId)}/deals`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingDeal.id, name: dealData.name, value: dealData.value, stage: dealData.stage, probability: dealData.probability, expectedCloseDate: dealData.expected_close_date, contactName: dealData.contact_name, contactEmail: dealData.contact_email, notes: dealData.notes }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to update deal');

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
      const response = await fetch(`/api/tenant/${encodeURIComponent(tenantId)}/deals`, { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [id] }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to delete deal');

      setDeals(prev => prev.filter(d => d.id !== id));
      toast.success('Deal deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete deal');
    }
  };

  const handleMoveDeal = async (id: string, newStage: Deal['stage']) => {
    let lossReason: string | undefined;
    if (newStage === 'closed_lost') {
      const reasonInput = window.prompt('Enter mandatory reason for marking this deal as Closed Lost:');
      if (!reasonInput || !reasonInput.trim()) {
        toast.error('A reason is mandatory for marking a deal as Lost.');
        return;
      }
      lossReason = reasonInput.trim();
    }

    const currentDeal = deals.find(d => d.id === id);
    if (!currentDeal) return;

    const newProbability = DEFAULT_STAGE_PROBABILITIES[newStage] ?? 50;
    // Optimistic update
    setDeals(prev =>
      prev.map(d =>
        d.id === id ? { ...d, stage: newStage, probability: newProbability, updated_at: new Date().toISOString() } : d
      )
    );

    try {
      const response = await fetch(`/api/tenant/${encodeURIComponent(tenantId)}/kanban/transitions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardType: 'crm_deals',
          cardId: id,
          targetState: newStage,
          reason: lossReason,
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to move deal');
      }
      toast.success(`Moved to ${newStage.replace('_', ' ')}`);
    } catch (err: any) {
      // Revert on failure
      loadDeals();
      toast.error(err.message || 'Failed to move deal');
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
          <h2 className="text-lg font-bold text-[var(--ws-text-primary)]">Deal Pipeline</h2>
          <p className="type-card-description text-[var(--ws-text-muted)]">
            {filteredDeals.length} deals · ${totalPipelineValue.toLocaleString()} total value
          </p>
        </div>
        <button
          onClick={() => {
            setEditingDeal(null);
            setIsFormOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-slate-950 rounded-xl type-caption font-bold hover:bg-[var(--brand-blue-400)] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Deal
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <AlphaCloneInput
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search deals..."
          className="w-full px-4 py-2.5"
        />
      </div>

      {/* Pipeline Columns */}
      {loading ? (
        <div className="flex xl:grid xl:grid-cols-6 gap-3 overflow-x-auto pb-20 [scrollbar-width:thin]">
          {STAGES.map(stage => (
            <div key={stage.key} className="w-[240px] xl:w-auto shrink-0 space-y-2">
              <div className="h-8 bg-[var(--ws-surface-secondary)]/50 rounded-lg animate-pulse" />
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-[var(--ws-surface-secondary)]/30 rounded-xl animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex xl:grid xl:grid-cols-6 gap-3 overflow-x-auto pb-20 [scrollbar-width:thin]">
          {groupedDeals.map(stage => {
            const columnDef = CRM_DEALS_BOARD_DEFINITION.columns.find(c => c.id === stage.key);
            const wipLimit = columnDef?.wipLimit;
            const isOverWip = wipLimit ? stage.deals.length >= wipLimit : false;
            return (
              <div key={stage.key} className="w-[240px] xl:w-auto xl:min-w-0 shrink-0 space-y-2">
                {/* Stage Header */}
                <div className={`px-3 py-2 rounded-lg type-caption font-bold ${stage.color} ${isOverWip ? 'ring-2 ring-amber-500/50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span>{stage.label}</span>
                    <span className={`text-[var(--ws-text-muted)] ${isOverWip ? 'text-amber-400 font-extrabold' : ''}`}>
                      {stage.deals.length}{wipLimit ? ` / ${wipLimit}` : ''}
                    </span>
                  </div>
                  {stage.deals.length > 0 && (
                    <div className="type-ui text-[var(--ws-text-muted)] mt-1">
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
                <div className="text-center py-8 text-slate-600 type-caption border border-dashed border-[var(--ws-border)]/50 rounded-xl">
                  No deals
                </div>
              )}
            </div>
            );
          })}
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
