'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Circle, Loader2, Plus } from 'lucide-react';
import { taskService, type Task } from '@/services/taskService';
import toast from 'react-hot-toast';

interface ProjectTasksPanelProps {
  projectId: string;
  userId: string;
  onProgressChange?: () => void;
}

const ACTIVE_STATUSES = new Set(['ideas', 'todo', 'in_progress', 'review']);

export function ProjectTasksPanel({ projectId, userId, onProgressChange }: ProjectTasksPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    const { tasks: rows, error } = await taskService.getTasks({ relatedToProject: projectId });
    if (error) {
      toast.error(error);
      setTasks([]);
    } else {
      setTasks(rows || []);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;

    setCreating(true);
    const { task, error } = await taskService.createTask(userId, {
      title,
      relatedToProject: projectId,
      priority: 'medium',
      status: 'todo',
    });
    setCreating(false);

    if (error || !task) {
      toast.error(error || 'Task could not be created');
      return;
    }

    setNewTitle('');
    setTasks((prev) => [task, ...prev]);
    onProgressChange?.();
    toast.success('Task added');
  };

  const toggleComplete = async (task: Task) => {
    const nextStatus = task.status === 'completed' ? 'todo' : 'completed';
    setTasks((prev) => prev.map((row) => (row.id === task.id ? { ...row, status: nextStatus } : row)));
    const { error } = await taskService.updateTask(task.id, { status: nextStatus });
    if (error) {
      toast.error(error);
      void loadTasks();
      return;
    }
    onProgressChange?.();
  };

  const open = tasks.filter((t) => ACTIVE_STATUSES.has(t.status));
  const done = tasks.filter((t) => t.status === 'completed');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Delivery tasks</span>
        <span className="text-[11px] text-slate-500">
          {done.length}/{tasks.length} done
        </span>
      </div>

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a task for this project…"
          className="flex-1 min-w-0 px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-white text-sm outline-none focus:border-[var(--brand-blue-500)]"
        />
        <button
          type="submit"
          disabled={creating || !newTitle.trim()}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[var(--brand-blue-600)] hover:bg-[var(--brand-blue-500)] disabled:opacity-50 text-white text-xs font-bold"
        >
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Add
        </button>
      </form>

      <div className="space-y-2 bg-slate-950/20 rounded-lg p-3 border border-white/5 max-h-56 overflow-y-auto custom-scrollbar">
        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="h-8 bg-slate-900/60 rounded animate-pulse" />)
        ) : tasks.length === 0 ? (
          <p className="text-xs text-slate-500 py-2 text-center">No tasks yet — add work items to track delivery.</p>
        ) : (
          <>
            {open.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => void toggleComplete(task)}
                className="w-full flex items-start gap-2 py-1.5 text-left group"
              >
                <Circle className="w-4 h-4 mt-0.5 shrink-0 text-slate-500 group-hover:text-[var(--brand-blue-400)]" />
                <span className="text-sm text-slate-200 leading-snug">{task.title}</span>
              </button>
            ))}
            {done.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => void toggleComplete(task)}
                className="w-full flex items-start gap-2 py-1.5 text-left group"
              >
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
                <span className="text-sm text-slate-500 line-through leading-snug">{task.title}</span>
              </button>
            ))}
          </>
        )}
      </div>

      {tasks.length > 0 ? (
        <a
          href={`/dashboard/tasks?project=${encodeURIComponent(projectId)}`}
          className="inline-block text-[11px] font-semibold text-[var(--brand-blue-300)] hover:text-[var(--brand-blue-200)]"
        >
          Open full task board →
        </a>
      ) : null}
    </div>
  );
}
