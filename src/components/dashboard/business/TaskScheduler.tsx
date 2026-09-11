'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Bot, CalendarClock, ChevronDown, ChevronUp, Loader2, Pause, Play, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTenant } from '@/contexts/TenantContext';

type ScheduledTask = {
  id: string;
  name: string;
  prompt: string;
  schedule: string;
  status: 'active' | 'paused';
  last_run_at?: string | null;
  next_run_at: string;
  latest_result?: { status: 'success' | 'failure'; output?: string | null; error?: string | null; ran_at: string } | null;
};

type Frequency = 'daily' | 'weekly' | 'monthly';

function cronFor(frequency: Frequency, time: string, day: number) {
  const [hour, minute] = time.split(':').map(Number);
  if (frequency === 'weekly') return `${minute} ${hour} * * ${Math.min(6, Math.max(0, day))}`;
  if (frequency === 'monthly') return `${minute} ${hour} ${Math.min(28, Math.max(1, day))} * *`;
  return `${minute} ${hour} * * *`;
}

function scheduleLabel(cron: string) {
  const [minute, hour, date, , weekday] = cron.split(' ');
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} UTC`;
  if (weekday !== '*') return `Weekly on day ${weekday} at ${time}`;
  if (date !== '*') return `Monthly on day ${date} at ${time}`;
  return `Daily at ${time}`;
}

export default function TaskScheduler({ onTaskComplete }: { onTaskComplete?: (task: ScheduledTask) => void }) {
  const { currentTenant } = useTenant();
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [time, setTime] = useState('09:00');
  const [day, setDay] = useState(1);

  const endpoint = currentTenant?.id ? `/api/tenant/${encodeURIComponent(currentTenant.id)}/scheduled-ai-tasks` : '';
  const load = useCallback(async () => {
    if (!endpoint) { setTasks([]); setLoading(false); return; }
    setLoading(true);
    try {
      const response = await fetch(endpoint, { credentials: 'include' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Tasks could not be loaded');
      setTasks(payload.tasks || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Tasks could not be loaded');
    } finally { setLoading(false); }
  }, [endpoint]);

  useEffect(() => { void load(); }, [load]);

  const createTask = async () => {
    if (!endpoint || !name.trim() || !prompt.trim()) return toast.error('Name and instructions are required');
    setBusyId('create');
    try {
      const response = await fetch(endpoint, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, prompt, schedule: cronFor(frequency, time, day) }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Task could not be scheduled');
      setName(''); setPrompt(''); setShowCreate(false); await load();
      toast.success('AI task scheduled');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Task could not be scheduled'); }
    finally { setBusyId(null); }
  };

  const setStatus = async (task: ScheduledTask) => {
    setBusyId(task.id);
    try {
      const status = task.status === 'active' ? 'paused' : 'active';
      const response = await fetch(endpoint, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: task.id, status }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Task status could not be changed');
      await load(); toast.success(status === 'active' ? 'Task resumed' : 'Task paused');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Task status could not be changed'); }
    finally { setBusyId(null); }
  };

  const runNow = async (task: ScheduledTask) => {
    if (!currentTenant?.id) return;
    setBusyId(task.id);
    try {
      const response = await fetch(`${endpoint}/${task.id}/run`, { method: 'POST', credentials: 'include' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Task execution failed');
      await load(); onTaskComplete?.(task); toast.success('Task completed');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Task execution failed'); }
    finally { setBusyId(null); }
  };

  const deleteTask = async (task: ScheduledTask) => {
    if (!window.confirm(`Delete “${task.name}” and its run history?`)) return;
    setBusyId(task.id);
    try {
      const response = await fetch(`${endpoint}?id=${encodeURIComponent(task.id)}`, { method: 'DELETE', credentials: 'include' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Task could not be deleted');
      setTasks((current) => current.filter((item) => item.id !== task.id)); toast.success('Task deleted');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Task could not be deleted'); }
    finally { setBusyId(null); }
  };

  return <div className="space-y-5">
    <div className="flex items-start justify-between gap-4">
      <div><h2 className="text-2xl font-semibold text-white flex items-center gap-2"><Bot className="w-6 h-6 text-violet-400" /> AI Task Scheduler</h2><p className="text-sm text-slate-400 mt-1">Run durable AI analysis and drafting tasks on a UTC schedule. Every run stores its real provider result.</p></div>
      <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg bg-violet-500 text-white font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> Schedule task</button>
    </div>

    {showCreate && <div className="dashboard-panel-soft p-5 space-y-4">
      <div className="flex justify-between"><h3 className="font-semibold text-white">New scheduled task</h3><button onClick={() => setShowCreate(false)} aria-label="Close"><X className="w-5 h-5 text-slate-400" /></button></div>
      <input value={name} onChange={(event) => setName(event.target.value)} maxLength={200} placeholder="Task name" className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white" />
      <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={20000} rows={5} placeholder="Describe the analysis, summary, or draft the AI should produce." className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white resize-y" />
      <div className="grid sm:grid-cols-3 gap-3">
        <select value={frequency} onChange={(event) => setFrequency(event.target.value as Frequency)} className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select>
        <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white" />
        {frequency !== 'daily' ? <input type="number" min={frequency === 'weekly' ? 0 : 1} max={frequency === 'weekly' ? 6 : 28} value={day} onChange={(event) => setDay(Number(event.target.value))} aria-label={frequency === 'weekly' ? 'Day of week, Sunday is 0' : 'Day of month'} className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white" /> : <div className="rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-500">UTC timezone</div>}
      </div>
      {frequency === 'weekly' && <p className="text-xs text-slate-500">Weekly day: 0 Sunday through 6 Saturday.</p>}
      <button disabled={busyId === 'create'} onClick={createTask} className="px-4 py-2 rounded-lg bg-violet-500 disabled:opacity-50 text-white font-semibold">{busyId === 'create' ? 'Scheduling…' : 'Create schedule'}</button>
    </div>}

    {loading ? <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div> : tasks.length === 0 ? <div className="dashboard-panel-soft p-10 text-center"><CalendarClock className="w-9 h-9 text-slate-600 mx-auto mb-3" /><p className="text-white font-medium">No scheduled AI tasks</p><p className="text-sm text-slate-500 mt-1">Create one to generate a stored result on a durable server schedule.</p></div> : <div className="space-y-3">{tasks.map((task) => <div key={task.id} className="dashboard-panel-soft p-4">
      <div className="flex items-start justify-between gap-3"><button onClick={() => setExpandedId(expandedId === task.id ? null : task.id)} className="text-left flex-1"><div className="flex items-center gap-2"><span className="font-semibold text-white">{task.name}</span><span className={`text-[10px] uppercase px-2 py-0.5 rounded-full ${task.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>{task.status}</span></div><p className="text-xs text-slate-500 mt-1">{scheduleLabel(task.schedule)} · Next {new Date(task.next_run_at).toLocaleString()}</p></button><div className="flex items-center gap-1">
        <button disabled={busyId === task.id} onClick={() => runNow(task)} className="p-2 text-violet-400 hover:bg-violet-500/10 rounded-lg" aria-label="Run now"><Play className="w-4 h-4" /></button>
        <button disabled={busyId === task.id} onClick={() => setStatus(task)} className="p-2 text-slate-400 hover:bg-slate-700 rounded-lg" aria-label={task.status === 'active' ? 'Pause' : 'Resume'}>{task.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</button>
        <button disabled={busyId === task.id} onClick={() => deleteTask(task)} className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
        <button onClick={() => setExpandedId(expandedId === task.id ? null : task.id)} className="p-2 text-slate-400">{expandedId === task.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
      </div></div>
      {expandedId === task.id && <div className="mt-4 pt-4 border-t border-slate-800 space-y-3"><div><p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Instructions</p><p className="text-sm text-slate-300 whitespace-pre-wrap">{task.prompt}</p></div><div><p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Latest run</p>{task.latest_result ? <div className={`rounded-lg p-3 text-sm whitespace-pre-wrap ${task.latest_result.status === 'success' ? 'bg-emerald-500/5 text-slate-300' : 'bg-rose-500/5 text-rose-300'}`}>{task.latest_result.output || task.latest_result.error || 'No output was recorded.'}<p className="text-[11px] text-slate-600 mt-2">{new Date(task.latest_result.ran_at).toLocaleString()}</p></div> : <p className="text-sm text-slate-500">This task has not run yet.</p>}</div></div>}
    </div>)}</div>}
  </div>;
}
