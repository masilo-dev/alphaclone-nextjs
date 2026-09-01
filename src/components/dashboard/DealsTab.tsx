'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  ChevronRight, ArrowLeft, Plus, TrendingUp, Clock,
  User, Mail, Phone, FileText, CheckSquare, ArrowRight,
  LayoutGrid, List, Smartphone, Search, ArrowUpDown, Filter, Trash2, Square
} from 'lucide-react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';
import { User as UserType } from '../../types';
import { dealService, DealProduct } from '../../services/dealService';
import { businessInvoiceService } from '../../services/businessInvoiceService';
import { ModuleStatCards, type ModuleStat } from './common/ModuleStatCards';
import toast from 'react-hot-toast';
import { CommunicationModal } from './crm/CommunicationModal';
import type { EmailRecipient } from './crm/emailRecipient';
import { RevenueLeakagePanel } from './crm/RevenueLeakagePanel';
import { DealRevenueTimeline } from './deals/DealRevenueTimeline';
import EmptyState, { EmptyStateFromPreset } from '../ui/EmptyState';
import { DetailDrawer } from '../ui/DetailDrawer';
import { ModulePageLayout } from '../ui/ModulePageLayout';
import { Input } from '../ui/UIComponents';
import { RecordHeader, AskBonnieButton } from '@/components/ui/os';
import { StandardStatusBadge, resolveStatusVariant } from '@/components/ui/design-system';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { resolveDealStagePrimaryAction } from '@/lib/behavioral/dealStagePrimaryAction';
import {
  getDealStageProgress,
  getForwardStageTarget,
  PIPELINE_FORWARD_ONLY_HINT,
  assertDealStageTransition,
} from '@/lib/stageProgression';
import { ACTIVE_DEAL_STAGES, isActiveDealStage } from '@/lib/crmPipelineStages';
import { showDealStageNextSteps } from '@/lib/dealStageActions';
import { showActionNextSteps, showInvoiceCreatedWithSendPrompt } from '@/components/common/showActionNextSteps';
import { CRMNav } from './crm/CRMNav';
import { CrmSyncToolbar } from './crm/CrmSyncToolbar';
import { OperationalWorkflowStrip } from './OperationalWorkflowStrip';
import { buildMailComposeUrl } from '@/lib/email/composeNavigation';
import { UniversalModuleExecutionHeader } from './common/UniversalModuleExecutionHeader';
import type { UniversalNextActionState, ModuleExecutionQuestions } from '@/types/moduleExecution';
import { ExecutionDecisionGuide } from '@/components/dashboard/ExecutionDecisionGuide';
import { DEALS_EXECUTION_STEPS } from '@/lib/ui/dashboardExecutionSteps';

type DealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';

const STAGES: DealStage[] = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
const BOARD_STAGES = ACTIVE_DEAL_STAGES;
const COLUMN_WIP_LIMIT = 8;
const STALL_DAYS = 7;

const probabilityAccent = (probability?: number) => {
  const p = probability ?? 0;
  if (p >= 70) return 'border-l-emerald-500';
  if (p >= 20) return 'border-l-yellow-500';
  return 'border-l-red-500';
};

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
  contact_id?: string | null;
  contact_name?: string;
  contact_email?: string;
  score?: number;
  probability?: number;
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
  onMarkLost: (id: string) => void;
  onTap: (deal: Deal) => void;
}> = ({ deal, onAdvance, onMarkLost, onTap }) => {
  const x = useMotionValue(0);
  const leftOp  = useTransform(x, [0, 80],  [0, 1]);
  const rightOp = useTransform(x, [-80, 0], [1, 0]);
  const progress = getDealStageProgress(deal.stage);
  const nextStage = getForwardStageTarget(deal.stage);
  const canAdvance = nextStage != null;
  const canMarkLost = deal.stage !== 'closed_won' && deal.stage !== 'closed_lost';
  const col = STAGE_COLORS[deal.stage];

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 80 && canAdvance) { onAdvance(deal.id); }
    else if (info.offset.x < -80 && canMarkLost) { onMarkLost(deal.id); }
    x.set(0);
  };

  return (
    <div className="relative overflow-hidden">
      <motion.div style={{ opacity: leftOp }} className="absolute inset-y-0 left-0 w-24 bg-emerald-500/80 flex flex-col items-center justify-center z-0 gap-1">
        <ArrowRight className="w-5 h-5 text-white" />
        <span className="text-[10px] text-white font-bold capitalize">{nextStage?.replace('_', ' ')}</span>
      </motion.div>
      <motion.div style={{ opacity: rightOp }} className="absolute inset-y-0 right-0 w-24 bg-red-500/80 flex flex-col items-center justify-center z-0 gap-1">
        <ArrowLeft className="w-5 h-5 text-white" />
        <span className="text-[10px] text-white font-bold">Lost</span>
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
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-[var(--brand-blue-500)] rounded-full" style={{ width: `${progress.percent}%` }} />
            </div>
            <span className="text-[10px] font-bold text-slate-500 tabular-nums shrink-0">
              {progress.step}/{progress.total} · {progress.percent}%
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-[15px] font-bold text-[var(--brand-blue-400)]">${(deal.value || 0).toLocaleString()}</span>
          <span className="text-[11px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full">{daysInStage(deal.updated_at)}d</span>
        </div>
      </motion.div>
    </div>
  );
};

