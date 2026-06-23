import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent
} from '@dnd-kit/core';
import { 
  SortableContext, 
  arrayMove, 
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Lead, leadService } from '@/services/leadService';
import { CrmNextStepsPanel } from './CrmNextStepsPanel';
import { buildLeadKanbanNextSteps } from '@/lib/crmNextSteps';
import { buildMailComposeUrl } from '@/lib/email/composeNavigation';
import { assertLeadStageTransition } from '@/lib/stageProgression';
import { Mail, Phone, MapPin, Sparkles, AlertCircle, ShieldCheck, GripVertical, CheckCircle2, Plus, X } from 'lucide-react';
import AIOutreachModal from '../business/AIOutreachModal';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { Avatar } from '@/components/ui/Avatar';
import LeadDetailModal from '@/components/dashboard/leads/LeadDetailModal';
import { useSearchParams, useRouter } from 'next/navigation';

// Define the columns/stages based on the database
const KANBAN_STAGES = [
  { id: 'lead', title: 'Discovered', color: 'bg-slate-800' },
  { id: 'qualified', title: 'Qualified', color: 'bg-blue-900/20' },
  { id: 'proposal', title: 'Proposal', color: 'bg-indigo-900/20' },
  { id: 'negotiation', title: 'Negotiation', color: 'bg-amber-900/20' },
  { id: 'won', title: 'Closed Won', color: 'bg-emerald-900/20' },
  { id: 'lost', title: 'Closed Lost', color: 'bg-rose-900/20' },
];

/** ------------------------------------------------------------------
 * KANBAN CARD COMPONENT
 * ------------------------------------------------------------------- */
