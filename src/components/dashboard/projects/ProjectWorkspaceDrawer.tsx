'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  X,
  Users as UsersIcon,
  FileText,
  Share2,
  LayoutGrid,
  ListTodo,
  Flag,
  GanttChartSquare,
} from 'lucide-react';
import { User, Project as BusinessProject, ProjectStage } from '@/types';
import { projectService } from '@/services/projectService';
import { milestoneService } from '@/services/milestoneService';
import { businessClientService } from '@/services/businessClientService';
import { projectStageService } from '@/services/projectStageService';
import { taskService } from '@/services/taskService';
import { supabase } from '@/lib/supabase';
import { buildMailComposeUrl } from '@/lib/email/composeNavigation';
import { RecordHeader, AskBonnieButton } from '@/components/ui/os';
import { BusinessContextPanel } from '@/components/dashboard/crm/BusinessContextPanel';
import { StandardStatusBadge, resolveStatusVariant } from '@/components/ui/design-system';
import { ProjectPortalShareDialog } from '@/components/dashboard/business/ProjectPortalShareDialog';
import { ProjectTasksKanban } from '@/components/dashboard/projects/ProjectTasksKanban';
import { ProjectBlockersPanel } from '@/components/dashboard/projects/ProjectBlockersPanel';
import { GanttChart } from '@/components/dashboard/projects/GanttChart';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

type WorkspaceTab = 'overview' | 'tasks' | 'milestones' | 'timeline' | 'team';

const WORKSPACE_TABS: { id: WorkspaceTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'milestones', label: 'Milestones', icon: Flag },
  { id: 'timeline', label: 'Timeline', icon: GanttChartSquare },
  { id: 'team', label: 'Team', icon: UsersIcon },
];

const PROJECT_STAGES_ORDER: ProjectStage[] = ['Initiation', 'Planning', 'Execution', 'Review', 'Closure'];

export interface ProjectWorkspaceDrawerProps {
  project: BusinessProject;
  tenantId: string;
  currentUser: User;
  onClose: () => void;
  onEdit: (project: BusinessProject) => void;
  onProgressChange?: (projectId: string, progress: number) => void;
  onStageChange?: (projectId: string, stage: ProjectStage) => void;
}

function getNormalizedStage(stage: string | undefined): ProjectStage {
  if (!stage) return 'Initiation';
  const legacyMap: Record<string, ProjectStage> = {
    Discovery: 'Initiation',
    Design: 'Planning',
    Development: 'Execution',
    Testing: 'Review',
    Deployment: 'Closure',
    Completed: 'Closure',
    Maintenance: 'Closure',
  };
  return (legacyMap[stage] || stage) as ProjectStage;
}