// ── Deal Detail ────────────────────────────────────────────────────────────────
const DealDetail: React.FC<{
  deal: Deal;
  user: UserType;
  onBack: () => void;
  onStageChange: (id: string, stage: DealStage) => void;
  onComposeEmail?: (recipient: EmailRecipient, subject: string) => void;
  onNavigate?: (path: string) => void;
  inDrawer?: boolean;
}> = ({ deal, user, onBack, onStageChange, onComposeEmail, onNavigate, inDrawer }) => {
  const router = useRouter();
  const col = STAGE_COLORS[deal.stage];
  const progress = getDealStageProgress(deal.stage);
  const nextStage = getForwardStageTarget(deal.stage);
  const stagePrimary = resolveDealStagePrimaryAction(deal.stage);

  const handleStagePrimary = () => {
    if (stagePrimary.href) {
      navigate(stagePrimary.href);
      return;
    }
    if (stagePrimary.advanceStage && nextStage) {
      onStageChange(deal.id, nextStage);
    }
  };

  const [products, setProducts] = useState<DealProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ productName: '', quantity: '1', unitPrice: '' });
  const [logging, setLogging] = useState(false);
  const [activityNote, setActivityNote] = useState('');
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  const navigate = useCallback(
    (path: string) => {
      if (onNavigate) onNavigate(path);
      else router.push(path);
    },
    [onNavigate, router],
  );

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    const { products: rows } = await dealService.getDealProducts(deal.id);
    setProducts(rows);
    setProductsLoading(false);
  }, [deal.id]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const productsTotal = products.reduce((s, p) => s + (p.total || 0), 0);

  const resolveClientIdForInvoice = useCallback(async (): Promise<string | undefined> => {
    if (!deal.contact_id || !deal.tenant_id) return undefined;
    const { data } = await supabase
      .from('business_clients')
      .select('id')
      .eq('tenant_id', deal.tenant_id)
      .eq('crm_contact_id', deal.contact_id)
      .maybeSingle();
    return data?.id as string | undefined;
  }, [deal.contact_id, deal.tenant_id]);

  const handleAddProduct = async () => {
    const qty = parseFloat(newProduct.quantity) || 0;
    const price = parseFloat(newProduct.unitPrice) || 0;
    if (!newProduct.productName.trim() || qty <= 0) {
      toast.error('Enter a product name and quantity');
      return;
    }
    const { error } = await dealService.addDealProduct(deal.id, {
      productName: newProduct.productName.trim(),
      quantity: qty,
      unitPrice: price,
    });
    if (error) { toast.error('Could not add product'); return; }
    toast.success('Product added');
    setNewProduct({ productName: '', quantity: '1', unitPrice: '' });
    setShowAddProduct(false);
    loadProducts();
  };

  const handleDeleteProduct = async (id: string) => {
    const { error } = await dealService.deleteDealProduct(deal.id, id);
    if (error) { toast.error('Could not remove product'); return; }
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const handleLogActivity = async () => {
    if (!activityNote.trim()) { toast.error('Write a note first'); return; }
    const { error } = await dealService.addDealActivity(deal.id, user.id, 'note', activityNote.trim());
    if (error) { toast.error('Could not log activity'); return; }
    toast.success('Activity logged');
    setActivityNote('');
    setLogging(false);
  };

  const handleCreateInvoice = async () => {
    if (!deal.tenant_id) { toast.error('Missing workspace'); return; }
    setCreatingInvoice(true);
    try {
      const lineItems = products.length > 0
        ? products.map(p => ({ description: p.productName, quantity: p.quantity, rate: p.unitPrice, amount: p.total }))
        : [{ description: deal.name, quantity: 1, rate: deal.value || 0, amount: deal.value || 0 }];
      const subtotal = lineItems.reduce((s, li) => s + (li.amount || 0), 0);
      const clientId = await resolveClientIdForInvoice();
      const { invoice, error } = await businessInvoiceService.createInvoice(deal.tenant_id, {
        status: 'draft',
        issueDate: new Date().toISOString().split('T')[0],
        lineItems,
        subtotal,
        total: subtotal,
        notes: `Generated from deal: ${deal.name}`,
        ...(clientId ? { clientId } : {}),
      });
      if (error) {
        toast.error(error);
        return;
      }
      const billingPath = invoice?.id
        ? `/dashboard/business/billing/manage?invoiceId=${encodeURIComponent(invoice.id)}`
        : '/dashboard/business/billing/manage';
      navigate(billingPath);
      showInvoiceCreatedWithSendPrompt(navigate);
      showActionNextSteps('invoice_created', navigate);
    } finally {
      setCreatingInvoice(false);
    }
  };

  return (
    <div className={inDrawer ? 'space-y-4 pb-6' : 'flex flex-col h-full'}>
      {!inDrawer && (
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--ws-border)]">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-[var(--ws-surface-tertiary)] flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-[var(--ws-text-secondary)]" />
        </button>
        <span className="text-[15px] font-semibold text-[var(--ws-text-primary)] flex-1">Pipeline record</span>
      </div>
      )}

      <div className={inDrawer ? 'space-y-4' : 'flex-1 overflow-y-auto p-4 space-y-4 pb-28'}>
        <RecordHeader
          moduleId="pipeline"
          title={deal.name}
          subtitle={deal.contact_name || undefined}
          status={
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize ${col.bg} ${col.text} ${col.border}`}>
              {deal.stage.replace(/_/g, ' ')}
            </span>
          }
          meta={
            <>
              <span className="tabular-nums font-semibold text-[var(--ws-text-primary)]">
                ${(deal.value || 0).toLocaleString()}
              </span>
              <span>Step {progress.step} of {progress.total}</span>
            </>
          }
          actions={
            <AskBonnieButton
              compact
              mode="analyse"
              contexts={[
                { type: 'Deal', id: deal.id, label: deal.name },
                ...(deal.contact_name
                  ? [{ type: 'Contact', label: deal.contact_name }]
                  : []),
              ]}
            />
          }
        />

        {/* Value hero */}
        <div className="flex flex-col items-center py-4 gap-2">
          <span className="text-[28px] font-bold text-[var(--ws-text-primary)] tabular-nums">${(deal.value || 0).toLocaleString()}</span>
          <div className="w-full max-w-xs px-2">
            <div className="flex justify-between text-[10px] text-[var(--ws-text-muted)] font-semibold uppercase tracking-wide mb-1">
              <span>Pipeline step {progress.step} of {progress.total}</span>
              <span>{progress.percent}%</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--ws-surface-tertiary)] overflow-hidden">
              <div className="h-full bg-[#E69222] rounded-full transition-all" style={{ width: `${progress.percent}%` }} />
            </div>
          </div>
          <button
            type="button"
            onClick={handleStagePrimary}
            className="px-5 py-2 rounded-full text-[13px] font-bold bg-teal-500/20 border border-teal-500/40 text-teal-100 hover:bg-teal-500/30 transition-colors"
          >
            {stagePrimary.label}
          </button>
          {nextStage && stagePrimary.advanceStage ? (
            <button
              type="button"
              onClick={() => onStageChange(deal.id, nextStage)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold border capitalize ${col.bg} ${col.text} ${col.border} opacity-80`}
            >
              Or move to {nextStage.replace('_', ' ')}
            </button>
          ) : null}
          {deal.stage !== 'closed_won' && deal.stage !== 'closed_lost' && (
            <button
              onClick={() => onStageChange(deal.id, 'closed_lost')}
              className="text-[11px] font-semibold text-red-400/80 hover:text-red-400"
            >
              Close as lost
            </button>
          )}
          {deal.score != null && (
            <span className={`text-[20px] font-black ${scoreColor(deal.score)}`}>Score: {deal.score}/10</span>
          )}
        </div>

        <DealRevenueTimeline dealId={deal.id} dealStage={deal.stage} />

        {/* Contact */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl divide-y divide-white/5">
          {deal.contact_name && <div className="flex items-center gap-3 p-4"><User className="w-5 h-5 text-slate-500" /><span className="text-[15px] text-slate-300">{deal.contact_name}</span></div>}
          {deal.contact_email && (
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3 min-w-0">
                <Mail className="w-5 h-5 text-slate-500 shrink-0" />
                <span className="text-[15px] text-slate-300 truncate">{deal.contact_email}</span>
              </div>
              {onComposeEmail && (
                <button
                  type="button"
                  onClick={() => onComposeEmail(
                    { name: deal.contact_name || deal.name, email: deal.contact_email! },
                    `Re: ${deal.name}`
                  )}
                  className="shrink-0 text-xs font-bold text-[var(--brand-blue-400)] hover:text-[var(--brand-blue-300)]"
                >
                  Follow up
                </button>
              )}
            </div>
          )}
        </div>

        {deal.description && (
          <div className="bg-slate-900 border border-white/5 rounded-2xl p-4">
            <p className="text-[15px] text-slate-300 leading-relaxed">{deal.description}</p>
          </div>
        )}

        {/* Line items */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-black uppercase tracking-wider text-slate-400">Products / Line Items</span>
            <button onClick={() => setShowAddProduct(v => !v)} className="text-[12px] font-bold text-emerald-400 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          {productsLoading ? (
            <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-9 bg-slate-800/50 rounded animate-pulse" />)}</div>
          ) : products.length === 0 ? (
            <p className="text-[13px] text-slate-500">No products added yet.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {products.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] text-slate-200 font-medium truncate">{p.productName}</p>
                    <p className="text-[12px] text-slate-500">{p.quantity} × ${p.unitPrice.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[14px] font-bold text-[var(--brand-blue-400)]">${(p.total || 0).toLocaleString()}</span>
                    <button onClick={() => handleDeleteProduct(p.id)} className="text-slate-600 hover:text-red-400 text-[12px]">Remove</button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2.5">
                <span className="text-[13px] font-bold text-slate-300">Total</span>
                <span className="text-[15px] font-black text-[var(--brand-blue-400)]">${productsTotal.toLocaleString()}</span>
              </div>
            </div>
          )}

          {showAddProduct && (
            <div className="space-y-2 pt-2 border-t border-white/5">
              <input
                value={newProduct.productName}
                onChange={e => setNewProduct(p => ({ ...p, productName: e.target.value }))}
                placeholder="Product / service name"
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-emerald-500"
              />
              <div className="flex gap-2">
                <input
                  value={newProduct.quantity}
                  onChange={e => setNewProduct(p => ({ ...p, quantity: e.target.value }))}
                  placeholder="Qty"
                  type="number"
                  className="w-20 bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-emerald-500"
                />
                <input
                  value={newProduct.unitPrice}
                  onChange={e => setNewProduct(p => ({ ...p, unitPrice: e.target.value }))}
                  placeholder="Unit price"
                  type="number"
                  className="flex-1 bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button onClick={handleAddProduct} className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-[13px] font-bold text-white">Add product</button>
            </div>
          )}
        </div>

        {/* Log activity */}
        {logging && (
          <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 space-y-2">
            <textarea
              value={activityNote}
              onChange={e => setActivityNote(e.target.value)}
              placeholder="Log a call, email, or note…"
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-[var(--brand-blue-500)] resize-none h-20"
            />
            <button onClick={handleLogActivity} className="w-full py-2 bg-[var(--brand-blue-500)] hover:bg-[var(--brand-blue-600)] rounded-lg text-[13px] font-bold text-white">Save activity</button>
          </div>
        )}
      </div>

      {inDrawer ? (
        <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate(deal.contact_id ? `/dashboard/crm/unified-contacts?contactId=${encodeURIComponent(deal.contact_id)}` : '/dashboard/crm/unified-contacts')}
              className="min-h-11 px-3 text-[13px] text-slate-300 font-bold rounded-xl border border-white/10 hover:bg-white/5"
            >
              Open customer
            </button>
            <button
              type="button"
              onClick={() => navigate(`/dashboard/business/quotes?dealId=${encodeURIComponent(deal.id)}`)}
              className="min-h-11 px-3 text-[13px] text-slate-300 font-bold rounded-xl border border-white/10 hover:bg-white/5"
            >
              Create quote
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/business/calendar')}
              className="min-h-11 px-3 text-[13px] text-slate-300 font-bold rounded-xl border border-white/10 hover:bg-white/5"
            >
              Schedule follow-up
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setLogging(v => !v)} className="flex-1 min-h-11 py-2.5 text-[13px] text-slate-400 font-bold rounded-xl border border-white/10 hover:bg-white/5">Log Activity</button>
            <button onClick={handleCreateInvoice} disabled={creatingInvoice} className="flex-1 min-h-11 py-2.5 text-[13px] text-emerald-400 font-bold rounded-xl border border-emerald-500/20 hover:bg-emerald-500/10 disabled:opacity-50">
              {creatingInvoice ? 'Creating…' : 'Create Invoice'}
            </button>
          </div>
        </div>
      ) : (
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 border-t border-white/5 flex flex-col pb-[env(safe-area-inset-bottom,0px)] z-20">
        <div className="flex divide-x divide-white/5 overflow-x-auto">
          <button type="button" onClick={() => navigate(deal.contact_id ? `/dashboard/crm/unified-contacts?contactId=${encodeURIComponent(deal.contact_id)}` : '/dashboard/crm/unified-contacts')} className="flex-1 min-w-[5.5rem] py-2.5 text-[11px] text-slate-400 font-bold hover:bg-white/5">Customer</button>
          <button type="button" onClick={() => navigate(`/dashboard/business/quotes?dealId=${encodeURIComponent(deal.id)}`)} className="flex-1 min-w-[5.5rem] py-2.5 text-[11px] text-slate-400 font-bold hover:bg-white/5">Quote</button>
          <button type="button" onClick={() => navigate('/dashboard/business/calendar')} className="flex-1 min-w-[5.5rem] py-2.5 text-[11px] text-slate-400 font-bold hover:bg-white/5">Follow-up</button>
        </div>
        <div className="flex divide-x divide-white/5">
          <button onClick={() => setLogging(v => !v)} className="flex-1 py-3.5 text-[13px] text-slate-400 font-bold hover:bg-white/5 transition-colors">Log Activity</button>
          <button onClick={handleCreateInvoice} disabled={creatingInvoice} className="flex-1 py-3.5 text-[13px] text-emerald-400 font-bold hover:bg-white/5 transition-colors disabled:opacity-50">
            {creatingInvoice ? 'Creating…' : 'Create Invoice'}
          </button>
        </div>
      </div>
      )}
    </div>
  );
};

