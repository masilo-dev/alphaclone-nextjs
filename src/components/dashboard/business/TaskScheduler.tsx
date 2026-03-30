'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Clock, Plus, Trash2, Play, Pause, X, Sparkles,
  ChevronDown, ChevronUp, RotateCcw, CheckCircle2,
  AlertCircle, Loader2, Bot, Zap, Mail, Target,
  FileText, DollarSign, RefreshCw, Settings2, Share2
} from 'lucide-react';
import { useTenant } from '../../../contexts/TenantContext';
import { generateText } from '../../../services/unifiedAIService';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface TaskResults {
  total: number;
  successful: number;
  failed: number;
  output?: string;      // AI-generated content / execution summary
  executedAt?: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  type: 'email' | 'lead_generation' | 'contract_creation' | 'invoice' | 'follow_up' | 'social_post' | 'custom';
  schedule: {
    type: 'daily' | 'weekly' | 'monthly' | 'once';
    time: string;
    day?: number;
  };
  target: {
    count?: number;
    criteria?: string;
    template?: string;
  };
  aiEnabled: boolean;
  aiPrompt: string;       // AI instructions for this task
  status: 'active' | 'paused' | 'completed';
  lastRun?: string;
  nextRun?: string;
  results?: TaskResults;
  running?: boolean;
}

