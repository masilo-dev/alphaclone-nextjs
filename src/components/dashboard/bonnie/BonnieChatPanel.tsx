'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { BookOpen, CheckCircle2, Loader2, Mic, MicOff, Send, Wrench, XCircle } from 'lucide-react';
import BonnieApprovalCard from './BonnieApprovalCard';
import { bonnieService } from '@/services/bonnieService';

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
};

type BonnieChatSendResult = {
  text: string;
  error?: boolean;
  tools?: BonnieToolStep[];
  approval?: BonniePendingApproval;
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
    onPhase?: (phase: string) => void
  ) => Promise<BonnieChatSendResult>;
  onResolveApproval?: (
    approvalId: string,
    status: 'approved' | 'rejected',
    editedArgs?: Record<string, unknown>
  ) => Promise<{ success: boolean; message?: string; continuation?: { response?: string; continued?: boolean } | null }>;
  /** Tenant id for voice commands */
  tenantId?: string;
  pathname?: string;
};

function loadStoredMessages(key: string, intro: string): BonnieChatMessage[] {
  if (typeof window === 'undefined') {
    return intro ? [{ id: 'intro', role: 'assistant', text: intro }] : [];
  }
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as BonnieChatMessage[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore corrupt storage
  }
  return intro ? [{ id: 'intro', role: 'assistant', text: intro }] : [];
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
}: BonnieChatPanelProps) {
  const [messages, setMessages] = useState<BonnieChatMessage[]>(() =>
    storageKey ? loadStoredMessages(storageKey, introMessage) : introMessage ? [{ id: 'intro', role: 'assistant', text: introMessage }] : []
  );
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [agentPhase, setAgentPhase] = useState<'idle' | 'thinking' | 'executing' | 'responding'>('idle');
  const [listening, setListening] = useState(false);
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

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-40)));
  }, [messages, storageKey]);

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
          (phase) => {
            if (phase === 'executing') setAgentPhase('executing');
            if (phase === 'thinking') setAgentPhase('thinking');
          }
        );

        window.clearTimeout(phaseTimer);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamMsgId
              ? {
                  ...m,
                  text: result.text || m.text,
                  error: result.error,
                  tools: result.tools,
                  approval: result.approval,
                }
              : m
          )
        );
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
          },
        ]);
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
    const fresh = introMessage ? [{ id: 'intro', role: 'assistant' as const, text: introMessage }] : [];
    setMessages(fresh);
    if (storageKey && typeof window !== 'undefined') {
      sessionStorage.removeItem(storageKey);
    }
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
      className={`flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#090d16] ${
        compact ? 'h-[280px]' : 'h-full min-h-[360px]'
      }`}
    >
      {!compact && messages.length > 1 && (
        <div className="flex justify-end border-b border-slate-800/60 px-3 py-1.5">
          <button
            type="button"
            onClick={clearChat}
            className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300"
          >
            Clear chat
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
              <p className="whitespace-pre-wrap">{sanitizeDisplayText(msg.text)}</p>
              {msg.tools && msg.tools.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-slate-700/50 pt-2">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <Wrench className="h-3 w-3" /> Actions run
                  </p>
                  {msg.tools.map((t, i) => (
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
                  ))}
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
                        },
                      ];
                      if (result.continuation?.response) {
                        followUps.push({
                          id: `assistant-resume-${Date.now() + 1}`,
                          role: 'assistant',
                          text: result.continuation.response,
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
          Enter to send · Mic uses Web Speech → voice API · Bonnie runs real tools across your workspace
        </p>
      </div>
    </div>
  );
}
