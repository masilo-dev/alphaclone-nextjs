'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Send, Wrench, XCircle } from 'lucide-react';

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
};

export type BonnieChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
  tools?: BonnieToolStep[];
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
  ) => Promise<{ text: string; error?: boolean; tools?: BonnieToolStep[] }>;
  onStreamSend?: (
    text: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    onToken: (token: string) => void,
    onPhase?: (phase: string) => void
  ) => Promise<{ text: string; error?: boolean; tools?: BonnieToolStep[] }>;
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
}: BonnieChatPanelProps) {
  const [messages, setMessages] = useState<BonnieChatMessage[]>(() =>
    storageKey ? loadStoredMessages(storageKey, introMessage) : introMessage ? [{ id: 'intro', role: 'assistant', text: introMessage }] : []
  );
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [agentPhase, setAgentPhase] = useState<'idle' | 'thinking' | 'executing' | 'responding'>('idle');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
            onClick={() => void handleSend()}
            disabled={disabled || sending || !input.trim()}
            aria-label="Send to Bonnie"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white transition-colors hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
          Enter to send · Bonnie AI runs real tools across your workspace — chat persists in this session
        </p>
      </div>
    </div>
  );
}
