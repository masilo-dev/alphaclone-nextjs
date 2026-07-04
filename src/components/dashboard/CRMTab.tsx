'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  UserPlus, Search, X, Phone, Mail, Building,
  MessageCircle, Clock,
  UserCheck, Users, ArrowLeft, Star, AlertCircle,
  ShieldCheck, DollarSign, Activity, Loader2, Smartphone, Video,
  ChevronRight, TrendingUp, Sparkles, AlertTriangle, RefreshCw, Target,
  Trash2, CheckSquare, Square
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, DragOverlay, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';
import { User } from '../../types';
import toast from 'react-hot-toast';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { dailyService } from '../../services/dailyService';
import { churnPropensityService, ChurnRiskReport } from '@/services/intelligence/churnPropensityService';
import { customer360Service, Customer360Profile } from '@/services/intelligence/customer360Service';
import { presenceService } from '@/services/presenceService';
import { microsoft365Service } from '@/services/microsoft365Service';
import { microsoftGraphService } from '@/services/microsoftGraphService';
import { missedCallsService } from '@/services/missedCallsService';
import OnlineStatusBadge from './OnlineStatusBadge';
import { CommunicationModal } from './crm/CommunicationModal';
import { LeadImportModal } from './crm/LeadImportModal';
import { RevenueLeakagePanel } from './crm/RevenueLeakagePanel';
import { showActionNextSteps } from '../common/showActionNextSteps';
import { useLanguage } from '../../contexts/LanguageContext';
import { ResponsiveTableDesktop, ResponsiveTableMobile, MobileDataCard } from '../ui/ResponsiveTable';
import { ModuleStatCards, type ModuleStat } from './common/ModuleStatCards';
import { StandardStatusBadge, resolveStatusVariant, SocialPlatformIcon } from '@/components/ui/design-system';
import { leadService } from '../../services/leadService';
import { businessClientService } from '../../services/businessClientService';
import { contactService } from '../../services/contactService';
import { dealService } from '../../services/dealService';
import { CRMNav } from './crm/CRMNav';
import { OperationalWorkflowStrip } from './OperationalWorkflowStrip';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { ModulePageLayout } from '@/components/ui/ModulePageLayout';
import { Input } from '../ui/UIComponents';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

// ── Types ──────────────────────────────────────────────────────────────────────
type LeadStatus = 'new' | 'contacted' | 'qualified' | 'disqualified';
type SubView = 'leads' | 'clients' | 'contacts';

interface Lead {
  id: string;
  name: string;
  business_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  source?: string;
  status: LeadStatus;
  created_at: string;
  tenant_id: string;
}

interface BusinessClient {
  id: string;
  tenant_id: string;
  name: string;
  email?: string;
  phone?: string;
  sales_stage: 'lead' | 'prospect' | 'customer' | 'lost';
  value: number;
  description?: string;
  location?: string;
  custom_fields?: Record<string, any>;
  created_at: string;
  updated_at?: string;
  is_active: boolean;
  industry?: string;
  website?: string;
}

interface CRMEntity {
  type: 'lead' | 'client' | 'contact';
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  source?: string;
  status: string;
  created_at: string;
  value?: number;
  industry?: string;
  rawLead?: Lead;
  rawClient?: BusinessClient;
}

interface CRMTabProps {
  user: User;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const getInitials = (name?: string) => {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).map(n => n[0] || '').join('').toUpperCase().slice(0, 2) || '?';
};

const entityKey = (entity: { type: string; id: string }) => `${entity.type}:${entity.id}`;

