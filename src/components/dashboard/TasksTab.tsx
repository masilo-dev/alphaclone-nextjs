'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, ChevronDown, ChevronRight, X, Calendar, Briefcase,
  User, Trash2, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';
import { User as UserType } from '../../types';
import toast from 'react-hot-toast';

type Priority = 'low' | 'medium' | 'high';
type TaskStatus = 'todo' | 'in_progress' | 'done';

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
    if (t.status === 'done') { groups['Completed'].push(t); continue; }
    if (!t.due_date) { groups['No Due Date'].push(t); continue; }
    const d = new Date(t.due_date); d.setHours(0,0,0,0);
    if (d <= today) groups['Today'].push(t);
    else if (d <= weekEnd) groups['This Week'].push(t);
    else groups['Later'].push(t);
  }
  return groups;
};

// ── Swipeable Task Row ─────────────────────────────────────────────────────────
const SwipeableTaskRow: React.FC<{
  task: Task;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onTap: (task: Task) => void;
}> = ({ task, onComplete, onDelete, onTap }) => {
  const x = useMotionValue(0);
  const leftOp  = useTransform(x, [0, 70],   [0, 1]);
  const rightOp = useTransform(x, [-70, 0], [1, 0]);
  const done = task.status === 'done';

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
        {/* Custom checkbox — 44x44 tap area */}
        <button
          onClick={() => !done && onComplete(task.id)}
          className="w-11 h-11 flex items-center justify-center flex-shrink-0"
        >
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${done ? 'border-teal-500 bg-teal-500' : 'border-slate-600'}`}>
            {done && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
          </div>
        </button>

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

// ── Task Detail Bottom Sheet ───────────────────────────────────────────────────
const TaskDetailSheet: React.FC<{
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
    <motion.div
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 flex flex-col"
    >
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="bg-slate-900 border-t border-white/10 rounded-t-3xl max-h-[85vh] overflow-y-auto">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-slate-700 rounded-full" />
        </div>

        <div className="px-4 pb-10 space-y-5">
          {/* Editable title */}
          <textarea
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full text-[17px] font-bold text-white bg-transparent resize-none outline-none leading-snug"
            rows={2}
          />

          {/* Priority */}
          <div>
            <label className="text-[11px] text-slate-500 uppercase font-black block mb-2">Priority</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as Priority[]).map(p => (
                <button key={p} onClick={() => setPriority(p)} className={`flex-1 py-2 rounded-xl text-[13px] font-bold border capitalize transition-all ${priority === p ? (p === 'high' ? 'bg-red-500/20 text-red-400 border-red-500/30' : p === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-slate-700 text-slate-300 border-slate-600') : 'bg-slate-900 text-slate-500 border-white/5'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Due date */}
          <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl">
            <Calendar className="w-5 h-5 text-slate-500" />
            <span className="text-[15px] text-slate-300">{task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'No due date'}</span>
          </div>

          {/* Project */}
          {task.project_name && (
            <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl">
              <Briefcase className="w-5 h-5 text-slate-500" />
              <span className="text-[15px] text-slate-300">{task.project_name}</span>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-[11px] text-slate-500 uppercase font-black block mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes..."
              rows={4}
              className="w-full text-[15px] text-slate-300 bg-slate-800 rounded-xl p-3 resize-none outline-none placeholder:text-slate-600 border border-white/5"
            />
          </div>

          <button onClick={save} className="w-full py-3 bg-teal-600 text-white font-black uppercase tracking-wider rounded-xl text-[13px]">Save Changes</button>

          <button
            onClick={() => { if (confirm('Delete this task?')) { onDelete(task.id); onClose(); } }}
            className="w-full py-3 text-red-400 font-bold text-[13px]"
          >
            Delete Task
          </button>
        </div>
      </div>
    </motion.div>
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
}> = ({ label, tasks, defaultCollapsed = false, onComplete, onDelete, onTap }) => {
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
              {tasks.map(t => <SwipeableTaskRow key={t.id} task={t} onComplete={onComplete} onDelete={onDelete} onTap={onTap} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Main TasksTab ──────────────────────────────────────────────────────────────
const TasksTab: React.FC<TasksTabProps> = ({ user }) => {
  const { currentTenant } = useTenant();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const { data } = await supabase.from('tasks').select('*, projects(name)').eq('tenant_id', currentTenant.id).order('created_at', { ascending: false });
    const mapped = ((data as any[]) || []).map(t => ({ ...t, project_name: t.projects?.name }));
    setTasks(mapped as Task[]);
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => { load(); }, [load]);

  const handleComplete = async (id: string) => {
    await supabase.from('tasks').update({ status: 'done' }).eq('id', id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'done' as TaskStatus } : t));
    toast.success('Task completed! 🎉');
  };

  const handleDelete = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id);
    setTasks(prev => prev.filter(t => t.id !== id));
    toast.success('Task deleted');
  };

  const handleUpdate = async (id: string, changes: Partial<Task>) => {
    await supabase.from('tasks').update(changes).eq('id', id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...changes } : t));
    toast.success('Task updated');
  };

  const groups = groupTasks(tasks);
  const ORDER = ['Today', 'This Week', 'Later', 'No Due Date', 'Completed'];

  return (
    <div className="relative flex flex-col h-full">
      <div className="flex-1 overflow-y-auto pb-20 bg-slate-950">
        {loading ? (
          <div className="space-y-px">{[...Array(8)].map((_, i) => <div key={i} className="h-11 bg-slate-900/40 animate-pulse" />)}</div>
        ) : (
          ORDER.map(label => (
            <TaskSection
              key={label}
              label={label}
              tasks={groups[label] || []}
              defaultCollapsed={label === 'Completed'}
              onComplete={handleComplete}
              onDelete={handleDelete}
              onTap={setDetailTask}
            />
          ))
        )}
      </div>

      {/* FAB */}
      <button className="fixed bottom-20 right-4 w-14 h-14 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30 z-30">
        <Plus className="w-6 h-6 text-white" />
      </button>

      {/* Task Detail Sheet */}
      <AnimatePresence>
        {detailTask && (
          <TaskDetailSheet
            task={detailTask}
            onClose={() => setDetailTask(null)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default TasksTab;
