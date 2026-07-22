'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, Play, Pause, RefreshCw,
  CheckCircle2, AlertCircle, Clock, Sparkles, Activity, ShieldAlert, BookOpen, ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { openBonniePopoutWindow, resolveBonnieDashboardRoute } from '@/lib/bonnie/bonnieWorkspace';
import { bonnieService, BonnieLog, BonnieRule, resolveBonnieNavIntent } from '../../../services/bonnieService';
import { BONNIE_MODULE_HINTS, resolveBonnieModuleFromPath } from '../../../lib/bonnie/bonnieToolCatalog';
import { useTenant } from '../../../contexts/TenantContext';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import BonnieChatPanel from './BonnieChatPanel';
import { BonnieResearchPanel } from './BonnieResearchPanel';
import { useBonnieApprovals } from '../../../hooks/useBonnieApprovals';
import type { BonniePendingApprovalResponse } from '../../../services/bonnieService';

type BonnieFullViewProps = {
  variant?: 'default' | 'popout';
};

export default function BonnieFullView({ variant = 'default' }: BonnieFullViewProps) {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const contextPath = searchParams.get('from') || pathname || '';
  const activeModule = resolveBonnieModuleFromPath(contextPath);
  const isPopout = variant === 'popout';
  const moduleHint = BONNIE_MODULE_HINTS[activeModule];
  const [rules, setRules] = useState<BonnieRule | null>(null);
  const [logs, setLogs] = useState<BonnieLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const tenantId = currentTenant?.id;
  const { pendingCount, handleApproval, refresh: refreshApprovals } = useBonnieApprovals(tenantId);

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

      setLogs(await bonnieService.getCombinedLogs(tenantId));
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
  const effectiveMode =
    !rules
      ? 'Unknown'
      : !rules.enabled
        ? 'Paused'
        : rules.auto_send_enabled && !rules.high_risk_approval_required
          ? 'Autonomous'
          : 'Act with approval';

  const mapInstructionResult = (res: {
    response: string;
    success: boolean;
    executionStatus?: 'executed' | 'queued_for_approval' | 'read_only_answer' | 'planning_failed' | 'provider_blocked';
    toolsExecuted?: Array<{
      tool: string;
      success: boolean;
      summary: string;
      approvalRequired?: boolean;
      approvalId?: string;
      riskClass?: string;
      preview?: { target?: string; draft?: string };
    }>;
    pendingApproval?: BonniePendingApprovalResponse | null;
  }) => ({
    text: res.response,
    tools: res.toolsExecuted,
    approval: res.pendingApproval || undefined,
    executionStatus: res.executionStatus,
  });

  const handleBonnieMessage = async (
    text: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ) => {
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
      pathname: contextPath || undefined,
      moduleContext: activeModule,
    });
    if (res.success) {
      const logsData = await bonnieService.getCombinedLogs(tenantId);
      setLogs(logsData);
      void refreshApprovals();
      return mapInstructionResult(res);
    }

    return { text: res.response || 'Failed to process command.', error: true, executionStatus: res.executionStatus };
  };

  const handleBonnieStream = async (
    text: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
    onToken: (token: string) => void,
    onPhase?: (phase: string, meta?: Record<string, unknown>) => void
  ) => {
    const res = await bonnieService.streamInstruction(tenantId, text, history, {
      pathname: contextPath || undefined,
      moduleContext: activeModule,
      onToken,
      onPhase: (phase, meta) => onPhase?.(phase, meta),
    });
    if (res.success) {
      const logsData = await bonnieService.getCombinedLogs(tenantId);
      setLogs(logsData);
      void refreshApprovals();
      return mapInstructionResult(res);
    }
    return { text: res.response || 'Failed to process command.', error: true, executionStatus: res.executionStatus };
  };

  const handleResolveApproval = async (
    approvalId: string,
    status: 'approved' | 'rejected',
    editedArgs?: Record<string, unknown>
  ) => {
    const result = await handleApproval(approvalId, status, editedArgs);
    if (result.success) {
      const logsData = await bonnieService.getCombinedLogs(tenantId);
      setLogs(logsData);
    }
    return {
      success: result.success,
      message: result.execution?.result?.summary || result.execution?.error,
      continuation: result.continuation || null,
    };
  };

  const bonnieDashboardRoute = resolveBonnieDashboardRoute(pathname, user?.role);

  return (
    <div className={`flex w-full flex-col gap-4 md:gap-6 bg-slate-950 text-white overflow-y-auto ${isPopout ? 'min-h-dvh p-3 md:p-4' : 'min-h-[calc(100dvh-10rem)] p-1 md:p-2'}`}>
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-800 bg-[#090d16] p-4 md:p-6 sm:flex-row sm:items-center shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 shadow-xl shadow-teal-500/20">
            <Brain className="h-7 w-7 text-white animate-pulse" />
            <span className={`absolute -bottom-0.5 -right-0.5 h-4.5 w-4.5 rounded-full border-3 border-slate-950 ${isRunning ? 'bg-emerald-500 shadow-[0_0_12px_#10b981]' : 'bg-amber-500 shadow-[0_0_12px_#f59e0b]'}`} />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-cyan-400">
              {isPopout ? 'Bonnie Workspace' : 'Bonnie AI System Console'}
            </h1>
            <p className="text-sm text-slate-400">
              {isPopout
                ? `Dedicated window · context: ${moduleHint.label}`
                : 'Bonnie AI executes real actions across CRM, finance, outreach, social, and automation. Ask for actions like "run scan", "list overdue invoices", or "publish LinkedIn post".'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isPopout ? (
            <Link
              href={bonnieDashboardRoute}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 border border-slate-700 hover:border-teal-500/40 hover:text-teal-300 transition-all"
            >
              <BookOpen size={14} />
              Open in app
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={() => openBonniePopoutWindow(pathname || undefined)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 border border-slate-700 hover:border-cyan-500/40 hover:text-cyan-300 transition-all"
              >
                <ExternalLink size={14} />
                Pop out window
              </button>
              <Link
                href="/dashboard/help"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 border border-slate-700 hover:border-teal-500/40 hover:text-teal-300 transition-all"
              >
                <BookOpen size={14} />
                Platform guide
              </Link>
            </>
          )}
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
      <div className="flex flex-1 flex-col lg:flex-row gap-4 lg:gap-6 min-h-0">
        
        {/* Left Side: System Information & Activity Log */}
        <div className="flex w-full lg:w-80 xl:w-96 flex-col gap-4 lg:gap-6 shrink-0 lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto pr-0 lg:pr-1 custom-scrollbar">
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
                <span className="font-bold text-slate-300">
                  {effectiveMode === 'Autonomous' ? 'Autonomous allowed' : 'Approval required'}
                </span>
              </div>
            </div>

            {/* Active rules and objectives */}
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

          <BonnieResearchPanel tenantId={tenantId} />

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
        <div className="flex flex-1 flex flex-col bg-[#090d16] border border-slate-800 rounded-3xl p-4 md:p-6 relative min-h-[min(70dvh,720px)] lg:min-h-[480px]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/50 mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-400" />
              <span className="text-sm font-black uppercase tracking-wider text-slate-200">Talk to Bonnie</span>
            </div>
            <div className="flex items-center gap-2">
              {pendingCount > 0 && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-slate-950">
                  {pendingCount} pending
                </span>
              )}
              <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
                <span className="text-[10px] font-black text-teal-400/80 uppercase tracking-wider">
                  Bonnie AI · Agentic
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-[280px]">
            <BonnieChatPanel
              streaming
              storageKey={tenantId ? `bonnie_chat_full_${tenantId}` : undefined}
              placeholder="Tell Bonnie what to run (e.g. audit overdue invoices, send WhatsApp, publish campaign, find Facebook leads)…"
              introMessage="I'm Bonnie AI — your full-stack workspace agent. Chat naturally; I execute real tools across CRM, finance, outreach, social, WhatsApp, and automation."
              onSend={handleBonnieMessage}
              onStreamSend={handleBonnieStream}
              onResolveApproval={handleResolveApproval}
              tenantId={tenantId}
              pathname={contextPath || undefined}
              userRole={user?.role}
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