const hashColor = (name?: string) => {
  if (!name) return 'bg-slate-700';
  const colors = [
    'bg-blue-600/80',
    'bg-emerald-600/80',
    'bg-violet-600/80',
    'bg-orange-600/80',
    'bg-pink-600/80',
    'bg-teal-600/80',
    'bg-indigo-600/80'
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length;
  return colors[h];
};

const sourceColors: Record<string, string> = {
  linkedin: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  manual:   'bg-slate-500/10 text-slate-400 border border-slate-500/20',
  whatsapp: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  referral: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  website:  'bg-teal-500/10 text-teal-400 border border-teal-500/20',
};

const statusColors: Record<string, string> = {
  new:           'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  contacted:     'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  qualified:     'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  disqualified:  'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  lead:          'bg-slate-500/10 text-slate-400 border border-slate-500/20',
  prospect:      'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
  customer:      'bg-teal-500/10 text-teal-400 border border-teal-500/20',
  lost:          'bg-red-500/10 text-red-400 border border-red-500/20',
};

// ── Swipeable Row ──────────────────────────────────────────────────────────────
const SwipeableRow: React.FC<{
  entity: CRMEntity;
  status: 'online' | 'away' | 'busy' | 'offline';
  isTeamsConnected: boolean;
  onMarkContacted: (id: string) => void;
  onDisqualify: (id: string) => void;
  onQualify: (entity: CRMEntity) => void;
  onTap: (entity: CRMEntity) => void;
  isSelected?: boolean;
  onToggleSelect?: (entity: CRMEntity) => void;
}> = ({ entity, status, isTeamsConnected, onMarkContacted, onDisqualify, onQualify, onTap, isSelected, onToggleSelect }) => {
  const x = useMotionValue(0);
  const leftOpacity  = useTransform(x, [0, 80],  [0, 1]);
  const rightOpacity = useTransform(x, [-80, 0], [1, 0]);

  const handleDragEnd = (_: any, info: any) => {
    if (entity.type === 'lead') {
      if (info.offset.x > 80) { onMarkContacted(entity.id); x.set(0); }
      else if (info.offset.x < -80) { onDisqualify(entity.id); x.set(0); }
      else x.set(0);
    } else {
      x.set(0);
    }
  };

  return (
    <div className="relative overflow-hidden group border-b border-white/5 hover:bg-slate-900/30 transition-colors">
      {entity.type === 'lead' && (
        <>
          {/* Left action (green) */}
          <motion.div style={{ opacity: leftOpacity }} className="absolute inset-y-0 left-0 w-20 bg-emerald-500 flex items-center justify-center z-0">
            <UserCheck className="w-5 h-5 text-white" />
          </motion.div>
          {/* Right action (red) */}
          <motion.div style={{ opacity: rightOpacity }} className="absolute inset-y-0 right-0 w-20 bg-rose-500 flex items-center justify-center z-0">
            <X className="w-5 h-5 text-white" />
          </motion.div>
        </>
      )}

      <motion.div
        drag={entity.type === 'lead' ? 'x' : false}
        dragConstraints={{ left: -100, right: 100 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className={`relative z-10 bg-slate-950/60 flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-slate-900/40 active:bg-slate-900/60 transition-colors ${isSelected ? 'bg-teal-500/10' : ''}`}
        onClick={() => onTap(entity)}
      >
        {onToggleSelect && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleSelect(entity); }}
            className="flex-shrink-0 p-1 text-slate-500 hover:text-teal-400 transition-colors"
            aria-label={isSelected ? 'Deselect' : 'Select'}
          >
            {isSelected ? <CheckSquare className="w-4 h-4 text-teal-400" /> : <Square className="w-4 h-4" />}
          </button>
        )}
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className={`w-10 h-10 rounded-xl ${hashColor(entity.name)} flex items-center justify-center shadow-inner`}>
            <span className="text-xs font-black text-white">{getInitials(entity.name)}</span>
          </div>
          <OnlineStatusBadge
            status={status}
            size="sm"
            className="absolute -bottom-1 -right-1 border-2 border-slate-950 rounded-full bg-slate-950"
          />
        </div>

        {/* Center */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold text-white truncate">{entity.name}</span>
            {isTeamsConnected && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-purple-500/20 bg-purple-950/30 text-purple-300 flex items-center gap-0.5">
                Teams
              </span>
            )}
            {entity.source && (
              <span className="flex items-center gap-1 shrink-0">
                <SocialPlatformIcon platform={entity.source} size="sm" />
                <StandardStatusBadge variant="neutral">{entity.source}</StandardStatusBadge>
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400 truncate block">
            {entity.company ? `${entity.company} • ` : ''}{entity.email || entity.phone || 'No contact details'}
          </span>
        </div>

        {/* Quick actions for leads (desktop / tablet) — visible on hover so users can move a lead without swiping */}
        {entity.type === 'lead' && (
          <div
            className="hidden sm:flex items-center gap-1 flex-shrink-0 mr-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            {entity.status !== 'contacted' && entity.status !== 'qualified' && (
              <button
                type="button"
                title="Mark as contacted"
                onClick={() => onMarkContacted(entity.id)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 active:scale-95 transition-all"
              >
                <Phone className="w-3.5 h-3.5" />
              </button>
            )}
            {entity.status !== 'qualified' && (
              <button
                type="button"
                title="Qualify & convert to client"
                onClick={() => onQualify(entity)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-300 hover:bg-teal-500/20 active:scale-95 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            )}
            {entity.status !== 'disqualified' && (
              <button
                type="button"
                title="Disqualify lead"
                onClick={() => onDisqualify(entity.id)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 active:scale-95 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Right */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-xs font-bold text-teal-400">
            {entity.value ? `$${entity.value.toLocaleString()}` : ''}
          </span>
          <div className="flex items-center gap-1.5">
            <StandardStatusBadge variant={resolveStatusVariant(entity.status)}>{entity.status}</StandardStatusBadge>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ── Lead Detail Component ──────────────────────────────────────────────────────
const LeadDetail: React.FC<{
  lead: Lead;
  onBack: () => void;
  onUpdate: (id: string, status: LeadStatus) => void;
  onQualify: (lead: Lead) => void;
  onSaveLead?: (id: string, patch: { name: string; email?: string; phone?: string; company?: string }) => Promise<void>;
  inDrawer?: boolean;
}> = ({ lead, onBack, onUpdate, onQualify, onSaveLead, inDrawer }) => {
  const [activities, setActivities] = useState<Array<{ id: string; type: string; description: string; created_at: string }>>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [name, setName] = useState(lead.name);
  const [email, setEmail] = useState(lead.email || '');
  const [phone, setPhone] = useState(lead.phone || '');
  const [company, setCompany] = useState(lead.company || lead.business_name || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(lead.name);
    setEmail(lead.email || '');
    setPhone(lead.phone || '');
    setCompany(lead.company || lead.business_name || '');
  }, [lead.id, lead.name, lead.email, lead.phone, lead.company, lead.business_name]);

  useEffect(() => {
    let cancelled = false;
    const loadActivities = async () => {
      setLoadingActivities(true);
      try {
        const { data } = await supabase
          .from('lead_activities')
          .select('id, type, description, created_at')
          .eq('lead_id', lead.id)
          .order('created_at', { ascending: false })
          .limit(50);
        if (!cancelled) setActivities(data || []);
      } catch {
        if (!cancelled) setActivities([]);
      } finally {
        if (!cancelled) setLoadingActivities(false);
      }
    };
    loadActivities();
    return () => { cancelled = true; };
  }, [lead.id]);

  const handleSaveLead = async () => {
    if (!onSaveLead || !name.trim()) return;
    setSaving(true);
    try {
      await onSaveLead(lead.id, {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        company: company.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const leadActions = (
    <div className={`grid grid-cols-3 gap-2 ${inDrawer ? 'pt-2 border-t border-white/5' : 'fixed bottom-0 left-0 right-0 md:absolute bg-slate-950/95 border-t border-white/5 divide-x divide-white/5 pb-[env(safe-area-inset-bottom,0px)] z-30'}`}>
      <button
        onClick={() => onUpdate(lead.id, 'contacted')}
        className={`flex flex-col items-center justify-center gap-1 hover:bg-slate-900 transition-colors ${inDrawer ? 'min-h-11 rounded-xl border border-white/5 py-2' : 'py-3.5'}`}
      >
        <Phone className="w-5 h-5 text-amber-400" />
        <span className="text-[10px] text-slate-400 font-bold">Mark Contacted</span>
      </button>
      <button
        onClick={() => onQualify(lead)}
        className={`flex flex-col items-center justify-center gap-1 hover:bg-slate-900 transition-colors bg-teal-500/5 ${inDrawer ? 'min-h-11 rounded-xl border border-teal-500/20 py-2' : 'py-3.5'}`}
      >
        <Sparkles className="w-5 h-5 text-teal-400 animate-pulse" />
        <span className="text-[10px] text-teal-300 font-bold">Qualify & Convert</span>
      </button>
      <button
        onClick={() => onUpdate(lead.id, 'disqualified')}
        className={`flex flex-col items-center justify-center gap-1 hover:bg-slate-900 transition-colors ${inDrawer ? 'min-h-11 rounded-xl border border-white/5 py-2' : 'py-3.5'}`}
      >
        <X className="w-5 h-5 text-rose-500" />
        <span className="text-[10px] text-slate-400 font-bold">Disqualify</span>
      </button>
    </div>
  );

  return (
    <div className={inDrawer ? 'space-y-4 pb-2' : 'flex flex-col h-full bg-slate-950 text-slate-100'}>
      {!inDrawer && (
      <div className="flex items-center gap-3 p-4 border-b border-white/5 bg-slate-900/60 sticky top-0 z-20 backdrop-blur-md">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">
          <ArrowLeft className="w-4 h-4 text-slate-300" />
        </button>
        <span className="text-sm font-bold text-white">Lead Details</span>
      </div>
      )}

      <div className={inDrawer ? 'space-y-4' : 'flex-1 overflow-y-auto p-5 space-y-6 pb-28'}>
        {/* Header Profile */}
        <div className="flex flex-col items-center gap-2 py-4">
          <div className={`w-20 h-20 rounded-2xl ${hashColor(lead.name)} flex items-center justify-center shadow-lg shadow-black/30`}>
            <span className="text-2xl font-black text-white">{getInitials(lead.name)}</span>
          </div>
          <h2 className="text-xl font-bold text-white text-center mt-2">{name || lead.name}</h2>
          <div className="flex items-center gap-2">
            <StandardStatusBadge variant={resolveStatusVariant(lead.status)}>{lead.status}</StandardStatusBadge>
            {lead.source && (
              <span className="flex items-center gap-1">
                <SocialPlatformIcon platform={lead.source} size="sm" />
                <StandardStatusBadge variant="neutral">{lead.source}</StandardStatusBadge>
              </span>
            )}
          </div>
        </div>

        {/* Editable contact fields */}
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Contact details</span>
          <Input
            label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            validate={(v) => !v.trim() ? 'Name is required' : undefined}
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            validate={(v) => v.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? 'Enter a valid email' : undefined}
          />
          <Input
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            validate={(v) => v.trim() && v.replace(/\D/g, '').length < 7 ? 'Enter a valid phone number' : undefined}
          />
          <Input
            label="Company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          {onSaveLead && (
            <button
              type="button"
              onClick={() => void handleSaveLead()}
              disabled={saving || !name.trim()}
              className="w-full min-h-11 rounded-xl bg-teal-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          )}
        </div>

        {/* Read-only metadata */}
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl divide-y divide-white/5">
          <div className="flex items-center gap-3 p-4">
            <Clock className="w-5 h-5 text-slate-500 flex-shrink-0" />
            <div>
              <span className="block text-[11px] text-slate-500 font-bold uppercase tracking-wider">Created At</span>
              <span className="text-sm text-slate-300">
                {new Date(lead.created_at).toLocaleString()}
              </span>
            </div>
          </div>
          {lead.source && (
            <div className="flex items-center gap-3 p-4">
              <Building className="w-5 h-5 text-slate-500 flex-shrink-0" />
              <div>
                <span className="block text-[11px] text-slate-500 font-bold uppercase tracking-wider">Source</span>
                <span className="text-sm text-slate-300 capitalize">{lead.source}</span>
              </div>
            </div>
          )}
        </div>

        {/* Activity / Email History */}
        <div>
          <div className="flex items-center gap-2 mb-3 px-1">
            <Activity className="w-4 h-4 text-teal-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Activity History</span>
          </div>
          <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
            {loadingActivities ? (
              <div className="flex items-center gap-2 text-slate-500 text-xs py-4 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading history…
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-6">
                <Clock className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-500">No activity logged yet.</p>
                <p className="text-[10px] text-slate-600 mt-1">Status changes and outreach will appear here.</p>
              </div>
            ) : (
              <div className="space-y-0">
                {activities.map((act, i) => (
                  <div key={act.id} className="flex gap-3 relative pb-4 last:pb-0">
                    {i !== activities.length - 1 && (
                      <span className="absolute left-[7px] top-4 bottom-0 w-px bg-slate-800" />
                    )}
                    <span className="mt-1 w-3.5 h-3.5 rounded-full bg-teal-500/20 border border-teal-500/40 flex-shrink-0 z-10" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-300 leading-relaxed">{act.description || act.type}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">{new Date(act.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {leadActions}
    </div>
  );
};

// ── Client/Contact 360 Detail Component ────────────────────────────────────────
const Client360Detail: React.FC<{
  client: BusinessClient;
  user: User;
  onBack: () => void;
  onNewDeal: (client: BusinessClient) => void;
  onDraftContract: (client: BusinessClient) => void;
  onClientSaved?: (clientId: string, patch: Partial<BusinessClient>) => Promise<void>;
  status: 'online' | 'away' | 'busy' | 'offline';
  isTeamsConnected: boolean;
  inDrawer?: boolean;
}> = ({ client, user, onBack, onNewDeal, onDraftContract, onClientSaved, status, isTeamsConnected, inDrawer }) => {
  const { currentTenant } = useTenant();
  const router = useRouter();
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [name, setName] = useState(client.name);
  const [email, setEmail] = useState(client.email || '');
  const [phone, setPhone] = useState(client.phone || '');
  const [industry, setIndustry] = useState(client.industry || '');
  const [website, setWebsite] = useState(client.website || '');
  const [description, setDescription] = useState(client.description || '');
  const [salesStage, setSalesStage] = useState(client.sales_stage);
  const [value, setValue] = useState(String(client.value ?? 0));
  const [savingClient, setSavingClient] = useState(false);

  useEffect(() => {
    setName(client.name);
    setEmail(client.email || '');
    setPhone(client.phone || '');
    setIndustry(client.industry || '');
    setWebsite(client.website || '');
    setDescription(client.description || '');
    setSalesStage(client.sales_stage);
    setValue(String(client.value ?? 0));
  }, [client.id, client.name, client.email, client.phone, client.industry, client.website, client.description, client.sales_stage, client.value]);

  const handleSaveClient = async () => {
    if (!name.trim()) {
      toast.error('Client name is required');
      return;
    }
    setSavingClient(true);
    try {
      const patch: Partial<BusinessClient> = {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        industry: industry.trim() || undefined,
        website: website.trim() || undefined,
        description: description.trim() || undefined,
        sales_stage: salesStage,
        value: Number(value) || 0,
      };
      if (onClientSaved) {
        await onClientSaved(client.id, patch);
      } else {
        const { error } = await businessClientService.updateClient(client.id, {
          name: patch.name,
          email: patch.email,
          phone: patch.phone,
          industry: patch.industry,
          website: patch.website,
          description: patch.description,
          salesStage: patch.sales_stage,
          value: patch.value,
        });
        if (error) throw new Error(error);
        toast.success('Client updated');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update client');
    } finally {
      setSavingClient(false);
    }
  };

  // AI & Timeline States
  const [loadingAi, setLoadingAi] = useState(true);
  const [churnRisk, setChurnRisk] = useState<ChurnRiskReport | null>(null);
  const [profile360, setProfile360] = useState<Customer360Profile | null>(null);

  useEffect(() => {
    const fetch360Data = async () => {
      if (!currentTenant?.id || !client.email) {
        setLoadingAi(false);
        return;
      }
      setLoadingAi(true);
      try {
        const [risk, profile] = await Promise.all([
          churnPropensityService.calculateChurnRisk(supabase, currentTenant.id, client.id),
          customer360Service.buildProfile(supabase, currentTenant.id, client.email)
        ]);
        setChurnRisk(risk);
        setProfile360(profile);
      } catch (err) {
        console.error('Failed to fetch Client 360 data:', err);
      } finally {
        setLoadingAi(false);
      }
    };
    fetch360Data();
  }, [client, currentTenant?.id]);

  const handleStartVideoCall = async () => {
    const toastId = toast.loading('Creating secure call room…');
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        toast.error('You must be signed in to start a call', { id: toastId });
        return;
      }
      if (status !== 'online') {
        toast.error(`${client.name} is offline. Missed call notification sent.`, { id: toastId });
        await missedCallsService.createMissedCall(user.id, client.id, 'video', client.id);
        await missedCallsService.createCallAttempt(user.id, client.id, 'video', client.id);
        return;
      }
      const { call, error } = await dailyService.createVideoCall({
        hostId: authUser.id,
        title: `Call with ${client.name}`,
        isPublic: false,
      });
      if (error || !call) {
        toast.error(error === 'LIMIT_EXCEEDED_TEASER' ? 'You\u2019ve used your free meetings. Upgrade to continue.' : (error || 'Could not create call'), { id: toastId });
        return;
      }
      toast.success('Meeting room ready', { id: toastId });
      router.push(`/call/${call.id}`);
    } catch (err) {
      toast.error('Failed to start call', { id: toastId });
    }
  };

  const handleOpenWhatsApp = () => {
    const phoneClean = client.phone?.replace(/[^0-9]/g, '') || '';
    if (!phoneClean) {
      toast.error('No phone number available for outreach');
      return;
    }
    // Try to send via platform API first, fallback to opening WhatsApp
    const sendViaPlatform = async () => {
      try {
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: currentTenant?.id,
            to: phoneClean,
            message: `Hello ${client.name}, this is a message from AlphaClone.`,
          }),
        });
        if (res.ok) {
          toast.success('WhatsApp message sent via platform!');
          return;
        }
      } catch {}
      // Fallback: open WhatsApp Web/app
      window.open(`https://wa.me/${phoneClean}?text=Hello%20${encodeURIComponent(client.name)},`, '_blank');
    };
    sendViaPlatform();
  };

  const clientActions = (
    <div className={`grid grid-cols-3 gap-2 ${inDrawer ? 'pt-2 border-t border-white/5' : 'fixed bottom-0 left-0 right-0 md:absolute bg-slate-950/95 border-t border-white/5 divide-x divide-white/5 pb-[env(safe-area-inset-bottom,0px)] z-30'}`}>
      <button
        onClick={() => onNewDeal(client)}
        className={`flex flex-col items-center justify-center gap-1 hover:bg-slate-900 transition-colors ${inDrawer ? 'min-h-11 rounded-xl border border-white/5 py-2' : 'py-3.5'}`}
      >
        <TrendingUp className="w-5 h-5 text-emerald-400" />
        <span className="text-[10px] text-slate-400 font-bold">Add Deal</span>
      </button>
      <button
        onClick={() => onDraftContract(client)}
        className={`flex flex-col items-center justify-center gap-1 hover:bg-slate-900 transition-colors bg-teal-500/5 ${inDrawer ? 'min-h-11 rounded-xl border border-teal-500/20 py-2' : 'py-3.5'}`}
      >
        <ShieldCheck className="w-5 h-5 text-teal-400" />
        <span className="text-[10px] text-teal-300 font-bold">Draft Contract</span>
      </button>
      <button
        onClick={() => router.push(user.role === 'tenant_admin' ? '/dashboard/business/billing' : '/dashboard/finance')}
        className={`flex flex-col items-center justify-center gap-1 hover:bg-slate-900 transition-colors ${inDrawer ? 'min-h-11 rounded-xl border border-white/5 py-2' : 'py-3.5'}`}
      >
        <DollarSign className="w-5 h-5 text-blue-400" />
        <span className="text-[10px] text-slate-400 font-bold">Create Invoice</span>
      </button>
    </div>
  );

  return (
    <div className={inDrawer ? 'space-y-4 pb-2' : 'flex flex-col h-full bg-slate-950 text-slate-100'}>
      {!inDrawer && (
      <div className="flex items-center gap-3 p-4 border-b border-white/5 bg-slate-900/60 sticky top-0 z-20 backdrop-blur-md">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">
          <ArrowLeft className="w-4 h-4 text-slate-300" />
        </button>
        <span className="text-sm font-bold text-white">Client 360 Workspace</span>
      </div>
      )}

      <div className={inDrawer ? 'space-y-4' : 'flex-1 overflow-y-auto p-5 space-y-6 pb-28'}>
        {/* Profile Card */}
        <div className="flex flex-col items-center gap-2 py-4">
          <div className={`w-20 h-20 rounded-2xl ${hashColor(client.name)} flex items-center justify-center shadow-lg shadow-black/30 relative`}>
            <span className="text-2xl font-black text-white">{getInitials(client.name)}</span>
            <OnlineStatusBadge
              status={status}
              size="lg"
              className="absolute -bottom-1 -right-1 border-4 border-slate-950 rounded-full bg-slate-950"
            />
          </div>
          <h2 className="text-xl font-bold text-white text-center mt-2">{name || client.name}</h2>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <StandardStatusBadge variant={resolveStatusVariant(salesStage)}>{salesStage}</StandardStatusBadge>
            {(industry || client.industry) && (
              <span className="text-[11px] font-bold px-3 py-1 rounded-full border border-slate-700 bg-slate-900/60 text-slate-400 capitalize">
                {industry || client.industry}
              </span>
            )}
            {isTeamsConnected && (
              <span className="text-[11px] font-bold px-3 py-1 rounded-full border border-purple-500/30 bg-purple-950/40 text-purple-300 flex items-center gap-1.5 shadow-sm shadow-purple-500/10 animate-pulse">
                Teams Synced
              </span>
            )}
          </div>
        </div>

        {/* Editable client profile */}
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Client details</span>
          <Input
            label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            validate={(v) => !v.trim() ? 'Name is required' : undefined}
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            validate={(v) => v.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? 'Enter a valid email' : undefined}
          />
          <Input
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            validate={(v) => v.trim() && v.replace(/\D/g, '').length < 7 ? 'Enter a valid phone number' : undefined}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />
            <Input
              label="Portfolio value ($)"
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <Input
            label="Website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            validate={(v) => v.trim() && !/^https?:\/\/.+/.test(v.trim()) ? 'Enter a valid URL (https://…)' : undefined}
          />
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sales stage</label>
            <select
              value={salesStage}
              onChange={(e) => setSalesStage(e.target.value as BusinessClient['sales_stage'])}
              className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500/50 capitalize"
            >
              {(['lead', 'prospect', 'customer', 'lost'] as const).map((stage) => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Notes</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Account notes…"
              className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500/50 resize-none"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleSaveClient()}
            disabled={savingClient || !name.trim()}
            className="w-full min-h-11 rounded-xl bg-teal-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {savingClient ? 'Saving…' : 'Save changes'}
          </button>
        </div>

        {/* Quick Communication Outreach Bar */}
        <div className="grid grid-cols-4 gap-2 bg-slate-900/40 p-3 rounded-2xl border border-white/5">
          <button
            onClick={handleStartVideoCall}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 transition-all active:scale-95 group"
          >
            <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center group-hover:bg-teal-500/20 transition-colors">
              <Video className="w-5 h-5 text-teal-400" />
            </div>
            <span className="text-[10px] text-slate-400 font-bold">Secure Call</span>
          </button>
          <button
            onClick={handleOpenWhatsApp}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 transition-all active:scale-95 group"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
              <Smartphone className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-[10px] text-slate-400 font-bold">WhatsApp</span>
          </button>
          <button
            onClick={() => {
              if (client.email) setShowEmailModal(true);
              else toast.error('Add an email address for this client first.');
            }}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 transition-all active:scale-95 group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <Mail className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-[10px] text-slate-400 font-bold">Send Email</span>
          </button>
          <button
            onClick={() => router.push(`${user.role === 'tenant_admin' ? '/dashboard/business/messages' : '/dashboard/messages'}?selectedClientId=${client.id}`)}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 transition-all active:scale-95 group"
          >
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
              <MessageCircle className="w-5 h-5 text-violet-400" />
            </div>
            <span className="text-[10px] text-slate-400 font-bold">Live Chat</span>
          </button>
        </div>

        {/* AI Propensity & Health Panel */}
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white">AI Client Health Insight</h3>
            </div>
            {loadingAi && <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />}
          </div>

          {!client.email ? (
            <div className="flex items-center gap-2 text-slate-500 text-xs py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Provide an email to enable AI propensity scoring & 360-degree timeline logs.</span>
            </div>
          ) : loadingAi ? (
            <div className="h-20 flex items-center justify-center text-slate-500 text-xs">
              Resolving profiles & calculating engagement health...
            </div>
          ) : churnRisk ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Churn Propensity Risk</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${
                  churnRisk.risk_tier === 'low' ? 'bg-emerald-500/15 text-emerald-400' :
                  churnRisk.risk_tier === 'medium' ? 'bg-yellow-500/15 text-yellow-400' :
                  churnRisk.risk_tier === 'high' ? 'bg-orange-500/15 text-orange-400' :
                  'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}>
                  {churnRisk.risk_tier} Risk ({Math.round(churnRisk.churn_probability * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    churnRisk.risk_tier === 'low' ? 'bg-emerald-500' :
                    churnRisk.risk_tier === 'medium' ? 'bg-yellow-500' :
                    churnRisk.risk_tier === 'high' ? 'bg-orange-500' :
                    'bg-rose-500'
                  }`}
                  style={{ width: `${churnRisk.churn_probability * 100}%` }}
                />
              </div>
              {churnRisk.risk_factors.length > 0 ? (
                <div className="pt-2 space-y-1.5">
                  <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Risk Factors</span>
                  {churnRisk.risk_factors.map((factor, idx) => (
                    <div key={idx} className="flex gap-2 items-start text-xs text-slate-300 leading-normal">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                      <span>{factor}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-emerald-400 flex items-center gap-1.5 py-1">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span>Account health is solid. High engagement detected.</span>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Financial Portfolio Metrics */}
        {profile360 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/40 p-4 border border-white/5 rounded-2xl">
              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Lifetime Value</span>
              <span className="text-lg font-black text-white mt-1 block">${profile360.lifetime_value.toLocaleString()}</span>
            </div>
            <div className="bg-slate-900/40 p-4 border border-white/5 rounded-2xl">
              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active Deals</span>
              <span className="text-lg font-black text-teal-400 mt-1 block">
                {profile360.active_deals_count} (${profile360.active_deals_value.toLocaleString()})
              </span>
            </div>
          </div>
        )}

        {/* 360 Engagement Timeline */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-bold text-white">Customer 360 Logs</h3>
          </div>

          {loadingAi ? (
            <div className="h-20 flex items-center justify-center text-slate-500 text-xs">
              Resolving audit logs...
            </div>
          ) : profile360?.timeline && profile360.timeline.length > 0 ? (
            <div className="relative border-l border-white/5 pl-4 ml-2 space-y-5 py-2">
              {profile360.timeline.map((event) => (
                <div key={event.id} className="relative">
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-teal-500 ring-4 ring-slate-950" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-white">{event.title}</span>
                    <span className="text-[11px] text-slate-400">{event.description}</span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(event.timestamp).toLocaleDateString()} at {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-900/30 p-6 rounded-2xl border border-white/5 border-dashed text-center text-slate-500 text-xs">
              No recent timeline history or records matched for this account.
            </div>
          )}
        </div>
      </div>

      {clientActions}

      {showEmailModal && (
        <CommunicationModal
          client={client as any}
          user={user}
          onClose={() => setShowEmailModal(false)}
          onSent={() => setShowEmailModal(false)}
        />
      )}
    </div>
  );
};

// ── Lead Qualification Modal ──────────────────────────────────────────────────
interface QualifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  onConfirm: (leadId: string, clientData: { industry: string; value: number }) => void;
}

const QualifyModal: React.FC<QualifyModalProps> = ({ isOpen, onClose, lead, onConfirm }) => {
  const [industry, setIndustry] = useState('');
  const [value, setValue] = useState('2500');

  return (
    <DetailDrawer
      open={isOpen && Boolean(lead)}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Convert Lead to Client"
      description={lead ? `Qualifying ${lead.name} creates a customer account and active deal.` : undefined}
    >
      {lead && (
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Industry</label>
            <input
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              placeholder="e.g. Technology, Finance, E-commerce"
              className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Deal Target Value ($)</label>
            <input
              type="number"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="Target contract value"
              className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-bold text-slate-400 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(lead.id, { industry, value: parseFloat(value) || 0 })}
              className="flex-1 py-2.5 text-xs font-bold text-white bg-teal-500 rounded-xl hover:bg-teal-400 transition-colors"
            >
              Qualify Account
            </button>
          </div>
        </div>
      )}
    </DetailDrawer>
  );
};

// ── Lead Creation Drawer ────────────────────────────────────────────────────────
interface CreateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    type: 'lead' | 'client';
    name: string;
    email: string;
    phone: string;
    company: string;
    source: string;
    industry: string;
    value: number;
  }) => void;
}

const CreateDrawer: React.FC<CreateDrawerProps> = ({ isOpen, onClose, onSave }) => {
  const [type, setType] = useState<'lead' | 'client'>('lead');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [source, setSource] = useState('Manual');
  const [industry, setIndustry] = useState('');
  const [value, setValue] = useState('');

  const handleSave = () => {
    if (!name) {
      toast.error('Name is required');
      return;
    }
    onSave({
      type, name, email, phone, company, source, industry, value: parseFloat(value) || 0
    });
    setName(''); setEmail(''); setPhone(''); setCompany(''); setSource('Manual'); setIndustry(''); setValue('');
  };

  return (
    <DetailDrawer
      open={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Add Entity to CRM"
    >
      <div className="space-y-4 pt-2">
        <div className="flex border border-white/5 p-1 rounded-xl bg-slate-950">
          {(['lead', 'client'] as const).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg capitalize transition-colors ${type === t ? 'bg-teal-500 text-white' : 'text-slate-500'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <Input
            label="Full Name *"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. John Doe"
            validate={(v) => !v.trim() ? 'Name is required' : undefined}
          />
        </div>

        <div className="space-y-1">
          <Input
            label="Email address"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="e.g. john@example.com"
            validate={(v) => v.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? 'Enter a valid email' : undefined}
          />
        </div>

        <div className="space-y-1">
          <Input
            label="Phone number"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="e.g. +1 234 567 890"
            validate={(v) => v.trim() && v.replace(/\D/g, '').length < 7 ? 'Enter a valid phone number' : undefined}
          />
        </div>

        <div className="space-y-1">
          <Input
            label="Company / business name"
            value={company}
            onChange={e => setCompany(e.target.value)}
            placeholder="e.g. Acme Corp"
          />
        </div>

        {type === 'lead' ? (
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Lead Source</label>
            <select
              value={source}
              onChange={e => setSource(e.target.value)}
              className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-teal-500/50"
            >
              {['LinkedIn', 'WhatsApp', 'Referral', 'Website', 'Manual'].map(src => (
                <option key={src} value={src}>{src}</option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Industry</label>
              <input
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                placeholder="e.g. Real Estate"
                className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target Portfolio Value ($)</label>
              <input
                type="number"
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
              />
            </div>
          </>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-xs font-bold text-slate-400 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 text-xs font-bold text-white bg-teal-500 rounded-xl hover:bg-teal-400 transition-colors"
          >
            Save Record
          </button>
        </div>
      </div>
    </DetailDrawer>
  );
};

// ── Main CRMTab Component ──────────────────────────────────────────────────────
const STATUS_FILTERS: { label: string; value: LeadStatus | 'all' }[] = [
  { label: 'All Statuses', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'Contacted', value: 'contacted' },
  { label: 'Qualified', value: 'qualified' },
  { label: 'Disqualified', value: 'disqualified' },
];

// ── Pipeline Kanban ──────────────────────────────────────────────────────────
const KANBAN_COLUMNS: { status: LeadStatus; label: string; accent: string; dot: string }[] = [
  { status: 'new', label: 'New', accent: 'border-sky-500/30', dot: 'bg-sky-400' },
  { status: 'contacted', label: 'Contacted', accent: 'border-amber-500/30', dot: 'bg-amber-400' },
  { status: 'qualified', label: 'Qualified', accent: 'border-teal-500/30', dot: 'bg-teal-400' },
  { status: 'disqualified', label: 'Disqualified', accent: 'border-rose-500/30', dot: 'bg-rose-400' },
];

const KanbanCard: React.FC<{
  lead: Lead;
  onClick: () => void;
  overlay?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (lead: Lead) => void;
}> = ({ lead, onClick, overlay, isSelected, onToggleSelect }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id, data: { status: lead.status } });
  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={onClick}
      className={`group cursor-grab active:cursor-grabbing rounded-xl border border-white/5 bg-slate-900 p-3 shadow-sm hover:border-teal-500/30 transition-colors ${isDragging && !overlay ? 'opacity-30' : ''} ${overlay ? 'rotate-2 shadow-2xl shadow-black/40 ring-1 ring-teal-500/40' : ''} ${isSelected ? 'border-teal-500/50 bg-teal-500/10' : ''}`}
    >
      <div className="flex items-center gap-2.5">
        {onToggleSelect && !overlay && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onToggleSelect(lead); }}
            className="flex-shrink-0 text-slate-500 hover:text-teal-400"
            aria-label={isSelected ? 'Deselect lead' : 'Select lead'}
          >
            {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-teal-400" /> : <Square className="w-3.5 h-3.5" />}
          </button>
        )}
        <div className={`w-8 h-8 rounded-lg ${hashColor(lead.name)} flex items-center justify-center flex-shrink-0`}>
          <span className="text-[11px] font-black text-white">{getInitials(lead.name)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white truncate">{lead.name}</p>
          <p className="text-[10px] text-slate-500 truncate">{lead.company || lead.business_name || lead.email || '—'}</p>
        </div>
      </div>
    </div>
  );
};

const KanbanColumn: React.FC<{
  col: typeof KANBAN_COLUMNS[number];
  leads: Lead[];
  onSelect: (l: Lead) => void;
  selectedKeys?: Set<string>;
  onToggleSelect?: (lead: Lead) => void;
}> = ({ col, leads, onSelect, selectedKeys, onToggleSelect }) => {
  const { setNodeRef, isOver } = useDroppable({ id: col.status });
  return (
    <div className="flex w-[78%] sm:w-72 flex-shrink-0 flex-col">
      <div className="flex items-center justify-between px-2 pb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${col.dot}`} />
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">{col.label}</span>
        </div>
        <span className="text-[10px] font-bold text-slate-500 bg-slate-800/60 rounded-full px-2 py-0.5">{leads.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[120px] rounded-2xl border ${col.accent} ${isOver ? 'bg-teal-500/10 border-teal-500/40' : 'bg-slate-950/40'} p-2 space-y-2 transition-colors`}
      >
        {leads.map(l => (
          <KanbanCard
            key={l.id}
            lead={l}
            onClick={() => onSelect(l)}
            isSelected={selectedKeys?.has(entityKey({ type: 'lead', id: l.id }))}
            onToggleSelect={onToggleSelect}
          />
        ))}
        {leads.length === 0 && (
          <p className="text-center text-[10px] text-slate-600 py-6">Drop leads here</p>
        )}
      </div>
    </div>
  );
};

const LeadKanban: React.FC<{
  leads: Lead[];
  onUpdate: (id: string, status: LeadStatus) => void;
  onSelect: (l: Lead) => void;
  selectedKeys?: Set<string>;
  onToggleSelect?: (lead: Lead) => void;
}> = ({ leads, onUpdate, onSelect, selectedKeys, onToggleSelect }) => {
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragStart = (e: DragStartEvent) => {
    setActiveLead(leads.find(l => l.id === e.active.id) || null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveLead(null);
    const { active, over } = e;
    if (!over) return;
    const newStatus = over.id as LeadStatus;
    const lead = leads.find(l => l.id === active.id);
    if (lead && lead.status !== newStatus && KANBAN_COLUMNS.some(c => c.status === newStatus)) {
      onUpdate(lead.id, newStatus);
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto p-4 h-full items-start scrollbar-hide">
        {KANBAN_COLUMNS.map(col => (
          <KanbanColumn
            key={col.status}
            col={col}
            leads={leads.filter(l => l.status === col.status)}
            onSelect={onSelect}
            selectedKeys={selectedKeys}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead ? <KanbanCard lead={activeLead} onClick={() => {}} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
};

const CRMTab: React.FC<CRMTabProps> = ({ user }) => {
  const { currentTenant } = useTenant();
  const router = useRouter();
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();
  const { t } = useLanguage();

  // Unified State Management
  const [subView, setSubView] = useState<SubView>('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<BusinessClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LeadStatus | 'all'>('all');
  const [accountFilter, setAccountFilter] = useState<'all' | 'customer' | 'prospect' | 'lead' | 'lost'>('all');
  const [leadsView, setLeadsView] = useState<'list' | 'board'>('list');
  const [search, setSearch] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<CRMEntity | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const crmListRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const loadMoreEntities = useCallback(() => setVisibleCount((c) => c + 40), []);
  // Realtime transparency: recently changed record IDs get a brief row flash
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const flashRecord = useCallback((id: string) => {
    setFlashIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setFlashIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2500);
  }, []);

  const [presenceMap, setPresenceMap] = useState<Record<string, 'online' | 'away' | 'busy' | 'offline'>>({});
  const [teamsPresenceMap, setTeamsPresenceMap] = useState<Record<string, 'online' | 'away' | 'busy' | 'offline'>>({});
  const [isTeamsConnected, setIsTeamsConnected] = useState<boolean>(false);

  // Modals / Drawers
  const [isQualifyOpen, setIsQualifyOpen] = useState(false);
  const [qualifyingLead, setQualifyingLead] = useState<Lead | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLeadImportOpen, setIsLeadImportOpen] = useState(false);
  const [isSyncingContacts, setIsSyncingContacts] = useState(false);

  useEffect(() => {
    const checkTeamsConnection = async () => {
      if (currentTenant?.id) {
        try {
          const { config } = await microsoft365Service.getMicrosoft365Config(currentTenant.id);
          setIsTeamsConnected(!!config?.services?.teams);
        } catch (err) {
          console.warn('Failed to check Teams connection:', err);
          setIsTeamsConnected(false);
        }
      }
    };
    checkTeamsConnection();
  }, [currentTenant?.id]);

  useEffect(() => {
    const fetchPresences = async () => {
      const { data } = await supabase
        .from('user_presence')
        .select('user_id, status');
      if (data) {
        const initialMap: Record<string, 'online' | 'away' | 'busy' | 'offline'> = {};
        data.forEach((p: any) => {
          initialMap[p.user_id] = p.status;
        });
        setPresenceMap(initialMap);
      }
    };
    fetchPresences();

    const unsubscribe = presenceService.subscribeToPresence((presence) => {
      setPresenceMap((prev) => ({
        ...prev,
        [presence.user_id]: presence.status,
      }));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Realtime: visibly update the leads list when records change (no silent updates)
  useEffect(() => {
    if (!currentTenant?.id) return;
    const channel = supabase
      .channel(`crm-leads-${currentTenant.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads', filter: `tenant_id=eq.${currentTenant.id}` },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (payload.eventType === 'INSERT' && payload.new) {
            setLeads((prev) => {
              if (prev.some((l) => l.id === payload.new.id)) return prev;
              return [{ ...payload.new, name: payload.new.business_name || payload.new.name || 'Lead' } as Lead, ...prev];
            });
            flashRecord(payload.new.id);
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            setLeads((prev) => prev.map((l) => (l.id === payload.new.id ? { ...l, ...payload.new } : l)));
            flashRecord(payload.new.id);
          } else if (payload.eventType === 'DELETE' && row?.id) {
            setLeads((prev) => prev.filter((l) => l.id !== row.id));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTenant?.id, flashRecord]);

  useEffect(() => {
    if (isTeamsConnected && currentTenant?.id) {
      const fetchTeamsPresences = async () => {
        const allEntities = [...leads, ...clients];
        const newTeamsMap: Record<string, 'online' | 'away' | 'busy' | 'offline'> = {};
        await Promise.all(
          allEntities.map(async (entity) => {
            if (entity.email) {
              const { status } = await microsoft365Service.fetchTeamsPresence(currentTenant.id, entity.email);
              newTeamsMap[entity.id] = status;
            }
          })
        );
        setTeamsPresenceMap(newTeamsMap);
      };
      fetchTeamsPresences();
    }
  }, [isTeamsConnected, currentTenant?.id, leads, clients]);

  // Open the create drawer automatically when arriving via "Quick Add" (?quickAdd=true)
  useEffect(() => {
    if (searchParams?.get('quickAdd') === 'true') {
      setIsCreateOpen(true);
    }
  }, [searchParams]);

  // Fetch data across leads & unified contacts
  const loadCRMData = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      const [leadsResult, unifiedResult] = await Promise.all([
        leadService.getLeads(),
        contactService.getUnifiedContactsList({ limit: 500 }),
      ]);

      if (leadsResult.error) {
        throw new Error(leadsResult.error);
      }
      if (unifiedResult.error) {
        throw new Error(unifiedResult.error);
      }

      const openLeads = leadsResult.leads.filter(
        (lead) => !lead.client_id && lead.stage !== 'converted'
      );

      setLeads(
        openLeads.map((lead) => {
          const mappedStatus = (['new', 'contacted', 'qualified', 'disqualified'].includes(
            lead.status || ''
          )
            ? lead.status
            : lead.stage === 'qualified'
              ? 'qualified'
              : lead.stage === 'contacted'
                ? 'contacted'
                : 'new') as LeadStatus;
          return {
            id: lead.id,
            name: lead.businessName || 'Unknown Lead',
            business_name: lead.businessName,
            email: lead.email,
            phone: lead.phone,
            company: lead.businessName || '',
            source: lead.source,
            status: mappedStatus,
            created_at: lead.created_at || new Date().toISOString(),
            tenant_id: currentTenant.id,
          };
        })
      );

      setClients(
        unifiedResult.contacts.map((contact) => ({
          id: contact.business_client_id || contact.id,
          tenant_id: contact.tenant_id,
          name: contact.full_name,
          email: contact.email ?? undefined,
          phone: contact.phone ?? undefined,
          sales_stage:
            contact.lifecycle_stage === 'customer'
              ? 'customer'
              : contact.lifecycle_stage === 'prospect'
                ? 'prospect'
                : 'lead',
          value: 0,
          created_at: contact.created_at,
          is_active: true,
        }))
      );
    } catch (err) {
      console.error('Failed to sync CRM resources:', err);
      toast.error('Failed to load CRM data');
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  const handleSyncOutlookContacts = async () => {
    if (!currentTenant?.id) return;

    setIsSyncingContacts(true);
    try {
      const contacts = await microsoftGraphService.getContacts(50);
      const normalized = contacts
        .map((contact: any) => ({
          name:
            contact.displayName ||
            [contact.givenName, contact.surname].filter(Boolean).join(' ') ||
            contact.emailAddresses?.[0]?.address ||
            'Outlook Contact',
          email: contact.emailAddresses?.[0]?.address || null,
          phone: contact.businessPhones?.[0] || contact.mobilePhone || null,
          industry: contact.companyName || contact.department || 'Outlook',
          location: [
            contact.businessAddress?.street,
            contact.businessAddress?.city,
            contact.businessAddress?.state,
            contact.businessAddress?.countryOrRegion,
          ]
            .filter(Boolean)
            .join(', '),
        }))
        .filter((contact: any) => contact.email);

      const { processed, error: syncError } = await contactService.bulkUpsertOutlookImports(
        currentTenant.id,
        normalized
      );
      if (syncError) throw new Error(syncError);

      toast.success(`Outlook sync complete: ${processed} contacts processed`);
      await loadCRMData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to sync Outlook contacts');
    } finally {
      setIsSyncingContacts(false);
    }
  };

  useEffect(() => {
    loadCRMData();
  }, [loadCRMData]);

  useEffect(() => {
    setSelectedKeys(new Set());
    setVisibleCount(50);
  }, [subView, leadsView, filter, accountFilter, search]);

  const toggleEntitySelection = useCallback((entity: CRMEntity) => {
    const key = entityKey(entity);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleLeadSelection = useCallback((lead: Lead) => {
    toggleEntitySelection({ type: 'lead', id: lead.id } as CRMEntity);
  }, [toggleEntitySelection]);

  const handleBulkDelete = async () => {
    if (selectedKeys.size === 0) return;

    const leadIds: string[] = [];
    const clientIds: string[] = [];
    selectedKeys.forEach((key) => {
      const [type, id] = key.split(':');
      if (!id) return;
      if (type === 'lead') leadIds.push(id);
      else clientIds.push(id);
    });

    const total = leadIds.length + clientIds.length;
    if (!total) return;

    const noun = subView === 'leads' ? 'lead' : 'contact';
    if (!confirm(`Delete ${total} ${noun}(s)? This cannot be undone.`)) return;

    setBulkDeleting(true);
    const toastId = toast.loading(`Deleting ${total}...`);
    try {
      if (leadIds.length) {
        const { error } = await leadService.bulkDeleteLeads(leadIds);
        if (error) throw new Error(error);
        setLeads((prev) => prev.filter((l) => !leadIds.includes(l.id)));
      }
      if (clientIds.length) {
        const { error } = await businessClientService.bulkArchiveClients(clientIds);
        if (error) throw new Error(error);
        setClients((prev) => prev.filter((c) => !clientIds.includes(c.id)));
      }

      const deletedEntityKey = selectedEntity ? entityKey(selectedEntity) : null;
      const shouldClearDetail = deletedEntityKey ? selectedKeys.has(deletedEntityKey) : false;
      setSelectedKeys(new Set());
      if (shouldClearDetail) {
        setSelectedEntity(null);
      }
      toast.success(`Deleted ${total} ${noun}(s)`, { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk delete failed', { id: toastId });
      await loadCRMData();
    } finally {
      setBulkDeleting(false);
    }
  };

  // Lead status transition
  const handleStatusUpdate = async (id: string, status: LeadStatus) => {
    try {
      const { error } = await leadService.updateLead(id, { status });
      if (error) throw new Error(error);
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
      if (selectedEntity?.id === id) {
        setSelectedEntity(prev => prev ? { ...prev, status } : null);
      }
      toast.success(`Status updated to ${status}`);
    } catch (err) {
      toast.error('Failed to update lead status');
    }
  };

  const handleLeadSave = async (
    id: string,
    patch: { name: string; email?: string; phone?: string; company?: string },
  ) => {
    try {
      const { error } = await leadService.updateLead(id, {
        businessName: patch.name,
        email: patch.email ?? undefined,
        phone: patch.phone ?? undefined,
      });
      if (error) throw new Error(error);
      setLeads((prev) => prev.map((l) => (l.id === id ? {
        ...l,
        name: patch.name,
        email: patch.email,
        phone: patch.phone,
        company: patch.company,
        business_name: patch.name,
      } : l)));
      setSelectedEntity((prev) => {
        if (!prev?.rawLead || prev.rawLead.id !== id) return prev;
        const updatedLead = {
          ...prev.rawLead,
          name: patch.name,
          email: patch.email,
          phone: patch.phone,
          company: patch.company,
          business_name: patch.name,
        };
        return {
          ...prev,
          name: patch.name,
          email: patch.email,
          phone: patch.phone,
          company: patch.company,
          rawLead: updatedLead,
        };
      });
      toast.success('Lead updated');
    } catch {
      toast.error('Failed to update lead');
    }
  };

  const handleClientSave = async (clientId: string, patch: Partial<BusinessClient>) => {
    const { error } = await businessClientService.updateClient(clientId, {
      name: patch.name,
      email: patch.email,
      phone: patch.phone,
      industry: patch.industry,
      website: patch.website,
      description: patch.description,
      salesStage: patch.sales_stage,
      value: patch.value,
    });
    if (error) throw new Error(error);
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, ...patch } : c)));
    setSelectedEntity((prev) => {
      if (!prev?.rawClient || prev.rawClient.id !== clientId) return prev;
      const updatedClient = { ...prev.rawClient, ...patch };
      return {
        ...prev,
        name: patch.name ?? prev.name,
        email: patch.email ?? prev.email,
        phone: patch.phone ?? prev.phone,
        industry: patch.industry ?? prev.industry,
        rawClient: updatedClient,
      };
    });
    toast.success('Client updated');
  };

  // Convert/Qualify Lead to Client & active Deal
  const handleQualifyLead = (lead: Lead) => {
    setQualifyingLead(lead);
    setIsQualifyOpen(true);
  };

  const handleConfirmQualify = async (leadId: string, clientData: { industry: string; value: number }) => {
    const targetLead = leads.find(l => l.id === leadId);
    if (!targetLead) return;

    setIsQualifyOpen(false);
    const resolveToast = toast.loading('Converting lead & provisioning account...');

    try {
      // 1. Atomic conversion: contacts + business_clients via RPC
      const { contactId, clientId, error: convertErr } = await contactService.convertLeadToContact(
        leadId,
        { contactName: targetLead.name, companyName: targetLead.company || targetLead.name }
      );
      if (convertErr || !contactId) throw new Error(convertErr || 'Lead conversion failed');

      // 2. Enrich business_client metadata from qualify form
      if (clientId) {
        const { error: clientUpdateErr } = await businessClientService.updateClient(clientId, {
          industry: clientData.industry || 'General Services',
          salesStage: 'customer',
          value: clientData.value,
          description: `Converted qualified lead on ${new Date().toLocaleDateString()}`,
        });
        if (clientUpdateErr) throw new Error(clientUpdateErr);
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('You must be signed in to create a deal');

      const { error: dealErr } = await dealService.createDeal(authUser.id, {
        name: `${targetLead.name} - Acquisition`,
        value: clientData.value,
        stage: 'qualified',
        contactId,
        description: 'Qualified from CRM workspace',
      });
      if (dealErr) throw new Error(dealErr);

      toast.success('Lead converted to Customer & Deal active!', { id: resolveToast });
      showActionNextSteps('lead_qualified', (path) => router.push(path));
      setSelectedEntity(null);
      loadCRMData();
    } catch (err) {
      console.error('Lead conversion failure:', err);
      toast.error('Conversion process failed', { id: resolveToast });
    }
  };

  // Add Lead/Client manually
  const handleCreateEntity = async (entity: {
    type: 'lead' | 'client';
    name: string;
    email: string;
    phone: string;
    company: string;
    source: string;
    industry: string;
    value: number;
  }) => {
    setIsCreateOpen(false);
    const saveToast = toast.loading('Saving record...');
    try {
      if (entity.type === 'lead') {
        const { error } = await leadService.addLead({
          businessName: entity.name,
          email: entity.email,
          phone: entity.phone,
          industry: entity.industry || undefined,
          source: entity.source || 'manual',
          stage: 'lead',
          value: entity.value || 0,
        });
        if (error) throw new Error(error);
      } else {
        const { error } = await businessClientService.createClient(currentTenant!.id, {
          name: entity.name,
          email: entity.email,
          phone: entity.phone,
          industry: entity.industry || 'General',
          salesStage: 'customer',
          value: entity.value,
          description: 'Manually added client',
        });
        if (error) throw new Error(error);
      }
      toast.success('Record added successfully', { id: saveToast });
      loadCRMData();
    } catch (err) {
      toast.error('Failed to create record', { id: saveToast });
    }
  };

  // Transform leads and clients into a standardized array
  const entities: CRMEntity[] = React.useMemo(() => {
    const list: CRMEntity[] = [];

    // Leads
    (leads || []).forEach(l => {
      list.push({
        type: 'lead',
        id: l.id,
        name: l.name,
        email: l.email,
        phone: l.phone,
        company: l.company,
        source: l.source,
        status: l.status,
        created_at: l.created_at,
        rawLead: l
      });
    });

    // Clients
    (clients || []).forEach(c => {
      const isClient = c.sales_stage === 'customer';
      list.push({
        type: isClient ? 'client' : 'contact',
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        company: c.industry || 'Private Account',
        source: c.custom_fields?.source || 'Direct',
        status: c.sales_stage,
        created_at: c.created_at,
        value: c.value,
        industry: c.industry,
        rawClient: c
      });
    });

    return list;
  }, [leads, clients]);

  // Filtering Logic
  const filteredEntities = entities.filter(ent => {
    // 1. Subview Tab filter
    if (subView === 'leads' && ent.type !== 'lead') return false;
    if (subView === 'clients' && ent.type !== 'client') return false;
    if (subView === 'contacts' && (ent.type !== 'client' && ent.type !== 'contact')) return false;

    // 2. Status pill filter (leads only)
    if (subView === 'leads' && filter !== 'all' && ent.status !== filter) return false;

    // 2b. Account stage filter (clients/contacts views) — lets you isolate customers, prospects or lost accounts
    if ((subView === 'clients' || subView === 'contacts') && accountFilter !== 'all') {
      const stage = ent.rawClient?.sales_stage;
      if (stage !== accountFilter) return false;
    }

    // 3. Search text matching
    if (search) {
      const query = search.toLowerCase();
      const matchName = ent.name.toLowerCase().includes(query);
      const matchEmail = ent.email?.toLowerCase().includes(query) || false;
      const matchCompany = ent.company?.toLowerCase().includes(query) || false;
      return matchName || matchEmail || matchCompany;
    }

    return true;
  });

  const selectedCount = selectedKeys.size;

  const filteredKanbanLeads = leads.filter((l) => {
    if (filter !== 'all' && l.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        (l.email?.toLowerCase().includes(q) || false) ||
        (l.company?.toLowerCase().includes(q) || false)
      );
    }
    return true;
  });

  const bulkSelectTargetKeys =
    subView === 'leads' && leadsView === 'board'
      ? filteredKanbanLeads.map((l) => entityKey({ type: 'lead', id: l.id }))
      : filteredEntities.map(entityKey);

  useInfiniteScroll(crmListRef, loadMoreEntities, {
    enabled: leadsView === 'list' && filteredEntities.length > visibleCount,
  });
  const visibleEntities = filteredEntities.slice(0, visibleCount);

  const allBulkSelected =
    bulkSelectTargetKeys.length > 0 && bulkSelectTargetKeys.every((k) => selectedKeys.has(k));

  // Calculate summaries for stats indicators
  const totalLeadsCount = (leads || []).length;
  const activeClientsCount = (clients || []).filter(c => c.sales_stage === 'customer').length;
  const totalClientValue = (clients || []).filter(c => c.sales_stage === 'customer').reduce((sum, c) => sum + (c.value || 0), 0);

  const crmStats = React.useMemo<ModuleStat[]>(() => [
    { label: t('Leads Pool'), value: totalLeadsCount.toLocaleString(), sub: t('In the funnel'), Icon: Target, accent: 'purple' },
    { label: t('Customers'), value: activeClientsCount.toLocaleString(), sub: t('Won accounts'), Icon: UserCheck, accent: 'teal' },
    { label: t('Active Book'), value: `$${totalClientValue.toLocaleString()}`, sub: t('Customer value'), Icon: DollarSign, accent: 'emerald' },
  ], [t, totalLeadsCount, activeClientsCount, totalClientValue]);

  return (
    <div className="flex flex-col min-h-0 ac-scroll-full ac-enterprise-module bg-slate-950 select-none relative">
      <ModulePageLayout
        showBonnieDock
        header={(
          <div className="px-4 pt-3 space-y-3 shrink-0">
            <CRMNav pathname={pathname} />
            <OperationalWorkflowStrip moduleId="crm" userRole={user.role} />
          </div>
        )}
        stats={(
          <>
            <div className="p-4 border-b border-white/5 bg-slate-900/20">
              <ModuleStatCards stats={crmStats} className="grid-cols-1 sm:grid-cols-3 lg:grid-cols-3" />
            </div>
            <div className="px-4 pb-2">
              <RevenueLeakagePanel leakageOnly heading={t('Pipeline integrity')} />
            </div>
          </>
        )}
        toolbar={(
          <>
            <div className="flex border-b border-white/5 bg-slate-950">
              {([
                { key: 'leads', label: t('Leads'), count: leads.length },
                { key: 'clients', label: t('Customers'), count: activeClientsCount },
                { key: 'contacts', label: t('Contacts'), count: clients.length },
              ] as { key: SubView; label: string; count: number }[]).map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => {
                    setSubView(key);
                    setSelectedEntity(null);
                    setAccountFilter('all');
                  }}
                  className={`flex-1 py-3.5 text-xs font-bold capitalize transition-colors ${subView === key ? 'text-teal-400 border-b-2 border-teal-400' : 'text-slate-500'}`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
            <div className="px-4 py-3 space-y-2.5 bg-slate-950/80 sticky top-0 z-10 backdrop-blur-md">
        {isTeamsConnected && (
          <div className="flex items-center justify-between rounded-xl border border-blue-500/10 bg-blue-500/5 px-3 py-2">
            <div>
              <p className="text-xs font-bold text-blue-200">Outlook Contact Sync</p>
              <p className="text-[11px] text-slate-400">Import Microsoft contacts into the existing CRM.</p>
            </div>
            <button
              type="button"
              onClick={handleSyncOutlookContacts}
              disabled={isSyncingContacts}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              {isSyncingContacts ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Sync from Outlook
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 bg-slate-900 border border-white/5 rounded-xl px-3 h-10 shadow-inner">
          <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${subView}...`}
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
          />
          {search && (
            <button onClick={() => setSearch('')} className="p-1 text-slate-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Lead filters */}
        {subView === 'leads' && (
          <>
          <div className="flex items-center gap-2">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide py-0.5 flex-1">
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`flex-shrink-0 h-8 px-3.5 rounded-full text-xs font-bold transition-all border ${
                    filter === f.value
                      ? 'bg-teal-500 text-white border-teal-500 shadow-md shadow-teal-500/10'
                      : 'bg-slate-900 text-slate-400 border-white/5 hover:border-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center rounded-lg border border-white/5 bg-slate-900 p-0.5 flex-shrink-0">
              {(['list', 'board'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setLeadsView(v)}
                  className={`px-2.5 h-7 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors ${leadsView === v ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  {v}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIsLeadImportOpen(true)}
              className="flex-shrink-0 h-8 px-3 rounded-full text-xs font-bold bg-violet-500/15 text-violet-400 border border-violet-500/30 hover:bg-violet-500/25 transition-colors"
            >
              Import pool
            </button>
          </div>
          <p className="hidden sm:block text-[10px] text-slate-500 pt-0.5">
            {leadsView === 'board'
              ? <>Tip: <span className="text-teal-300 font-semibold">drag a card</span> between columns to move a lead across the pipeline.</>
              : <>Tip: hover a lead to <span className="text-amber-400 font-semibold">contact</span>, <span className="text-teal-300 font-semibold">qualify</span> or <span className="text-rose-400 font-semibold">disqualify</span> it — or swipe on mobile.</>}
          </p>
          </>
        )}

        {/* Account stage filters (clients & contacts) */}
        {(subView === 'clients' || subView === 'contacts') && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide py-0.5">
            {([
              { label: 'All', value: 'all' as const },
              { label: 'Customers', value: 'customer' as const },
              { label: 'Prospects', value: 'prospect' as const },
              { label: 'Lost', value: 'lost' as const },
            ]).map(f => (
              <button
                key={f.value}
                onClick={() => setAccountFilter(f.value)}
                className={`flex-shrink-0 h-8 px-3.5 rounded-full text-xs font-bold transition-all border ${
                  accountFilter === f.value
                    ? 'bg-teal-500 text-white border-teal-500 shadow-md shadow-teal-500/10'
                    : 'bg-slate-900 text-slate-400 border-white/5 hover:border-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Bulk selection toolbar */}
        {!loading && (filteredEntities.length > 0 || (subView === 'leads' && leadsView === 'board' && filteredKanbanLeads.length > 0)) && (
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => {
                if (allBulkSelected) {
                  setSelectedKeys(new Set());
                } else {
                  setSelectedKeys(new Set(bulkSelectTargetKeys));
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              {allBulkSelected ? <CheckSquare className="w-3.5 h-3.5 text-teal-400" /> : <Square className="w-3.5 h-3.5" />}
              {allBulkSelected ? 'Deselect all' : `Select all (${bulkSelectTargetKeys.length})`}
            </button>
            {selectedCount > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedKeys(new Set())}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:text-rose-300 disabled:opacity-50"
                >
                  {bulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Delete ({selectedCount})
                </button>
              </div>
            )}
          </div>
        )}
            </div>
          </>
        )}
      >
      <div ref={crmListRef} className={`flex-1 ac-scroll-full bg-slate-950 ${subView === 'leads' && leadsView === 'board' ? 'min-h-[420px]' : ''}`}>
        {!loading && subView === 'leads' && leadsView === 'board' ? (
          <LeadKanban
            leads={filteredKanbanLeads}
            onUpdate={handleStatusUpdate}
            onSelect={(l) => setSelectedEntity(entities.find(e => e.id === l.id) || null)}
            selectedKeys={selectedKeys}
            onToggleSelect={toggleLeadSelection}
          />
        ) : loading ? (
          <div className="space-y-px">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-900/30 animate-pulse" />
            ))}
          </div>
        ) : filteredEntities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500 px-4 text-center">
            <Users className="w-12 h-12 mb-3 opacity-30 text-teal-400" />
            <p className="text-sm font-bold text-slate-300">{t('No matching records')}</p>
            <p className="text-xs text-slate-500 max-w-xs mt-1 leading-normal">
              {subView === 'leads' ? t('Swipe right to qualify/contact accounts, swipe left to archive.') : t('Add accounts or qualify leads to view them here.')}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile View - Card List */}
            <ResponsiveTableMobile className="md:hidden">
              {visibleEntities.map(entity => (
                <MobileDataCard
                  key={entity.id}
                  onClick={() => setSelectedEntity(entity)}
                  className={[
                    selectedKeys.has(entityKey(entity)) ? 'ring-1 ring-teal-500/50' : '',
                    flashIds.has(entity.id) ? 'animate-pulse bg-teal-500/10' : '',
                  ].filter(Boolean).join(' ') || undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleEntitySelection(entity); }}
                      className="flex-shrink-0 text-slate-500 hover:text-teal-400"
                      aria-label={selectedKeys.has(entityKey(entity)) ? 'Deselect' : 'Select'}
                    >
                      {selectedKeys.has(entityKey(entity)) ? (
                        <CheckSquare className="w-4 h-4 text-teal-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white">{entity.name}</p>
                      <p className="text-sm text-slate-400">{entity.email || entity.phone || '-'}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${entity.status === 'new' ? 'bg-purple-500/20 text-purple-300' : entity.status === 'contacted' ? 'bg-blue-500/20 text-blue-300' : entity.status === 'qualified' ? 'bg-teal-500/20 text-teal-300' : 'bg-slate-500/20 text-slate-400'}`}>
                      {t(entity.status)}
                    </span>
                  </div>
                </MobileDataCard>
              ))}
            </ResponsiveTableMobile>

            {/* Desktop View - Table List */}
            <ResponsiveTableDesktop className="hidden md:block">
              <div className="divide-y divide-white/5">
                {visibleEntities.map(entity => (
                  <div key={entity.id} className={flashIds.has(entity.id) ? 'bg-teal-500/10 transition-colors duration-1000' : 'transition-colors duration-1000'}>
                  <SwipeableRow
                    entity={entity}
                    status={isTeamsConnected ? (teamsPresenceMap[entity.id] || 'offline') : (presenceMap[entity.id] || 'offline')}
                    isTeamsConnected={isTeamsConnected}
                    onMarkContacted={(id) => handleStatusUpdate(id, 'contacted')}
                    onDisqualify={(id) => handleStatusUpdate(id, 'disqualified')}
                    onQualify={(ent) => ent.rawLead && handleQualifyLead(ent.rawLead)}
                    onTap={setSelectedEntity}
                    isSelected={selectedKeys.has(entityKey(entity))}
                    onToggleSelect={toggleEntitySelection}
                  />
                  </div>
                ))}
              </div>
            </ResponsiveTableDesktop>
            {filteredEntities.length > visibleCount && (
              <button
                type="button"
                onClick={loadMoreEntities}
                className="w-full py-3 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white bg-slate-900/40 border-t border-white/5 transition-colors"
              >
                {t('Showing')} {visibleCount} / {filteredEntities.length} — {t('scroll to load more')}
              </button>
            )}
          </>
        )}
      </div>
      </ModulePageLayout>

      {/* FAB (Add Entity drawer trigger) */}
      <button
        onClick={() => setIsCreateOpen(true)}
        className="fixed bottom-20 right-4 md:absolute md:bottom-6 md:right-6 w-14 h-14 bg-teal-500 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/20 z-40 hover:bg-teal-400 active:scale-95 transition-all"
      >
        <UserPlus className="w-6 h-6 text-white" />
      </button>

      {/* Qualify dialog */}
      <QualifyModal
        isOpen={isQualifyOpen}
        onClose={() => setIsQualifyOpen(false)}
        lead={qualifyingLead}
        onConfirm={handleConfirmQualify}
      />

      {/* Create entity drawer */}
      <CreateDrawer
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSave={handleCreateEntity}
      />

      <LeadImportModal
        isOpen={isLeadImportOpen}
        onClose={() => setIsLeadImportOpen(false)}
        onImportComplete={() => {
          setIsLeadImportOpen(false);
          loadCRMData();
        }}
      />

      <DetailDrawer
        open={Boolean(selectedEntity?.type === 'lead' && selectedEntity.rawLead)}
        onOpenChange={(open) => { if (!open) setSelectedEntity(null); }}
        title={selectedEntity?.rawLead?.name || 'Lead'}
        size="wide"
      >
        {selectedEntity?.type === 'lead' && selectedEntity.rawLead && (
          <LeadDetail
            lead={selectedEntity.rawLead}
            onBack={() => setSelectedEntity(null)}
            onUpdate={handleStatusUpdate}
            onQualify={handleQualifyLead}
            onSaveLead={handleLeadSave}
            inDrawer
          />
        )}
      </DetailDrawer>

      <DetailDrawer
        open={Boolean(selectedEntity?.rawClient)}
        onOpenChange={(open) => { if (!open) setSelectedEntity(null); }}
        title={selectedEntity?.rawClient?.name || 'Client'}
        size="wide"
      >
        {selectedEntity?.rawClient && (
          <Client360Detail
            client={selectedEntity.rawClient}
            user={user}
            onBack={() => setSelectedEntity(null)}
            onClientSaved={handleClientSave}
            onNewDeal={() => {
              setSelectedEntity(null);
              router.push('/dashboard/deals');
            }}
            onDraftContract={() => {
              setSelectedEntity(null);
              router.push(user.role === 'tenant_admin' ? '/dashboard/business/contracts' : '/dashboard/contracts');
            }}
            status={isTeamsConnected ? (teamsPresenceMap[selectedEntity.id] || 'offline') : (presenceMap[selectedEntity.id] || 'offline')}
            isTeamsConnected={isTeamsConnected}
            inDrawer
          />
        )}
      </DetailDrawer>
    </div>
  );
};

export default CRMTab;
