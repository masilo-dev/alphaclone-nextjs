'use client';

/**
 * ExecutionTimelineEvent
 * ─────────────────────────────────────────────────────────────────────────────
 * A single row in Bonnie's execution timeline. Renders the tool name, phase
 * label, elapsed time, status icon, and an expandable JSON payload viewer.
 *
 * Designed to replace the raw phase-log text stream in BonnieChatPanel.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ChevronDown,
  ChevronRight,
  Wrench,
  Brain,
  Zap,
  ShieldAlert,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TimelineEventStatus =
  | 'running'
  | 'done'
  | 'failed'
  | 'pending'
  | 'approval_required';

export type TimelineEventKind =
  | 'tool_call'
  | 'planning'
  | 'synthesis'
  | 'approval'
  | 'phase';

export type ExecutionTimelineEventProps = {
  /** Unique event identifier */
  id: string;
  /** Human-readable label for the event */
  label: string;
  kind: TimelineEventKind;
  status: TimelineEventStatus;
  /** Name of the tool being called (if kind === 'tool_call') */
  tool?: string;
  /** Duration in milliseconds (filled once done/failed) */
  durationMs?: number;
  /** Optional short summary returned by the tool */
  summary?: string;
  /** Optional serialisable payload for the expanded JSON view */
  payload?: unknown;
  /** ISO timestamp for the event */
  timestamp?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const KIND_ICON: Record<TimelineEventKind, React.ReactNode> = {
  tool_call: <Wrench className="h-3.5 w-3.5" />,
  planning: <Brain className="h-3.5 w-3.5" />,
  synthesis: <Zap className="h-3.5 w-3.5" />,
  approval: <ShieldAlert className="h-3.5 w-3.5" />,
  phase: <Clock className="h-3.5 w-3.5" />,
};

const STATUS_CONFIG: Record<
  TimelineEventStatus,
  { icon: React.ReactNode; dotClass: string; labelClass: string }
> = {
  pending: {
    icon: <Clock className="h-3.5 w-3.5 text-slate-500" />,
    dotClass: 'bg-slate-600',
    labelClass: 'text-slate-500',
  },
  running: {
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-400" />,
    dotClass: 'bg-teal-400 animate-pulse',
    labelClass: 'text-teal-300',
  },
  done: {
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
    dotClass: 'bg-emerald-500',
    labelClass: 'text-slate-300',
  },
  failed: {
    icon: <XCircle className="h-3.5 w-3.5 text-rose-400" />,
    dotClass: 'bg-rose-500',
    labelClass: 'text-rose-300',
  },
  approval_required: {
    icon: <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />,
    dotClass: 'bg-amber-400 animate-pulse',
    labelClass: 'text-amber-300',
  },
};

const KIND_COLOR: Record<TimelineEventKind, string> = {
  tool_call: 'text-teal-400 bg-teal-500/10',
  planning: 'text-teal-400 bg-teal-500/10',
  synthesis: 'text-sky-400 bg-sky-500/10',
  approval: 'text-amber-400 bg-amber-500/10',
  phase: 'text-slate-400 bg-slate-500/10',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExecutionTimelineEvent({
  id,
  label,
  kind,
  status,
  tool,
  durationMs,
  summary,
  payload,
  timestamp,
}: ExecutionTimelineEventProps) {
  const [expanded, setExpanded] = useState(false);
  const hasPayload = payload !== undefined && payload !== null;
  const cfg = STATUS_CONFIG[status];

  return (
    <motion.div
      layoutId={id}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2.5 py-1"
    >
      {/* Timeline dot + connector line */}
      <div className="relative flex flex-col items-center pt-0.5 shrink-0">
        <div className={`h-2 w-2 rounded-full shrink-0 ${cfg.dotClass}`} />
        {/* vertical connector — rendered by parent via a wrapper div */}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Kind chip */}
          <span
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${KIND_COLOR[kind]}`}
          >
            {KIND_ICON[kind]}
            {kind.replace('_', ' ')}
          </span>

          {/* Tool badge */}
          {tool && (
            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300 border border-slate-700/60">
              {tool}
            </span>
          )}

          {/* Status icon */}
          {cfg.icon}

          {/* Duration */}
          {durationMs !== undefined && (
            <span className="text-[10px] text-slate-600 ml-auto shrink-0">
              {formatDuration(durationMs)}
            </span>
          )}

          {/* Expand toggle */}
          {hasPayload && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="ml-auto shrink-0 text-slate-600 hover:text-slate-300 transition-colors"
              title="Show payload"
            >
              {expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          )}
        </div>

        {/* Label */}
        <p className={`mt-0.5 text-[11px] leading-snug ${cfg.labelClass}`}>
          {label}
        </p>

        {/* Summary */}
        {summary && (
          <p className="mt-0.5 text-[10px] text-slate-500 leading-snug">
            {summary}
          </p>
        )}

        {/* Timestamp */}
        {timestamp && (
          <p className="mt-0.5 text-[9px] text-slate-700">
            {new Date(timestamp).toLocaleTimeString()}
          </p>
        )}

        {/* Expandable payload */}
        <AnimatePresence>
          {expanded && hasPayload && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <pre className="mt-1.5 max-h-40 overflow-auto rounded-lg border border-slate-700/60 bg-slate-950 p-2 text-[10px] text-slate-400 custom-scrollbar">
                {JSON.stringify(payload, null, 2)}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
