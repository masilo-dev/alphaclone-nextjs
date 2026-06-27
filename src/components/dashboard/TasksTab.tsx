'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus, ChevronDown, ChevronRight, Calendar, Briefcase,
  Trash2, RefreshCw, LayoutGrid, List,
  ListChecks, CalendarClock, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { ModuleStatCards, type ModuleStat } from './common/ModuleStatCards';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';
import { User as UserType } from '../../types';
import { useMicrosoftTasks } from '@/hooks/useMicrosoftTasks';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { showActionNextSteps } from '../common/showActionNextSteps';
import { OperationalWorkflowStrip } from './OperationalWorkflowStrip';
import EmptyState from '../ui/EmptyState';
import { DetailDrawer } from '../ui/DetailDrawer';
import { ModulePageLayout } from '../ui/ModulePageLayout';
import { Input } from '../ui/UIComponents';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { KanbanView } from './tasks/KanbanView';
import type { Task as KanbanTask } from '../../services/taskService';

type Priority = 'low' | 'medium' | 'high';
type TaskStatus = 'todo' | 'in_progress' | 'completed';

interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  due_date?: string;
  project_name?: string;
  project_id?: string;
  notes?: string;
  tenant_id: string;
  created_at: string;
}

interface TasksTabProps { user: UserType; }

const PRIORITY_DOT: Record<Priority, string> = {
  high:   'bg-red-500',
  medium: 'bg-yellow-500',
  low:    'bg-slate-600',
};

const groupTasks = (tasks: Task[]) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
  const groups: Record<string, Task[]> = { Today: [], 'This Week': [], Later: [], 'No Due Date': [], Completed: [] };
  for (const t of tasks) {
    if (t.status === 'completed') { groups['Completed'].push(t); continue; }
    if (!t.due_date) { groups['No Due Date'].push(t); continue; }
    const d = new Date(t.due_date); d.setHours(0,0,0,0);
    if (d <= today) groups['Today'].push(t);
    else if (d <= weekEnd) groups['This Week'].push(t);
    else groups['Later'].push(t);
  }
  return groups;
};

type ViewMode = 'list' | 'board';

const toKanbanStatus = (status: TaskStatus): KanbanTask['status'] => {
  if (status === 'in_progress') return 'in_progress';
  if (status === 'completed') return 'completed';
  return 'todo';
};

const fromKanbanStatus = (status: KanbanTask['status']): TaskStatus => {
  if (status === 'in_progress' || status === 'review') return 'in_progress';
  if (status === 'completed') return 'completed';
  return 'todo';
};

const toKanbanTask = (t: Task): KanbanTask => ({
  id: t.id,
  title: t.title,
  priority: t.priority,
  status: toKanbanStatus(t.status),
  dueDate: t.due_date,
  relatedToProject: t.project_id,
  createdAt: t.created_at,
  updatedAt: t.created_at,
  description: t.notes,
});

