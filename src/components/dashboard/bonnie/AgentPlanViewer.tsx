'use client';

/**
 * AgentPlanViewer
 * ─────────────────────────────────────────────────────────────────────────────
 * Collapsible panel rendered inside BonnieChatPanel that surfaces Bonnie's
 * real-time reasoning plan: numbered steps, active-step highlight, tool-call
 * annotations, and per-step status badges.
 *
 * It intentionally owns zero data-fetching logic — all state is passed in as
 * props so the parent (BonnieChatPanel) remains the single source of truth.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  Brain,
  CheckCircle2,
  Loader2,
  XCircle,
  Clock,
  Wrench,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AgentPlanStep = {
  id: string;
  label: string;
  /** Which tool (if any) this step invokes */
  tool?: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  /** Optional brief note shown under the step label */
  detail?: string;
};

export type AgentPlanViewerProps = {
  /** Plan steps derived from the stream. Empty array = don't render. */
  steps: AgentPlanStep[];
  /** Zero-based index of the currently-executing step */
  activeStepIndex?: number;
  /** Whether Bonnie is still building / executing the plan */
  isRunning?: boolean;
  /** Overall label for the plan ("Auditing Q2 invoices…") */
  planTitle?: string;
  /** Default collapsed state */
  defaultCollapsed?: boolean;
};

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_ICON: Record<AgentPlanStep['status'], React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5 text-slate-500" />,
  running: <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-400" />,
  done: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
  failed: <XCircle className="h-3.5 w-3.5 text-rose-400" />,
  skipped: <ChevronRight className="h-3.5 w-3.5 text-slate-600" />,
};

const STATUS_LABEL_CLASS: Record<AgentPlanStep['status'], string> = {
  pending: 'text-slate-500',
  running: 'text-teal-300 font-semibold',
  done: 'text-slate-300 line-through opacity-60',
  failed: 'text-rose-300',
  skipped: 'text-slate-600 italic',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AgentPlanViewer({
  steps,
  isRunning = false,
  planTitle,
  defaultCollapsed = false,
}: AgentPlanViewerProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (!steps || steps.length === 0) return null;

  const doneCount = steps.filter((s) => s.status === 'done').length;
  const failCount = steps.filter((s) => s.status === 'failed').length;

  return (
    <div className="mt-2 rounded-xl border border-teal-500/20 bg-slate-900/60 overflow-hidden">
      {/* Header ─── */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center justify-center h-5 w-5 rounded-md bg-teal-500/10">
          <Brain className="h-3 w-3 text-teal-400" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-teal-400/70">
            Agent Plan
          </p>
          {planTitle && (
            <p className="text-xs text-slate-300 truncate">{planTitle}</p>
          )}
        </div>

        {/* Progress pill */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isRunning && (
            <span className="flex items-center gap-1 rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[10px] font-bold text-teal-300">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              Running
            </span>
          )}
          {!isRunning && failCount > 0 && (
            <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-300">
              {failCount} failed
            </span>
          )}
          {!isRunning && failCount === 0 && (
            <span className="text-[10px] text-slate-500">
              {doneCount}/{steps.length}
            </span>
          )}
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
          )}
        </div>
      </button>

      {/* Progress bar ─── */}
      <div className="h-0.5 bg-slate-800">
        <motion.div
          className="h-full bg-teal-500 rounded-full"
          initial={{ width: 0 }}
          animate={{
            width: steps.length
              ? `${(doneCount / steps.length) * 100}%`
              : '0%',
          }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      {/* Steps list ─── */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="steps"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <ol className="px-3 py-2 space-y-1.5">
              {steps.map((step, idx) => (
                <motion.li
                  key={step.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="flex items-start gap-2"
                >
                  {/* Step number */}
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-700 text-[9px] font-black text-slate-500">
                    {idx + 1}
                  </span>

                  {/* Status icon */}
                  <span className="mt-0.5 shrink-0">
                    {STATUS_ICON[step.status]}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-snug ${STATUS_LABEL_CLASS[step.status]}`}>
                      {step.label}
                    </p>
                    {step.tool && (
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-600">
                        <Wrench className="h-2.5 w-2.5" />
                        <span className="font-mono">{step.tool}</span>
                      </p>
                    )}
                    {step.detail && step.status !== 'done' && (
                      <p className="mt-0.5 text-[10px] text-slate-500 leading-snug">
                        {step.detail}
                      </p>
                    )}
                  </div>
                </motion.li>
              ))}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
