'use client';

import React, { useEffect, useState } from 'react';
import { Bot, Cpu, Lock, CheckCircle2, Terminal, Database, Loader2, Play } from 'lucide-react';

interface AiExampleAction {
  id: string;
  prompt: string;
  moduleExecuted: string;
  mcpToolCall: string;
  workspaceResult: string;
}

const AI_EXAMPLES: AiExampleAction[] = [
  {
    id: 'proposal',
    prompt: 'Bonnie, draft a $18,000 onboarding proposal for Acme Growth based on my notes from today’s discovery call.',
    moduleExecuted: 'Documents & Proposals Module',
    mcpToolCall: 'mcp_create_proposal({ client: "Acme", amount: 18000, scope: "CRM Migration" })',
    workspaceResult: 'Created #PROP-2026-089 with itemized scope, milestone schedule ($9k/$9k), and custom SLA clauses.',
  },
  {
    id: 'invoices',
    prompt: 'Bonnie, check for any overdue invoices from last month and draft polite reminder emails for my review.',
    moduleExecuted: 'Financial Billing & Gmail Integration',
    mcpToolCall: 'mcp_audit_invoices({ min_days_overdue: 14 }) -> mcp_draft_email()',
    workspaceResult: 'Found 2 overdue invoices ($4,200 total). Drafted 2 personalized emails in your inbox for approval.',
  },
  {
    id: 'pipeline',
    prompt: 'Bonnie, summarize our high-value deals in progress and highlight which accounts require follow-up this week.',
    moduleExecuted: 'Living CRM & Executive Reporting',
    mcpToolCall: 'mcp_query_deals({ min_value: 10000, stage: "proposal_sent" })',
    workspaceResult: '3 deals totaling $64,000 need attention. Formatted summary ready for Monday leadership sync.',
  },
];

export default function BonnieAiSection() {
  const [activeExampleIndex, setActiveExampleIndex] = useState<number>(0);
  const [demoStage, setDemoStage] = useState<0 | 1 | 2 | 3>(0);
  const activeEx = AI_EXAMPLES[activeExampleIndex];

  useEffect(() => {
    if (demoStage === 0 || demoStage === 3) return;
    const timer = window.setTimeout(() => {
      setDemoStage((current) => (current < 3 ? ((current + 1) as 1 | 2 | 3) : current));
    }, 850);
    return () => window.clearTimeout(timer);
  }, [demoStage]);

  const selectExample = (index: number) => {
    setActiveExampleIndex(index);
    setDemoStage(0);
  };

  return (
    <div className="w-full py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header Banner */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs sm:text-sm font-medium mb-4">
            <Bot className="w-4 h-4 text-cyan-400" />
            <span>Workspace-Aware Intelligence</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-4 font-marketing-heading">
            Not Another Detached Chatbot.{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 via-cyan-400 to-emerald-400">
              An Extra Operator for Your Team.
            </span>
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Most SaaS AI is a generic chat box floating in a browser tab with zero knowledge of your actual business.
            Bonnie AI connects directly to your workspace memory via <strong className="text-white">Model Context Protocol (MCP)</strong> to execute real work safely.
          </p>
        </div>

        {/* AI Capabilities Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl backdrop-blur-md">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-4">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2 font-marketing-heading">1. Grounded in Your Data</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Bonnie AI reads your workspace records—client timelines, contract terms, active tasks, and billing states—so answers are always specific to your business.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl backdrop-blur-md">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2 font-marketing-heading">2. Powered by MCP</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Using Model Context Protocol, Bonnie AI invokes built-in platform actions safely—drafting proposals, scheduling tasks, and preparing invoice runs.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl backdrop-blur-md">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2 font-marketing-heading">3. Human-in-the-Loop</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              You remain in full control. Critical actions like sending contracts or charging client cards require your explicit review and approval before execution.
            </p>
          </div>
        </div>

        {/* Interactive Example Demo */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl p-6 sm:p-8 backdrop-blur-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider font-mono">Interactive Demonstration</span>
              <h3 className="text-xl sm:text-2xl font-bold text-white mt-1">
                See How Bonnie AI & MCP Execute Operational Prompts
              </h3>
            </div>
            <div className="flex gap-2">
              {AI_EXAMPLES.map((ex, idx) => (
                <button
                  key={ex.id}
                  onClick={() => selectExample(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeExampleIndex === idx
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  Prompt 0{idx + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] px-4 py-3">
            <p className="text-xs text-slate-300">
              Product walkthrough using sample workspace data. Sign in to run Bonnie against your real records.
            </p>
            <button
              type="button"
              onClick={() => setDemoStage(1)}
              disabled={demoStage > 0 && demoStage < 3}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-cyan-500 px-4 text-xs font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-wait disabled:opacity-70"
            >
              {demoStage > 0 && demoStage < 3 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {demoStage === 0 ? 'Run the flow' : demoStage === 3 ? 'Run again' : 'Bonnie is working'}
            </button>
          </div>

          {/* Interactive Code/Prompt Console */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 font-mono space-y-4">
            {/* User Input Prompt */}
            <div className={`space-y-1.5 transition-opacity ${demoStage >= 1 ? 'opacity-100' : 'opacity-45'}`}>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5 text-teal-400">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>PLAIN-ENGLISH USER INSTRUCTION:</span>
                </span>
                <span className="text-[10px] text-slate-500">OPERATOR PROMPT</span>
              </div>
              <p className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-xs sm:text-sm text-slate-100 leading-relaxed font-sans">
                "{activeEx.prompt}"
              </p>
            </div>

            {/* MCP Execution Signal */}
            <div className={`space-y-1.5 transition-opacity ${demoStage >= 2 ? 'opacity-100' : 'opacity-30'}`}>
              <div className="flex items-center justify-between text-xs text-cyan-400">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>MCP PROTOCOL TOOL INVOCATION:</span>
                </span>
                <span className="text-[10px] text-cyan-500">SECURE DISPATCH</span>
              </div>
              <p className="p-2.5 rounded-lg bg-slate-900 border border-cyan-900/40 text-[11px] sm:text-xs text-cyan-300 font-mono">
                → {activeEx.mcpToolCall}
              </p>
            </div>

            {/* Workspace Result */}
            <div className={`space-y-1.5 pt-1 transition-opacity ${demoStage >= 3 ? 'opacity-100' : 'opacity-30'}`}>
              <div className="flex items-center justify-between text-xs text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>EXECUTED WORKSPACE OUTCOME:</span>
                </span>
                <span className="text-[10px] text-emerald-500">REAL-TIME UPDATED</span>
              </div>
              <p className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/40 text-xs sm:text-sm text-emerald-200 leading-relaxed font-sans">
                ✓ {activeEx.workspaceResult}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