// ── Swipeable Task Row ─────────────────────────────────────────────────────────
const SwipeableTaskRow: React.FC<{
  task: Task;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onTap: (task: Task) => void;
  bulkMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}> = ({ task, onComplete, onDelete, onTap, bulkMode, selected, onToggleSelect }) => {
  const x = useMotionValue(0);
  const leftOp  = useTransform(x, [0, 70],   [0, 1]);
  const rightOp = useTransform(x, [-70, 0], [1, 0]);
  const done = task.status === 'completed';

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 70 && !done) onComplete(task.id);
    else if (info.offset.x < -70) onDelete(task.id);
    x.set(0);
  };

  return (
    <div className="relative overflow-hidden">
      <motion.div style={{ opacity: leftOp }} className="absolute inset-y-0 left-0 w-20 bg-emerald-500 flex items-center justify-center z-0">
        <motion.div className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-white" />
        </motion.div>
      </motion.div>
      <motion.div style={{ opacity: rightOp }} className="absolute inset-y-0 right-0 w-20 bg-red-500 flex items-center justify-center z-0">
        <Trash2 className="w-5 h-5 text-white" />
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 100 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="relative z-10 bg-slate-950 flex items-center gap-0 min-h-[44px]"
      >
        {bulkMode ? (
          <button
            type="button"
            onClick={() => onToggleSelect?.(task.id)}
            className="w-11 h-11 flex items-center justify-center flex-shrink-0"
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selected ? 'border-teal-500 bg-teal-500/20' : 'border-slate-600'}`}>
              {selected && <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />}
            </div>
          </button>
        ) : (
        <button
          onClick={() => !done && onComplete(task.id)}
          className="w-11 h-11 flex items-center justify-center flex-shrink-0"
        >
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${done ? 'border-teal-500 bg-teal-500' : 'border-slate-600'}`}>
            {done && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
          </div>
        </button>
        )}

        <div className="flex-1 min-w-0 py-2 cursor-pointer" onClick={() => onTap(task)}>
          <div className="flex items-center gap-2 pr-4">
            <span className={`text-[15px] flex-1 truncate ${done ? 'line-through text-slate-500 opacity-40' : 'text-white'}`}>{task.title}</span>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority]}`} />
          </div>
          <div className="flex items-center gap-2 mt-0.5 pr-4">
            {task.project_name && (
              <span className="text-[11px] px-1.5 py-0.5 bg-slate-800 rounded-full text-slate-400 truncate">{task.project_name}</span>
            )}
            {task.due_date && (
              <span className={`text-[13px] opacity-55 ${done ? 'text-slate-500' : 'text-slate-400'}`}>
                {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ── Task Detail (DetailDrawer content) ───────────────────────────────────────
const TaskDetailContent: React.FC<{
  task: Task;
  onClose: () => void;
  onUpdate: (id: string, changes: Partial<Task>) => void;
  onDelete: (id: string) => void;
}> = ({ task, onClose, onUpdate, onDelete }) => {
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [notes, setNotes] = useState(task.notes || '');

  const save = () => { onUpdate(task.id, { title, priority, notes }); onClose(); };

  return (
    <div className="space-y-5 pb-6">
      <Input
        label="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        validate={(v) => !v.trim() ? 'Task title is required' : undefined}
      />
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-2">Priority</label>
        <div className="flex gap-2">
          {(['low', 'medium', 'high'] as Priority[]).map(p => (
            <button key={p} type="button" onClick={() => setPriority(p)} className={`flex-1 min-h-11 py-2 rounded-xl text-sm font-bold border capitalize transition-all ${priority === p ? (p === 'high' ? 'bg-red-500/20 text-red-400 border-red-500/30' : p === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-slate-700 text-slate-300 border-slate-600') : 'bg-slate-900 text-slate-500 border-white/5'}`}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl">
        <Calendar className="w-5 h-5 text-slate-500" />
        <span className="text-sm text-slate-300">{task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'No due date'}</span>
      </div>
      {task.project_name && (
        <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl">
          <Briefcase className="w-5 h-5 text-slate-500" />
          <span className="text-sm text-slate-300">{task.project_name}</span>
        </div>
      )}
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-2">Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Add notes..."
          rows={4}
          className="w-full text-sm text-slate-300 bg-slate-800 rounded-xl p-3 resize-none outline-none placeholder:text-slate-600 border border-white/5"
        />
      </div>
      <button type="button" onClick={save} className="w-full min-h-11 py-3 bg-teal-600 text-white font-semibold rounded-xl text-sm">Save Changes</button>
      <button
        type="button"
        onClick={() => { if (confirm('Delete this task?')) { onDelete(task.id); onClose(); } }}
        className="w-full min-h-11 py-3 text-red-400 font-medium text-sm"
      >
        Delete Task
      </button>
    </div>
  );
};