export function ProjectWorkspaceDrawer({
  project,
  tenantId,
  currentUser,
  onClose,
  onEdit,
  onProgressChange,
  onStageChange,
}: ProjectWorkspaceDrawerProps) {
  const router = useRouter();
  const [tab, setTab] = useState<WorkspaceTab>('overview');
  const [progress, setProgress] = useState(project.progress || 0);
  const [milestones, setMilestones] = useState<{ id: string; label: string; checked: boolean; dueDate?: string }[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(true);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [comments, setComments] = useState<Array<{
    id: string;
    author_name: string;
    author_email?: string | null;
    content: string;
    is_client: boolean;
    created_at: string;
  }>>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentAuthorName, setCommentAuthorName] = useState(currentUser.name || '');
  const [commentAuthorEmail, setCommentAuthorEmail] = useState(currentUser.email || '');
  const [postingComment, setPostingComment] = useState(false);
  const [clientEmail, setClientEmail] = useState('');
  const [clientName, setClientName] = useState('');
  const [ganttTasks, setGanttTasks] = useState<Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
    created_at: string;
  }>>([]);
  const [tasksRefreshKey, setTasksRefreshKey] = useState(0);

  const normalizedStage = getNormalizedStage(project.currentStage);
  const teamList = project.team && project.team.length > 0 ? project.team : [];
  const availableStages = useMemo(
    () => projectStageService.getAvailableStages(normalizedStage, project),
    [normalizedStage, project],
  );

  useEffect(() => {
    setProgress(project.progress || 0);
  }, [project.id, project.progress]);

  const refreshProgress = async () => {
    const { progress: recalculated } = await projectService.recalculateProjectProgress(project.id);
    setProgress(recalculated);
    onProgressChange?.(project.id, recalculated);
    setTasksRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    let cancelled = false;
    const loadMilestones = async () => {
      setMilestonesLoading(true);
      const { milestones: rows } = await milestoneService.getMilestones(project.id);
      if (cancelled) return;

      setMilestones(rows.map((m) => ({
        id: m.id,
        label: m.name,
        checked: m.status === 'completed',
        dueDate: m.dueDate,
      })));
      if (!cancelled) {
        await refreshProgress();
        setMilestonesLoading(false);
      }
    };
    void loadMilestones();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  useEffect(() => {
    let cancelled = false;
    const loadComments = async () => {
      setCommentsLoading(true);
      const { data, error } = await supabase
        .from('project_comments')
        .select('id, author_name, author_email, content, is_client, created_at')
        .eq('project_id', project.id)
        .order('created_at', { ascending: true });
      if (!cancelled && !error) setComments((data || []) as typeof comments);
      if (!cancelled) setCommentsLoading(false);
    };
    void loadComments();
    return () => { cancelled = true; };
  }, [project.id]);

  useEffect(() => {
    let cancelled = false;
    const loadClient = async () => {
      if (!project.clientId) {
        setClientEmail('');
        setClientName('');
        return;
      }
      const { client } = await businessClientService.getClient(project.clientId);
      if (cancelled) return;
      setClientEmail(client?.email || '');
      setClientName(client?.name || '');
    };
    void loadClient();
    return () => { cancelled = true; };
  }, [project.clientId]);

  useEffect(() => {
    if (tab !== 'timeline') return;
    let cancelled = false;
    void (async () => {
      const { tasks } = await taskService.getTasks({ relatedToProject: project.id });
      if (cancelled) return;
      setGanttTasks(
        (tasks || []).map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          due_date: t.dueDate || null,
          created_at: t.createdAt,
        })),
      );
    })();
    return () => { cancelled = true; };
  }, [tab, project.id, tasksRefreshKey]);

  const toggleMilestone = async (id: string) => {
    const target = milestones.find((m) => m.id === id);
    if (!target) return;
    const nextChecked = !target.checked;
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, checked: nextChecked } : m)));
    const { error } = await milestoneService.updateMilestone(id, {
      status: nextChecked ? 'completed' : 'pending',
    });
    if (error) {
      setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, checked: !nextChecked } : m)));
      toast.error('Failed to update milestone');
      return;
    }
    await refreshProgress();
  };

  const updateMilestoneDueDate = async (id: string, dateInput: string) => {
    const dueDate = dateInput ? new Date(`${dateInput}T12:00:00`).toISOString() : undefined;
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, dueDate } : m)));
    const { error } = await milestoneService.updateMilestone(id, { dueDate });
    if (error) {
      toast.error('Could not update milestone date');
      return;
    }
    toast.success(dueDate ? 'Milestone date saved — synced to calendar' : 'Milestone date cleared');
  };

  const toDateInput = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    const authorName = commentAuthorName.trim();
    const content = commentDraft.trim();
    if (!authorName || !content) return;

    setPostingComment(true);
    try {
      const response = await fetch(
        `/api/tenant/${encodeURIComponent(tenantId)}/projects/${encodeURIComponent(project.id)}/comments`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Project comment could not be saved');
      if (payload.comment) {
        setComments((prev) => [...prev, payload.comment]);
        setCommentDraft('');
        const notifyResult = await projectService.notifyClientProjectNote(project.id, content, authorName);
        if (notifyResult?.sent) toast.success('Note saved and emailed to client');
        else toast.success('Note saved');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setPostingComment(false);
    }
  };

  const handleStageSelect = async (newStage: ProjectStage) => {
    if (newStage === normalizedStage) return;
    if (onStageChange) {
      onStageChange(project.id, newStage);
      return;
    }
    let result = await projectStageService.updateProjectStage(project.id, newStage, currentUser.id);
    if (!result.success && result.transition?.requiresConfirmation) {
      const ok = window.confirm(`Move this project back to ${newStage}?`);
      if (!ok) return;
      result = await projectStageService.updateProjectStage(project.id, newStage, currentUser.id, undefined, true);
    }
    if (!result.success) {
      toast.error(result.error || 'Stage change blocked');
      return;
    }
    toast.success(`Stage updated to ${newStage}`);
  };

  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - ((progress || 0) / 100) * circumference;

  const getHealthColor = (health: string | undefined) => {
    if (health === 'At Risk') return 'bg-red-500';
    if (health === 'Delayed') return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[1100]"
      />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="fixed bottom-0 left-0 right-0 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full h-[92vh] md:h-auto md:max-h-[90vh] md:max-w-4xl rounded-t-lg md:rounded-lg bg-slate-950 border-t md:border border-white/10 flex flex-col overflow-hidden z-[1110] shadow-[0_0_50px_rgba(0,0,0,0.8)]"
      >
        <div className="w-12 h-1 bg-slate-800 rounded-full mx-auto my-3 md:hidden" />

        <div className="px-4 md:px-6 py-3 border-b border-white/5 bg-slate-900/50 space-y-3">
          <div className="flex justify-between items-start gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${getHealthColor(project.health)} animate-pulse`} />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest truncate">
                {project.name}
              </span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none" role="tablist">
            {WORKSPACE_TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors',
                  tab === id
                    ? 'bg-[var(--brand-blue-600)] text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 space-y-5">
          {tab === 'overview' && (
            <>
              <RecordHeader
                moduleId="projects"
                title={project.name}
                subtitle={project.description || 'No description provided.'}
                status={
                  <StandardStatusBadge variant={resolveStatusVariant(project.health || 'On Track')}>
                    {project.health || 'On Track'}
                  </StandardStatusBadge>
                }
                meta={
                  <>
                    <span>{progress || 0}% complete</span>
                    {project.dueDate ? (
                      <span>Due {new Date(project.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    ) : null}
                    {clientName ? <span>{clientName}</span> : null}
                  </>
                }
                actions={
                  <AskBonnieButton
                    compact
                    mode="summarise"
                    contexts={[
                      { type: 'Project', id: project.id, label: project.name },
                      ...(clientName ? [{ type: 'Client', label: clientName }] : []),
                    ]}
                  />
                }
              />

              {tenantId ? (
                <BusinessContextPanel tenantId={tenantId} entityType="project" entityId={project.id} />
              ) : null}

              <div className="bg-slate-900/40 border border-white/5 rounded-lg p-4 flex items-center gap-6">
                <div className="relative w-20 h-20 shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="40" cy="40" r={radius} className="stroke-slate-800" strokeWidth="8" fill="transparent" />
                    <circle cx="40" cy="40" r={radius} className="stroke-[var(--brand-blue-500)]" strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-base font-bold text-white">{progress || 0}%</div>
                </div>
                <div className="text-sm text-slate-300 space-y-1">
                  <p><span className="text-slate-500">Stage:</span> {normalizedStage}</p>
                  {project.budget ? <p><span className="text-slate-500">Budget:</span> ${project.budget.toLocaleString()}</p> : null}
                </div>
              </div>

              {(clientEmail || clientName) && (
                <div className="rounded-lg border border-white/5 bg-slate-900/40 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Client</p>
                  <p className="text-sm text-white font-semibold">{clientName || 'Linked client'}</p>
                  {clientEmail ? (
                    <button type="button" onClick={() => router.push(buildMailComposeUrl(clientEmail, `Re: ${clientName}`))} className="text-xs text-[var(--brand-blue-300)] hover:underline">
                      {clientEmail}
                    </button>
                  ) : null}
                </div>
              )}

              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Project notes</span>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {commentsLoading ? (
                    <div className="h-16 bg-slate-900/60 rounded animate-pulse" />
                  ) : comments.length === 0 ? (
                    <p className="text-xs text-slate-500">No notes yet.</p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="rounded-lg border border-white/5 bg-slate-900/60 p-3 text-sm text-slate-300">
                        <p className="font-semibold text-white text-xs mb-1">{c.author_name}</p>
                        {c.content}
                      </div>
                    ))
                  )}
                </div>
                <form onSubmit={handleAddComment} className="space-y-2">
                  <textarea
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-white text-sm resize-none min-h-[72px]"
                    placeholder="Add a project note…"
                  />
                  <button type="submit" disabled={postingComment || !commentDraft.trim()} className="px-4 py-2 bg-[var(--brand-blue-600)] text-white rounded-xl text-sm font-bold disabled:opacity-50">
                    {postingComment ? 'Saving…' : 'Add note'}
                  </button>
                </form>
              </div>

              <a href="/dashboard/business/documents" className="flex items-center gap-2 p-3 bg-slate-950/40 border border-white/5 rounded-xl text-xs text-slate-300">
                <FileText className="w-4 h-4 text-[var(--brand-blue-400)]" />
                Open Document Hub
              </a>
            </>
          )}

          {tab === 'tasks' && (
            <>
              <ProjectBlockersPanel
                projectId={project.id}
                tenantId={tenantId}
                userId={currentUser.id}
                onTasksChanged={() => void refreshProgress()}
              />
              <ProjectTasksKanban
                key={tasksRefreshKey}
                projectId={project.id}
                userId={currentUser.id}
                projectDueDate={project.dueDate}
                onTasksChanged={() => void refreshProgress()}
              />
            </>
          )}

          {tab === 'milestones' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Milestones</span>
                {milestones.length > 0 && (
                  <span className="text-xs font-bold text-[var(--brand-blue-400)]">
                    {milestones.filter((m) => m.checked).length}/{milestones.length} done
                  </span>
                )}
              </div>
              <div className="space-y-2 bg-slate-950/20 rounded-lg p-3 border border-white/5">
                {milestonesLoading ? (
                  [...Array(4)].map((_, i) => <div key={i} className="h-6 bg-slate-900/60 rounded animate-pulse" />)
                ) : milestones.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">
                    No milestones yet. Add them when you want checkpoints — opening a project no longer plants unfinished ones.
                  </p>
                ) : (
                  milestones.map((m) => (
                    <div key={m.id} className="flex flex-wrap items-center gap-3 py-1">
                      <div className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => void toggleMilestone(m.id)}>
                        <input type="checkbox" checked={m.checked} readOnly className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800" />
                        <span className={`text-sm ${m.checked ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{m.label}</span>
                      </div>
                      <input
                        type="date"
                        value={toDateInput(m.dueDate)}
                        onChange={(e) => void updateMilestoneDueDate(m.id, e.target.value)}
                        title="Milestone due date — syncs to calendar"
                        className="shrink-0 px-2 py-1 bg-slate-950 border border-white/10 rounded-lg text-white text-xs"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'timeline' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Task schedule by due date</p>
              {ganttTasks.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">Add tasks with due dates to see the timeline.</p>
              ) : (
                <GanttChart tasks={ganttTasks} edges={[]} />
              )}
            </div>
          )}

          {tab === 'team' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Project team</span>
                {teamList.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {teamList.map((name, i) => (
                      <span key={i} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--brand-blue-600)]/20 text-sm text-white">
                        <UsersIcon className="w-3.5 h-3.5" />
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No team members assigned — edit the project to add people.</p>
                )}
              </div>

              <div className="space-y-2 rounded-lg border border-white/5 bg-slate-900/40 p-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Lifecycle stage</span>
                <p className="text-sm text-white font-semibold">{normalizedStage}</p>
                <select
                  value={normalizedStage}
                  onChange={(e) => void handleStageSelect(e.target.value as ProjectStage)}
                  className="w-full mt-2 px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-sm text-white"
                >
                  {PROJECT_STAGES_ORDER.map((stage) => (
                    <option key={stage} value={stage} disabled={!availableStages.includes(stage) && stage !== normalizedStage}>
                      {stage}
                      {!availableStages.includes(stage) && stage !== normalizedStage ? ' (blocked)' : ''}
                    </option>
                  ))}
                  <option value="On Hold">On Hold</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-2">
                  Stage changes are validated — missing requirements block forward moves.
                </p>
              </div>

              <button
                type="button"
                onClick={() => router.push('/dashboard/business/team')}
                className="text-xs font-semibold text-[var(--brand-blue-300)] hover:underline"
              >
                Open team allocation →
              </button>
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-slate-950/95 px-4 md:px-6 py-3 border-t border-white/10 flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => setShareDialogOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--brand-blue-500)]/30 text-[var(--brand-blue-300)] text-xs font-semibold"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share with client
          </button>
          <button
            type="button"
            onClick={() => { onEdit(project); onClose(); }}
            className="px-4 py-2 bg-[var(--brand-blue-600)] hover:bg-[var(--brand-blue-500)] text-white rounded-xl text-xs font-bold"
          >
            Edit project
          </button>
        </div>
      </motion.div>

      <ProjectPortalShareDialog
        isOpen={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        projectId={project.id}
        tenantId={tenantId}
        projectName={project.name}
      />
    </>
  );
}
