import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Play, Pause, RefreshCw, X,
  CheckCircle2, AlertCircle, Clock, Sun, BookOpen
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { bonnieService, BonnieLog, BonnieRule, resolveBonnieNavIntent } from '../../../services/bonnieService';
import { BONNIE_MODULE_HINTS, resolveBonnieModuleFromPath } from '../../../lib/bonnie/bonnieToolCatalog';
import { useTenant } from '../../../contexts/TenantContext';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import BonnieChatPanel from './BonnieChatPanel';
import { useBonnieApprovals } from '../../../hooks/useBonnieApprovals';
import { useBonnieMorningBrief } from '../../../hooks/useBonnieMorningBrief';
import type { BonniePendingApprovalResponse } from '../../../services/bonnieService';

export default function BonnieWidget() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const activeModule = resolveBonnieModuleFromPath(pathname || '');
  const moduleHint = BONNIE_MODULE_HINTS[activeModule];
  const [isOpen, setIsOpen] = useState(false);
  const [rules, setRules] = useState<BonnieRule | null>(null);
  const [logs, setLogs] = useState<BonnieLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const tenantId = currentTenant?.id;
  const { pendingCount, handleApproval, refresh: refreshApprovals } = useBonnieApprovals(tenantId);
  const { brief: morningBrief, refresh: refreshBrief } = useBonnieMorningBrief(tenantId);
  const hasUnreadBrief = Boolean(morningBrief?.summary && morningBrief.read !== true);

  // Load Rules and Logs when open or tenant changes
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

    // Poll less aggressively to avoid noisy console when optional tables are missing
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

  if (!tenantId) return null;

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

  const mapInstructionResult = (res: {
    response: string;
    success: boolean;
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
      pathname: pathname || undefined,
      moduleContext: activeModule,
    });
    if (res.success) {
      const logsData = await bonnieService.getCombinedLogs(tenantId);
      setLogs(logsData);
      void refreshApprovals();
      return mapInstructionResult(res);
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
      void refreshApprovals();
      return mapInstructionResult(res);
    }
    return { text: res.response || 'Failed to process command.', error: true };
  };

  const handleResolveApproval = async (
    approvalId: string,
    status: 'approved' | 'rejected',
    editedArgs?: Record<string, unknown>
  ) => {
    const result = await handleApproval(approvalId, status, editedArgs);
    if (result.success && status === 'approved') {
      const logsData = await bonnieService.getCombinedLogs(tenantId);
      setLogs(logsData);
    }
    return {
      success: result.success,
      message: result.execution?.result?.summary || result.execution?.error,
      continuation: result.continuation || null,
    };
  };

  const markBriefRead = async () => {
    if (!morningBrief?.notificationId || !tenantId) return;
    try {
      await fetch('/api/bonnie/briefing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, notificationId: morningBrief.notificationId }),
      });
      void refreshBrief();
    } catch {
      // non-critical
    }
  };

  const handleOpenWidget = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && hasUnreadBrief) void markBriefRead();
  };

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] right-4 z-[70] flex flex-col items-end md:bottom-6 md:right-6" data-tour="bonnie-widget">
      {/* Drawer / Popup Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="mb-4 w-96 overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/95 text-white shadow-2xl backdrop-blur-xl md:w-[420px]"
          >
            {/* Header */}
            <div className="relative flex items-center justify-between border-b border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg shadow-teal-500/20">
                  <Brain className="h-5 w-5 text-white animate-pulse" />
                  <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-950 ${isRunning ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'}`} />
                </div>
                <div>
                  <h3 className="font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-cyan-400">
                    Bonnie
                  </h3>
                  <p className="text-xs text-slate-400">
                    {moduleHint.label} · WhatsApp, campaigns, CRM & more
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Controls Bar */}
            <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-950/20 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Status:</span>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${isRunning ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isRunning ? (
                    <>
                      <Play className="h-3 w-3 fill-current" /> Running
                    </>
                  ) : (
                    <>
                      <Pause className="h-3 w-3 fill-current" /> Paused
                    </>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Pause/Play Toggle Button */}
                <button
                  onClick={handleToggleStatus}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                    isRunning 
                      ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20' 
                      : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
                  }`}
                >
                  {isRunning ? (
                    <>
                      <Pause className="h-3 w-3" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3" /> Resume
                    </>
                  )}
                </button>

                {/* Trigger Run Button */}
                <button
                  onClick={handleTriggerManualRun}
                  disabled={isTriggering}
                  className="flex items-center gap-1.5 rounded-lg bg-teal-500 px-2.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-teal-400 active:scale-95 disabled:opacity-50 transition-all shadow-md shadow-teal-500/10 border border-teal-400/20"
                >
                  <RefreshCw className={`h-3 w-3 ${isTriggering ? 'animate-spin' : ''}`} />
                  Run Now
                </button>
              </div>
            </div>

            <div className="border-b border-slate-800 bg-slate-950/20 p-4">
              {hasUnreadBrief && morningBrief && (
                <div className="mb-3 rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-teal-500/5 p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-300">
                    <Sun className="h-3.5 w-3.5" />
                    Morning briefing
                  </div>
                  <p className="text-sm leading-relaxed text-slate-200">{morningBrief.summary}</p>
                  {morningBrief.attentionItems.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-slate-400">
                      {morningBrief.attentionItems.slice(0, 4).map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {pendingCount > 0 && (
                <div className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  {pendingCount} action{pendingCount === 1 ? '' : 's'} need your approval
                </div>
              )}
              <BonnieChatPanel
                compact
                streaming
                storageKey={tenantId ? `bonnie_chat_${tenantId}` : undefined}
                placeholder={`Ask Bonnie about ${moduleHint.label.toLowerCase()}…`}
                introMessage={`I'm Bonnie AI — your in-platform agent for ${moduleHint.label}. Tell me what to do and I'll execute it. Try: "${moduleHint.examples[1] || moduleHint.examples[0]}"`}
                onSend={handleBonnieMessage}
                onStreamSend={handleBonnieStream}
                onResolveApproval={handleResolveApproval}
                tenantId={tenantId}
                pathname={pathname || undefined}
              />
              <Link
                href="/dashboard/help"
                className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-teal-400 transition-colors"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Platform guide & glossary
              </Link>
            </div>

            {/* Activity Feed / Logs Container */}
            <div className="p-4">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                Activity History
              </h4>

              <div className="h-44 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/80 p-3 scrollbar-thin scrollbar-thumb-slate-800">
                {isLoading ? (
                  <div className="flex h-full flex-col items-center justify-center text-slate-500 gap-2">
                    <RefreshCw className="h-5 w-5 animate-spin text-teal-500" />
                    <span className="text-xs">Loading execution logs...</span>
                  </div>
                ) : logs.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center p-4">
                    <Brain className="h-8 w-8 text-slate-700 mb-2" />
                    <p className="text-xs text-slate-500 font-medium">No actions logged yet.</p>
                    <p className="text-[10px] text-slate-600 mt-1 max-w-[200px]">Toggle resume or send an instruction to trigger logs.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[...logs].reverse().map((log) => {
                      const isAction = log.type === 'action';
                      return (
                        <div key={log.id} className="flex items-start gap-2.5 text-xs">
                          <div className="mt-0.5 flex-shrink-0">
                            {log.level === 'success' ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            ) : log.level === 'warning' ? (
                              <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                            ) : log.level === 'error' ? (
                              <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                            ) : (
                              <Clock className="h-3.5 w-3.5 text-slate-500" />
                            )}
                          </div>
                          <div className="flex-1 space-y-0.5">
                            <p className={`font-medium leading-relaxed ${isAction ? 'text-cyan-300' : 'text-slate-300'}`}>
                              {log.message}
                            </p>
                            {log.details && (
                              <p className="text-[10px] leading-relaxed text-slate-500 pl-1 border-l border-slate-800/80">
                                {log.details}
                              </p>
                            )}
                          </div>
                          <span className="text-[9px] text-slate-600 self-start">
                            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })}
                    <div ref={logEndRef} />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => handleOpenWidget()}
        title="Open Bonnie AI"
        aria-label="Open Bonnie AI assistant"
        className="relative flex h-14 min-w-[3.5rem] items-center justify-center gap-1.5 rounded-full bg-gradient-to-br from-teal-500 via-cyan-500 to-indigo-600 px-4 text-white shadow-xl shadow-teal-500/20 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-slate-900 border border-teal-400/20"
      >
        <Brain className="h-6 w-6 shrink-0" />
        <span className="hidden sm:inline text-xs font-black uppercase tracking-wide">Bonnie</span>
        {hasUnreadBrief && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-300 text-slate-950 shadow-lg">
            <Sun className="h-3 w-3" />
          </span>
        )}
        {pendingCount > 0 && (
          <span className="absolute -top-1 -left-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-slate-950">
            {pendingCount}
          </span>
        )}
        {/* Glow pulsing ring around the button */}
        <span className="absolute inset-0 rounded-full bg-teal-500 animate-ping opacity-20 pointer-events-none" />

        {/* Small active status circle */}
        <span className={`absolute top-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-950 ${isRunning ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      </motion.button>
    </div>
  );
}