// ── Collapsible Section ────────────────────────────────────────────────────────
const TaskSection: React.FC<{
  label: string;
  tasks: Task[];
  defaultCollapsed?: boolean;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onTap: (task: Task) => void;
  bulkMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}> = ({ label, tasks, defaultCollapsed = false, onComplete, onDelete, onTap, bulkMode, selectedIds, onToggleSelect }) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  if (tasks.length === 0) return null;
  return (
    <div>
      <button onClick={() => setCollapsed(c => !c)} className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-900/60 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-black uppercase tracking-wider text-slate-400">{label}</span>
          <span className="text-[11px] font-bold px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded-full">{tasks.length}</span>
        </div>
        {collapsed ? <ChevronRight className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      <AnimatePresence>
        {!collapsed && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="divide-y divide-white/5">
              {tasks.map(t => (
                <SwipeableTaskRow
                  key={t.id}
                  task={t}
                  onComplete={onComplete}
                  onDelete={onDelete}
                  onTap={onTap}
                  bulkMode={bulkMode}
                  selected={selectedIds?.has(t.id)}
                  onToggleSelect={onToggleSelect}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TaskCreateContent: React.FC<{
  onCreate: (data: { title: string; due_date?: string; priority: Priority }) => Promise<void>;
  creating: boolean;
  onClose: () => void;
}> = ({ onCreate, creating, onClose }) => {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState('');

  const submit = async () => {
    if (!title.trim()) {
      toast.error('Task title is required');
      return;
    }
    await onCreate({ title: title.trim(), due_date: dueDate || undefined, priority });
    onClose();
  };

  return (
    <div className="space-y-4 pb-6">
      <Input
        label="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs to be done?"
        validate={(v) => !v.trim() ? 'Task title is required' : undefined}
        autoFocus
      />
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-2">Priority</label>
        <div className="flex gap-2">
          {(['low', 'medium', 'high'] as Priority[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={`flex-1 min-h-11 py-2 rounded-xl text-xs font-bold border capitalize ${priority === p ? 'bg-teal-600 text-white border-teal-500' : 'bg-slate-900 text-slate-500 border-white/5'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="w-full px-3 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-white text-sm outline-none"
      />
      <button
        type="button"
        onClick={submit}
        disabled={creating}
        className="w-full min-h-11 py-3 bg-teal-600 text-white font-semibold rounded-xl text-sm disabled:opacity-50"
      >
        {creating ? 'Saving…' : 'Create task'}
      </button>
    </div>
  );
};

// ── Main TasksTab ──────────────────────────────────────────────────────────────
const TasksTab: React.FC<TasksTabProps> = ({ user }) => {
  const router = useRouter();
  const { currentTenant } = useTenant();
  const {
    lists: microsoftLists,
    connected: microsoftConnected,
    loading: microsoftLoading,
    error: microsoftError,
    refresh: refreshMicrosoftTasks,
  } = useMicrosoftTasks();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const PAGE_SIZE = 200;

  const loadPage = useCallback(async (pageIndex: number) => {
    if (!currentTenant?.id) return;
    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count } = await supabase
      .from('tasks')
      .select('*, projects(name)', { count: 'exact' })
      .eq('tenant_id', currentTenant.id)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    const mapped = ((data as any[]) || []).map((t) => ({ ...t, project_name: t.projects?.name }));
    setTotalCount(typeof count === 'number' ? count : null);
    setHasMore(typeof count === 'number' ? to + 1 < count : mapped.length === PAGE_SIZE);

    return mapped as Task[];
  }, [currentTenant?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    setPage(0);
    const firstPage = await loadPage(0);
    if (firstPage) setTasks(firstPage);
    setLoading(false);
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    const nextPage = page + 1;
    setLoading(true);
    const nextTasks = await loadPage(nextPage);
    if (nextTasks?.length) {
      setTasks((prev) => [...prev, ...nextTasks]);
      setPage(nextPage);
    } else {
      setHasMore(false);
    }
    setLoading(false);
  }, [hasMore, loadPage, loading, page]);

  useEffect(() => { load(); }, [load]);

  const handleComplete = async (id: string) => {
    if (!currentTenant?.id) return;
    await supabase.from('tasks').update({ status: 'completed' }).eq('id', id).eq('tenant_id', currentTenant.id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'completed' as TaskStatus } : t));
    toast.success('Task completed! 🎉');
  };

  const handleDelete = async (id: string) => {
    if (!currentTenant?.id) return;
    await supabase.from('tasks').delete().eq('id', id).eq('tenant_id', currentTenant.id);
    setTasks(prev => prev.filter(t => t.id !== id));
    toast.success('Task deleted');
  };

  const handleUpdate = async (id: string, changes: Partial<Task>) => {
    if (!currentTenant?.id) return;
    await supabase.from('tasks').update(changes).eq('id', id).eq('tenant_id', currentTenant.id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...changes } : t));
    toast.success('Task updated');
  };

  const handleKanbanStatus = async (taskId: string, newStatus: KanbanTask['status']) => {
    await handleUpdate(taskId, { status: fromKanbanStatus(newStatus) });
  };

  const toggleTaskSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!currentTenant?.id || selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected task(s)?`)) return;
    const ids = Array.from(selectedIds);
    await supabase.from('tasks').delete().eq('tenant_id', currentTenant.id).in('id', ids);
    setTasks((prev) => prev.filter((t) => !selectedIds.has(t.id)));
    setSelectedIds(new Set());
    toast.success(`${ids.length} task(s) deleted`);
  };

  const handleBulkComplete = async () => {
    if (!currentTenant?.id || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await supabase.from('tasks').update({ status: 'completed' }).eq('tenant_id', currentTenant.id).in('id', ids);
    setTasks((prev) => prev.map((t) => (selectedIds.has(t.id) ? { ...t, status: 'completed' as TaskStatus } : t)));
    setSelectedIds(new Set());
    toast.success(`${ids.length} task(s) completed`);
  };

  const handleCreateTask = async (data: { title: string; due_date?: string; priority: Priority }) => {
    if (!currentTenant?.id) return;
    setCreating(true);
    try {
      const { data: row, error } = await supabase
        .from('tasks')
        .insert({
          tenant_id: currentTenant.id,
          title: data.title,
          status: 'todo',
          priority: data.priority,
          due_date: data.due_date || null,
        })
        .select('*, projects(name)')
        .single();
      if (error) throw error;
      const mapped = { ...(row as any), project_name: (row as any).projects?.name } as Task;
      setTasks((prev) => [mapped, ...prev]);
      setCreateOpen(false);
      toast.success('Task created');
      showActionNextSteps('task_created', (path) => router.push(path));
    } catch {
      toast.error('Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  const groups = groupTasks(tasks);
  const ORDER = ['Today', 'This Week', 'Later', 'No Due Date', 'Completed'];
  const isTruncated = totalCount !== null && tasks.length < totalCount;

  const taskStats = useMemo<ModuleStat[]>(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const active = tasks.filter(t => t.status !== 'completed');
    const completed = tasks.filter(t => t.status === 'completed').length;
    const overdue = active.filter(t => t.due_date && new Date(t.due_date) < today).length;
    const dueToday = active.filter(t => {
      if (!t.due_date) return false;
      const d = new Date(t.due_date); d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    }).length;
    const totalSeen = tasks.length;
    const completionRate = totalSeen > 0 ? Math.round((completed / totalSeen) * 100) : 0;
    return [
      { label: 'Open Tasks', value: (totalCount ?? active.length).toLocaleString(), sub: 'Not yet completed', Icon: ListChecks, accent: 'blue' },
      { label: 'Due Today', value: dueToday, sub: 'Needs attention', Icon: CalendarClock, accent: 'amber' },
      { label: 'Overdue', value: overdue, sub: overdue > 0 ? 'Past due date' : 'All on track', Icon: AlertTriangle, accent: overdue > 0 ? 'rose' : 'emerald' },
      { label: 'Completion', value: `${completionRate}%`, sub: `${completed} done`, Icon: CheckCircle2, accent: 'teal' },
    ];
  }, [tasks, totalCount]);

  useInfiniteScroll(listRef, loadMore, { enabled: hasMore && !loading && viewMode === 'list' });

  return (
    <div className="relative flex flex-col min-h-0 ac-scroll-full ac-enterprise-module">
      <ModulePageLayout
        showBonnieDock
        header={(
          <div className="px-4 pt-3">
            <OperationalWorkflowStrip moduleId="projects" userRole={user.role} />
          </div>
        )}
        toolbar={(
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-white/5 bg-slate-950/80">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setBulkMode((v) => !v);
              setSelectedIds(new Set());
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${bulkMode ? 'bg-teal-600 text-white' : 'text-slate-400 border border-white/10'}`}
          >
            {bulkMode ? 'Cancel' : 'Select'}
          </button>
          {bulkMode && (
            <>
              <button type="button" onClick={() => setSelectedIds(new Set(tasks.map((t) => t.id)))} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 border border-white/10">
                All
              </button>
              <button type="button" disabled={selectedIds.size === 0} onClick={handleBulkComplete} className="px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-300 border border-emerald-500/30 disabled:opacity-40">
                Complete ({selectedIds.size})
              </button>
              <button type="button" disabled={selectedIds.size === 0} onClick={handleBulkDelete} className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-300 border border-rose-500/30 disabled:opacity-40">
                Delete ({selectedIds.size})
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setViewMode('list')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
        >
          <List className="w-3.5 h-3.5" /> List
        </button>
        <button
          type="button"
          onClick={() => setViewMode('board')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${viewMode === 'board' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
        >
          <LayoutGrid className="w-3.5 h-3.5" /> Board
        </button>
        </div>
      </div>
        )}
        stats={!loading ? (
          <div className="p-4 border-b border-white/5 bg-slate-900/20">
            <ModuleStatCards stats={taskStats} />
          </div>
        ) : null}
      >
      <div ref={listRef} className="flex-1 ac-scroll-full pb-20 bg-slate-950">
        {microsoftConnected && (
          <div className="p-4 border-b border-white/5 bg-slate-900/40">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Microsoft To Do</h3>
                <p className="text-xs text-slate-400">Connected task lists appear alongside native Alphaclone tasks.</p>
              </div>
              <button
                type="button"
                onClick={() => refreshMicrosoftTasks()}
                className="rounded-lg border border-white/5 bg-slate-950/50 p-2 text-slate-300 hover:text-white"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            {microsoftLoading ? (
              <div className="text-xs text-slate-500">Loading Microsoft To Do lists...</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {microsoftLists.map((list) => (
                  <div key={list.id} className="rounded-xl border border-blue-500/10 bg-slate-950/50 p-3">
                    <p className="text-sm font-semibold text-white truncate">{list.displayName}</p>
                    <p className="text-[11px] text-blue-300 mt-1">{list.tasks.length} Microsoft tasks</p>
                    <div className="mt-3 space-y-2">
                      {list.tasks.slice(0, 3).map((task: any) => (
                        <div key={task.id} className="rounded-lg bg-slate-900/70 px-2.5 py-2">
                          <p className="text-xs font-medium text-slate-200 truncate">{task.title}</p>
                          <p className="text-[11px] text-slate-500">
                            {task.status === 'completed' ? 'Completed' : 'Open in Microsoft To Do'}
                          </p>
                        </div>
                      ))}
                      {list.tasks.length === 0 && (
                        <p className="text-[11px] text-slate-500">No Microsoft tasks in this list.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {microsoftError && <p className="text-xs text-rose-400 mt-3">{microsoftError}</p>}
          </div>
        )}
        {loading ? (
          <div className="space-y-px">{[...Array(8)].map((_, i) => <div key={i} className="h-11 bg-slate-900/40 animate-pulse" />)}</div>
        ) : tasks.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={ListChecks}
              title="No tasks yet"
              description="Use the + button to create your first task and track follow-ups in one place."
            />
          </div>
        ) : viewMode === 'board' ? (
          <div className="p-4">
            <KanbanView
              tasks={tasks.map(toKanbanTask)}
              onUpdateStatus={handleKanbanStatus}
              onEditTask={(kt) => {
                const original = tasks.find((t) => t.id === kt.id);
                if (original) setDetailTask(original);
              }}
            />
          </div>
        ) : (
          <div>
            {isTruncated && (
              <div className="px-4 py-3 text-[12px] text-slate-400 bg-slate-900/60 border-b border-white/5">
                Showing {tasks.length.toLocaleString()} of {totalCount?.toLocaleString()} tasks
              </div>
            )}
            {ORDER.map(label => (
              <TaskSection
                key={label}
                label={label}
                tasks={groups[label] || []}
                defaultCollapsed={label === 'Completed'}
                onComplete={handleComplete}
                onDelete={handleDelete}
                onTap={setDetailTask}
                bulkMode={bulkMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleTaskSelected}
              />
            ))}
            {hasMore && (
              <div className="p-4 text-center text-xs text-slate-500 ac-skeleton-pulse">
                Loading more…
              </div>
            )}
          </div>
        )}
      </div>
      </ModulePageLayout>

      {/* FAB */}
      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-20 right-4 w-14 h-14 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30 z-30"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="New task">
        <TaskCreateContent onCreate={handleCreateTask} creating={creating} onClose={() => setCreateOpen(false)} />
      </DetailDrawer>

      <DetailDrawer
        open={!!detailTask}
        onOpenChange={(open) => !open && setDetailTask(null)}
        title="Task details"
      >
        {detailTask ? (
          <TaskDetailContent
            task={detailTask}
            onClose={() => setDetailTask(null)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ) : null}
      </DetailDrawer>
    </div>
  );
};

export default TasksTab;
