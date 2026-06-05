'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, Search, X, Phone, Mail, Building,
  MessageCircle, Clock,
  UserCheck, Users, ArrowLeft, Star, AlertCircle,
  ShieldCheck, DollarSign, Activity, Loader2, Smartphone, Video,
  ChevronRight, TrendingUp, Sparkles, AlertTriangle, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';
import { User } from '../../types';
import toast from 'react-hot-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { dailyService } from '../../services/dailyService';
import { churnPropensityService, ChurnRiskReport } from '@/services/intelligence/churnPropensityService';
import { customer360Service, Customer360Profile } from '@/services/intelligence/customer360Service';
import { presenceService } from '@/services/presenceService';
import { microsoft365Service } from '@/services/microsoft365Service';
import { microsoftGraphService } from '@/services/microsoftGraphService';
import { missedCallsService } from '@/services/missedCallsService';
import OnlineStatusBadge from './OnlineStatusBadge';

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
  onTap: (entity: CRMEntity) => void;
}> = ({ entity, status, isTeamsConnected, onMarkContacted, onDisqualify, onTap }) => {
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
        className="relative z-10 bg-slate-950/60 flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-slate-900/40 active:bg-slate-900/60 transition-colors"
        onClick={() => onTap(entity)}
      >
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
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md capitalize flex-shrink-0 ${sourceColors[entity.source.toLowerCase()] || 'bg-slate-800 text-slate-400'}`}>
                {entity.source}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400 truncate block">
            {entity.company ? `${entity.company} • ` : ''}{entity.email || entity.phone || 'No contact details'}
          </span>
        </div>

        {/* Right */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-xs font-bold text-teal-400">
            {entity.value ? `$${entity.value.toLocaleString()}` : ''}
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${statusColors[entity.status] || 'bg-slate-800 text-slate-300'}`}>
              {entity.status}
            </span>
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
}> = ({ lead, onBack, onUpdate, onQualify }) => {
  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
      <div className="flex items-center gap-3 p-4 border-b border-white/5 bg-slate-900/60 sticky top-0 z-20 backdrop-blur-md">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">
          <ArrowLeft className="w-4 h-4 text-slate-300" />
        </button>
        <span className="text-sm font-bold text-white">Lead Details</span>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-28">
        {/* Header Profile */}
        <div className="flex flex-col items-center gap-2 py-4">
          <div className={`w-20 h-20 rounded-2xl ${hashColor(lead.name)} flex items-center justify-center shadow-lg shadow-black/30`}>
            <span className="text-2xl font-black text-white">{getInitials(lead.name)}</span>
          </div>
          <h2 className="text-xl font-bold text-white text-center mt-2">{lead.name}</h2>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-bold px-3 py-1 rounded-full border capitalize ${statusColors[lead.status]}`}>
              {lead.status}
            </span>
            {lead.source && (
              <span className={`text-[11px] font-bold px-3 py-1 rounded-full border capitalize ${sourceColors[lead.source.toLowerCase()] || 'bg-slate-800 text-slate-400'}`}>
                {lead.source}
              </span>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl divide-y divide-white/5">
          <div className="flex items-center gap-3 p-4">
            <Mail className="w-5 h-5 text-slate-500 flex-shrink-0" />
            <div>
              <span className="block text-[11px] text-slate-500 font-bold uppercase tracking-wider">Email Address</span>
              <span className="text-sm text-slate-300">{lead.email || '—'}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4">
            <Phone className="w-5 h-5 text-slate-500 flex-shrink-0" />
            <div>
              <span className="block text-[11px] text-slate-500 font-bold uppercase tracking-wider">Phone Number</span>
              <span className="text-sm text-slate-300">{lead.phone || '—'}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4">
            <Building className="w-5 h-5 text-slate-500 flex-shrink-0" />
            <div>
              <span className="block text-[11px] text-slate-500 font-bold uppercase tracking-wider">Company</span>
              <span className="text-sm text-slate-300">{lead.company || lead.business_name || '—'}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4">
            <Clock className="w-5 h-5 text-slate-500 flex-shrink-0" />
            <div>
              <span className="block text-[11px] text-slate-500 font-bold uppercase tracking-wider">Created At</span>
              <span className="text-sm text-slate-300">
                {new Date(lead.created_at).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action footer */}
      <div className="fixed bottom-0 left-0 right-0 md:absolute bg-slate-950/95 border-t border-white/5 flex divide-x divide-white/5 pb-[env(safe-area-inset-bottom,0px)] z-30">
        <button
          onClick={() => onUpdate(lead.id, 'contacted')}
          className="flex-1 flex flex-col items-center justify-center py-3.5 gap-1 hover:bg-slate-900 transition-colors"
        >
          <Phone className="w-5 h-5 text-amber-400" />
          <span className="text-[10px] text-slate-400 font-bold">Mark Contacted</span>
        </button>
        <button
          onClick={() => onQualify(lead)}
          className="flex-1 flex flex-col items-center justify-center py-3.5 gap-1 hover:bg-slate-900 transition-colors bg-teal-500/5"
        >
          <Sparkles className="w-5 h-5 text-teal-400 animate-pulse" />
          <span className="text-[10px] text-teal-300 font-bold">Qualify & Convert</span>
        </button>
        <button
          onClick={() => onUpdate(lead.id, 'disqualified')}
          className="flex-1 flex flex-col items-center justify-center py-3.5 gap-1 hover:bg-slate-900 transition-colors"
        >
          <X className="w-5 h-5 text-rose-500" />
          <span className="text-[10px] text-slate-400 font-bold">Disqualify</span>
        </button>
      </div>
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
  status: 'online' | 'away' | 'busy' | 'offline';
  isTeamsConnected: boolean;
}> = ({ client, user, onBack, onNewDeal, onDraftContract, status, isTeamsConnected }) => {
  const { currentTenant } = useTenant();
  const router = useRouter();

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
      router.push(`/dashboard/call/${call.id}`);
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
    window.open(`https://wa.me/${phoneClean}?text=Hello%20${encodeURIComponent(client.name)},`, '_blank');
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
      {/* Sticky header */}
      <div className="flex items-center gap-3 p-4 border-b border-white/5 bg-slate-900/60 sticky top-0 z-20 backdrop-blur-md">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">
          <ArrowLeft className="w-4 h-4 text-slate-300" />
        </button>
        <span className="text-sm font-bold text-white">Client 360 Workspace</span>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-28">
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
          <h2 className="text-xl font-bold text-white text-center mt-2">{client.name}</h2>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-bold px-3 py-1 rounded-full border capitalize ${statusColors[client.sales_stage]}`}>
              {client.sales_stage}
            </span>
            {client.industry && (
              <span className="text-[11px] font-bold px-3 py-1 rounded-full border border-slate-700 bg-slate-900/60 text-slate-400 capitalize">
                {client.industry}
              </span>
            )}
            {isTeamsConnected && (
              <span className="text-[11px] font-bold px-3 py-1 rounded-full border border-purple-500/30 bg-purple-950/40 text-purple-300 flex items-center gap-1.5 shadow-sm shadow-purple-500/10 animate-pulse">
                Teams Synced
              </span>
            )}
          </div>
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
            onClick={() => router.push(`/dashboard/mail?to=${encodeURIComponent(client.email || '')}`)}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 transition-all active:scale-95 group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <Mail className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-[10px] text-slate-400 font-bold">SMTP Mail</span>
          </button>
          <button
            onClick={() => router.push(`/dashboard/messages?selectedClientId=${client.id}`)}
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

      {/* Action Footer */}
      <div className="fixed bottom-0 left-0 right-0 md:absolute bg-slate-950/95 border-t border-white/5 flex divide-x divide-white/5 pb-[env(safe-area-inset-bottom,0px)] z-30">
        <button
          onClick={() => onNewDeal(client)}
          className="flex-1 flex flex-col items-center justify-center py-3.5 gap-1 hover:bg-slate-900 transition-colors"
        >
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          <span className="text-[10px] text-slate-400 font-bold">Add Deal</span>
        </button>
        <button
          onClick={() => onDraftContract(client)}
          className="flex-1 flex flex-col items-center justify-center py-3.5 gap-1 hover:bg-slate-900 transition-colors bg-teal-500/5"
        >
          <ShieldCheck className="w-5 h-5 text-teal-400" />
          <span className="text-[10px] text-teal-300 font-bold">Draft Contract</span>
        </button>
        <button
          onClick={() => router.push('/dashboard/business/billing')}
          className="flex-1 flex flex-col items-center justify-center py-3.5 gap-1 hover:bg-slate-900 transition-colors"
        >
          <DollarSign className="w-5 h-5 text-blue-400" />
          <span className="text-[10px] text-slate-400 font-bold">Create Invoice</span>
        </button>
      </div>
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

  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in-up">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Convert Lead to Client</h3>
          <button onClick={onClose} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-xs text-slate-400 leading-normal">
            Qualifying <span className="text-white font-bold">{lead.name}</span> will create a customer account and launch an active sales deal in your pipeline.
          </p>

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
        </div>
        <div className="p-4 border-t border-white/5 bg-slate-950/40 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-xs font-bold text-slate-400 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(lead.id, { industry, value: parseFloat(value) || 0 })}
            className="flex-1 py-2 text-xs font-bold text-white bg-teal-500 rounded-xl hover:bg-teal-400 transition-colors shadow-lg shadow-teal-500/10"
          >
            Qualify Account
          </button>
        </div>
      </div>
    </div>
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

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name) {
      toast.error('Name is required');
      return;
    }
    onSave({
      type, name, email, phone, company, source, industry, value: parseFloat(value) || 0
    });
    // Reset
    setName(''); setEmail(''); setPhone(''); setCompany(''); setSource('Manual'); setIndustry(''); setValue('');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        className="bg-slate-900 border-l border-white/10 w-full max-w-md h-full flex flex-col shadow-2xl rounded-2xl overflow-hidden"
      >
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Add Entity to CRM</h3>
          <button onClick={onClose} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Full Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="e.g. john@example.com"
              className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Phone Number</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. +1 234 567 890"
              className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Company / Business Name</label>
            <input
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
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
        </div>

        <div className="p-4 border-t border-white/5 bg-slate-950/40 flex gap-2">
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
      </motion.div>
    </div>
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

const CRMTab: React.FC<CRMTabProps> = ({ user }) => {
  const { currentTenant } = useTenant();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Unified State Management
  const [subView, setSubView] = useState<SubView>('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<BusinessClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LeadStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<CRMEntity | null>(null);

  const [presenceMap, setPresenceMap] = useState<Record<string, 'online' | 'away' | 'busy' | 'offline'>>({});
  const [teamsPresenceMap, setTeamsPresenceMap] = useState<Record<string, 'online' | 'away' | 'busy' | 'offline'>>({});
  const [isTeamsConnected, setIsTeamsConnected] = useState<boolean>(false);

  // Modals / Drawers
  const [isQualifyOpen, setIsQualifyOpen] = useState(false);
  const [qualifyingLead, setQualifyingLead] = useState<Lead | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSyncingContacts, setIsSyncingContacts] = useState(false);

  useEffect(() => {
    const checkTeamsConnection = async () => {
      if (currentTenant?.id) {
        const { config } = await microsoft365Service.getMicrosoft365Config(currentTenant.id);
        setIsTeamsConnected(!!config?.services?.teams);
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

  // Fetch data across leads & business_clients
  const loadCRMData = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      const [leadsRes, clientsRes] = await Promise.all([
        supabase
          .from('leads')
          .select('*')
          .eq('tenant_id', currentTenant.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('business_clients')
          .select('*')
          .eq('tenant_id', currentTenant.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
      ]);

      if (leadsRes.data) {
        setLeads(leadsRes.data.map((row: any) => ({
          ...row,
          name: row.name || row.business_name || row.company || 'Unknown Lead',
          company: row.company || row.business_name || '',
          status: (['new', 'contacted', 'qualified', 'disqualified'].includes(row.status) ? row.status : 'new') as LeadStatus,
          created_at: row.created_at || new Date().toISOString()
        })));
      }

      if (clientsRes.data) {
        setClients(clientsRes.data);
      }
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

      const emails = normalized.map((contact: any) => contact.email);
      const { data: existingClients } = await supabase
        .from('business_clients')
        .select('id, email')
        .eq('tenant_id', currentTenant.id)
        .in('email', emails);

      const existingByEmail = new Map(
        ((existingClients as any[]) || []).map((client) => [client.email, client.id])
      );

      const inserts = normalized
        .filter((contact: any) => !existingByEmail.has(contact.email))
        .map((contact: any) => ({
          tenant_id: currentTenant.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          industry: contact.industry,
          location: contact.location || null,
          sales_stage: 'lead',
          value: 0,
          is_active: true,
          description: 'Imported from Outlook contacts',
        }));

      const updates = normalized.filter((contact: any) => existingByEmail.has(contact.email));

      if (inserts.length > 0) {
        const { error: insertError } = await supabase.from('business_clients').insert(inserts);
        if (insertError) throw insertError;
      }

      await Promise.all(
        updates.map((contact: any) =>
          supabase
            .from('business_clients')
            .update({
              name: contact.name,
              phone: contact.phone,
              industry: contact.industry,
              location: contact.location || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingByEmail.get(contact.email))
            .eq('tenant_id', currentTenant.id)
        )
      );

      toast.success(`Outlook sync complete: ${normalized.length} contacts processed`);
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

  // Lead status transition
  const handleStatusUpdate = async (id: string, status: LeadStatus) => {
    try {
      const { error } = await supabase.from('leads').update({ status }).eq('id', id);
      if (error) throw error;
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
      if (selectedEntity?.id === id) {
        setSelectedEntity(prev => prev ? { ...prev, status } : null);
      }
      toast.success(`Status updated to ${status}`);
    } catch (err) {
      toast.error('Failed to update lead status');
    }
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
      // 1. Mark lead qualified
      await supabase.from('leads').update({ status: 'qualified' }).eq('id', leadId);

      // 2. Insert business_clients record
      const { data: newClient, error: clientErr } = await supabase
        .from('business_clients')
        .insert({
          tenant_id: currentTenant?.id,
          name: targetLead.name,
          email: targetLead.email,
          phone: targetLead.phone,
          industry: clientData.industry || 'General Services',
          sales_stage: 'customer',
          value: clientData.value,
          description: `Converted qualified lead on ${new Date().toLocaleDateString()}`,
          is_active: true
        })
        .select()
        .single();

      if (clientErr) throw clientErr;

      // 3. Insert deals record linked to client
      const { error: dealErr } = await supabase
        .from('deals')
        .insert({
          tenant_id: currentTenant?.id,
          name: `${targetLead.name} - Acquisition`,
          value: clientData.value,
          stage: 'qualified',
          contact_name: targetLead.name,
          contact_email: targetLead.email,
          contact_id: newClient.id,
          score: 7
        });

      if (dealErr) throw dealErr;

      toast.success('Lead converted to Customer & Deal active!', { id: resolveToast });
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
        const { error } = await supabase.from('leads').insert({
          tenant_id: currentTenant?.id,
          name: entity.name,
          email: entity.email,
          phone: entity.phone,
          company: entity.company,
          source: entity.source,
          status: 'new'
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('business_clients').insert({
          tenant_id: currentTenant?.id,
          name: entity.name,
          email: entity.email,
          phone: entity.phone,
          industry: entity.industry || 'General',
          sales_stage: 'customer',
          value: entity.value,
          description: 'Manually added client',
          is_active: true
        });
        if (error) throw error;
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
    leads.forEach(l => {
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
    clients.forEach(c => {
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

  // Render detail views
  if (selectedEntity) {
    if (selectedEntity.type === 'lead' && selectedEntity.rawLead) {
      return (
        <LeadDetail
          lead={selectedEntity.rawLead}
          onBack={() => setSelectedEntity(null)}
          onUpdate={handleStatusUpdate}
          onQualify={handleQualifyLead}
        />
      );
    } else if (selectedEntity.rawClient) {
      return (
        <Client360Detail
          client={selectedEntity.rawClient}
          user={user}
          onBack={() => setSelectedEntity(null)}
          onNewDeal={() => {
            setSelectedEntity(null);
            router.push('/dashboard/deals');
          }}
          onDraftContract={() => {
            setSelectedEntity(null);
            router.push('/dashboard/business/contracts');
          }}
          status={isTeamsConnected ? (teamsPresenceMap[selectedEntity.id] || 'offline') : (presenceMap[selectedEntity.id] || 'offline')}
          isTeamsConnected={isTeamsConnected}
        />
      );
    }
  }

  // Calculate summaries for stats indicators
  const totalLeadsCount = leads.length;
  const activeClientsCount = clients.filter(c => c.sales_stage === 'customer').length;
  const totalClientValue = clients.filter(c => c.sales_stage === 'customer').reduce((sum, c) => sum + (c.value || 0), 0);

  return (
    <div className="flex flex-col h-full bg-slate-950 select-none relative">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-3 gap-3 p-4 bg-slate-900/20 border-b border-white/5">
        <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5 flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Leads Pool</span>
          <span className="text-base font-black text-white">{totalLeadsCount}</span>
        </div>
        <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5 flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Customers</span>
          <span className="text-base font-black text-teal-400">{activeClientsCount}</span>
        </div>
        <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5 flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active Book</span>
          <span className="text-base font-black text-white">${totalClientValue.toLocaleString()}</span>
        </div>
      </div>

      {/* Segment Tabs */}
      <div className="flex border-b border-white/5 bg-slate-950">
        {(['leads', 'clients', 'contacts'] as SubView[]).map(v => (
          <button
            key={v}
            onClick={() => {
              setSubView(v);
              setSelectedEntity(null);
            }}
            className={`flex-1 py-3.5 text-xs font-bold capitalize transition-colors ${subView === v ? 'text-teal-400 border-b-2 border-teal-400' : 'text-slate-500'}`}
          >
            {v} ({
              v === 'leads' ? leads.length :
              v === 'clients' ? activeClientsCount :
              clients.length
            })
          </button>
        ))}
      </div>

      {/* Control panel (Search & Filter) */}
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
          <div className="flex gap-2 overflow-x-auto scrollbar-hide py-0.5">
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
        )}
      </div>

      {/* List content */}
      <div className="flex-1 overflow-y-auto bg-slate-950">
        {loading ? (
          <div className="space-y-px">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-900/30 animate-pulse" />
            ))}
          </div>
        ) : filteredEntities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500 px-4 text-center">
            <Users className="w-12 h-12 mb-3 opacity-30 text-teal-400" />
            <p className="text-sm font-bold text-slate-300">No matching records</p>
            <p className="text-xs text-slate-500 max-w-xs mt-1 leading-normal">
              {subView === 'leads' ? 'Swipe right to qualify/contact accounts, swipe left to archive.' : 'Add accounts or qualify leads to view them here.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredEntities.map(entity => (
              <SwipeableRow
                key={entity.id}
                entity={entity}
                status={isTeamsConnected ? (teamsPresenceMap[entity.id] || 'offline') : (presenceMap[entity.id] || 'offline')}
                isTeamsConnected={isTeamsConnected}
                onMarkContacted={(id) => handleStatusUpdate(id, 'contacted')}
                onDisqualify={(id) => handleStatusUpdate(id, 'disqualified')}
                onTap={setSelectedEntity}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB (Add Entity drawer trigger) */}
      <button
        onClick={() => setIsCreateOpen(true)}
        className="absolute bottom-6 right-6 w-14 h-14 bg-teal-500 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/20 z-30 hover:bg-teal-400 active:scale-95 transition-all"
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
      <AnimatePresence>
        {isCreateOpen && (
          <CreateDrawer
            isOpen={isCreateOpen}
            onClose={() => setIsCreateOpen(false)}
            onSave={handleCreateEntity}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default CRMTab;
