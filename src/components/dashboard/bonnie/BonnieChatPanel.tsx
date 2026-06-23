'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';

export type BonnieChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
};

type BonnieChatPanelProps = {
  introMessage?: string;
  placeholder?: string;
  compact?: boolean;
  disabled?: boolean;
  onSend: (
    text: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>
  ) => Promise<{ text: string; error?: boolean }>;
};

export default function BonnieChatPanel({
  introMessage = "Hi — I'm Bonnie. Type a command (e.g. audit overdue invoices, open CRM, summarize stale deals).",
  placeholder = 'Instruct Bonnie…',
  compact = false,
  disabled = false,
  onSend,
}: BonnieChatPanelProps) {
  const [messages, setMessages] = useState<BonnieChatMessage[]>(() =>
    introMessage
      ? [{ id: 'intro', role: 'assistant', text: introMessage }]
      : []
  );
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

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

    const history = messages
      .filter((m) => m.id !== 'intro')
      .map((m) => ({ role: m.role, content: m.text }));

    try {
      const result = await onSend(text, history);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: result.text,
          error: result.error,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: 'Something went wrong processing that command. Please try again.',
          error: true,
        },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#090d16] ${
        compact ? 'h-[280px]' : 'h-full min-h-[360px]'
      }`}
    >
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
              {msg.text}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-400" />
            Bonnie is working…
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
          Enter to send · Bonnie AI runs real tools across your workspace
        </p>
      </div>
    </div>
  );
}