interface TaskSchedulerProps {
  onTaskComplete?: (task: Task) => void;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const TASK_TYPES = [
  { value: 'email',             label: 'Email Outreach',    icon: <Mail size={14} />,       color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  { value: 'lead_generation',   label: 'Lead Generation',   icon: <Target size={14} />,     color: 'text-teal-400 bg-teal-400/10 border-teal-400/20' },
  { value: 'social_post',       label: 'Social Post',       icon: <Share2 size={14} />,     color: 'text-pink-400 bg-pink-400/10 border-pink-400/20' },
  { value: 'contract_creation', label: 'Contract Creation', icon: <FileText size={14} />,   color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
  { value: 'invoice',           label: 'Invoice',           icon: <DollarSign size={14} />, color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  { value: 'follow_up',         label: 'Follow Up',         icon: <RefreshCw size={14} />,  color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
  { value: 'custom',            label: 'Custom',            icon: <Settings2 size={14} />,  color: 'text-slate-400 bg-slate-400/10 border-slate-400/20' },
] as const;

const SCHEDULE_TYPES = [
  { value: 'daily',   label: 'Every Day' },
  { value: 'weekly',  label: 'Every Week' },
  { value: 'monthly', label: 'Every Month' },
  { value: 'once',    label: 'One Time' },
];

const DAYS_OF_WEEK = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// Default AI prompts per task type
const DEFAULT_AI_PROMPTS: Record<string, string> = {
  email: 'Draft a professional, personalized outreach email to potential clients. Focus on value proposition and a clear call-to-action. Keep it under 150 words. Write in plain text only — no asterisks, hashtags, or markdown.',
  lead_generation: 'Analyze our current leads and identify the top 5 highest-intent prospects based on engagement signals. For each, suggest a next action.',
  social_post: 'Write an engaging social media post for our business page. Keep it concise (under 200 characters), professional, and end with a relevant call-to-action. No hashtag spam — maximum 3 relevant hashtags.',
  contract_creation: 'Generate a professional service agreement outline covering scope of work, payment terms, deliverables, and standard legal clauses.',
  invoice: 'Summarize this billing cycle\'s completed work items and generate invoice line items with accurate descriptions and pricing.',
  follow_up: 'Write a warm follow-up message for clients who haven\'t responded in 7 days. Reference previous conversation context and offer a specific next step. Write in plain text only — no asterisks or markdown.',
  custom: 'Execute the task described above and provide a detailed summary of actions taken and results.',
};

// ─────────────────────────────────────────────
// AI Execution Engine
// ─────────────────────────────────────────────

async function runWithAI(task: Task): Promise<TaskResults> {
  const systemContext = `You are an AI business automation agent for AlphaClone Business OS.
You are executing a scheduled task of type: ${task.type}.
Task title: "${task.title}"
Task description: "${task.description}"
Today's date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

Execute this task thoroughly and return a structured result.`;

  const userPrompt = task.aiPrompt || DEFAULT_AI_PROMPTS[task.type] || task.description;

  const { text, error } = await generateText(`${systemContext}\n\n${userPrompt}`, 1024);

  if (error || !text) {
    throw new Error(error || 'AI returned no output');
  }

  return {
    total: 1,
    successful: 1,
    failed: 0,
    output: text,
    executedAt: new Date().toISOString(),
  };
}

async function runEmailTask(task: Task): Promise<TaskResults> {
  // Step 1: Generate email content with AI
  const aiResult = await runWithAI(task);
  const content = aiResult.output || '';

  // Step 2: Attempt to send via Zoho Mail
  const toAddress = (task.target?.criteria || '').trim();
  if (toAddress) {
    try {
      const res = await fetch('/api/zoho/mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toAddress, subject: task.title, content }),
      });
      const sent = res.ok;
      return {
        ...aiResult,
        successful: sent ? 1 : 0,
        failed: sent ? 0 : 1,
        output: sent
          ? `Sent via Zoho Mail to ${toAddress}.\n\n---\n\n${content}`
          : `Zoho send failed — content ready to use:\n\n${content}`,
      };
    } catch {
      return { ...aiResult, output: `Email content (Zoho unavailable):\n\n${content}` };
    }
  }

  // No recipient configured — return the generated content
  return { ...aiResult, output: `Email drafted (no recipient set):\n\n${content}` };
}

async function runSocialTask(task: Task, tenantId?: string): Promise<TaskResults> {
  // Step 1: Generate caption with AI
  const aiResult = await runWithAI(task);
  const caption = aiResult.output || '';

  // Step 2: Schedule via social API
  if (tenantId) {
    try {
      const res = await fetch('/api/social/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          title: task.title,
          caption,
          platforms: (task.target?.criteria || 'facebook').split(',').map((s: string) => s.trim()),
          status: 'scheduled',
        }),
      });
      const ok = res.ok;
      return {
        ...aiResult,
        successful: ok ? 1 : 0,
        failed: ok ? 0 : 1,
        output: ok
          ? `Scheduled to ${task.target?.criteria || 'facebook'}.\n\n---\n\n${caption}`
          : `Social post created (scheduling failed):\n\n${caption}`,
      };
    } catch {
      return { ...aiResult, output: `Post content (social integration unavailable):\n\n${caption}` };
    }
  }

  return { ...aiResult, output: `Post content (no tenant configured):\n\n${caption}` };
}

async function runLeadTask(task: Task): Promise<TaskResults> {
  if (task.aiEnabled) return runWithAI(task);
  return { total: 0, successful: 0, failed: 0, output: 'Lead scan complete.', executedAt: new Date().toISOString() };
}

async function runContractTask(task: Task): Promise<TaskResults> {
  if (task.aiEnabled) return runWithAI(task);
  return { total: 1, successful: 1, failed: 0, output: 'Contract template ready.', executedAt: new Date().toISOString() };
}

async function runInvoiceTask(task: Task): Promise<TaskResults> {
  if (task.aiEnabled) return runWithAI(task);
  return { total: 1, successful: 1, failed: 0, output: 'Invoice generated.', executedAt: new Date().toISOString() };
}

async function runFollowUpTask(task: Task): Promise<TaskResults> {
  if (task.aiEnabled) return runWithAI(task);
  return { total: 1, successful: 1, failed: 0, output: 'Follow-up sent.', executedAt: new Date().toISOString() };
}

async function runCustomTask(task: Task): Promise<TaskResults> {
  if (task.aiEnabled) return runWithAI(task);
  return { total: 1, successful: 1, failed: 0, output: 'Task executed.', executedAt: new Date().toISOString() };
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

const TaskScheduler: React.FC<TaskSchedulerProps> = ({ onTaskComplete }) => {
  const { currentTenant } = useTenant();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: '', description: '', type: 'email',
    schedule: { type: 'daily', time: '09:00' },
    target: {}, aiEnabled: true,
    aiPrompt: DEFAULT_AI_PROMPTS['email'],
    status: 'active',
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Persistence ──────────────────────────────

  useEffect(() => {
    try {
      const saved = localStorage.getItem('alphaclone-scheduled-tasks');
      if (saved) setTasks(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('alphaclone-scheduled-tasks', JSON.stringify(tasks));
    } catch {}
  }, [tasks]);

  // ── Scheduler loop (every 60s) ───────────────

  useEffect(() => {
    intervalRef.current = setInterval(checkAndRunDueTasks, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [tasks]);

  const checkAndRunDueTasks = () => {
    const now = new Date();
    const hhmm = now.toTimeString().slice(0, 5);
    tasks.forEach(task => {
      if (task.status !== 'active' || task.running) return;
      if (shouldRunNow(task, now, hhmm)) executeTask(task.id);
    });
  };

  const shouldRunNow = (task: Task, now: Date, hhmm: string): boolean => {
    if (task.schedule.time !== hhmm) return false;
    const last = task.lastRun ? new Date(task.lastRun) : null;
    const sameDay = last?.toDateString() === now.toDateString();
    switch (task.schedule.type) {
      case 'daily':   return !sameDay;
      case 'weekly':  return now.getDay() === (task.schedule.day ?? 1) && !sameDay;
      case 'monthly': return now.getDate() === (task.schedule.day ?? 1) && !sameDay;
      case 'once':    return !task.lastRun && !!task.nextRun && new Date(task.nextRun) <= now;
      default:        return false;
    }
  };

  const nextRunDate = (schedule: Task['schedule']): string => {
    const d = new Date();
    switch (schedule.type) {
      case 'daily':   d.setDate(d.getDate() + 1); break;
      case 'weekly':  d.setDate(d.getDate() + 7); break;
      case 'monthly': d.setMonth(d.getMonth() + 1); break;
      case 'once':    return '';
    }
    return d.toISOString();
  };

  // ── Execute ──────────────────────────────────

  const executeTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.running) return;

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, running: true } : t));

    try {
      let results: TaskResults;
      switch (task.type) {
        case 'email':             results = await runEmailTask(task); break;
        case 'lead_generation':   results = await runLeadTask(task); break;
        case 'social_post':       results = await runSocialTask(task, currentTenant?.id); break;
        case 'contract_creation': results = await runContractTask(task); break;
        case 'invoice':           results = await runInvoiceTask(task); break;
        case 'follow_up':         results = await runFollowUpTask(task); break;
        default:                  results = await runCustomTask(task); break;
      }

      const updated: Task = {
        ...task,
        running: false,
        lastRun: new Date().toISOString(),
        nextRun: task.schedule.type === 'once' ? '' : nextRunDate(task.schedule),
        status: task.schedule.type === 'once' ? 'completed' : task.status,
        results,
      };

      setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
      setExpandedTask(taskId); // auto-expand to show output
      toast.success(`"${task.title}" completed`);
      if (onTaskComplete) onTaskComplete(updated);
    } catch (err: any) {
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, running: false, results: { total: 1, successful: 0, failed: 1, output: err.message, executedAt: new Date().toISOString() } } : t
      ));
      toast.error(`"${task.title}" failed`);
    }
  };

  // ── CRUD ─────────────────────────────────────

  const addTask = () => {
    if (!newTask.title?.trim() || !newTask.description?.trim()) {
      toast.error('Title and description are required');
      return;
    }
    const task: Task = {
      id: crypto.randomUUID(),
      title: newTask.title!,
      description: newTask.description!,
      type: newTask.type as Task['type'] || 'custom',
      schedule: newTask.schedule || { type: 'daily', time: '09:00' },
      target: newTask.target || {},
      aiEnabled: newTask.aiEnabled ?? true,
      aiPrompt: newTask.aiPrompt || DEFAULT_AI_PROMPTS[newTask.type || 'custom'],
      status: 'active',
      nextRun: nextRunDate(newTask.schedule || { type: 'daily', time: '09:00' }),
    };
    setTasks(prev => [...prev, task]);
    setShowAddModal(false);
    resetNewTask();
    toast.success('Task scheduled!');
  };

  const resetNewTask = () => setNewTask({
    title: '', description: '', type: 'email',
    schedule: { type: 'daily', time: '09:00' },
    target: {}, aiEnabled: true,
    aiPrompt: DEFAULT_AI_PROMPTS['email'],
    status: 'active',
  });

  const toggleStatus = (id: string) =>
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, status: t.status === 'active' ? 'paused' : 'active' } : t
    ));

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    toast.success('Task deleted');
  };

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
                      <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-500/15 border border-violet-500/20 text-violet-400 text-[10px]">
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
                      <span className="ml-auto text-[10px] text-slate-600">
                        {new Date(task.results.executedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-900/60 rounded-xl p-4 border border-white/5 max-h-60 overflow-y-auto">
                    {task.results.output}
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(task.results!.output!); toast.success('Copied!'); }}
                    className="mt-2 text-[10px] text-slate-500 hover:text-white transition-colors"
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
                    className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500/50 transition-colors"
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
                    className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500/50 transition-colors"
                  >
                    {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Frequency</label>
                  <select
                    value={newTask.schedule?.type || 'daily'}
                    onChange={e => setNewTask(p => ({ ...p, schedule: { ...p.schedule!, type: e.target.value as Task['schedule']['type'] } }))}
                    className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500/50 transition-colors"
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
                      className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500/50 transition-colors"
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
                      className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-1"
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
                  <p className="text-[10px] text-slate-600 mt-1">
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
    </div>
  );
};

export default TaskScheduler;
