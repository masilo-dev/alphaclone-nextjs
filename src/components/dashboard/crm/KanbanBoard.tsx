import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { assertLeadStageTransition } from '@/lib/stageProgression';
import { Mail, Phone, MapPin, Sparkles, AlertCircle, ShieldCheck, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import { Avatar } from '@/components/ui/Avatar';
import LeadDetailModal from '@/components/dashboard/leads/LeadDetailModal';
import { useSearchParams } from 'next/navigation';

// Define the columns/stages based on the database
const KANBAN_STAGES = [
  { id: 'lead', title: 'Discovered', color: 'bg-slate-100 dark:bg-slate-800' },
  { id: 'qualified', title: 'Qualified', color: 'bg-blue-50 dark:bg-blue-900/20' },
  { id: 'proposal', title: 'Proposal', color: 'bg-indigo-50 dark:bg-indigo-900/20' },
  { id: 'negotiation', title: 'Negotiation', color: 'bg-amber-50 dark:bg-amber-900/20' },
  { id: 'won', title: 'Closed Won', color: 'bg-emerald-50 dark:bg-emerald-900/20' },
  { id: 'lost', title: 'Closed Lost', color: 'bg-rose-50 dark:bg-rose-900/20' },
];

/** ------------------------------------------------------------------
 * KANBAN CARD COMPONENT
 * ------------------------------------------------------------------- */
function KanbanCard({
  lead,
  isOverlay = false,
  onOpenLead,
}: {
  lead: Lead;
  isOverlay?: boolean;
  onOpenLead?: (lead: Lead) => void;
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
      className={`relative flex gap-1.5 p-2 sm:p-3 bg-white dark:bg-slate-900 border ${
        isDragging ? 'border-teal-500 shadow-xl z-50' : 'border-slate-200 dark:border-slate-800'
      } rounded-xl shadow-sm hover:shadow-md transition-shadow group
      ${isOverlay ? 'scale-105 shadow-2xl rotate-2 z-50 border-teal-500' : ''}`}
    >
      <button
        type="button"
        className="shrink-0 touch-none self-start p-1 rounded-md text-slate-400 hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-grab active:cursor-grabbing mt-0.5"
        aria-label="Drag to move lead"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="w-4 h-4" />
      </button>

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
            <Avatar
              name={lead.businessName}
              email={lead.email}
              size={32}
              shape="rounded"
              className="flex-shrink-0"
            />
            <div className="min-w-0">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">{lead.businessName}</h4>
              {lead.industry && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 truncate mt-0.5 inline-block max-w-full">
                  {lead.industry}
                </span>
              )}
              {lead.source ? (
                <span
                  className="text-[10px] text-slate-500 dark:text-slate-400 truncate block mt-0.5"
                  title={`Lead source: ${lead.source}`}
                >
                  Source: {lead.source}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {(lead.email || lead.phone || lead.location) && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
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

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {lead.trustScore ? (
              <div
                className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  lead.trustScore >= 80
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                    : lead.trustScore >= 50
                      ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                      : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
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
            <div title="AI Analyzed" className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
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
}: {
    column: { id: string; title: string; color: string };
    leads: Lead[];
    onOpenLead: (lead: Lead) => void;
}) {
  const { setNodeRef } = useSortable({
    id: column.id,
    data: { type: 'Column', column },
  });

  return (
    <div
      className={`flex flex-col w-[min(88vw,300px)] shrink-0 snap-center rounded-2xl md:w-auto md:min-w-0 md:max-w-none md:shrink md:snap-none ${column.color} border border-slate-200/50 dark:border-slate-700/30 overflow-hidden`}
    >
      <div className="p-3 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-800 flex items-center justify-between sticky top-0 z-10">
        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
            {column.title}
            <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-400 font-medium">
                {leads.length}
            </span>
        </h3>
      </div>
      
      <div ref={setNodeRef} className="flex-1 min-h-[240px] max-h-[min(72vh,640px)] p-2 overflow-y-auto flex flex-col gap-2 relative">
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <KanbanCard key={lead.id} lead={lead} onOpenLead={onOpenLead} />
          ))}
        </SortableContext>
        {leads.length === 0 && (
            <div className="pointer-events-none absolute inset-0 m-4 border-2 border-dashed border-slate-300/50 dark:border-slate-600/30 rounded-xl flex items-center justify-center text-xs text-slate-400 font-medium text-center px-4">
                Drag leads here to update pipeline
            </div>
        )}
      </div>
    </div>
  );
}

/** ------------------------------------------------------------------
 * MAIN BOARD COMPONENT
 * ------------------------------------------------------------------- */
export default function KanbanBoard() {
  const [columns, setColumns] = useState(KANBAN_STAGES);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const dragOriginStageRef = useRef<string | null>(null);
  const searchParams = useSearchParams();
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
        const mappedLeads = dbLeads.map(l => {
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
    if (sourceFilter === 'all') return leads;
    return leads.filter((lead) => sourceBucket(lead) === sourceFilter);
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Lead source view</span>
            <button
              onClick={() => setSourceFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${sourceFilter === 'all' ? 'bg-teal-600 text-white border-teal-500' : 'bg-slate-900 text-slate-300 border-slate-700'}`}
            >
              All ({sourceCounts.all})
            </button>
            <button
              onClick={() => setSourceFilter('ai_mcp')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${sourceFilter === 'ai_mcp' ? 'bg-teal-600 text-white border-teal-500' : 'bg-slate-900 text-slate-300 border-slate-700'}`}
            >
              Claude/MCP ({sourceCounts.ai_mcp})
            </button>
            <button
              onClick={() => setSourceFilter('manual')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${sourceFilter === 'manual' ? 'bg-teal-600 text-white border-teal-500' : 'bg-slate-900 text-slate-300 border-slate-700'}`}
            >
              Manual ({sourceCounts.manual})
            </button>
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
                            onOpenLead={setDetailLead}
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
    </div>
  );
}
