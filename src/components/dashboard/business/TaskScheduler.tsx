'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Bot, CalendarClock, ChevronDown, ChevronUp, Loader2, Pause, Play, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
<<<<<<< HEAD
import { useTenant } from '@/contexts/TenantContext';
=======
import { ModuleIntelligenceCard } from '../ModuleIntelligenceCard';
>>>>>>> origin/main

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

<<<<<<< HEAD
  return <div className="space-y-5">
    <div className="flex items-start justify-between gap-4">
      <div><h2 className="text-2xl font-semibold text-white flex items-center gap-2"><Bot className="w-6 h-6 text-violet-400" /> AI Task Scheduler</h2><p className="text-sm text-slate-400 mt-1">Run durable AI analysis and drafting tasks on a UTC schedule. Every run stores its real provider result.</p></div>
      <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg bg-violet-500 text-white font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> Schedule task</button>
=======
  const typeInfo = (type: string) => TASK_TYPES.find(t => t.value === type) || TASK_TYPES[TASK_TYPES.length - 1];

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold text-white">Task Scheduler</h2>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs">
              <Bot size={11} /> AI
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">Automate business tasks with Claude AI — runs on your schedule</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold px-4 py-2.5 rounded-xl transition-all active:scale-95 shadow-lg shadow-violet-600/20"
        >
          <Plus size={16} /> New Task
        </button>
      </div>
      <ModuleIntelligenceCard moduleKey="taskManagement" title="Task Intelligence" />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Active',    count: tasks.filter(t => t.status === 'active').length,    color: 'text-teal-400',   bg: 'bg-teal-400/10' },
          { label: 'AI Tasks',  count: tasks.filter(t => t.aiEnabled).length,              color: 'text-violet-400', bg: 'bg-violet-400/10' },
          { label: 'Paused',    count: tasks.filter(t => t.status === 'paused').length,    color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
          { label: 'Completed', count: tasks.filter(t => t.status === 'completed').length, color: 'text-slate-400',  bg: 'bg-slate-400/10' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-white/5 rounded-2xl p-4 text-center`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-900/40 border border-white/5 rounded-2xl text-center">
          <div className="w-16 h-16 bg-violet-500/10 border border-violet-500/20 rounded-2xl flex items-center justify-center mb-4">
            <Bot size={28} className="text-violet-400" />
          </div>
          <p className="text-white font-bold text-lg">No scheduled tasks yet</p>
          <p className="text-slate-500 text-sm mt-1 max-w-sm">
            Create AI-powered tasks that run automatically — email campaigns, lead scoring, follow-ups, and more.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-6 flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold px-5 py-2.5 rounded-xl transition-all active:scale-95"
          >
            <Sparkles size={15} /> Create First Task
          </button>
        </div>
      )}

      {/* Task List */}
      <div className="space-y-3">
        {tasks.map(task => {
          const ti = typeInfo(task.type);
          const isExpanded = expandedTask === task.id;

          return (
            <div key={task.id} className={`relative bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden transition-all pl-1`}>
              {/* Status strip */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${
                task.running       ? 'bg-violet-500 animate-pulse' :
                task.status === 'completed' ? 'bg-teal-500' :
                task.status === 'paused'    ? 'bg-yellow-500' :
                                              'bg-green-500'
              }`} />
              {/* Task Row */}
              <div className="flex items-center gap-3 p-4">
                {/* Type badge */}
                <div className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border ${ti.color}`}>
                  {ti.icon}
                  <span className="hidden sm:inline">{ti.label}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white truncate">{task.title}</span>
                    {task.aiEnabled && (
                      <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-500/15 border border-violet-500/20 text-violet-400 text-xs">
                        <Sparkles size={8} /> AI
                      </span>
                    )}
                    {task.running && (
                      <span className="shrink-0 flex items-center gap-1 text-teal-400 text-xs">
                        <Loader2 size={10} className="animate-spin" /> Running
                      </span>
                    )}
                    {task.status === 'completed' && <CheckCircle2 size={14} className="text-teal-400 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500 flex-wrap">
                    <span className="capitalize">{task.schedule.type} @ {task.schedule.time}</span>
                    {task.nextRun && task.status === 'active' && (
                      <span>Next: {new Date(task.nextRun).toLocaleDateString()}</span>
                    )}
                    {task.lastRun && (
                      <span>Last run: {new Date(task.lastRun).toLocaleString()}</span>
                    )}
                    {task.results && (
                      <span className={task.results.failed > 0 ? 'text-red-400' : 'text-teal-400'}>
                        {task.results.successful}/{task.results.total} ok
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Run Now */}
                  <button
                    onClick={() => executeTask(task.id)}
                    disabled={task.running || task.status === 'completed'}
                    title="Run now"
                    className="p-2 rounded-lg hover:bg-violet-500/10 text-slate-500 hover:text-violet-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    {task.running ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                  </button>
                  {/* Pause / Resume */}
                  <button
                    onClick={() => toggleStatus(task.id)}
                    disabled={task.status === 'completed'}
                    title={task.status === 'active' ? 'Pause' : 'Resume'}
                    className="p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    {task.status === 'active' ? <Pause size={15} /> : <Play size={15} />}
                  </button>
                  {/* Expand */}
                  {task.results?.output && (
                    <button
                      onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                      className="p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-colors"
                    >
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  )}
                  {/* Delete */}
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* AI Output panel */}
              {isExpanded && task.results?.output && (
                <div className="border-t border-white/5 bg-slate-950/50 px-4 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Bot size={14} className="text-violet-400" />
                    <span className="text-xs font-medium text-violet-400">AI Output</span>
                    {task.results.executedAt && (
                      <span className="ml-auto text-xs text-slate-600">
                        {new Date(task.results.executedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-900/60 rounded-xl p-4 border border-white/5 max-h-60 overflow-y-auto">
                    {task.results.output}
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(task.results!.output!); toast.success('Copied!'); }}
                    className="mt-2 text-xs text-slate-500 hover:text-white transition-colors"
                  >
                    Copy output
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Add Task Modal ───────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-white">New Task</h3>
                <p className="text-slate-500 text-xs mt-0.5">Scheduled automation powered by Claude AI</p>
              </div>
              <button onClick={() => { setShowAddModal(false); resetNewTask(); }} className="p-2 hover:bg-white/5 rounded-xl text-slate-400">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5">
              {/* Title */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Task Name</label>
                <input
                  type="text"
                  placeholder="e.g. Daily lead follow-up campaign"
                  value={newTask.title || ''}
                  onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Description</label>
                <input
                  type="text"
                  placeholder="What should this task accomplish?"
                  value={newTask.description || ''}
                  onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>

              {/* Recipient — shown for email tasks */}
              {newTask.type === 'email' && (
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Recipient Email</label>
                  <input
                    type="email"
                    placeholder="client@example.com (leave blank to draft only)"
                    value={newTask.target?.criteria || ''}
                    onChange={e => setNewTask(p => ({ ...p, target: { ...p.target, criteria: e.target.value } }))}
                    className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                  <p className="text-[11px] text-slate-600 mt-1">When set, email will be sent automatically via Zoho Mail on each run.</p>
                </div>
              )}

              {/* Platform — shown for social tasks */}
              {newTask.type === 'social_post' && (
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Platforms</label>
                  <select
                    value={newTask.target?.criteria || 'facebook'}
                    onChange={e => setNewTask(p => ({ ...p, target: { ...p.target, criteria: e.target.value } }))}
                    className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-md text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                  >
                    <option value="facebook">Facebook</option>
                    <option value="facebook,instagram">Facebook + Instagram</option>
                    <option value="instagram">Instagram</option>
                  </select>
                  <p className="text-[11px] text-slate-600 mt-1">AI writes the caption and schedules the post automatically.</p>
                </div>
              )}

              {/* Type + Schedule row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Task Type</label>
                  <select
                    value={newTask.type || 'email'}
                    onChange={e => setNewTask(p => ({
                      ...p,
                      type: e.target.value as Task['type'],
                      aiPrompt: p.aiPrompt === DEFAULT_AI_PROMPTS[p.type || 'email']
                        ? DEFAULT_AI_PROMPTS[e.target.value]
                        : p.aiPrompt,
                    }))}
                    className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-md text-white focus:outline-none focus:border-violet-500/50 transition-colors"
                  >
                    {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Frequency</label>
                  <select
                    value={newTask.schedule?.type || 'daily'}
                    onChange={e => setNewTask(p => ({ ...p, schedule: { ...p.schedule!, type: e.target.value as Task['schedule']['type'] } }))}
                    className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-md text-white focus:outline-none focus:border-violet-500/50 transition-colors"
                  >
                    {SCHEDULE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Time + Day row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Run Time</label>
                  <input
                    type="time"
                    value={newTask.schedule?.time || '09:00'}
                    onChange={e => setNewTask(p => ({ ...p, schedule: { ...p.schedule!, time: e.target.value } }))}
                    className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500/50 transition-colors"
                  />
                </div>
                {newTask.schedule?.type === 'weekly' && (
                  <div>
                    <label className="text-xs font-medium text-slate-400 mb-1.5 block">Day of Week</label>
                    <select
                      value={newTask.schedule?.day ?? 1}
                      onChange={e => setNewTask(p => ({ ...p, schedule: { ...p.schedule!, day: parseInt(e.target.value) } }))}
                      className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-md text-white focus:outline-none focus:border-violet-500/50 transition-colors"
                    >
                      {DAYS_OF_WEEK.map((d, i) => <option key={d} value={i}>{d}</option>)}
                    </select>
                  </div>
                )}
                {newTask.schedule?.type === 'monthly' && (
                  <div>
                    <label className="text-xs font-medium text-slate-400 mb-1.5 block">Day of Month</label>
                    <input
                      type="number" min={1} max={28}
                      value={newTask.schedule?.day ?? 1}
                      onChange={e => setNewTask(p => ({ ...p, schedule: { ...p.schedule!, day: parseInt(e.target.value) } }))}
                      className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500/50 transition-colors"
                    />
                  </div>
                )}
              </div>

              {/* AI Toggle */}
              <div className="flex items-center justify-between p-4 bg-violet-500/5 border border-violet-500/20 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-violet-500/10 rounded-xl">
                    <Bot size={18} className="text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Claude AI Execution</p>
                    <p className="text-[11px] text-slate-500">AI reads your instructions and executes the task intelligently</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setNewTask(p => ({ ...p, aiEnabled: !p.aiEnabled }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${newTask.aiEnabled ? 'bg-violet-600' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${newTask.aiEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* AI Prompt */}
              {newTask.aiEnabled && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-400">AI Instructions</label>
                    <button
                      type="button"
                      onClick={() => setNewTask(p => ({ ...p, aiPrompt: DEFAULT_AI_PROMPTS[p.type || 'custom'] }))}
                      className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                    >
                      <RotateCcw size={9} /> Reset to default
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    placeholder="Tell Claude exactly what to do when this task runs…"
                    value={newTask.aiPrompt || ''}
                    onChange={e => setNewTask(p => ({ ...p, aiPrompt: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 transition-colors resize-none"
                  />
                  <p className="text-xs text-slate-600 mt-1">
                    Claude will use this as its instructions when executing the task. Be specific for better results.
                  </p>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowAddModal(false); resetNewTask(); }}
                className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 font-bold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={addTask}
                className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Sparkles size={15} /> Schedule
              </button>
            </div>
          </div>
        </div>
      )}
>>>>>>> origin/main
    </div>

<<<<<<< HEAD
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
=======
export default TaskScheduler;

>>>>>>> origin/main
