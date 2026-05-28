'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Plus, FolderPlus, CheckSquare, Flag, Calendar,
  Users, DollarSign, ChevronRight, ChevronDown, Clock, Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';
import { User } from '../../types';
import toast from 'react-hot-toast';

type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed';
type ProjectTab = 'overview' | 'tasks' | 'milestones' | 'timeline';

const STATUS_COLORS: Record<ProjectStatus, string> = {
  planning:  'bg-slate-500/15 text-slate-400 border-slate-500/30',
  active:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  on_hold:   'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

interface Project { id: string; name: string; status: ProjectStatus; progress: number; task_count: number; completed_tasks: number; due_date?: string; description?: string; budget?: number; tenant_id: string; created_at: string; }
interface Milestone { id: string; project_id: string; name: string; due_date?: string; status: 'done' | 'in_progress' | 'pending'; }
interface Task { id: string; project_id: string; title: string; status: string; priority: string; due_date?: string; }

interface ProjectsTabProps { user: User; }

// ── Milestone Timeline ─────────────────────────────────────────────────────────
const MilestoneTimeline: React.FC<{ milestones: Milestone[] }> = ({ milestones }) => (
  <div className="relative pl-6">
    <div className="absolute left-2.5 top-0 bottom-0 w-px bg-white/10" />
    {milestones.map((m, i) => {
      const dotColor = m.status === 'done' ? 'bg-emerald-500' : m.status === 'in_progress' ? 'bg-yellow-500' : 'bg-slate-600';
      return (
        <div key={m.id} className="relative flex items-start gap-3 pb-5">
          <div className={`absolute -left-4 top-1 w-3 h-3 rounded-full border-2 border-slate-950 ${dotColor}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-bold text-white truncate">{m.name}</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                m.status === 'done' ? 'bg-emerald-500/15 text-emerald-400' : m.status === 'in_progress' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-slate-500/15 text-slate-400'
              }`}>{m.status.replace('_', ' ')}</span>
            </div>
            {m.due_date && <p className="text-[13px] text-slate-500 mt-0.5">{new Date(m.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
          </div>
        </div>
      );
    })}
  </div>
);

// ── Project Detail ─────────────────────────────────────────────────────────────
const ProjectDetail: React.FC<{ project: Project; onBack: () => void }> = ({ project, onBack }) => {
  const [activeTab, setActiveTab] = useState<ProjectTab>('overview');
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    supabase.from('milestones').select('*').eq('project_id', project.id).order('due_date').then(({ data }: { data: any[] | null }) => setMilestones((data as Milestone[]) || []));
    supabase.from('tasks').select('*').eq('project_id', project.id).order('created_at', { ascending: false }).then(({ data }: { data: any[] | null }) => setTasks((data as Task[]) || []));
  }, [project.id]);

  const TABS: ProjectTab[] = ['overview', 'tasks', 'milestones', 'timeline'];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 bg-slate-950">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-slate-300" />
          </button>
          <span className="text-[17px] font-bold text-white flex-1 truncate">{project.name}</span>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[project.status]}`}>{project.status.replace('_', ' ')}</span>
            <span className="text-[13px] text-teal-400 font-bold">{project.progress}%</span>
          </div>
        </div>

        {/* Sticky sub-tabs */}
        <div className="flex gap-0 border-b border-white/5 -mx-4 px-4 overflow-x-auto scrollbar-hide">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-shrink-0 h-[34px] px-4 text-[13px] font-bold capitalize transition-colors ${activeTab === tab ? 'text-teal-400 border-b-2 border-teal-400' : 'text-slate-500'}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-28 space-y-4">
        {activeTab === 'overview' && (
          <>
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 space-y-3">
              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-[13px] mb-1.5">
                  <span className="text-slate-400">Progress</span>
                  <span className="text-teal-400 font-bold">{project.progress}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full" style={{ width: `${project.progress}%` }} />
                </div>
              </div>
              {/* Meta rows */}
              {project.due_date && (
                <div className="flex items-center gap-2 text-[13px] text-slate-400">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span>Due {new Date(project.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-[13px] text-slate-400">
                <CheckSquare className="w-4 h-4 text-slate-500" />
                <span>{project.completed_tasks} / {project.task_count} tasks done</span>
              </div>
              {project.budget && (
                <div className="flex items-center gap-2 text-[13px] text-slate-400">
                  <DollarSign className="w-4 h-4 text-slate-500" />
                  <span>Budget: ${project.budget.toLocaleString()}</span>
                </div>
              )}
            </div>
            {project.description && (
              <div className="bg-slate-900 border border-white/5 rounded-2xl p-4">
                <p className="text-[15px] text-slate-300 leading-relaxed">{project.description}</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'tasks' && (
          <div className="bg-slate-900 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
            {tasks.length === 0 && <div className="py-8 text-center text-[13px] text-slate-500">No tasks yet.</div>}
            {tasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`w-4 h-4 rounded flex-shrink-0 border-2 ${task.status === 'completed' ? 'bg-teal-500 border-teal-500' : 'border-slate-600'}`} />
                <span className={`flex-1 text-[15px] ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-white'}`}>{task.title}</span>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-yellow-500' : 'bg-slate-600'}`} />
              </div>
            ))}
          </div>
        )}

        {activeTab === 'milestones' && (
          milestones.length === 0
            ? <div className="py-8 text-center text-[13px] text-slate-500">No milestones yet.</div>
            : <MilestoneTimeline milestones={milestones} />
        )}

        {activeTab === 'timeline' && (
          <div className="overflow-x-auto -mx-4 px-4">
            {milestones.map(m => (
              <div key={m.id} className="flex items-center gap-3 py-3 border-b border-white/5">
                {m.due_date && (
                  <span className="flex-shrink-0 px-2.5 py-1 bg-slate-800 rounded-full text-[11px] font-bold text-slate-400">
                    {new Date(m.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
                <span className="text-[15px] text-white">{m.name}</span>
              </div>
            ))}
            {milestones.length === 0 && <div className="py-8 text-center text-[13px] text-slate-500">No timeline events yet.</div>}
          </div>
        )}
      </div>

      {/* Context-aware FAB */}
      <button className="fixed bottom-20 right-4 w-14 h-14 bg-teal-500 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/30 z-30">
        <Plus className="w-6 h-6 text-white" />
      </button>
    </div>
  );
};

// ── Main ProjectsTab ───────────────────────────────────────────────────────────
const ProjectsTab: React.FC<ProjectsTabProps> = ({ user }) => {
  const { currentTenant } = useTenant();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Project | null>(null);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const { data } = await supabase.from('projects').select('*').eq('tenant_id', currentTenant.id).order('created_at', { ascending: false });
    setProjects((data as Project[]) || []);
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => { load(); }, [load]);

  if (selected) return <ProjectDetail project={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="relative flex flex-col h-full">
      <div className="flex-1 overflow-y-auto pb-20">
        {loading ? (
          <div className="space-y-px">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-slate-900/40 animate-pulse mx-4 my-1 rounded-2xl" />)}</div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <FolderPlus className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-[15px]">No projects yet</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5 px-0">
            {projects.map(p => (
              <button key={p.id} onClick={() => setSelected(p)} className="w-full flex flex-col gap-2 px-4 py-3 hover:bg-white/5 transition-colors text-left">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[15px] font-bold text-white truncate">{p.name}</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_COLORS[p.status]}`}>{p.status.replace('_', ' ')}</span>
                </div>
                {/* Progress bar */}
                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${p.progress}%` }} />
                </div>
                <div className="flex items-center gap-3 text-[13px] text-slate-500 opacity-55">
                  <span>{p.completed_tasks}/{p.task_count} tasks</span>
                  {p.due_date && <span>· Due {new Date(p.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="fixed bottom-20 right-4 w-14 h-14 bg-violet-500 rounded-full flex items-center justify-center shadow-lg shadow-violet-500/30 z-30">
        <FolderPlus className="w-6 h-6 text-white" />
      </button>
    </div>
  );
};

export default ProjectsTab;
