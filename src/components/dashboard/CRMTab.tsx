'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UserPlus, Search, ChevronRight, X, Phone, Mail, Building, Globe,
  MessageCircle, Briefcase, CheckSquare, Clock, MoreVertical, Filter,
  UserCheck, Users, ArrowLeft, Star, MapPin, Tag, AlertCircle, Plus
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';
import { User } from '../../types';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

// ── Types ──────────────────────────────────────────────────────────────────────
type LeadStatus = 'new' | 'contacted' | 'qualified' | 'disqualified';
type SubView = 'leads' | 'clients' | 'contacts';

interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  source?: string;
  status: LeadStatus;
  created_at: string;
}

interface CRMTabProps {
  user: User;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
const hashColor = (name: string) => {
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500', 'bg-indigo-500'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length;
  return colors[h];
};

const sourceColors: Record<string, string> = {
  linkedin: 'bg-blue-500/15 text-blue-400',
  manual:   'bg-slate-500/15 text-slate-400',
  whatsapp: 'bg-green-500/15 text-green-400',
  referral: 'bg-purple-500/15 text-purple-400',
  website:  'bg-teal-500/15 text-teal-400',
};

const statusColors: Record<LeadStatus, string> = {
  new:           'bg-blue-500/15 text-blue-400 border-blue-500/20',
  contacted:     'bg-amber-500/15 text-amber-400 border-amber-500/20',
  qualified:     'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  disqualified:  'bg-red-500/15 text-red-400 border-red-500/20',
};

// ── Swipeable Row ──────────────────────────────────────────────────────────────
const SwipeableRow: React.FC<{
  lead: Lead;
  onMarkContacted: (id: string) => void;
  onDisqualify: (id: string) => void;
  onTap: (lead: Lead) => void;
}> = ({ lead, onMarkContacted, onDisqualify, onTap }) => {
  const x = useMotionValue(0);
  const leftOpacity  = useTransform(x, [0, 80],  [0, 1]);
  const rightOpacity = useTransform(x, [-80, 0], [1, 0]);

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 80)  { onMarkContacted(lead.id); x.set(0); }
    else if (info.offset.x < -80) { onDisqualify(lead.id); x.set(0); }
    else x.set(0);
  };

  return (
    <div className="relative overflow-hidden">
      {/* Left action (green) */}
      <motion.div style={{ opacity: leftOpacity }} className="absolute inset-y-0 left-0 w-20 bg-emerald-500 flex items-center justify-center z-0">
        <UserCheck className="w-5 h-5 text-white" />
      </motion.div>
      {/* Right action (red) */}
      <motion.div style={{ opacity: rightOpacity }} className="absolute inset-y-0 right-0 w-20 bg-red-500 flex items-center justify-center z-0">
        <X className="w-5 h-5 text-white" />
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 100 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="relative z-10 bg-slate-950 flex items-center gap-3 px-4 min-h-[56px] cursor-pointer active:bg-white/5"
        onClick={() => onTap(lead)}
      >
        {/* Avatar */}
        <div className={`w-9 h-9 rounded-full ${hashColor(lead.name)} flex items-center justify-center flex-shrink-0`}>
          <span className="text-[12px] font-black text-white">{getInitials(lead.name)}</span>
        </div>

        {/* Center */}
        <div className="flex-1 min-w-0 py-2.5">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[15px] font-semibold text-white truncate">{lead.name}</span>
            {lead.source && (
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${sourceColors[lead.source.toLowerCase()] || 'bg-slate-500/15 text-slate-400'}`}>
                {lead.source}
              </span>
            )}
          </div>
          <span className="text-[13px] text-slate-500 truncate block">{lead.email || lead.phone || '—'}</span>
        </div>

        {/* Right */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${statusColors[lead.status]}`}>
            {lead.status}
          </span>
          <span className="text-[11px] text-slate-500 opacity-55">
            {new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </motion.div>
    </div>
  );
};

// ── Lead Detail ────────────────────────────────────────────────────────────────
const LeadDetail: React.FC<{ lead: Lead; onBack: () => void; onUpdate: (id: string, status: LeadStatus) => void }> = ({ lead, onBack, onUpdate }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b border-white/5">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800">
          <ArrowLeft className="w-4 h-4 text-slate-300" />
        </button>
        <span className="text-[15px] font-bold text-white">Lead Detail</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
        {/* Header */}
        <div className="flex flex-col items-center gap-2 py-4">
          <div className={`w-16 h-16 rounded-full ${hashColor(lead.name)} flex items-center justify-center`}>
            <span className="text-xl font-black text-white">{getInitials(lead.name)}</span>
          </div>
          <h2 className="text-[20px] font-bold text-white">{lead.name}</h2>
          <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${statusColors[lead.status]}`}>{lead.status}</span>
        </div>

        {/* Contact Info */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl divide-y divide-white/5">
          {[
            { icon: Mail, label: 'Email', value: lead.email },
            { icon: Phone, label: 'Phone', value: lead.phone },
            { icon: Building, label: 'Company', value: lead.company },
            { icon: Tag, label: 'Source', value: lead.source },
          ].filter(r => r.value).map(row => (
            <div key={row.label} className="flex items-center gap-3 p-4">
              <row.icon className="w-5 h-5 text-slate-500 flex-shrink-0" />
              <span className="text-[15px] text-slate-300">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Fixed action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 border-t border-white/5 flex gap-0 divide-x divide-white/5 pb-[env(safe-area-inset-bottom,0px)]">
        {[
          { label: 'Message', icon: MessageCircle, color: 'text-sky-400' },
          { label: 'Create Deal', icon: Briefcase, color: 'text-emerald-400', fn: () => onUpdate(lead.id, 'qualified') },
          { label: 'Convert', icon: UserCheck, color: 'text-teal-400', fn: () => onUpdate(lead.id, 'qualified') },
        ].map(btn => (
          <button key={btn.label} onClick={btn.fn} className="flex-1 flex flex-col items-center justify-center h-[52px] gap-1 hover:bg-white/5 transition-colors">
            <btn.icon className={`w-5 h-5 ${btn.color}`} />
            <span className="text-[11px] text-slate-400">{btn.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ── Main CRMTab ────────────────────────────────────────────────────────────────
const STATUS_FILTERS: { label: string; value: LeadStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'Contacted', value: 'contacted' },
  { label: 'Qualified', value: 'qualified' },
  { label: 'Disqualified', value: 'disqualified' },
];

const CRMTab: React.FC<CRMTabProps> = ({ user }) => {
  const { currentTenant } = useTenant();
  const router = useRouter();
  const [subView, setSubView] = useState<SubView>('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LeadStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const loadLeads = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false });
    setLeads((data as Lead[]) || []);
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const handleStatusUpdate = async (id: string, status: LeadStatus) => {
    await supabase.from('leads').update({ status }).eq('id', id);
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    toast.success(`Lead marked as ${status}`);
  };

  const filtered = leads.filter(l => {
    if (filter !== 'all' && l.status !== filter) return false;
    if (search && !l.name.toLowerCase().includes(search.toLowerCase()) && !l.email?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (selectedLead) {
    return <LeadDetail lead={selectedLead} onBack={() => setSelectedLead(null)} onUpdate={handleStatusUpdate} />;
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Sub-view tabs */}
      <div className="flex border-b border-white/5 bg-slate-950">
        {(['leads', 'clients', 'contacts'] as SubView[]).map(v => (
          <button key={v} onClick={() => setSubView(v)} className={`flex-1 py-3 text-[13px] font-bold capitalize transition-colors ${subView === v ? 'text-teal-400 border-b-2 border-teal-400' : 'text-slate-500'}`}>
            {v}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 bg-slate-900 border border-white/5 rounded-xl px-3 h-9">
          <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${subView}...`}
            className="flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-slate-600"
          />
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`flex-shrink-0 h-[34px] px-3.5 rounded-full text-[12px] font-bold transition-all ${filter === f.value ? 'bg-teal-500 text-white' : 'bg-slate-900 text-slate-400 border border-white/5'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto bg-slate-950">
        {loading ? (
          <div className="space-y-px">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-[56px] bg-slate-900/40 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Users className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-[15px]">No {subView} found</p>
            <p className="text-[13px] opacity-55 mt-1">Swipe right to contact, left to disqualify</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map(lead => (
              <SwipeableRow
                key={lead.id}
                lead={lead}
                onMarkContacted={(id) => handleStatusUpdate(id, 'contacted')}
                onDisqualify={(id) => handleStatusUpdate(id, 'disqualified')}
                onTap={setSelectedLead}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => router.push('/dashboard/crm/new')}
        className="fixed bottom-20 right-4 w-14 h-14 bg-teal-500 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/30 z-30"
      >
        <UserPlus className="w-6 h-6 text-white" />
      </button>
    </div>
  );
};

export default CRMTab;
