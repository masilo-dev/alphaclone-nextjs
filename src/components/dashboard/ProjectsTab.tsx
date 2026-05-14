'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, Filter, LayoutGrid, List, Activity, 
  Cpu, Edit2, ListChecks, Share2, MessageSquare, X, 
  FileCheck, Video, ChevronRight, Layout, AlertTriangle, CalendarClock, ShieldAlert, Wallet
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Project, User, STAGES, ProjectStage } from '../../types';
import { Button } from '../ui/UIComponents';
import CustomContextMenu from '../common/CustomContextMenu';
import { GanttChart } from './projects/GanttChart';
import { taskDependencyService } from '../../services/taskDependencyService';
import toast from 'react-hot-toast';

interface ProjectsTabProps {
  user: User;
  filteredProjects: Project[];
  refreshProjects: () => Promise<void>;
  openArchitectTool: (p: Project) => void;
  startEditProject: (p: Project) => void;
  handleShareProject: (id: string) => void;
  declineProject: (p: Project) => void;
  updateProjectStage: (id: string, stage: ProjectStage) => void;
  openContractGenerator: (p: Project) => void;
  setSelectedProjectForMilestones: (p: Project) => void;
  setMilestoneModalOpen: (open: boolean) => void;
}

const ProjectsTab: React.FC<ProjectsTabProps> = ({
  user,
  filteredProjects,
  refreshProjects,
  openArchitectTool,
  startEditProject,
  handleShareProject,
  declineProject,
  updateProjectStage,
  openContractGenerator,
  setSelectedProjectForMilestones,
  setMilestoneModalOpen,
}) => {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'gantt'>('grid');
  const [ganttData, setGanttData] = useState<{ nodes: any[], edges: any[] }>({ nodes: [], edges: [] });
  const [isLoadingGantt, setIsLoadingGantt] = useState(false);

  const executionInsights = useMemo(() => {
    const now = new Date();
    const activeProjects = filteredProjects.filter((project) => project.status === 'Active');
    const overdueProjects = activeProjects.filter((project) => project.dueDate && new Date(project.dueDate) < now);
    const atRiskProjects = activeProjects.filter(
      (project) => project.health === 'At Risk' || project.health === 'Delayed' || project.risk === 'High'
    );
    const missingScope = activeProjects.filter(
      (project) => !project.dueDate || !project.budget || !project.resources?.length
    );
    const stuckExecution = activeProjects.filter(
      (project) => project.currentStage === 'Execution' && (project.progress ?? 0) < 40
    );

    const attentionQueue = activeProjects
      .map((project) => {
        const reasons: string[] = [];
        let urgency = 0;

        if (project.dueDate && new Date(project.dueDate) < now) {
          reasons.push('overdue delivery date');
          urgency += 4;
        }
        if (project.health === 'Delayed') {
          reasons.push('health marked delayed');
          urgency += 3;
        }
        if (project.health === 'At Risk' || project.risk === 'High') {
          reasons.push('risk elevated');
          urgency += 3;
        }
        if (!project.dueDate) {
          reasons.push('missing due date');
          urgency += 2;
        }
        if (!project.budget) {
          reasons.push('missing budget');
          urgency += 1;
        }
        if (!project.resources?.length) {
          reasons.push('no resources mapped');
          urgency += 1;
        }
        if (project.currentStage === 'Execution' && (project.progress ?? 0) < 40) {
          reasons.push('execution progress thin');
          urgency += 2;
        }

        return { project, reasons, urgency };
      })
      .filter((item) => item.urgency > 0)
      .sort((a, b) => b.urgency - a.urgency || (a.project.progress ?? 0) - (b.project.progress ?? 0))
      .slice(0, 5);

    return {
      overdueProjects,
      atRiskProjects,
      missingScope,
      stuckExecution,
      attentionQueue,
    };
  }, [filteredProjects]);

  useEffect(() => {
    if (viewMode === 'gantt' && filteredProjects.length > 0) {
      loadGanttData();
    }
  }, [viewMode, filteredProjects]);

  const loadGanttData = async () => {
    setIsLoadingGantt(true);
    try {
      // In a real app, we might combine data from multiple projects or show a selector
      // For now, let's load the dependency graph for the first active project if any
      const firstActive = filteredProjects.find(p => p.status === 'Active') || filteredProjects[0];
      if (firstActive) {
        const data = await taskDependencyService.getDependencyGraph(firstActive.id);
        setGanttData(data);
      }
    } catch (err) {
      console.error('Failed to load Gantt data:', err);
    } finally {
      setIsLoadingGantt(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 md:space-y-6"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
            {user.role === 'admin' ? 'All Projects' : 'My Projects'}
          </h2>
          <div className="text-xs text-slate-500 font-mono mt-1 uppercase tracking-widest">
            {filteredProjects.length} Projects
          </div>
        </div>
        <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-2 sm:gap-4 mt-2 sm:mt-0">
          <div className="flex gap-2">
            <Button 
              onClick={async () => {
                toast.loading('Nexus: Architecting project structure...', { id: 'nexus-projects' });
                const res = await fetch('/api/social/command-center', { 
                  method: 'POST', 
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ tenantId: user.tenantId, mode: 'nexus_system_action', systemKey: 'project_architect' })
                });
                const data = await res.json();
                toast.success(data.result.message, { id: 'nexus-projects' });
              }}
              variant="secondary" 
              className="h-8 md:h-10 px-3 md:px-4 text-xs md:text-xs font-black uppercase tracking-widest bg-slate-900 border-white/5 text-violet-400"
            >
              <Cpu className="w-4 h-4 mr-2" />
              Nexus Architect
            </Button>
            {user.role === 'client' && (
              <Button 
                onClick={() => router.push('/dashboard/submit')} 
                variant="secondary" 
                className="h-8 md:h-10 px-3 md:px-4 text-xs md:text-xs font-black uppercase tracking-widest"
              >
                Add New Item
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-xl border border-white/5 shadow-inner">
            <button
              onClick={() => setViewMode('list')}
              className={`relative p-2 rounded-lg transition-all ${viewMode === 'list' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
              title="List View"
            >
              {viewMode === 'list' && (
                <motion.div layoutId="viewModeBg" className="absolute inset-0 bg-teal-500 rounded-lg -z-0 shadow-lg shadow-teal-500/20" />
              )}
              <List className="relative z-10 w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`relative p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
              title="Grid View"
            >
              {viewMode === 'grid' && (
                <motion.div layoutId="viewModeBg" className="absolute inset-0 bg-teal-500 rounded-lg -z-0 shadow-lg shadow-teal-500/20" />
              )}
              <LayoutGrid className="relative z-10 w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('gantt')}
              className={`relative p-2 rounded-lg transition-all ${viewMode === 'gantt' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
              title="Timeline (Gantt)"
            >
              {viewMode === 'gantt' && (
                <motion.div layoutId="viewModeBg" className="absolute inset-0 bg-indigo-500 rounded-lg -z-0 shadow-lg shadow-indigo-500/20" />
              )}
              <Activity className="relative z-10 w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          {
            label: 'Delivery Risk',
            value: executionInsights.atRiskProjects.length,
            hint: 'Active projects marked delayed, at risk, or high risk.',
            icon: ShieldAlert,
            accent: 'text-amber-300',
          },
          {
            label: 'Overdue Projects',
            value: executionInsights.overdueProjects.length,
            hint: 'Projects whose due dates already slipped.',
            icon: CalendarClock,
            accent: 'text-rose-300',
          },
          {
            label: 'Scoping Gaps',
            value: executionInsights.missingScope.length,
            hint: 'Missing due date, budget, or resource mapping.',
            icon: Wallet,
            accent: 'text-sky-300',
          },
          {
            label: 'Execution Stall',
            value: executionInsights.stuckExecution.length,
            hint: 'Execution-stage work below 40% progress.',
            icon: AlertTriangle,
            accent: 'text-teal-300',
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border border-white/5 bg-slate-900/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-slate-500">{card.label}</p>
                  <p className="text-2xl font-black text-white mt-2">{card.value}</p>
                  <p className="text-xs text-slate-500 mt-2">{card.hint}</p>
                </div>
                <div className={`rounded-xl border border-white/10 bg-slate-950/70 p-2 ${card.accent}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-4">
        <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">Execution Command Queue</h3>
              <p className="text-xs text-slate-500 mt-1">Projects most likely to become churn, margin loss, or team thrash.</p>
            </div>
            <Activity className="w-4 h-4 text-teal-400" />
          </div>

          <div className="space-y-3">
            {executionInsights.attentionQueue.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-5 text-sm text-slate-400">
                No urgent execution gaps in the current project set.
              </div>
            ) : (
              executionInsights.attentionQueue.map(({ project, reasons, urgency }) => (
                <div key={project.id} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{project.name}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {project.currentStage} • {project.progress}% progress • {project.health || 'Health not set'}
                      </p>
                    </div>
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-amber-200">
                      P{urgency}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {reasons.map((reason) => (
                      <span key={reason} className="rounded-full border border-white/10 bg-slate-900/80 px-2 py-1 text-[11px] text-slate-300">
                        {reason}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-3">
                    Due: {project.dueDate || 'No due date set'} • Budget: {project.budget ? `$${project.budget.toLocaleString()}` : 'Not scoped'}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">Scope Hygiene</h3>
              <p className="text-xs text-slate-500 mt-1">The gaps that make Asana-style work look busy but stay commercially weak.</p>
            </div>
            <Layout className="w-4 h-4 text-teal-400" />
          </div>

          <div className="space-y-3">
            {[
              {
                label: 'No due date',
                value: filteredProjects.filter((project) => project.status === 'Active' && !project.dueDate).length,
                detail: 'Execution without a delivery commitment hides schedule risk.',
              },
              {
                label: 'No budget',
                value: filteredProjects.filter((project) => project.status === 'Active' && !project.budget).length,
                detail: 'Delivery can drift without margin visibility.',
              },
              {
                label: 'No resources mapped',
                value: filteredProjects.filter((project) => project.status === 'Active' && !project.resources?.length).length,
                detail: 'Projects need named capability coverage, not generic ownership.',
              },
              {
                label: 'Review stage still open',
                value: filteredProjects.filter((project) => project.status === 'Active' && project.currentStage === 'Review').length,
                detail: 'Review queues are where client approvals often stall.',
              },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-200">{item.label}</p>
                  <span className="text-lg font-semibold text-white">{item.value}</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'grid' && (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4"
          >
            {filteredProjects.map((p, idx) => (
              <ProjectCard 
                key={p.id} 
                project={p} 
                index={idx} 
                user={user}
                onArchitect={openArchitectTool}
                onEdit={startEditProject}
                onMilestones={(p: Project) => { setSelectedProjectForMilestones(p); setMilestoneModalOpen(true); }}
                onShare={handleShareProject}
                onDecline={declineProject}
                onContract={openContractGenerator}
                onUpdateStage={updateProjectStage}
              />
            ))}
          </motion.div>
        )}

        {viewMode === 'list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-transparent md:bg-slate-900/40 md:backdrop-blur-xl rounded-2xl md:border md:border-white/5 overflow-hidden md:shadow-2xl"
          >
            <ProjectList 
              projects={filteredProjects} 
              user={user}
              onArchitect={openArchitectTool}
              onEdit={startEditProject}
              onMilestones={(p: Project) => { setSelectedProjectForMilestones(p); setMilestoneModalOpen(true); }}
              onShare={handleShareProject}
              onDecline={declineProject}
              onContract={openContractGenerator}
              onUpdateStage={updateProjectStage}
            />
          </motion.div>
        )}

        {viewMode === 'gantt' && (
          <motion.div
            key="gantt"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="w-full"
          >
            {isLoadingGantt ? (
              <div className="h-64 flex items-center justify-center bg-slate-900/40 rounded-2xl border border-white/5">
                <div className="flex flex-col items-center gap-3">
                  <Activity className="w-8 h-8 text-teal-500 animate-pulse" />
                  <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Building Timeline...</span>
                </div>
              </div>
            ) : (
              <GanttChart tasks={filteredProjects as any} edges={ganttData.edges} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ProjectsTab;

// Sub-components to keep ProjectsTab manageable

const ProjectCard = ({ project: p, index, user, onArchitect, onEdit, onMilestones, onShare, onDecline, onContract, onUpdateStage }: any) => {
  const router = useRouter();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.03 }}
      whileHover={{ y: -4 }}
      className="h-full"
    >
      <CustomContextMenu
        items={[
          { label: 'AI Architect', icon: <Cpu className="w-4 h-4" />, onClick: () => onArchitect(p) },
          { label: 'Edit Project', icon: <Edit2 className="w-4 h-4" />, onClick: () => onEdit(p) },
          { label: 'Manage Phases', icon: <ListChecks className="w-4 h-4" />, onClick: () => onMilestones(p) },
          { label: 'Share Link', icon: <Share2 className="w-4 h-4" />, onClick: () => onShare(p.id) },
          { label: 'Message Client', icon: <MessageSquare className="w-4 h-4" />, onClick: () => router.push(`/dashboard/messages?selectedClientId=${p.ownerId}`) },
          { label: 'Decline Project', icon: <X className="w-4 h-4" />, onClick: () => onDecline(p), destructive: true },
        ]}
      >
        <div className={`group relative bg-slate-900/60 backdrop-blur-xl rounded-2xl overflow-hidden border transition-all flex flex-col h-full ${p.status === 'Declined' ? 'border-red-900/20 opacity-60' : 'border-white/5 hover:border-teal-500/50 shadow-lg hover:shadow-teal-500/10'}`}>
          <div className="aspect-video relative overflow-hidden">
            <Image 
              src={p.image || '/placeholder.png'} 
              alt={p.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105" 
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            />
            <div className={`absolute top-3 right-3 backdrop-blur-md px-2.5 py-1 rounded-full text-xs text-white font-black uppercase tracking-widest border ${p.status === 'Active' ? 'bg-green-500/20 border-green-500/50 text-green-400' : p.status === 'Declined' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-black/60 border-white/10'}`}>
              {p.status}
            </div>
          </div>
          <div className="p-3 md:p-4 flex-1 flex flex-col">
            <div className="flex justify-between items-start mb-1">
              <h4 className="font-bold text-white text-base leading-tight group-hover:text-teal-400 transition-colors uppercase tracking-tight">{p.name}</h4>
              {user.role === 'admin' && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onArchitect(p)} className="text-slate-500 hover:text-teal-400 p-1" title="AI Architect"><Cpu className="w-4 h-4" /></button>
                  <button onClick={() => onEdit(p)} className="text-slate-500 hover:text-white p-1" title="Edit"><Edit2 className="w-4 h-4" /></button>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mb-4">{p.category}</p>

            <div className="mt-auto">
              <div className="flex justify-between text-xs text-slate-500 uppercase tracking-widest mb-2 font-mono">
                <span>Stage</span>
                <span className="text-teal-400 font-black">{p.currentStage}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-950 rounded-full flex gap-1 p-0.5 border border-white/5 shadow-inner">
                {STAGES.map((s, i) => {
                  const stageIndex = STAGES.indexOf(p.currentStage || 'Initiation');
                  return (
                    <div
                      key={s}
                      className={`h-full flex-1 rounded-full transition-all duration-500 ${i <= stageIndex ? 'bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.3)]' : 'bg-slate-800'}`}
                    />
                  );
                })}
              </div>
            </div>

            <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-white/5 flex flex-col gap-2 md:gap-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => router.push(user.role === 'admin' ? `/dashboard/messages?selectedClientId=${p.ownerId}` : '/dashboard/messages')}
                  className="px-3 py-2 bg-slate-800/40 hover:bg-teal-500/10 text-slate-400 hover:text-teal-400 text-xs font-black uppercase tracking-widest rounded-xl border border-white/5 hover:border-teal-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Message
                </button>
                <button
                  onClick={() => router.push('/dashboard/conference')}
                  className="px-3 py-2 bg-slate-800/40 hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 text-xs font-black uppercase tracking-widest rounded-xl border border-white/5 hover:border-blue-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Video className="w-3.5 h-3.5" />
                  Meeting
                </button>
              </div>

              {user.role === 'admin' && (
                <>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onMilestones(p)}
                      className="flex-1 px-3 py-2 bg-slate-950/50 hover:bg-slate-900 text-slate-400 text-xs font-black uppercase tracking-widest rounded-xl border border-white/5 hover:border-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      <ListChecks className="w-3.5 h-3.5" />
                      Milestones
                    </button>
                    <button
                      onClick={() => onShare(p.id)}
                      className="px-3 py-2 bg-slate-950/50 hover:bg-teal-500/10 text-slate-400 hover:text-teal-400 text-xs font-black uppercase tracking-widest rounded-xl border border-white/5 hover:border-teal-500/20 transition-all flex items-center justify-center"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {p.status === 'Active' && (
                    <button
                      onClick={() => onContract(p)}
                      className="w-full px-3 py-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 text-xs font-black uppercase tracking-widest rounded-xl border border-violet-500/20 transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-500/5"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      {p.contractStatus === 'Sent' || p.contractStatus === 'Signed' ? 'Review Contract' : 'Send Contract'}
                    </button>
                  )}
                  <div className="mt-2">
                    <select
                      className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-300 focus:ring-1 focus:ring-teal-500/50 focus:border-teal-500/50 outline-none transition-all cursor-pointer"
                      value={p.currentStage || 'Initiation'}
                      onChange={(e) => onUpdateStage(p.id, e.target.value as ProjectStage)}
                    >
                      {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </CustomContextMenu>
    </motion.div>
  );
};

const ProjectList = ({ projects, user, onArchitect, onEdit, onMilestones, onShare, onDecline, onContract, onUpdateStage }: any) => {
  const router = useRouter();
  return (
    <>
      <table className="hidden md:table w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-white/5 bg-slate-900/60 font-mono">
            <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">Project</th>
            <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">Status</th>
            <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">Stage</th>
            <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {projects.map((p: any, idx: number) => (
            <CustomContextMenu
              as="tr"
              key={p.id}
              items={[
                { label: 'AI Architect', icon: <Cpu className="w-4 h-4" />, onClick: () => onArchitect(p) },
                { label: 'Edit Project', icon: <Edit2 className="w-4 h-4" />, onClick: () => onEdit(p) },
                { label: 'Manage Phases', icon: <ListChecks className="w-4 h-4" />, onClick: () => onMilestones(p) },
                { label: 'Share Link', icon: <Share2 className="w-4 h-4" />, onClick: () => onShare(p.id) },
                { label: 'Message Client', icon: <MessageSquare className="w-4 h-4" />, onClick: () => router.push(`/dashboard/messages?selectedClientId=${p.ownerId}`) },
                { label: 'Decline Project', icon: <X className="w-4 h-4" />, onClick: () => onDecline(p), destructive: true },
              ]}
            >
              <motion.tr
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.02 }}
                className="group hover:bg-slate-800/40 transition-all cursor-default"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-white/10 group-hover:border-teal-500/50 transition-colors">
                      <Image 
                        src={p.image || '/placeholder.png'} 
                        alt={p.name}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500" 
                        sizes="40px"
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm font-bold text-slate-200 block group-hover:text-white transition-colors truncate uppercase tracking-tight">{p.name}</span>
                      <span className="text-xs text-slate-500 uppercase font-mono tracking-widest">{p.category}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 text-xs rounded-full font-black uppercase tracking-widest border ${p.status === 'Active' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                    p.status === 'Declined' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                      'bg-slate-800/50 text-slate-400 border-white/5'
                    }`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs font-black text-teal-400 bg-teal-500/5 px-2.5 py-1 rounded-lg border border-teal-500/20 uppercase tracking-widest">
                    {p.currentStage || 'Initiation'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    {user.role === 'admin' && (
                      <>
                        <button onClick={() => onArchitect(p)} className="p-2 bg-slate-800/50 hover:bg-teal-500/20 text-slate-400 hover:text-teal-400 rounded-xl border border-white/5 hover:border-teal-500/20 transition-all" title="AI Architect"><Cpu className="w-4 h-4" /></button>
                        <button onClick={() => onEdit(p)} className="p-2 bg-slate-800/50 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl border border-white/5 hover:border-white/10 transition-all" title="Edit"><Edit2 className="w-4 h-4" /></button>
                      </>
                    )}
                    <button
                      onClick={() => router.push(user.role === 'admin' ? `/dashboard/messages?selectedClientId=${p.ownerId}` : '/dashboard/messages')}
                      className="p-2 bg-slate-800/50 hover:bg-teal-500/20 text-slate-400 hover:text-teal-400 rounded-xl border border-white/5 hover:border-teal-500/20 transition-all"
                      title="Secure Messaging"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            </CustomContextMenu>
          ))}
        </tbody>
      </table>

      {/* Mobile Card-List View */}
      <div className="md:hidden space-y-4 p-4">
        {projects.map((p: any, idx: number) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.02 }}
            onClick={() => onArchitect(p)}
            className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/5 p-4 flex items-center gap-4 active:scale-[0.98] transition-all"
          >
            <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 shrink-0 relative">
              <Image 
                src={p.image || '/placeholder.png'} 
                alt={p.name}
                fill
                className="object-cover" 
                sizes="56px"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-white text-sm truncate uppercase tracking-tight">{p.name}</h4>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${p.status === 'Active' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-slate-800/50 text-slate-400 border-white/5'}`}>
                  {p.status}
                </span>
                <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">{p.category}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-black text-teal-400 font-mono">{p.progress}%</span>
              <ChevronRight className="w-4 h-4 text-slate-600 block ml-auto mt-1" />
            </div>
          </motion.div>
        ))}
      </div>
    </>
  );
};

