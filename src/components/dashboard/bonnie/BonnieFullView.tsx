'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, Play, Pause, RefreshCw,
  CheckCircle2, AlertCircle, Clock, Sparkles, Activity, ShieldAlert
} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { bonnieService, BonnieLog, BonnieRule, resolveBonnieNavIntent } from '../../../services/bonnieService';
import { BONNIE_MODULE_HINTS, resolveBonnieModuleFromPath } from '../../../lib/bonnie/bonnieToolCatalog';
import { useTenant } from '../../../contexts/TenantContext';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import BonnieChatPanel from './BonnieChatPanel';

export default function BonnieFullView() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const activeModule = resolveBonnieModuleFromPath(pathname || '');
  const moduleHint = BONNIE_MODULE_HINTS[activeModule];
  const [rules, setRules] = useState<BonnieRule | null>(null);
  const [logs, setLogs] = useState<BonnieLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const tenantId = currentTenant?.id;

  // Load Rules and Logs when tenant changes
  useEffect(() => {
    if (!tenantId) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const rulesData = await bonnieService.getRules(tenantId);
        setRules(rulesData);

        const logsData = await bonnieService.getCombinedLogs(tenantId);
        setLogs(logsData);
      } catch (err) {
        console.error('Failed to load Bonnie data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Set up polling for logs every 8 seconds to keep feed live-updating
    const interval = setInterval(async () => {
      try {
        const logsData = await bonnieService.getCombinedLogs(tenantId);
        setLogs(logsData);
      } catch (e) {
        // ignore polling errors
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [tenantId]);

  // Scroll logs to bottom on update
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (!tenantId) {
    return (
      <div className="flex h-[calc(100vh-140px)] items-center justify-center bg-slate-950 p-8 text-center text-slate-500">
        <div className="max-w-md space-y-4">
          <Brain className="mx-auto h-16 w-16 text-slate-700 opacity-40 animate-pulse" />
          <h3 className="text-xl font-black text-white uppercase tracking-wider">Select a Tenant</h3>
          <p className="text-sm text-slate-400">
            Please switch to a valid tenant space to activate the Bonnie AI assistant console.
          </p>
        </div>
      </div>
    );
  }

  const handleToggleStatus = async () => {
    if (!rules) return;
    try {
      const nextEnabled = !rules.enabled;
      const updated = await bonnieService.updateRules(tenantId, { enabled: nextEnabled });
      setRules(updated);
      toast.success(
        nextEnabled 
          ? 'Bonnie background execution resumed.' 
          : 'Bonnie background execution paused.'
      );

      // Add a log entry simulating the status toggle
      setLogs(prev => [
        {
          id: String(Date.now()),
          created_at: new Date().toISOString(),
          type: 'log',
          level: nextEnabled ? 'success' : 'warning',
          message: nextEnabled ? 'Agent execution state changed to RUNNING.' : 'Agent execution state changed to PAUSED.'
        },
        ...prev
      ]);
    } catch (err) {
      toast.error('Failed to toggle executing status.');
    }
  };

  const handleTriggerManualRun = async () => {
    if (isTriggering) return;
    setIsTriggering(true);
    toast.loading('Triggering Bonnie execution scan...', { id: 'manual-trigger' });
    try {
      const res = await bonnieService.triggerManualRun(tenantId);
      if (res.success) {
        toast.success('Bonnie manual execution completed successfully.', { id: 'manual-trigger' });
        // Refresh logs
        const logsData = await bonnieService.getCombinedLogs(tenantId);
        setLogs(logsData);
      } else {
        toast.error(res.error || 'Failed to complete execution run.', { id: 'manual-trigger' });
      }
    } catch (err) {
      toast.error('Execution failed.', { id: 'manual-trigger' });
    } finally {
      setIsTriggering(false);
    }
  };

  const isRunning = rules?.enabled ?? true;

  const handleBonnieMessage = async (
    text: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ): Promise<{ text: string; error?: boolean; tools?: Array<{ tool: string; success: boolean; summary: string }> }> => {
    setLogs(prev => [
      {
        id: String(Date.now()),
        created_at: new Date().toISOString(),
        type: 'log',
        level: 'info',
        message: `Command received: "${text}"`,
      },
      ...prev,
    ]);

    const nav = resolveBonnieNavIntent(text, user?.role);
    if (nav) {
      router.push(nav.route);
      setLogs(prev => [
        {
          id: String(Date.now() + 1),
          created_at: new Date().toISOString(),
          type: 'action',
          level: 'success',
          message: `Navigated to ${nav.label}`,
          details: nav.route,
        },
        ...prev,
      ]);
      return { text: `Opening ${nav.label} for you now.` };
    }

    const res = await bonnieService.sendInstruction(tenantId, text, history, {
      pathname: pathname || undefined,
      moduleContext: activeModule,
    });
    if (res.success) {
      const logsData = await bonnieService.getCombinedLogs(tenantId);
      setLogs(logsData);
      return {
        text: res.response,
        tools: res.toolsExecuted,
      };
    }

    return { text: res.response || 'Failed to process command.', error: true };
  };

  const handleBonnieStream = async (
    text: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
    onToken: (token: string) => void,
    onPhase?: (phase: string) => void
  ) => {
    const res = await bonnieService.streamInstruction(tenantId, text, history, {
      pathname: pathname || undefined,
      moduleContext: activeModule,
      onToken,
      onPhase,
    });
    if (res.success) {
      const logsData = await bonnieService.getCombinedLogs(tenantId);
      setLogs(logsData);
      return { text: res.response, tools: res.toolsExecuted };
    }
    return { text: res.response || 'Failed to process command.', error: true };
  };

  return (
    <div className="flex h-[calc(100vh-140px)] min-h-[600px] w-full flex-col gap-6 bg-slate-950 text-white p-1 md:p-2">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-800 bg-[#090d16] p-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 shadow-xl shadow-teal-500/20">
            <Brain className="h-7 w-7 text-white animate-pulse" />
            <span className={`absolute -bottom-0.5 -right-0.5 h-4.5 w-4.5 rounded-full border-3 border-slate-950 ${isRunning ? 'bg-emerald-500 shadow-[0_0_12px_#10b981]' : 'bg-amber-500 shadow-[0_0_12px_#f59e0b]'}`} />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-cyan-400">
              Bonnie AI System Console
            </h1>
            <p className="text-sm text-slate-400">
              Bonnie AI executes real actions across CRM, finance, outreach, social, and automation — not just chat.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleStatus}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md ${
              isRunning
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
            }`}
          >
            {isRunning ? (
              <>
                <Pause size={14} /> Pause Agent
              </>
            ) : (
              <>
                <Play size={14} /> Resume Agent
              </>
            )}
          </button>

          <button
            onClick={handleTriggerManualRun}
            disabled={isTriggering}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md"
          >
            <RefreshCw size={14} className={isTriggering ? 'animate-spin' : ''} />
            Scan Now
          </button>
        </div>
      </div>

      {/* Main Split Interface */}
      <div className="flex flex-1 gap-6 overflow-hidden min-h-0">
        
        {/* Left Side: System Information & Activity Log */}
        <div className="hidden lg:flex w-96 flex-col gap-6 shrink-0 overflow-y-auto pr-1 custom-scrollbar">
          {/* Status Panel */}
          <div className="rounded-3xl border border-slate-800 bg-[#090d16] p-6 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Activity size={14} className="text-teal-400" />
              Agent Core Status
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm py-1 border-b border-slate-800/40">
                <span className="text-slate-400">Background Worker</span>
                <span className={`font-bold ${isRunning ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isRunning ? 'ACTIVE' : 'PAUSED'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm py-1 border-b border-slate-800/40">
                <span className="text-slate-400">Chat commands</span>
                <span className="font-bold text-teal-400">Always available</span>
              </div>
              <div className="flex justify-between items-center text-sm py-1 border-b border-slate-800/40">
                <span className="text-slate-400">Background scans</span>
                <span className={`font-bold ${isRunning ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isRunning ? 'Scheduled + manual' : 'Paused'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm py-1 border-b border-slate-800/40">
                <span className="text-slate-400">High-risk sends</span>
                <span className="font-bold text-slate-300">Approval required</span>
              </div>
            </div>

            {/* Simulated Rules / Objectives */}
            {rules && (
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Autonomous Mandates</span>
                <div className="space-y-1.5 text-xs text-slate-300 leading-relaxed bg-slate-950/40 border border-slate-800/60 p-3.5 rounded-2xl">
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5" />
                    <span>Cross-module data integrity scans</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5" />
                    <span>Real-time anomaly identification</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5" />
                    <span>Auto-enrich client profiles via pipeline updates</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Activity / Execution Log */}
          <div className="flex-1 rounded-3xl border border-slate-800 bg-[#090d16] p-6 flex flex-col min-h-[300px]">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              <Clock size={14} className="text-teal-400" />
              Agent Execution Stream
            </h3>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs custom-scrollbar">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <RefreshCw className="h-6 w-6 animate-spin text-teal-500/40 mb-2" />
                  <span>Loading logs stream...</span>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <span>No log entries recorded.</span>
                </div>
              ) : (
                logs.map((log) => {
                  let badgeColor = 'text-slate-500 bg-slate-500/10 border-slate-500/20';
                  let Icon = Clock;

                  if (log.level === 'success' || log.type === 'action') {
                    badgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                    Icon = CheckCircle2;
                  } else if (log.level === 'warning') {
                    badgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
                    Icon = AlertCircle;
                  } else if (log.level === 'error') {
                    badgeColor = 'text-red-400 bg-red-500/10 border-red-500/20';
                    Icon = ShieldAlert;
                  }

                  return (
                    <div
                      key={log.id}
                      className="group flex flex-col gap-1.5 p-3 rounded-2xl border border-slate-800/40 bg-slate-950/40 hover:border-slate-800 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${badgeColor}`}>
                          <Icon size={10} />
                          {log.type === 'action' ? 'Trigger' : log.level}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed break-words">
                        {log.message}
                      </p>
                    </div>
                  );
                })
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>

        {/* Right Side: Chat Interface */}
        <div className="flex-1 flex flex-col bg-[#090d16] border border-slate-800 rounded-3xl p-6 relative overflow-hidden min-h-0">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/50 mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-400" />
              <span className="text-sm font-black uppercase tracking-wider text-slate-200">Talk to Bonnie</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
              <span className="text-[10px] font-black text-teal-400/80 uppercase tracking-wider">
                Bonnie AI · Agentic
              </span>
            </div>
          </div>

          <div className="flex-1 min-h-[420px]">
            <BonnieChatPanel
              streaming
              storageKey={tenantId ? `bonnie_chat_full_${tenantId}` : undefined}
              placeholder="Tell Bonnie what to run (e.g. audit overdue invoices, send WhatsApp, publish campaign, find Facebook leads)…"
              introMessage="I'm Bonnie AI — your full-stack workspace agent. Chat naturally; I execute real tools across CRM, finance, outreach, social, WhatsApp, and automation."
              onSend={handleBonnieMessage}
              onStreamSend={handleBonnieStream}
            />
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
      ` }} />
    </div>
  );
}
