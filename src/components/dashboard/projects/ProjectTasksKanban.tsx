'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, ExternalLink, Loader2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { KanbanView } from '@/components/dashboard/tasks/KanbanView';
import { taskService, type Task } from '@/services/taskService';
import toast from 'react-hot-toast';

interface ProjectTasksKanbanProps {
  projectId: string;
  userId: string;
  projectDueDate?: string;
  onTasksChanged?: () => void;
}

function toDateInputValue(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

/** Default schedule: project due date if still ahead, otherwise next weekday 5pm local. */
function defaultDueDateInput(projectDueDate?: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (projectDueDate) {
    const projectDue = new Date(projectDueDate);
    projectDue.setHours(0, 0, 0, 0);
    if (projectDue >= today) return toDateInputValue(projectDueDate);
  }

  const next = new Date(today);
  const day = next.getDay();
  if (day === 6) next.setDate(next.getDate() + 2);
  else if (day === 0) next.setDate(next.getDate() + 1);
  return next.toISOString().split('T')[0];
}

function dueDateToIso(dateInput: string): string {
  const d = new Date(`${dateInput}T17:00:00`);
  return d.toISOString();
}

export function ProjectTasksKanban({ projectId, userId, projectDueDate, onTasksChanged }: ProjectTasksKanbanProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState(() => defaultDueDateInput(projectDueDate));
  const [creating, setCreating] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editDueDate, setEditDueDate] = useState('');

  const calendarHref = useMemo(
    () => `/dashboard/calendar?project=${encodeURIComponent(projectId)}`,
    [projectId],
  );
  const tasksHref = useMemo(
    () => `/dashboard/tasks?project=${encodeURIComponent(projectId)}`,
    [projectId],
  );

  useEffect(() => {
    setNewDueDate(defaultDueDateInput(projectDueDate));
  }, [projectDueDate]);

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
    const dueDate = newDueDate ? dueDateToIso(newDueDate) : undefined;
    const { task, error } = await taskService.createTask(userId, {
      title,
      relatedToProject: projectId,
      priority: 'medium',
      status: 'todo',
      dueDate,
    });
    setCreating(false);

    if (error || !task) {
      toast.error(error || 'Task could not be created');
      return;
    }

    setNewTitle('');
    setNewDueDate(defaultDueDateInput(projectDueDate));
    setTasks((prev) => [task, ...prev]);
    onTasksChanged?.();
    toast.success(dueDate ? 'Task added — synced to your calendar' : 'Task added');
  };

  const handleUpdateStatus = async (taskId: string, newStatus: Task['status']) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    const { error } = await taskService.updateTask(taskId, { status: newStatus });
    if (error) {
      toast.error(error);
      void loadTasks();
      return;
    }
    onTasksChanged?.();
  };

  const openEditDueDate = (task: Task) => {
    setEditingTask(task);
    setEditDueDate(toDateInputValue(task.dueDate) || defaultDueDateInput(projectDueDate));
  };

  const saveEditDueDate = async () => {
    if (!editingTask) return;
    const dueDate = editDueDate ? dueDateToIso(editDueDate) : undefined;
    const { error } = await taskService.updateTask(editingTask.id, { dueDate });
    if (error) {
      toast.error(error);
      return;
    }
    setTasks((prev) =>
      prev.map((t) => (t.id === editingTask.id ? { ...t, dueDate } : t)),
    );
    setEditingTask(null);
    onTasksChanged?.();
    toast.success(dueDate ? 'Due date saved — calendar updated' : 'Due date cleared');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500">
          Tasks link to this project and sync to your calendar when they have a due date.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.push(tasksHref)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--brand-blue-300)] hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            All tasks
          </button>
          <button
            type="button"
            onClick={() => router.push(calendarHref)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--brand-blue-300)] hover:underline"
          >
            <Calendar className="w-3 h-3" />
            Calendar
          </button>
        </div>
      </div>

      <form onSubmit={handleCreate} className="flex flex-wrap gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a delivery task…"
          className="flex-1 min-w-[140px] px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-white text-sm outline-none focus:border-[var(--brand-blue-500)]"
        />
        <input
          type="date"
          value={newDueDate}
          onChange={(e) => setNewDueDate(e.target.value)}
          title="Due date — adds to calendar"
          className="px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-white text-sm outline-none focus:border-[var(--brand-blue-500)]"
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

      {tasks.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">No tasks yet — add work items to run delivery from this project.</p>
      ) : (
        <div className="overflow-x-auto pb-2">
          <KanbanView
            tasks={tasks}
            onUpdateStatus={handleUpdateStatus}
            onEditTask={openEditDueDate}
          />
        </div>
      )}

      {editingTask ? (
        <div className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-slate-900 p-4 space-y-3 shadow-xl">
            <p className="text-sm font-bold text-white truncate">{editingTask.title}</p>
            <label className="block text-xs text-slate-400">
              Due date
              <input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-lg text-white text-sm"
              />
            </label>
            <p className="text-[11px] text-slate-500">Saving updates your dashboard calendar (and Google Calendar if connected).</p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="px-3 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveEditDueDate()}
                className="px-3 py-2 rounded-lg bg-[var(--brand-blue-600)] text-white text-xs font-bold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