function KanbanCard({
  lead,
  isOverlay = false,
  onOpenLead,
  isSelected = false,
  onToggleSelect,
}: {
  lead: Lead;
  isOverlay?: boolean;
  onOpenLead?: (lead: Lead) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { type: 'Lead', lead },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex gap-1.5 p-2 sm:p-3 bg-slate-900 border ${
        isDragging ? 'border-teal-500 shadow-xl z-50' : 'border-slate-800'
      } rounded-xl shadow-sm hover:shadow-md transition-shadow group
      ${isOverlay ? 'scale-105 shadow-2xl rotate-2 z-50 border-teal-500' : ''}`}
    >
      <div className="flex flex-col gap-2 shrink-0 pt-0.5">
        <button
          type="button"
          className="p-1 rounded-md text-slate-400 hover:text-teal-400 hover:bg-slate-800 cursor-grab active:cursor-grabbing"
          aria-label="Drag to move lead"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        {!isOverlay && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(lead.id);
            }}
            className={`p-1 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-teal-500 border-teal-500' : 'border-slate-700 hover:border-teal-500'}`}
          >
            {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
          </button>
        )}
      </div>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (isOverlay) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenLead?.(lead);
          }
        }}
        onClick={() => !isOverlay && onOpenLead?.(lead)}
        className="flex flex-col gap-2 flex-1 min-w-0 cursor-pointer text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* 36px Circular Initials */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-indigo-600 flex items-center justify-center font-bold text-white text-[13px] shrink-0 shadow-sm">
              {(lead.businessName || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-sm text-white truncate">{lead.businessName}</h4>
              
              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                {lead.industry && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 truncate max-w-full">
                    {lead.industry}
                  </span>
                )}
                
                {/* Leads source/status badge */}
                {lead.source && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 uppercase">
                    {lead.source}
                  </span>
                )}
                {lead.status && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                    {lead.status}
                  </span>
                )}

                {/* Client stage pill */}
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-400 uppercase tracking-wider">
                  {lead.stage}
                </span>
              </div>
            </div>
          </div>
        </div>

        {(lead.email || lead.phone || lead.location) && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
            {lead.location && (
              <div className="flex items-center gap-1 min-w-0">
                <MapPin className="w-3 h-3 shrink-0" />{' '}
                <span className="truncate max-w-[140px]">{lead.location}</span>
              </div>
            )}
            {lead.email && (
              <div className="flex items-center gap-1 min-w-0">
                <Mail className="w-3 h-3 shrink-0" />{' '}
                <span className="truncate max-w-[140px]">{lead.email}</span>
              </div>
            )}
            {lead.phone && (
              <div className="flex items-center gap-1 min-w-0">
                <Phone className="w-3 h-3 shrink-0" />{' '}
                <span className="truncate max-w-[140px]">{lead.phone}</span>
              </div>
            )}
          </div>
        )}

        <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {lead.trustScore ? (
              <div
                className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                  lead.trustScore >= 80
                    ? 'bg-emerald-900/20 text-emerald-400'
                    : lead.trustScore >= 50
                      ? 'bg-amber-900/20 text-amber-400'
                      : 'bg-red-900/20 text-red-400'
                }`}
              >
                {lead.trustScore >= 80 ? <ShieldCheck className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                Score: {lead.trustScore}
              </div>
            ) : (
              <div />
            )}
          </div>
          {lead.sdrInsight && (
            <div title="AI Analyzed" className="w-5 h-5 rounded-full bg-indigo-900/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-3 h-3 text-indigo-500" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** ------------------------------------------------------------------
 * KANBAN COLUMN COMPONENT
 * ------------------------------------------------------------------- */
function KanbanColumn({
    column,
    leads,
    onOpenLead,
    selectedLeadIds,
    onToggleSelect,
}: {
    column: { id: string; title: string; color: string };
    leads: Lead[];
    onOpenLead: (lead: Lead) => void;
    selectedLeadIds: string[];
    onToggleSelect: (id: string) => void;
}) {
  const { setNodeRef } = useSortable({
    id: column.id,
    data: { type: 'Column', column },
  });

  return (
    <div
      className={`flex flex-col w-[min(88vw,300px)] shrink-0 snap-center rounded-2xl md:w-auto md:min-w-0 md:max-w-none md:shrink md:snap-none ${column.color} border border-slate-700/30 overflow-hidden`}
    >
      <div className="p-3 bg-slate-900/50 backdrop-blur-sm border-b border-slate-800 flex items-center justify-between sticky top-0 z-10">
        <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
            {column.title}
            <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full text-slate-400 font-medium">
                {leads?.length || 0}
            </span>
        </h3>
      </div>
      
      <div ref={setNodeRef} className="flex-1 min-h-[240px] max-h-[min(72vh,640px)] p-2 overflow-y-auto flex flex-col gap-2 relative">
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <KanbanCard 
              key={lead.id} 
              lead={lead} 
              onOpenLead={onOpenLead} 
              isSelected={selectedLeadIds.includes(lead.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </SortableContext>
        {leads.length === 0 && (
            <div className="pointer-events-none absolute inset-0 m-4 border-2 border-dashed border-slate-600/30 rounded-xl flex items-center justify-center text-xs text-slate-400 font-medium text-center px-4">
                Drag leads here to update pipeline
            </div>
        )}
      </div>
    </div>
  );
}

const MobileLeadContactDrawer = ({ isOpen, onClose, lead, onStageSelect, onOpenFullDetails }: any) => {
  const router = useRouter();
  if (!lead) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm md:hidden"
          />
          {/* Drawer container */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] bg-slate-950 border-t border-white/10 rounded-t-[2.5rem] shadow-2xl flex flex-col overflow-hidden md:hidden"
          >
            {/* Grab Handle */}
            <div className="flex justify-center py-3 shrink-0 bg-slate-900/40 border-b border-white/5">
              <div className="w-12 h-1 bg-white/20 rounded-full" />
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar pb-12 space-y-6">
              {/* Header: Circle Initials & Name */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-400 to-indigo-600 flex items-center justify-center font-black text-white text-2xl shadow-xl shadow-teal-500/10 shrink-0">
                  {(lead.businessName || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
                    {lead.industry || 'Unknown Industry'}
                  </span>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight truncate mt-0.5">
                    {lead.businessName}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                    <span className="text-xs text-slate-400">Trust Score: <span className="text-teal-400 font-bold">{lead.trustScore || 'N/A'}</span></span>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-full bg-white/5 text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Dot Selectors */}
              <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono mb-3 text-center">
                  Stage Pipeline Controller
                </p>
                <div className="flex items-center justify-between px-2">
                  {KANBAN_STAGES.map((stage) => {
                    const isActive = lead.stage === stage.id;
                    let dotColor = 'bg-slate-600';
                    if (stage.id === 'lead') dotColor = 'bg-slate-400';
                    else if (stage.id === 'qualified') dotColor = 'bg-blue-400';
                    else if (stage.id === 'proposal') dotColor = 'bg-indigo-400';
                    else if (stage.id === 'negotiation') dotColor = 'bg-amber-400';
                    else if (stage.id === 'won') dotColor = 'bg-emerald-400';
                    else if (stage.id === 'lost') dotColor = 'bg-rose-400';

                    return (
                      <button
                        key={stage.id}
                        onClick={() => onStageSelect(lead.id, stage.id)}
                        className="flex flex-col items-center gap-1.5 focus:outline-none relative group"
                        title={`Move to ${stage.title}`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                          isActive 
                            ? 'scale-110 ring-2 ring-teal-500 ring-offset-2 ring-offset-slate-950 bg-white/10' 
                            : 'hover:bg-white/5'
                        }`}>
                          <span className={`w-3.5 h-3.5 rounded-full ${dotColor} ${isActive ? 'scale-110 shadow-lg shadow-current' : 'opacity-60'}`} />
                        </div>
                        <span className={`text-[9px] font-mono uppercase tracking-wider ${isActive ? 'text-white font-bold' : 'text-slate-500'}`}>
                          {stage.title.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Contact Actions (Call, Email, Map) */}
              <div className="grid grid-cols-3 gap-3">
                {lead.phone ? (
                  <a
                    href={`tel:${lead.phone}`}
                    className="flex flex-col items-center gap-2 p-3 bg-slate-900 border border-white/5 hover:border-teal-500/30 rounded-2xl transition-all"
                  >
                    <div className="p-2 bg-teal-500/10 rounded-xl">
                      <Phone className="w-5 h-5 text-teal-400" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 font-mono">Call</span>
                  </a>
                ) : (
                  <div className="flex flex-col items-center gap-2 p-3 bg-slate-900/30 border border-dashed border-white/5 rounded-2xl opacity-40">
                    <Phone className="w-5 h-5 text-slate-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 font-mono">No Phone</span>
                  </div>
                )}

                {lead.email ? (
                  <button
                    type="button"
                    onClick={() => router.push(buildMailComposeUrl(lead.email, `Re: ${lead.businessName || 'your inquiry'}`))}
                    className="flex flex-col items-center gap-2 p-3 bg-slate-900 border border-white/5 hover:border-teal-500/30 rounded-2xl transition-all"
                  >
                    <div className="p-2 bg-indigo-500/10 rounded-xl">
                      <Mail className="w-5 h-5 text-indigo-400" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 font-mono">Email</span>
                  </button>
                ) : (
                  <div className="flex flex-col items-center gap-2 p-3 bg-slate-900/30 border border-dashed border-white/5 rounded-2xl opacity-40">
                    <Mail className="w-5 h-5 text-slate-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 font-mono">No Email</span>
                  </div>
                )}

                {lead.location ? (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(lead.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-2 p-3 bg-slate-900 border border-white/5 hover:border-teal-500/30 rounded-2xl transition-all"
                  >
                    <div className="p-2 bg-amber-500/10 rounded-xl">
                      <MapPin className="w-5 h-5 text-amber-400" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 font-mono">Locate</span>
                  </a>
                ) : (
                  <div className="flex flex-col items-center gap-2 p-3 bg-slate-900/30 border border-dashed border-white/5 rounded-2xl opacity-40">
                    <MapPin className="w-5 h-5 text-slate-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 font-mono">No Map</span>
                  </div>
                )}
              </div>

              {/* SDR Insights Section */}
              {lead.sdrInsight && (
                <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-indigo-500/10 rounded-lg">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-white font-mono">AI Outreach Strategy</h4>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-950/40 p-3.5 rounded-2xl border border-white/5">
                    {lead.sdrInsight}
                  </p>
                </div>
              )}

              {/* Full Details Trigger */}
              <button
                onClick={() => {
                  onOpenFullDetails();
                  onClose();
                }}
                className="w-full py-4 bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/10 rounded-2xl text-center text-xs font-black uppercase tracking-widest text-white transition-all"
              >
                Open Full Conversation Hub
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

/** ------------------------------------------------------------------
 * MAIN BOARD COMPONENT
 * ------------------------------------------------------------------- */
export default function KanbanBoard() {
  const [columns, setColumns] = useState(KANBAN_STAGES);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileDrawerLead, setMobileDrawerLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);

  const handleOpenLead = (lead: Lead) => {
    if (window.innerWidth < 768) {
      setMobileDrawerLead(lead);
      setMobileDrawerOpen(true);
    } else {
      setDetailLead(lead);
    }
  };

  const handleStageUpdate = async (leadId: string, newStage: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    const originStage = lead.stage;
    const check = assertLeadStageTransition(originStage, newStage);
    if (!check.ok) {
      toast.error(check.message);
      return;
    }
    
    // Optimistically update local states
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: newStage } : l));
    if (mobileDrawerLead && mobileDrawerLead.id === leadId) {
      setMobileDrawerLead(prev => prev ? { ...prev, stage: newStage } : null);
    }
    if (detailLead && detailLead.id === leadId) {
      setDetailLead(prev => prev ? { ...prev, stage: newStage } : null);
    }

    try {
      const { error } = await leadService.updateLead(leadId, { stage: newStage });
      if (error) throw new Error(error);
      toast.success(`Moved to ${KANBAN_STAGES.find(s => s.id === newStage)?.title}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update stage');
      // Rollback
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: originStage } : l));
      if (mobileDrawerLead && mobileDrawerLead.id === leadId) {
        setMobileDrawerLead(prev => prev ? { ...prev, stage: originStage } : null);
      }
      if (detailLead && detailLead.id === leadId) {
        setDetailLead(prev => prev ? { ...prev, stage: originStage } : null);
      }
    }
  };
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [showOutreachModal, setShowOutreachModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const dragOriginStageRef = useRef<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [sourceFilter, setSourceFilter] = useState<'all' | 'ai_mcp' | 'manual'>('all');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadLeads = useCallback(async () => {
    setLoading(true);
    const { leads: dbLeads, error } = await leadService.getLeads();
    if (error) {
        toast.error('Failed to load CRM pipeline');
    } else {
        // Map any unknown/legacy stages to the first column so they remain visible.
        const mappedLeads = (dbLeads || []).map(l => {
            if (!KANBAN_STAGES.find(c => c.id === l.stage)) {
                return { ...l, stage: 'lead' }; // Default to first column if unknown
            }
            return l;
        });
        setLeads(mappedLeads);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLeads();
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) setCurrentUserId(data.user.id);
    };
    fetchUser();
  }, [loadLeads]);

  const leadNextSteps = useMemo(() => buildLeadKanbanNextSteps(leads), [leads]);
  const normalizedSource = useCallback((source: string | undefined) => String(source || '').trim().toLowerCase(), []);
  const sourceBucket = useCallback((lead: Lead): 'ai_mcp' | 'manual' => {
    const src = normalizedSource(lead.source);
    if (src.includes('mcp') || src.includes('claude') || src.includes('ai')) return 'ai_mcp';
    return 'manual';
  }, [normalizedSource]);

  useEffect(() => {
    const sourceParam = String(searchParams?.get('source') || '').trim().toLowerCase();
    if (sourceParam === 'mcp' || sourceParam === 'claude' || sourceParam === 'ai') {
      setSourceFilter('ai_mcp');
      return;
    }
    if (sourceParam === 'manual') {
      setSourceFilter('manual');
      return;
    }
    setSourceFilter('all');
  }, [searchParams]);

  const visibleLeads = useMemo(() => {
    if (sourceFilter === 'all') return leads || [];
    return (leads || []).filter((lead) => sourceBucket(lead) === sourceFilter);
  }, [leads, sourceFilter, sourceBucket]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    KANBAN_STAGES.forEach((stage) => {
      counts[stage.id] = visibleLeads.filter((lead) => lead.stage === stage.id).length;
    });
    return counts;
  }, [visibleLeads]);

  const sourceCounts = useMemo(
    () => ({
      all: leads.length,
      ai_mcp: leads.filter((lead) => sourceBucket(lead) === 'ai_mcp').length,
      manual: leads.filter((lead) => sourceBucket(lead) === 'manual').length,
    }),
    [leads, sourceBucket]
  );

  const activeId = activeLead?.id;

  const onDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const { data } = active;
    if (data.current?.type === 'Lead') {
      const l = data.current.lead as Lead;
      dragOriginStageRef.current = l.stage;
      setActiveLead(l);
    }
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveALead = active.data.current?.type === 'Lead';
    const isOverALead = over.data.current?.type === 'Lead';
    const isOverAColumn = over.data.current?.type === 'Column';

    if (!isActiveALead) return;

    // Dropping a Lead over another Lead
    if (isActiveALead && isOverALead) {
      setLeads((leads) => {
        const activeIndex = leads.findIndex((l) => l.id === activeId);
        const overIndex = leads.findIndex((l) => l.id === overId);
        const activeLeadData = leads[activeIndex];
        const overLeadData = leads[overIndex];
        
        // If moving to a different column
        if (activeLeadData.stage !== overLeadData.stage) {
            activeLeadData.stage = overLeadData.stage;
            return arrayMove(leads, activeIndex, overIndex);
        }

        return arrayMove(leads, activeIndex, overIndex);
      });
    }

    // Dropping a Lead over a Column
    if (isActiveALead && isOverAColumn) {
      setLeads((leads) => {
        const activeIndex = leads.findIndex((l) => l.id === activeId);
        const newStage = overId as string;
        
        if (leads[activeIndex].stage !== newStage) {
            const updated = [...leads];
            updated[activeIndex].stage = newStage;
            return updated;
        }
        return leads;
      });
    }
  };

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveLead(null);
    const originStage = dragOriginStageRef.current;
    dragOriginStageRef.current = null;
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    const lead = leads.find(l => l.id === leadId);
    
    if (lead) {
        const overData = over.data.current;
        let newStage = lead.stage;
        
        if (overData?.type === 'Column') {
            newStage = over.id as string;
        } else if (overData?.type === 'Lead') {
            newStage = overData.lead.stage;
        }

        if (newStage && originStage != null) {
            const check = assertLeadStageTransition(originStage, newStage);
            if (!check.ok) {
                toast.error(check.message);
                await loadLeads();
                return;
            }
            try {
                await toast.promise(
                    (async () => {
                        const { error } = await leadService.updateLead(lead.id, { stage: newStage });
                        if (error) throw new Error(error);
                    })(),
                    {
                        loading: 'Syncing pipeline...',
                        success: 'Pipeline updated',
                        error: (err) => (err instanceof Error ? err.message : 'Failed to update pipeline'),
                    }
                );
            } catch {
                await loadLeads();
            }
        }
    }
  };

  if (loading) {
      return (
          <div className="w-full min-h-[240px] flex items-center justify-center p-12">
              <div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full" />
          </div>
      );
  }

  return (
    <div className="w-full min-w-0 p-3 sm:p-4 pb-8 overflow-x-auto md:overflow-x-visible">
        <CrmNextStepsPanel
            heading="Lead execution"
            subheading="Each card should move toward a clear decision: qualify, propose, win, or exit with a reason."
            items={leadNextSteps}
        />
        <div className="mb-4 p-3 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none h-8 shrink-0">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold whitespace-nowrap mr-1">Lead source view</span>
              {[
                { value: 'all', label: `All (${sourceCounts.all})` },
                { value: 'ai_mcp', label: `Claude/MCP (${sourceCounts.ai_mcp})` },
                { value: 'manual', label: `Manual (${sourceCounts.manual})` }
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setSourceFilter(filter.value as any)}
                  className={`h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                    sourceFilter === filter.value
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm shadow-teal-600/10'
                      : 'bg-slate-900 text-slate-400 border-slate-750 hover:text-white hover:bg-slate-800'
                  }`}
                  style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                >
                  {filter.label}
                </button>
              ))}
              <button
                onClick={() => {
                  if (selectedLeadIds.length > 0) {
                    setSelectedLeadIds([]);
                  } else {
                    const batch = visibleLeads.slice(0, 20).map(l => l.id);
                    setSelectedLeadIds(batch);
                    if (visibleLeads.length > 20) {
                      toast.success('Selected first 20 leads for bulk outreach.');
                    }
                  }
                }}
                className="h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-all border bg-slate-900 text-slate-400 border-slate-750 hover:text-teal-400 hover:bg-slate-800"
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              >
                {selectedLeadIds.length > 0 ? 'Deselect All' : 'Select All (Max 20)'}
              </button>
            </div>
            {selectedLeadIds.length > 0 && (
              <button
                onClick={() => setShowOutreachModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold rounded-lg transition-all shadow-lg shadow-teal-500/20 h-8 self-start sm:self-auto"
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              >
                <Sparkles className="w-3.5 h-3.5" /> Bulk Outreach ({selectedLeadIds.length})
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            {KANBAN_STAGES.map((stage) => (
              <div key={stage.id} className="px-2 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs text-slate-300 flex justify-between">
                <span>{stage.title}</span>
                <span className="font-bold text-white">{stageCounts[stage.id] || 0}</span>
              </div>
            ))}
          </div>
        </div>
        <DndContext 
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
        >
            <div className="flex md:grid md:grid-cols-6 gap-3 md:gap-4 min-h-[280px] snap-x snap-proximity md:snap-none pb-4 items-stretch">
                <SortableContext items={columns.map(c => c.id)}>
                    {columns.map((col) => (
                        <KanbanColumn
                            key={col.id}
                            column={col}
                            leads={visibleLeads.filter((l) => l.stage === col.id)}
                            onOpenLead={handleOpenLead}
                            selectedLeadIds={selectedLeadIds}
                            onToggleSelect={(id) => {
                                setSelectedLeadIds(prev => {
                                    if (prev.includes(id)) return prev.filter(i => i !== id);
                                    if (prev.length >= 20) {
                                        toast.error('Bulk outreach limited to 20 leads at once.');
                                        return prev;
                                    }
                                    return [...prev, id];
                                });
                            }}
                        />
                    ))}
                </SortableContext>
            </div>
            
            {/* Overlay for drag preview */}
            <DragOverlay>
                {activeLead ? <KanbanCard lead={activeLead} isOverlay /> : null}
            </DragOverlay>

        </DndContext>

        {detailLead && (
          <LeadDetailModal
            isOpen
            lead={detailLead}
            onClose={() => setDetailLead(null)}
            onLeadUpdate={(updated) => {
              setLeads((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
              setDetailLead((d) => (d && d.id === updated.id ? { ...d, ...updated } : d));
            }}
          />
        )}

        <MobileLeadContactDrawer
            isOpen={mobileDrawerOpen}
            onClose={() => setMobileDrawerOpen(false)}
            lead={mobileDrawerLead}
            onStageSelect={handleStageUpdate}
            onOpenFullDetails={() => {
                if (mobileDrawerLead) {
                    setDetailLead(mobileDrawerLead);
                }
            }}
        />

        <AIOutreachModal
            isOpen={showOutreachModal}
            onClose={() => setShowOutreachModal(false)}
            userId={currentUserId}
            initialSelectedLeads={selectedLeadIds}
        />

        {/* FAB for Mobile */}
        <button
          onClick={() => {
            router.push(window.location.pathname + '?add=true');
          }}
          className="fixed bottom-20 right-4 z-50 md:hidden w-14 h-14 rounded-full bg-teal-600 hover:bg-teal-500 text-white flex items-center justify-center shadow-lg shadow-teal-600/35 cursor-pointer active:scale-95 transition-transform"
          style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
        >
          <Plus className="w-6 h-6" />
        </button>
    </div>
  );
}

