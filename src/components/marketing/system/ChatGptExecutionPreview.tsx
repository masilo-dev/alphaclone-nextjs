'use client';

import { SiOpenai } from 'react-icons/si';
import { Bot, Check, Sparkles } from 'lucide-react';

const MESSAGES = [
  {
    role: 'user' as const,
    text: 'Find customers in Harare who need website work, add them to CRM, and draft outreach for the top 5.',
  },
  {
    role: 'assistant' as const,
    text: 'I found 12 matching businesses. I created 12 CRM records, scored fit, and prepared 5 outreach drafts. Two actions need your approval before send.',
    tools: ['search_leads', 'create_leads', 'prepare_outreach'],
  },
  {
    role: 'user' as const,
    text: 'Approve the top 3 drafts and schedule follow-ups for Friday.',
  },
  {
    role: 'assistant' as const,
    text: 'Done. 3 emails queued through your connected provider. Follow-up tasks scheduled for Friday 09:00 with CRM context attached.',
    tools: ['send_email', 'create_task'],
    done: true,
  },
];

export default function ChatGptExecutionPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/10 bg-[#212121] shadow-2xl shadow-black/40 ${compact ? '' : 'ring-1 ring-emerald-500/20'}`}
      aria-label="ChatGPT conversation executing AlphaClone business workflows"
    >
      <div className="flex items-center justify-between border-b border-white/10 bg-[#2f2f2f] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#10a37f]/15">
            <SiOpenai className="h-4 w-4 text-[#10a37f]" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">ChatGPT</p>
            <p className="text-[10px] text-slate-400">AlphaClone MCP connected</p>
          </div>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300 sm:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live execution
        </span>
      </div>

      <div className={`space-y-4 bg-[#212121] ${compact ? 'p-4 max-h-[320px] overflow-y-auto' : 'p-5 sm:p-6'}`}>
        {MESSAGES.map((msg, index) => (
          <div
            key={index}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#10a37f] text-white">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
              </div>
            )}
            <div
              className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 sm:max-w-[85%] ${
                msg.role === 'user'
                  ? 'bg-[#2f2f2f] text-slate-100'
                  : 'bg-transparent text-slate-200'
              }`}
            >
              <p>{msg.text}</p>
              {msg.tools && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {msg.tools.map((tool) => (
                    <span
                      key={tool}
                      className="inline-flex items-center gap-1 rounded-md border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 font-mono text-[10px] text-cyan-200"
                    >
                      <Bot className="h-3 w-3" aria-hidden />
                      {tool}
                    </span>
                  ))}
                </div>
              )}
              {msg.done && (
                <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  Verified in AlphaClone audit log
                </p>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-600 text-[10px] font-bold text-white">
                You
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 bg-[#2f2f2f] px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#212121] px-3 py-2.5 text-xs text-slate-500">
          <span className="flex-1">Message ChatGPT…</span>
          <span className="rounded-md bg-[#10a37f] px-2 py-1 text-[10px] font-bold text-white">Send</span>
        </div>
      </div>
    </div>
  );
}