// ── Main DealsTab ──────────────────────────────────────────────────────────────
const DealsTab: React.FC<DealsTabProps> = ({ user }) => {
  const router = useRouter();
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();
  const { currentTenant } = useTenant();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newDeal, setNewDeal] = useState({ name: '', value: '', stage: 'lead' as DealStage, contact_name: '', contact_email: '' });

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
  const [emailCompose, setEmailCompose] = useState<{ recipient: EmailRecipient; subject: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(40);
  const loadMoreDeals = useCallback(() => setVisibleCount((c) => c + 30), []);
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleDealSelection = (dealId: string) => {
    setSelectedDealIds((prev) => {
      const next = new Set(prev);
      if (next.has(dealId)) next.delete(dealId);
      else next.add(dealId);
      return next;
    });
  };

  const openSingleSelectedDeal = useCallback(() => {
    const [id] = [...selectedDealIds];
    if (!id) return;
    const deal = deals.find((d) => d.id === id);
    if (deal) setSelectedDeal(deal);
  }, [deals, selectedDealIds]);

  const handleBulkDeleteDeals = async () => {
    const ids = [...selectedDealIds];
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} deal(s)? This cannot be undone.`)) return;

    setBulkDeleting(true);
    const toastId = toast.loading(`Deleting ${ids.length} deal(s)...`);
    try {
      const { error, count } = await dealService.bulkDeleteDeals(ids);
      if (error) throw new Error(error);
      setDeals((prev) => prev.filter((d) => !selectedDealIds.has(d.id)));
      if (selectedDeal && selectedDealIds.has(selectedDeal.id)) setSelectedDeal(null);
      setSelectedDealIds(new Set());
      toast.success(`Deleted ${count} deal(s)`, { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk delete failed', { id: toastId });
      await load();
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkEmailDeals = useCallback(() => {
    if (selectedDealIds.size === 0) return;
    const recipients = deals
      .filter((deal) => selectedDealIds.has(deal.id))
      .map((deal) => deal.contact_email?.trim() || '')
      .filter((email, index, arr) => email.length > 0 && arr.indexOf(email) === index);

    if (recipients.length === 0) {
      toast.error('Selected deals do not have contact email addresses.');
      return;
    }

    const subject = recipients.length === 1 ? 'Deal follow-up' : 'Pipeline follow-up';
    router.push(buildMailComposeUrl(recipients, subject));
  }, [deals, router, selectedDealIds]);

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
    setDeals((data as Deal[])?.filter((d) => isActiveDealStage(d.stage)) || []);
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const dealId = searchParams?.get('deal') || searchParams?.get('dealId');
    if (!dealId || deals.length === 0) return;
    const match = deals.find((d) => d.id === dealId);
    if (match) {
      setSelectedDeal(match);
      router.replace('/dashboard/deals', { scroll: false });
    }
  }, [searchParams, deals, router]);

  const applyStageChange = async (id: string, newStage: DealStage) => {
    const deal = deals.find((d) => d.id === id);
    if (!deal || !currentTenant?.id) return;

    const check = assertDealStageTransition(deal.stage, newStage);
    if (!check.ok) {
      toast.error(check.message);
      return;
    }

    const currentIndex = STAGES.indexOf(deal.stage);
    const nextIndex = STAGES.indexOf(newStage);
    const isBackwardMove = currentIndex !== -1 && nextIndex !== -1 && nextIndex < currentIndex;
    const stageReason = isBackwardMove
      ? window.prompt(`Why is ${deal.name} moving back to ${newStage.replace('_', ' ')}?`)?.trim() || ''
      : undefined;
    if (isBackwardMove && !stageReason) {
      toast.error('Please add a reason before moving a deal backward.');
      return;
    }

    const { error, deal: updatedDeal } = await dealService.updateDeal(id, {
      stage: newStage,
      stageReason,
    });

    if (error) {
      toast.error(error || 'Failed to update deal stage');
      return;
    }

    const removesFromBoard = newStage === 'closed_won' || newStage === 'closed_lost';
    if (removesFromBoard) {
      setDeals((prev) => prev.filter((d) => d.id !== id));
      if (selectedDeal?.id === id) setSelectedDeal(null);
      toast.success(newStage === 'closed_won' ? 'Deal closed won — removed from active board' : 'Deal removed from pipeline');
      showDealStageNextSteps(newStage, (path) => router.push(path));
      return;
    }

    setDeals((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, stage: updatedDeal?.stage || newStage, updated_at: new Date().toISOString() } : d
      )
    );
    if (selectedDeal?.id === id) {
      setSelectedDeal((prev) => (prev ? { ...prev, stage: updatedDeal?.stage || newStage } : prev));
    }
    toast.success(`Moved to ${newStage.replace('_', ' ')}`);
    showDealStageNextSteps(newStage, (path) => router.push(path));
  };

  const advanceStage = async (id: string) => {
    const deal = deals.find((d) => d.id === id);
    if (!deal) return;
    const newStage = getForwardStageTarget(deal.stage);
    if (!newStage) return;
    await applyStageChange(id, newStage);
  };

  const markDealLost = async (id: string) => {
    await applyStageChange(id, 'closed_lost');
  };

  const handleStageChange = async (id: string, stage: DealStage) => {
    await applyStageChange(id, stage);
  };

  const handleBoardDrop = async (dealId: string, targetStage: DealStage) => {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === targetStage) return;
    await applyStageChange(dealId, targetStage);
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
      const response = await fetch(`/api/tenant/${encodeURIComponent(currentTenant.id)}/deals`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDealName.trim(),
          value: parseFloat(newDealValue) || 0,
          stage: newDealStage,
          contactName: newDealContactName.trim(),
          contactEmail: newDealContactEmail.trim(),
          description: newDealDescription.trim(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Error creating deal');
      const data = payload.deal;

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

  const pipelineHealth = useMemo(() => {
    if (deals.length === 0) return 0;
    return Math.round(
      deals.reduce((s, d) => s + getDealStageProgress(d.stage).percent, 0) / deals.length
    );
  }, [deals]);

  // Group by stage for Board / mobile views
  const grouped = useMemo(() => {
    return BOARD_STAGES.reduce<Record<string, Deal[]>>((acc, s) => {
      acc[s] = deals.filter(d => d.stage === s);
      return acc;
    }, {} as Record<string, Deal[]>);
  }, [deals]);

  // Calculate total pipeline value
  const totalPipelineValue = useMemo(() => {
    return deals.reduce((sum, d) => sum + (d.value || 0), 0);
  }, [deals]);

  const dealStats = useMemo<ModuleStat[]>(() => {
    const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`;
    const open = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost');
    const openValue = open.reduce((s, d) => s + (d.value || 0), 0);
    const won = deals.filter(d => d.stage === 'closed_won');
    const wonValue = won.reduce((s, d) => s + (d.value || 0), 0);
    const closed = deals.filter(d => d.stage === 'closed_won' || d.stage === 'closed_lost').length;
    const winRate = closed > 0 ? Math.round((won.length / closed) * 100) : 0;
    const avgDeal = deals.length > 0 ? totalPipelineValue / deals.length : 0;
    return [
      { label: 'Open Pipeline', value: fmt(openValue), sub: `${open.length} active deals`, Icon: TrendingUp, accent: 'teal' },
      { label: 'Won', value: fmt(wonValue), sub: `${won.length} closed won`, Icon: CheckSquare, accent: 'emerald' },
      { label: 'Win Rate', value: `${winRate}%`, sub: `${closed} closed`, Icon: ArrowUpDown, accent: 'purple' },
      { label: 'Avg Deal', value: fmt(avgDeal), sub: `${deals.length} total`, Icon: FileText, accent: 'blue' },
    ];
  }, [deals, totalPipelineValue]);

  // Stage funnel breakdown for the mini visualization
  const stageBreakdown = useMemo(() => {
    const max = Math.max(1, ...STAGES.map(st => deals.filter(d => d.stage === st).reduce((s, d) => s + (d.value || 0), 0)));
    return STAGES.map(st => {
      const inStage = deals.filter(d => d.stage === st);
      const value = inStage.reduce((s, d) => s + (d.value || 0), 0);
      return { stage: st, count: inStage.length, value, pct: Math.round((value / max) * 100) };
    });
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

  useInfiniteScroll(listRef, loadMoreDeals, {
    enabled: viewMode === 'list' && filteredDeals.length > visibleCount,
  });
  const visibleDeals = filteredDeals.slice(0, visibleCount);

  // ── RENDER BOARD VIEW ──────────────────────────────────────────────────────────
  const renderBoard = () => (
    <div className="flex gap-4 p-4 overflow-x-auto h-[calc(100vh-210px)] select-none">
      {BOARD_STAGES.map((stage) => {
        const stageDeals = grouped[stage] || [];
        const col = STAGE_COLORS[stage];
        const totalVal = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);

        return (
          <div
            key={stage}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData('text/plain');
              if (id) void handleBoardDrop(id, stage);
            }}
            className="flex-1 min-w-[280px] max-w-[320px] bg-slate-900/25 border border-white/5 rounded-2xl flex flex-col h-full overflow-hidden"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between p-3.5 border-b border-white/5 bg-slate-900/40 shrink-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${col.text} bg-current`} />
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">{stage.replace('_', ' ')}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${col.bg} ${col.text}`}>{stageDeals.length}</span>
                {stageDeals.length > COLUMN_WIP_LIMIT && (
                  <span className="text-[9px] font-bold text-amber-400" title="WIP limit exceeded">WIP!</span>
                )}
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedDeal(deal);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open deal: ${deal.name}`}
                    className={`bg-slate-950 border hover:border-slate-800 border-l-4 ${probabilityAccent(deal.probability)} p-4 rounded-xl cursor-pointer hover:shadow-lg transition-all flex flex-col gap-3 group relative overflow-hidden active:scale-[0.98] ${
                      selectedDealIds.has(deal.id) ? 'border-[var(--brand-blue-500)]/40' : 'border-white/5'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDealSelection(deal.id);
                      }}
                      className="absolute top-3 right-3 z-10 text-slate-500 hover:text-[var(--brand-blue-400)]"
                      aria-label={`Select ${deal.name} for bulk actions`}
                      title="Select for bulk actions"
                    >
                      {selectedDealIds.has(deal.id)
                        ? <CheckSquare className="w-4 h-4 text-[var(--brand-blue-400)]" />
                        : <Square className="w-4 h-4" />}
                    </button>
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-[13px] font-bold text-white group-hover:text-[var(--brand-blue-400)] transition-colors leading-tight truncate">{deal.name}</h4>
                        {deal.score != null && (
                          <span className={`text-[10px] font-extrabold flex-shrink-0 px-1.5 py-0.5 rounded-md ${scoreColor(deal.score)} bg-white/5`}>
                            ★ {deal.score}
                          </span>
                        )}
                      </div>
                      {deal.contact_name && (
                        <span className="text-[11px] text-slate-500 mt-1 block truncate">{deal.contact_name}</span>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-[var(--brand-blue-500)]/80 rounded-full"
                            style={{ width: `${getDealStageProgress(deal.stage).percent}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-bold text-slate-500 tabular-nums">
                          {getDealStageProgress(deal.stage).percent}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1 shrink-0">
                      <span className="text-[13px] font-extrabold text-[var(--brand-blue-400)]">${(deal.value || 0).toLocaleString()}</span>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-550" />
                        <span className={`text-[10px] font-semibold tabular-nums ${daysInStage(deal.updated_at) >= STALL_DAYS ? 'text-amber-400' : 'text-slate-550'}`}>
                          {daysInStage(deal.updated_at)}d
                        </span>
                        {daysInStage(deal.updated_at) >= STALL_DAYS && (
                          <span className="text-[9px] font-bold text-amber-400 uppercase">Stall</span>
                        )}
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
            className="w-full pl-9 pr-4 py-2 bg-slate-950/60 border border-white/5 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[var(--brand-blue-500)]/50"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {/* Stage filter */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="bg-slate-950/60 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[var(--brand-blue-500)]/50 capitalize"
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
              sortBy === 'value' ? 'text-[var(--brand-blue-400)] border-[var(--brand-blue-500)]/20' : 'text-slate-400'
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
              sortBy === 'created_at' ? 'text-[var(--brand-blue-400)] border-[var(--brand-blue-500)]/20' : 'text-slate-400'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>Created {sortBy === 'created_at' && (sortOrder === 'asc' ? '↑' : '↓')}</span>
          </button>
        </div>
      </div>

      {/* Table grid */}
      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-950/30">
        <table className="ac-data-table w-full border-collapse text-left min-w-[700px]">
          <thead>
            <tr className="border-b border-white/5 bg-slate-900/20">
              <th className="px-3 py-3 w-10">
                <button
                  type="button"
                  onClick={() => {
                    const visibleIds = filteredDeals.map((d) => d.id);
                    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedDealIds.has(id));
                    setSelectedDealIds(allSelected ? new Set() : new Set(visibleIds));
                  }}
                  className="text-slate-500 hover:text-white transition-colors"
                  aria-label="Select all deals"
                >
                  {filteredDeals.length > 0 && filteredDeals.every((d) => selectedDealIds.has(d.id))
                    ? <CheckSquare className="w-3.5 h-3.5" />
                    : <Square className="w-3.5 h-3.5" />}
                </button>
              </th>
              <th className="px-3 py-3 text-[11px] font-black text-slate-400 uppercase tracking-[0.22em]">Deal Name</th>
              <th className="px-3 py-3 text-[11px] font-black text-slate-400 uppercase tracking-[0.22em]">Stage</th>
              <th className="px-3 py-3 text-[11px] font-black text-slate-400 uppercase tracking-[0.22em]">Value</th>
              <th className="px-3 py-3 text-[11px] font-black text-slate-400 uppercase tracking-[0.22em]">Contact</th>
              <th className="px-3 py-3 text-[11px] font-black text-slate-400 uppercase tracking-[0.22em]">Score</th>
              <th className="px-3 py-3 text-[11px] font-black text-slate-400 uppercase tracking-[0.22em] text-right">Age</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredDeals.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-500 text-[11px]">
                  No deals found matching search criteria.
                </td>
              </tr>
            ) : (
              visibleDeals.map((deal) => (
                  <tr
                    key={deal.id}
                    onClick={() => setSelectedDeal(deal)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedDeal(deal);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open deal: ${deal.name}`}
                    className={`hover:bg-white/5 transition-colors cursor-pointer ${selectedDealIds.has(deal.id) ? 'bg-[var(--brand-blue-500)]/5' : ''}`}
                  >
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => toggleDealSelection(deal.id)}
                        className="text-slate-500 hover:text-[var(--brand-blue-400)] transition-colors"
                        aria-label={`Select ${deal.name} for bulk actions`}
                        title="Select for bulk actions"
                      >
                        {selectedDealIds.has(deal.id)
                          ? <CheckSquare className="w-3.5 h-3.5 text-[var(--brand-blue-400)]" />
                          : <Square className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-[12px] font-bold text-white block">{deal.name}</span>
                    </td>
                    <td className="px-3 py-3">
                      <StandardStatusBadge variant={resolveStatusVariant(deal.stage)}>{deal.stage.replace('_', ' ')}</StandardStatusBadge>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-[12px] font-black text-[var(--brand-blue-400)]">${(deal.value || 0).toLocaleString()}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[12px] text-slate-300 font-semibold">{deal.contact_name || '-'}</span>
                        {deal.contact_email && <span className="text-[10px] text-slate-500">{deal.contact_email}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {deal.score != null ? (
                        <span className={`text-xs font-black ${scoreColor(deal.score)}`}>
                          ★ {deal.score}/10
                        </span>
                      ) : (
                        <span className="text-slate-550 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-xs text-slate-500 font-semibold font-mono">{daysInStage(deal.updated_at)} days</span>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── RENDER STAGES LIST VIEW (Existing Swipe view) ────────────────────────────────
  const renderMobileStageList = () => (
    <div className="flex-grow overflow-y-auto pb-20">
      {BOARD_STAGES.map(stage => {
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
                  onMarkLost={markDealLost}
                  onTap={setSelectedDeal}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (!loading && deals.length === 0) {
    return (
      <div className="relative flex flex-col h-full bg-slate-950 p-6">
        <EmptyStateFromPreset
          moduleId="deals"
          onAction={() => setShowCreateModal(true)}
        />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col min-h-0 ac-scroll-full ac-enterprise-module" data-module="pipeline">
      <div className="px-4 pt-3 shrink-0 space-y-2.5">
        <CRMNav pathname={pathname} />
        <CrmSyncToolbar />
        <OperationalWorkflowStrip moduleId="crm" userRole={user.role} />
        <UniversalModuleExecutionHeader
          moduleName="Deals & Sales Pipeline"
          recordTitle="Opportunity Progression & Revenue Forecasting"
          nextActionState={{
            currentState: 'Opportunity Pipeline',
            owner: user.name || user.email || 'Sales Lead',
            nextAction: 'Advance deal stages → Draft quotes & contracts → Close won',
            deadline: '7-day stage stall threshold',
            blocker: deals.length === 0 ? 'No active deals' : null,
            expectedOutcome: 'Closed won revenue & converted contracts',
            outcomeStatus: totalPipelineValue > 0 ? 'verified' : 'pending',
            verifiedResult: `$${totalPipelineValue.toLocaleString()} active open pipeline across ${deals.length} deals`,
            authorityLevel: 'automatic_logged',
          }}
          questions={{
            whatCameIn: `${deals.length} active deals totaling $${totalPipelineValue.toLocaleString()} in open opportunity value`,
            whatDoesItMean: 'Sales opportunities in active proposal, negotiation, or qualification stages',
            whatShouldHappen: 'Progress forward stage-by-stage, complete quotes, and execute contracts',
            whoOwnsIt: user.name || user.email || 'Sales Lead',
            canAlphaCloneAct: 'automatic_logged',
            whatActuallyHappened: `${deals.length} deals actively tracked across board columns`,
            didItProduceExpectedOutcome: totalPipelineValue > 0 ? 'YES' : 'IN_PROGRESS',
            whatHappensNext: 'Generate invoice upon closing deal or send proposal follow-up',
          }}
          onExecuteNextAction={() => setShowCreateModal(true)}
        />
        <ExecutionDecisionGuide
          steps={DEALS_EXECUTION_STEPS}
          onNavigate={(href) => router.push(href)}
        />
      </div>
      <ModulePageLayout
        toolbar={(
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4 py-3 border-b border-[var(--ws-border)] bg-[var(--ws-toolbar)] sticky top-0 z-20 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-[var(--ws-text-primary)]">Sales pipeline</h2>
          <p className="text-[12px] text-[var(--ws-text-muted)] mt-0.5 font-medium">
            Open pipeline: <span className="text-[var(--module-pipeline-primary,#E69222)] font-semibold tabular-nums">${totalPipelineValue.toLocaleString()}</span> • {deals.length} active deals
            {pipelineHealth != null && (
              <> • Avg progress <span className="text-[var(--brand-blue-500)] font-semibold tabular-nums">{pipelineHealth}%</span></>
            )}
          </p>
          <p className="text-[11px] text-[var(--ws-text-disabled)] mt-1 max-w-md leading-relaxed">
            {PIPELINE_FORWARD_ONLY_HINT} Click any deal card to open full details.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {selectedDealIds.size > 0 && (
            <div className="flex items-center gap-1.5 mr-1 rounded-full border border-white/5 bg-slate-900/60 p-1 shadow-inner">
              <button
                type="button"
                onClick={() => setSelectedDealIds(new Set())}
                className="h-7 px-3 rounded-full text-[11px] font-bold text-slate-500 border border-white/10 transition-colors hover:text-slate-300"
              >
                Clear
              </button>
              {selectedDealIds.size === 1 && (
                <button
                  type="button"
                  onClick={openSingleSelectedDeal}
                  className="h-7 px-3 rounded-full text-[11px] font-bold text-[var(--brand-blue-300)] border border-[var(--brand-blue-500)]/30 transition-colors hover:text-[var(--brand-blue-200)]"
                >
                  Open deal
                </button>
              )}
              <button
                type="button"
                onClick={handleBulkEmailDeals}
                className="h-7 px-3 rounded-full text-[11px] font-bold text-indigo-300 border border-indigo-500/30 transition-colors hover:text-indigo-200"
              >
                Follow-up ({selectedDealIds.size})
              </button>
              <button
                type="button"
                disabled={bulkDeleting}
                onClick={handleBulkDeleteDeals}
                className="h-7 px-3 rounded-full text-[11px] font-bold text-rose-300 border border-rose-500/30 transition-colors hover:text-rose-200 disabled:opacity-50"
              >
                {bulkDeleting ? 'Deleting…' : `Delete (${selectedDealIds.size})`}
              </button>
            </div>
          )}
          {/* Switcher pills */}
          <div className="flex bg-slate-900/60 p-1 rounded-full border border-white/5 shadow-inner">
            <button
              onClick={() => setViewMode('board')}
              className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-bold transition-all ${
                viewMode === 'board'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Board</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-bold transition-all ${
                viewMode === 'list'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode('mobile-stage')}
              className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-bold transition-all ${
                viewMode === 'mobile-stage'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Stages</span>
            </button>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-emerald-500 px-3 text-[11px] font-black text-white transition-all hover:bg-emerald-600 active:scale-95 shadow-md shadow-emerald-500/10 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Deal</span>
          </button>
        </div>
          </div>
        )}
        stats={!loading && deals.length > 0 ? (
          <div className="p-4 border-b border-white/5 bg-slate-900/20 space-y-4 shrink-0">
            <RevenueLeakagePanel deals={deals} heading="What to fix next" />
            <ModuleStatCards stats={dealStats} hub="deals" />
            <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Pipeline by Stage</h3>
                <span className="text-[11px] text-slate-500">Value distribution</span>
              </div>
              <div className="space-y-2">
                {stageBreakdown.map(({ stage, count, value, pct }) => (
                  <div key={stage} className="flex items-center gap-3">
                    <span className={`w-24 shrink-0 text-[11px] font-bold capitalize ${STAGE_COLORS[stage].text}`}>
                      {stage.replace('_', ' ')}
                    </span>
                    <div className="flex-1 h-2.5 rounded-full bg-slate-800/80 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        className={`h-full rounded-full ${STAGE_COLORS[stage].bg.replace('/15', '/60')}`}
                      />
                    </div>
                    <span className="w-28 shrink-0 text-right text-[11px] tabular-nums text-slate-300">
                      ${value.toLocaleString()} <span className="text-slate-600">({count})</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : !loading ? (
          <div className="p-4 border-b border-white/5 shrink-0 space-y-4">
            <RevenueLeakagePanel deals={deals} heading="What to fix next" />
          </div>
        ) : null}
      >
      {/* Main View Area */}
      <div ref={listRef} className="flex-1 ac-scroll-full">
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
      </ModulePageLayout>

      {/* Create Deal */}
      <DetailDrawer
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        title="Create New Deal"
        description="Add a deal to your pipeline"
      >
        <form onSubmit={handleCreateDeal} className="space-y-3.5 pb-6">
              <div>
                <Input
                  label="Deal Name *"
                  type="text"
                  value={newDealName}
                  onChange={(e) => setNewDealName(e.target.value)}
                  placeholder="e.g. Acme Enterprise SaaS"
                  validate={(v) => !v.trim() ? 'Deal name is required' : undefined}
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
                    className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[var(--brand-blue-500)]/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Stage *</label>
                  <select
                    value={newDealStage}
                    onChange={(e) => setNewDealStage(e.target.value as DealStage)}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-[var(--brand-blue-500)]/50 capitalize"
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
                  className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[var(--brand-blue-500)]/50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contact Email</label>
                <input
                  type="email"
                  value={newDealContactEmail}
                  onChange={(e) => setNewDealContactEmail(e.target.value)}
                  placeholder="e.g. john@acme.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[var(--brand-blue-500)]/50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description</label>
                <textarea
                  value={newDealDescription}
                  onChange={(e) => setNewDealDescription(e.target.value)}
                  placeholder="Add brief details about the deal..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[var(--brand-blue-500)]/50 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={savingNewDeal}
                className="w-full min-h-11 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all mt-2"
              >
                {savingNewDeal ? 'Saving...' : 'Create Deal'}
              </button>
            </form>
      </DetailDrawer>

      <DetailDrawer
        open={Boolean(selectedDeal)}
        onOpenChange={(open) => { if (!open) setSelectedDeal(null); }}
        title={selectedDeal?.name || 'Deal'}
        description={selectedDeal?.contact_name || undefined}
        size="wide"
      >
        {selectedDeal && (
          <DealDetail
            deal={selectedDeal}
            user={user}
            onBack={() => setSelectedDeal(null)}
            onStageChange={handleStageChange}
            onComposeEmail={(recipient, subject) => setEmailCompose({ recipient, subject })}
            onNavigate={(path) => router.push(path)}
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

export default DealsTab;
