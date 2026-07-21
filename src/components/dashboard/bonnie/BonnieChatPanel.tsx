'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { AlertCircle, BookOpen, CheckCircle2, Clock, Loader2, Mic, MicOff, Send, Trash2, Wrench, XCircle, Zap } from 'lucide-react';
import BonnieApprovalCard from './BonnieApprovalCard';
import AgentPlanViewer, { AgentPlanStep } from './AgentPlanViewer';
import ExecutionTimelineEvent, { ExecutionTimelineEventProps } from './ExecutionTimelineEvent';
import { bonnieService, resolveBonnieNavIntent } from '@/services/bonnieService';
import { normalizeBonnieNavPath, parseBonnieDeepLink } from '@/lib/bonnie/bonnieDeepLink';
import { useBonniePersistence } from '@/hooks/useBonniePersistence';

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: Array<{ 0?: { transcript?: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

// Sanitize text to remove problematic characters
function sanitizeDisplayText(text: string): string {
  return text
    .replace(/[\*]{2,}/g, '')
    .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, '')
    .replace(/[£]{2,}/g, '')
    .replace(/[$]{2,}/g, '')
    .replace(/[#]{2,}/g, '')
    .replace(/\\/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

function isProviderOutageMessage(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('out of credits') ||
    normalized.includes('billing is inactive') ||
    normalized.includes('all ai providers failed') ||
    normalized.includes('insufficient credits') ||
    normalized.includes('insufficient balance') ||
    normalized.includes('account not active')
  );
}

export type BonnieToolStep = {
  tool: string;
  success: boolean;
  summary: string;
  approvalRequired?: boolean;
  approvalId?: string;
  riskClass?: string;
  preview?: { target?: string; draft?: string };
};

export type BonniePendingApproval = {
  approvalId: string;
  tool: string;
  riskClass?: string;
  summary?: string;
  preview?: { target?: string; draft?: string };
};

export type BonnieChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
  tools?: BonnieToolStep[];
  approval?: BonniePendingApproval;
  executionStatus?: 'executed' | 'queued_for_approval' | 'read_only_answer' | 'planning_failed' | 'provider_blocked';
};

type BonnieChatSendResult = {
  text: string;
  error?: boolean;
  tools?: BonnieToolStep[];
  approval?: BonniePendingApproval;
  executionStatus?: 'executed' | 'queued_for_approval' | 'read_only_answer' | 'planning_failed' | 'provider_blocked';
};

type BonnieAiQuota = {
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  resetsAt: string;
};

type BonnieChatPanelProps = {
  introMessage?: string;
  placeholder?: string;
  compact?: boolean;
  disabled?: boolean;
  storageKey?: string;
  streaming?: boolean;
  onSend: (
    text: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>
  ) => Promise<BonnieChatSendResult>;
  onStreamSend?: (
    text: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    onToken: (token: string) => void,
    onPhase?: (phase: string, meta?: Record<string, unknown>) => void
  ) => Promise<BonnieChatSendResult>;
  onResolveApproval?: (
    approvalId: string,
    status: 'approved' | 'rejected',
    editedArgs?: Record<string, unknown>
  ) => Promise<{
    success: boolean;
    message?: string;
    continuation?: { response?: string; continued?: boolean; executionStatus?: 'executed' | 'queued_for_approval' | 'read_only_answer' | 'planning_failed' | 'provider_blocked' } | null;
  }>;
  /** Tenant id for voice commands */
  tenantId?: string;
  pathname?: string;
  userRole?: string | null;
};

function mapToolsToPlanSteps(tools: Array<{ tool: string; success?: boolean; summary?: string }>): AgentPlanStep[] {
  return tools.map((tool, index) => ({
    id: `plan-${tool.tool}-${index}`,
    label: tool.summary || tool.tool,
    tool: tool.tool,
    status: tool.success === false ? 'failed' : 'done',
    detail: tool.summary,
  }));
}

/** Emit a custom event so Dashboard.tsx can deep-link to the relevant module */
function emitNavIntent(text: string, userRole?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const resolved = resolveBonnieNavIntent(text, userRole);
    if (resolved) {
      const path = normalizeBonnieNavPath(resolved.route) || resolved.route;
      window.dispatchEvent(
        new CustomEvent('bonnie:navigate', {
          detail: {
            path,
            label: resolved.label,
            reason: `Bonnie opened ${resolved.label} based on your request.`,
          },
        })
      );
    }
  } catch {
    // non-critical
  }
}

export function emitBonnieDeepLink(target: ReturnType<typeof parseBonnieDeepLink>): void {
  if (!target?.route || typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('bonnie:navigate', {
      detail: {
        path: target.route,
        label: target.label,
        tab: target.tab,
        focus: target.focus,
        recordId: target.recordId,
        workflowId: target.workflowId,
        reason: target.reason,
      },
    })
  );
}

export default function BonnieChatPanel({
  introMessage = "Hi — I'm Bonnie AI. Tell me what to do (audit invoices, send WhatsApp, publish a campaign, find leads) and I'll execute it across your workspace.",
  placeholder = 'Ask Bonnie to do something…',
  compact = false,
  disabled = false,
  storageKey,
  streaming = false,
  onSend,
  onStreamSend,
  onResolveApproval,
  tenantId,
  pathname,
  userRole,
}: BonnieChatPanelProps) {
  // ── Persistent chat history (localStorage, survives reloads) ──────────────
  const { messages, setMessages, clearHistory } = useBonniePersistence({
    tenantId,
    userId: storageKey, // storageKey already encodes userId at call sites
    introMessage,
  });

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [agentPhase, setAgentPhase] = useState<'idle' | 'thinking' | 'executing' | 'responding'>('idle');
  const [listening, setListening] = useState(false);
  const [aiQuota, setAiQuota] = useState<BonnieAiQuota | null>(null);
  // Agent plan steps surfaced from stream phases
  const [planSteps, setPlanSteps] = useState<AgentPlanStep[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<ExecutionTimelineEventProps[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const sendVoiceTranscript = useCallback(
    async (transcript: string) => {
      if (!tenantId || sending || !transcript.trim()) return;
      setSending(true);
      setAgentPhase('executing');
      const userMsg: BonnieChatMessage = { id: `user-voice-${Date.now()}`, role: 'user', text: `🎤 ${transcript}` };
      setMessages((prev) => [...prev, userMsg]);
      try {
        const res = await bonnieService.sendVoiceCommand(tenantId, transcript, { pathname });
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-voice-${Date.now()}`,
            role: 'assistant',
            text: res.response,
            error: !res.success,
            executionStatus: res.executionStatus,
            tools: res.toolsExecuted?.map((t) => ({
              tool: t.tool,
              success: t.success,
              summary: t.summary,
            })),
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: `voice-fail-${Date.now()}`, role: 'assistant', text: 'Voice command failed.', error: true },
        ]);
      } finally {
        setSending(false);
        setAgentPhase('idle');
      }
    },
    [tenantId, sending, pathname]
  );

  const startVoiceInput = useCallback(() => {
    if (typeof window === 'undefined') return;
    const win = window as Window & {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const SpeechRecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setMessages((prev) => [
        ...prev,
        {
          id: `voice-err-${Date.now()}`,
          role: 'assistant',
          text: 'Voice input is not supported in this browser. Use Chrome or Edge.',
          error: true,
        },
      ]);
      return;
    }
    if (listening) {
      stopListening();
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) void sendVoiceTranscript(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [listening, stopListening, sendVoiceTranscript]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending, agentPhase]);

  // (Persistence is now handled by useBonniePersistence hook — no sessionStorage write needed here)

  useEffect(() => {
    if (!tenantId) {
      setAiQuota(null);
      return;
    }
    let cancelled = false;
    const loadQuota = async () => {
      try {
        const res = await fetch(`/api/bonnie/quota?tenantId=${encodeURIComponent(tenantId)}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) {
          setAiQuota({
            used: Number(data.used ?? 0),
            limit: Number(data.limit ?? 0),
            remaining: Number(data.remaining ?? 0),
            percentUsed: Number(data.percentUsed ?? 0),
            resetsAt: String(data.resetsAt || ''),
          });
        }
      } catch {
        // quota display is optional
      }
    };
    void loadQuota();
    return () => {
      cancelled = true;
    };
  }, [tenantId, sending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || disabled) return;

    const userMsg: BonnieChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    setAgentPhase('thinking');

    const history = messages
      .filter((m) => m.id !== 'intro')
      .map((m) => ({ role: m.role, content: m.text }));

    const phaseTimer = window.setTimeout(() => setAgentPhase('executing'), 1200);
    // Reset plan/timeline for new request
    setPlanSteps([]);
    setTimelineEvents([]);

    try {
      if (streaming && onStreamSend) {
        const streamMsgId = `assistant-${Date.now()}`;
        setMessages((prev) => [...prev, { id: streamMsgId, role: 'assistant', text: '' }]);
        setAgentPhase('responding');

        const result = await onStreamSend(
          text,
          history,
          (token) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === streamMsgId ? { ...m, text: m.text + token } : m))
            );
          },
          (phase, meta) => {
            if (phase === 'executing') {
              setAgentPhase('executing');
              const evId = `ev-${Date.now()}`;
              setTimelineEvents((prev) => [
                ...prev,
                { id: evId, label: 'Executing tools', kind: 'phase', status: 'running' },
              ]);
            }
            if (phase === 'thinking') {
              setAgentPhase('thinking');
              setTimelineEvents((prev) => [
                ...prev,
                { id: `ev-think-${Date.now()}`, label: 'Planning', kind: 'planning', status: 'running' },
              ]);
            }
            if (phase === 'tools' && Array.isArray(meta?.tools)) {
              setPlanSteps(mapToolsToPlanSteps(meta.tools as Array<{ tool: string; success?: boolean; summary?: string }>));
            }
          }
        );

        window.clearTimeout(phaseTimer);
        // Mark last timeline event done
        setTimelineEvents((prev) =>
          prev.map((e, i) => i === prev.length - 1 ? { ...e, status: 'done' as const } : e)
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamMsgId
              ? {
                  ...m,
                  text: result.text || m.text,
                  error: result.error,
                  tools: result.tools,
                  approval: result.approval,
                  executionStatus: result.executionStatus,
                }
              : m
          )
        );
        if (result.tools?.length) {
          setPlanSteps(mapToolsToPlanSteps(result.tools));
        }
        // Deep-link navigation intent
        if (result.text) emitNavIntent(result.text, userRole);
      } else {
        const result = await onSend(text, history);
        window.clearTimeout(phaseTimer);
        setAgentPhase('responding');

        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            text: result.text,
            error: result.error,
            tools: result.tools,
            approval: result.approval,
            executionStatus: result.executionStatus,
          },
        ]);
        // Deep-link navigation intent
        if (result.text) emitNavIntent(result.text, userRole);
      }
    } catch {
      window.clearTimeout(phaseTimer);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: 'Something went wrong. Check that DEEPSEEK_API_KEY is set and try again.',
          error: true,
        },
      ]);
    } finally {
      setSending(false);
      setAgentPhase('idle');
      inputRef.current?.focus();
    }
  };

  const clearChat = () => {
    clearHistory();
    setPlanSteps([]);
    setTimelineEvents([]);
  };

  const phaseLabel =
    agentPhase === 'thinking'
      ? 'Bonnie is thinking…'
      : agentPhase === 'executing'
        ? 'Bonnie is running tools…'
        : agentPhase === 'responding'
          ? 'Bonnie is responding…'
          : null;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-slate-950/80 backdrop-blur-md ${
        compact ? 'h-full min-h-[200px]' : 'h-full min-h-[360px]'
      }`}
    >
      {!compact && messages.length > 1 && (
        <div className="flex items-center justify-between border-b border-slate-800/60 px-3 py-1.5">
          {timelineEvents.length > 0 && (
            <span className="text-[10px] text-teal-400/70 font-semibold">
              {timelineEvents.filter(e => e.status === 'done').length}/{timelineEvents.length} steps
            </span>
          )}
          <button
            type="button"
            onClick={clearChat}
            className="ml-auto flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3 custom-scrollbar">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[90%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-teal-600 text-white'
                  : msg.error
                    ? 'border border-rose-500/30 bg-rose-500/10 text-rose-200'
                    : 'border border-slate-700/60 bg-slate-800/80 text-slate-100'
              }`}
            >
              {msg.role === 'assistant' && msg.id !== 'intro' && (
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-teal-400/80">
                  Bonnie AI
                </p>
              )}
              {msg.executionStatus && msg.executionStatus !== 'read_only_answer' ? (
                <div className="mb-2">
                  {msg.executionStatus === 'queued_for_approval' ? (
                    <div className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-100">
                      <Clock className="h-3 w-3" />
                      Awaiting approval
                    </div>
                  ) : msg.executionStatus === 'planning_failed' ? (
                    <div className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-200">
                      <AlertCircle className="h-3 w-3" />
                      Could not execute
                    </div>
                  ) : msg.executionStatus === 'provider_blocked' ? (
                    <div className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-100">
                      <Wrench className="h-3 w-3" />
                      Provider blocked
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-100">
                      <CheckCircle2 className="h-3 w-3" />
                      Executed
                    </div>
                  )}
                </div>
              ) : null}
              <p className="whitespace-pre-wrap">{sanitizeDisplayText(msg.text)}</p>
              {msg.error && isProviderOutageMessage(msg.text) ? (
                <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
                  Bonnie is online, but execution is blocked by AI provider billing or credit exhaustion. Re-enable at least one provider and retry the action.
                </div>
              ) : null}
              {msg.tools && msg.tools.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-slate-700/50 pt-2">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <Wrench className="h-3 w-3" /> Actions run
                  </p>
                  {/* Timeline events for live runs */}
                  {timelineEvents.length > 0 && msg.role === 'assistant' && messages[messages.length - 1]?.id === msg.id
                    ? timelineEvents.map((ev) => (
                        <ExecutionTimelineEvent key={ev.id} {...ev} />
                      ))
                    : msg.tools.map((t, i) => (
                        <div key={`${t.tool}-${i}`} className="flex items-start gap-1.5 text-[11px] text-slate-400">
                          {t.success ? (
                            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                          ) : (
                            <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-rose-400" />
                          )}
                          <span>
                            <span className="font-mono text-slate-300">{t.tool}</span>
                            {' — '}
                            {sanitizeDisplayText(t.summary)}
                          </span>
                        </div>
                      ))
                  }
                  {/* Agent plan viewer for current in-progress message */}
                  {planSteps.length > 0 && messages[messages.length - 1]?.id === msg.id && (
                    <AgentPlanViewer steps={planSteps} isRunning={sending} />
                  )}
                </div>
              )}
              {msg.approval && onResolveApproval && (
                <BonnieApprovalCard
                  approvalId={msg.approval.approvalId}
                  tool={msg.approval.tool}
                  riskClass={msg.approval.riskClass}
                  summary={msg.approval.summary}
                  preview={msg.approval.preview}
                  onApprove={async (editedArgs) => {
                    const result = await onResolveApproval(
                      msg.approval!.approvalId,
                      'approved',
                      editedArgs
                    );
                    if (result.success) {
                      const followUps: BonnieChatMessage[] = [
                        {
                          id: `assistant-approval-${Date.now()}`,
                          role: 'assistant',
                          text: result.message
                            ? `Approved and executed: ${result.message}`
                            : 'Action approved and executed successfully.',
                          executionStatus: 'executed',
                        },
                      ];
                      if (result.continuation?.response) {
                        followUps.push({
                          id: `assistant-resume-${Date.now() + 1}`,
                          role: 'assistant',
                          text: result.continuation.response,
                          executionStatus: result.continuation.executionStatus,
                        });
                      }
                      setMessages((prev) => [
                        ...prev.map((m) =>
                          m.id === msg.id ? { ...m, approval: undefined } : m
                        ),
                        ...followUps,
                      ]);
                    }
                    return result;
                  }}
                  onReject={async () => {
                    const result = await onResolveApproval(msg.approval!.approvalId, 'rejected');
                    if (result.success) {
                      setMessages((prev) => [
                        ...prev.map((m) =>
                          m.id === msg.id ? { ...m, approval: undefined } : m
                        ),
                        {
                          id: `assistant-reject-${Date.now()}`,
                          role: 'assistant',
                          text: 'Action cancelled. I will not proceed with that step.',
                        },
                      ]);
                    }
                    return { success: result.success };
                  }}
                />
              )}
            </div>
          </div>
        ))}
        {sending && phaseLabel && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-400" />
            {phaseLabel}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-800 bg-slate-950/80 p-3">
        {tenantId && aiQuota && (
          <div className="mb-2 rounded-xl border border-white/5 bg-slate-900 px-2.5 py-2 shadow-sm">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px]">
              <span className="flex items-center gap-1 font-black uppercase tracking-widest text-slate-500">
                <Zap className="h-3 w-3 text-teal-400" />
                AI Priority Layer
              </span>
              <span
                className={
                  aiQuota.percentUsed >= 90
                    ? 'text-rose-400'
                    : aiQuota.percentUsed >= 75
                      ? 'text-amber-400'
                      : 'text-teal-400'
                }
              >
                {aiQuota.remaining.toLocaleString()} / {aiQuota.limit.toLocaleString()} left
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all ${
                  aiQuota.percentUsed >= 90
                    ? 'bg-rose-500'
                    : aiQuota.percentUsed >= 75
                      ? 'bg-amber-500'
                      : 'bg-teal-500'
                }`}
                style={{ width: `${Math.min(100, aiQuota.percentUsed)}%` }}
              />
            </div>
          </div>
        )}
        <Link
          href="/dashboard/help"
          className="mb-2 inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-teal-400 transition-colors"
        >
          <BookOpen className="h-3 w-3" />
          Platform guide & glossary
        </Link>
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            rows={compact ? 2 : 3}
            disabled={disabled || sending}
            placeholder={placeholder}
            aria-label="Message Bonnie"
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => startVoiceInput()}
            disabled={disabled || sending || !tenantId}
            aria-label={listening ? 'Stop voice input' : 'Voice command'}
            title={listening ? 'Listening… tap to stop' : 'Speak a command'}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              listening
                ? 'border-rose-500/50 bg-rose-500/20 text-rose-300'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-teal-500/50 hover:text-teal-300'
            }`}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={disabled || sending || !input.trim()}
            aria-label="Send to Bonnie"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white transition-colors hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
          Enter to send · Mic uses Web Speech → voice API · Bonnie will show when an action was blocked by provider billing instead of silently failing
        </p>
      </div>
    </div>
  );
}
