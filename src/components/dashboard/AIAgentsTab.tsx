'use client';

import React, { useState } from 'react';
import { Cpu, Play, CheckCircle, X, AlertTriangle, Clock, ChevronRight, Plus, Pause, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

type PlaybookStatus = 'idle' | 'running' | 'success' | 'failed';

interface Playbook {
  id: string; name: string; status: PlaybookStatus;
  lastRun?: string; duration?: string; description?: string; error?: string;
  trigger: 'manual' | 'scheduled' | 'event';
}

interface ScheduledTask {
  id: string; name: string; prompt: string; nextRun: string; paused: boolean;
}

const PLAYBOOKS: Playbook[] = [
  { id: '1', name: 'Lead Qualifier', status: 'running', lastRun: '2 min ago', duration: '1m 12s', trigger: 'event', description: 'Qualifies incoming leads using AI scoring.' },
  { id: '2', name: 'Invoice Reminder', status: 'success', lastRun: '1h ago', duration: '0m 8s', trigger: 'scheduled', description: 'Sends reminders for overdue invoices.' },
  { id: '3', name: 'Social Post Queue', status: 'failed', lastRun: '3h ago', duration: '0m 3s', trigger: 'scheduled', description: 'Posts to social media queue.', error: 'API rate limit exceeded. Retry after 60 minutes.' },
  { id: '4', name: 'Deal Score Update', status: 'idle', lastRun: 'Yesterday', trigger: 'manual', description: 'Re-scores all open deals.' },
];

const TASKS: ScheduledTask[] = [
  { id: '1', name: 'Daily Lead Summary', prompt: 'Summarize new leads from today and suggest next actions', nextRun: 'Today 9:00 AM', paused: false },
  { id: '2', name: 'Weekly Report', prompt: 'Generate weekly performance report for the team', nextRun: 'Monday 8:00 AM', paused: true },
];

const STATUS_STYLES: Record<PlaybookStatus, { dot: string; badge: string; label: string }> = {
  idle:    { dot: 'bg-slate-500', badge: 'bg-slate-500/15 text-slate-400', label: 'Idle' },
  running: { dot: 'bg-blue-400 animate-pulse', badge: 'bg-blue-500/10 text-blue-400', label: 'Running' },
  success: { dot: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-400', label: 'Success' },
  failed:  { dot: 'bg-red-500', badge: 'bg-red-500/15 text-red-400', label: 'Failed' },
};

// ── Playbook Detail Sheet ──────────────────────────────────────────────────────
const PlaybookDetail: React.FC<{ playbook: Playbook; onClose: () => void; onRun: (id: string) => void }> = ({ playbook, onClose, onRun }) => {
  const mockSteps = [
    { name: 'Fetch CRM data', status: playbook.status === 'failed' ? 'success' : 'success', duration: '0.3s' },
    { name: 'Run AI scoring', status: playbook.status === 'failed' ? 'failed' : 'success', duration: '0.8s', error: playbook.error },
    { name: 'Update records', status: playbook.status === 'running' ? 'running' : (playbook.status === 'failed' ? 'skipped' : 'success'), duration: '0.1s' },
  ];

  return (
    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 flex flex-col">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="bg-slate-900 border-t border-white/10 rounded-t-3xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-slate-700 rounded-full" /></div>
        <div className="px-4 pb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[17px] font-bold text-white">{playbook.name}</h3>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[playbook.status].badge}`}>{STATUS_STYLES[playbook.status].label}</span>
          </div>
          {playbook.description && <p className="text-[15px] text-slate-400 opacity-70">{playbook.description}</p>}

          {/* Execution Steps */}
          <div>
            <div className="text-[11px] text-slate-500 uppercase font-black mb-2">Execution Log</div>
            <div className="space-y-2">
              {mockSteps.map((step, i) => (
                <div key={i} className={`bg-slate-800 rounded-xl p-3 ${step.status === 'failed' ? 'border border-red-500/20' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-slate-500 w-5 font-mono">{i + 1}.</span>
                    <span className="flex-1 text-[15px] text-white">{step.name}</span>
                    {step.status === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                    {step.status === 'failed' && <X className="w-4 h-4 text-red-400" />}
                    {step.status === 'running' && <div className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />}
                    <span className="text-[11px] text-slate-500">{step.duration}</span>
                  </div>
                  {step.status === 'failed' && step.error && (
                    <p className="mt-2 text-[13px] text-red-400 font-mono bg-red-500/5 rounded-lg px-2 py-1.5">{step.error}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => { onRun(playbook.id); onClose(); }} className="w-full h-[52px] bg-purple-600 rounded-xl text-white font-black uppercase tracking-wider text-[13px]">
            Run Now
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ── Main AIAgentsTab ──────────────────────────────────────────────────────────
const AIAgentsTab: React.FC = () => {
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [tasks, setTasks] = useState<ScheduledTask[]>(TASKS);

  const successRate = Math.round((PLAYBOOKS.filter(p => p.status === 'success').length / PLAYBOOKS.length) * 100);
  const failures = PLAYBOOKS.filter(p => p.status === 'failed').length;

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, paused: !t.paused } : t));
  };

  return (
    <div className="overflow-y-auto pb-24 space-y-5 px-4 pt-4">

      {/* Health Card */}
      <div className="bg-slate-900 border border-white/5 rounded-2xl p-4">
        <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3">Automation Health</div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-[22px] font-bold text-white">{PLAYBOOKS.length}</div>
            <div className="text-[11px] text-slate-500 opacity-55">Runs 24h</div>
          </div>
          <div className="text-center">
            <div className={`text-[22px] font-bold ${successRate >= 90 ? 'text-emerald-400' : successRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{successRate}%</div>
            <div className="text-[11px] text-slate-500 opacity-55">Success Rate</div>
          </div>
          <div className="text-center">
            <div className={`text-[22px] font-bold ${failures > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{failures}</div>
            <div className="text-[11px] text-slate-500 opacity-55">Failures</div>
          </div>
        </div>
      </div>

      {/* Playbook List */}
      <div>
        <div className="text-[13px] font-black uppercase tracking-wider text-slate-400 mb-3">Playbooks</div>
        <div className="bg-slate-900 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
          {PLAYBOOKS.map(pb => {
            const s = STATUS_STYLES[pb.status];
            return (
              <button key={pb.id} onClick={() => setSelectedPlaybook(pb)} className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${pb.status === 'running' ? 'bg-blue-500/5' : 'hover:bg-white/5'}`}>
                <Cpu className="w-5 h-5 text-slate-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[15px] font-bold text-white truncate">{pb.name}</span>
                  </div>
                  {pb.status === 'failed' && pb.error && (
                    <span className="text-[13px] text-red-400 opacity-55 truncate block">{pb.error}</span>
                  )}
                  {pb.lastRun && !pb.error && <span className="text-[13px] text-slate-500 opacity-55">Last run {pb.lastRun}</span>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.badge}`}>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${s.dot}`} />
                    {s.label}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scheduled Tasks */}
      <div>
        <div className="text-[13px] font-black uppercase tracking-wider text-slate-400 mb-3">Scheduled Tasks</div>
        <div className="bg-slate-900 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
          {tasks.map(task => (
            <div key={task.id} className={`flex items-center gap-3 px-4 py-3 ${task.paused ? 'opacity-55' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[15px] font-bold text-white truncate">{task.name}</span>
                  {task.paused && <span className="text-[11px] font-bold px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded-full">Paused</span>}
                </div>
                <span className="text-[13px] text-slate-500 opacity-55 block truncate">{task.prompt}</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-slate-600" />
                  <span className="text-[11px] text-slate-500 opacity-55">{task.nextRun}</span>
                </div>
              </div>
              {/* Toggle */}
              <button onClick={() => toggleTask(task.id)} className={`w-[51px] h-[31px] rounded-full transition-colors relative flex-shrink-0 ${!task.paused ? 'bg-purple-500' : 'bg-slate-700'}`}>
                <div className={`absolute top-0.5 w-[27px] h-[27px] bg-white rounded-full shadow-md transition-all ${!task.paused ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
        <button className="mt-2 w-full flex items-center gap-2 px-4 py-3 bg-slate-900 border border-white/5 rounded-2xl text-[14px] text-purple-400 font-bold hover:bg-white/5 transition-colors">
          <Plus className="w-4 h-4" /> New Scheduled Task
        </button>
      </div>

      <AnimatePresence>
        {selectedPlaybook && (
          <PlaybookDetail
            playbook={selectedPlaybook}
            onClose={() => setSelectedPlaybook(null)}
            onRun={(id) => toast.success('Playbook started!')}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default AIAgentsTab;
