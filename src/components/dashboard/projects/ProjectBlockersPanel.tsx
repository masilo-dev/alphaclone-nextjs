'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { taskService, type Task } from '@/services/taskService';
import toast from 'react-hot-toast';

type ProjectIssue = {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  task_id: string | null;
};

interface ProjectBlockersPanelProps {
  projectId: string;
  tenantId: string;
  userId: string;
  onTasksChanged?: () => void;
}

export function ProjectBlockersPanel({
  projectId,
  tenantId,
  userId,
  onTasksChanged,
}: ProjectBlockersPanelProps) {
  const [blockedTasks, setBlockedTasks] = useState<Task[]>([]);
  const [issues, setIssues] = useState<ProjectIssue[]>([]);
  const [loading, setLoading] = useState(true);

  const issuesBase = `/api/tenant/${encodeURIComponent(tenantId)}/projects/${encodeURIComponent(projectId)}/issues`;

  const load = useCallback(async () => {
    setLoading(true);
    const [{ tasks }, issuesRes] = await Promise.all([
      taskService.getTasks({ relatedToProject: projectId }),
      fetch(`${issuesBase}?status=active`, { credentials: 'include' }),
    ]);

    setBlockedTasks((tasks || []).filter((t) => String(t.status) === 'blocked'));

    if (!issuesRes.ok) {
      setIssues([]);
    } else {
      const payload = await issuesRes.json().catch(() => ({}));
      setIssues((payload.issues || []) as ProjectIssue[]);
    }
    setLoading(false);
  }, [issuesBase, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const unblockTask = async (task: Task) => {
    const { error } = await taskService.updateTask(task.id, { status: 'todo' });
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Task unblocked');
    onTasksChanged?.();
    void load();
  };

  const resolveIssue = async (issueId: string) => {
    const response = await fetch(`${issuesBase}/${encodeURIComponent(issueId)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    });
    if (!response.ok) {
      toast.error('Could not resolve issue');
      return;
    }
    toast.success('Issue resolved');
    void load();
  };

  const addIssue = async () => {
    const title = window.prompt('Describe the blocker or risk');
    if (!title?.trim()) return;
    const response = await fetch(issuesBase, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), severity: 'high' }),
    });
    if (!response.ok) {
      toast.error('Could not log issue');
      return;
    }
    toast.success('Issue logged');
    void load();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Checking blockers…
      </div>
    );
  }

  if (blockedTasks.length === 0 && issues.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">
        No active blockers on this project.
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5" />
          Blockers & risks
        </div>
        <button
          type="button"
          onClick={() => void addIssue()}
          className="text-[10px] font-semibold text-amber-200 hover:text-white"
        >
          + Log issue
        </button>
      </div>
      <div className="space-y-2">
        {blockedTasks.map((task) => (
          <div key={task.id} className="flex items-start justify-between gap-2 rounded-md bg-slate-950/50 px-2.5 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{task.title}</p>
              <p className="text-[11px] text-amber-200/80">Blocked task</p>
            </div>
            <button
              type="button"
              onClick={() => void unblockTask(task)}
              className="shrink-0 text-[10px] font-semibold text-teal-300 hover:text-teal-200"
            >
              Unblock
            </button>
          </div>
        ))}
        {issues.map((issue) => (
          <div key={issue.id} className="flex items-start justify-between gap-2 rounded-md bg-slate-950/50 px-2.5 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{issue.title}</p>
              <p className="text-[11px] text-slate-400 capitalize">{issue.severity} · {issue.status}</p>
            </div>
            <button
              type="button"
              onClick={() => void resolveIssue(issue.id)}
              className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-teal-300 hover:text-teal-200"
            >
              <CheckCircle2 className="w-3 h-3" />
              Resolve
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
