'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Shield,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import type {
  ExecutionAuthorityLevel,
  ModuleExecutionQuestions,
  UniversalNextActionState,
} from '@/types/moduleExecution';

interface UniversalModuleExecutionHeaderProps {
  moduleName: string;
  recordTitle?: string;
  nextActionState: UniversalNextActionState;
  questions?: ModuleExecutionQuestions;
  onExecuteNextAction?: () => void;
  className?: string;
}

const AUTHORITY_CONFIG: Record<
  ExecutionAuthorityLevel,
  { label: string; bg: string; text: string; border: string }
> = {
  automatic: {
    label: 'AUTOMATIC (Safe & Reversible)',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
  automatic_logged: {
    label: 'AUTOMATIC + LOGGED',
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
  },
  approval_required: {
    label: 'APPROVAL REQUIRED',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  human_decision_required: {
    label: 'HUMAN DECISION REQUIRED',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
  },
};

export function UniversalModuleExecutionHeader({
  moduleName,
  recordTitle,
  nextActionState,
  questions,
  onExecuteNextAction,
  className = '',
}: UniversalModuleExecutionHeaderProps) {
  const [show8Questions, setShow8Questions] = useState(false);
  const authority = AUTHORITY_CONFIG[nextActionState.authorityLevel] || AUTHORITY_CONFIG.automatic_logged;

  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur-md shadow-lg transition-all ${className}`}
    >
      {/* Header bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-teal-400">
                {moduleName} • Active Execution Object
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${authority.bg} ${authority.text} ${authority.border}`}
              >
                <Shield className="h-3 w-3" />
                {authority.label}
              </span>
            </div>
            <h2 className="text-base font-bold text-white leading-snug">
              {recordTitle || `${moduleName} Execution Loop`}
            </h2>
          </div>
        </div>

        {onExecuteNextAction && (
          <button
            type="button"
            onClick={onExecuteNextAction}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-500 transition-colors shadow-md shrink-0"
          >
            <span>Execute Next Action</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Operational 7-Field Grid */}
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-7 border-t border-slate-800 pt-3">
        {/* 1. Current State */}
        <div className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800/60">
          <p className="text-[10px] font-semibold uppercase text-slate-400">Current State</p>
          <p className="mt-1 font-medium text-slate-200 truncate">{nextActionState.currentState}</p>
        </div>

        {/* 2. Owner */}
        <div className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800/60">
          <p className="text-[10px] font-semibold uppercase text-slate-400 flex items-center gap-1">
            <User className="h-3 w-3 text-slate-400" /> Owner
          </p>
          <p className="mt-1 font-medium text-slate-200 truncate">{nextActionState.owner}</p>
        </div>

        {/* 3. Next Action */}
        <div className="rounded-lg bg-slate-950/60 p-2.5 border border-teal-500/30">
          <p className="text-[10px] font-bold uppercase text-teal-400">Next Action</p>
          <p className="mt-1 font-semibold text-teal-300 truncate">{nextActionState.nextAction}</p>
        </div>

        {/* 4. Deadline */}
        <div className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800/60">
          <p className="text-[10px] font-semibold uppercase text-slate-400 flex items-center gap-1">
            <Clock className="h-3 w-3 text-slate-400" /> Deadline
          </p>
          <p className="mt-1 font-medium text-slate-200 truncate">
            {nextActionState.deadline || 'Immediate / Continuous'}
          </p>
        </div>

        {/* 5. Blocker */}
        <div className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800/60">
          <p className="text-[10px] font-semibold uppercase text-slate-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-400" /> Blocker
          </p>
          <p className={`mt-1 font-medium truncate ${nextActionState.blocker ? 'text-amber-400 font-semibold' : 'text-slate-500'}`}>
            {nextActionState.blocker || 'None'}
          </p>
        </div>

        {/* 6. Expected Outcome */}
        <div className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800/60">
          <p className="text-[10px] font-semibold uppercase text-slate-400">Expected Outcome</p>
          <p className="mt-1 font-medium text-slate-200 truncate">{nextActionState.expectedOutcome}</p>
        </div>

        {/* 7. Verified Result */}
        <div className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800/60">
          <p className="text-[10px] font-semibold uppercase text-slate-400 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Verified Result
          </p>
          <p className={`mt-1 font-medium truncate ${nextActionState.outcomeStatus === 'verified' ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
            {nextActionState.verifiedResult || 'Awaiting execution verification'}
          </p>
        </div>
      </div>

      {/* Toggle 8 Questions Drawer */}
      {questions && (
        <div className="mt-3 border-t border-slate-800/80 pt-2">
          <button
            type="button"
            onClick={() => setShow8Questions(!show8Questions)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <HelpCircle className="h-3.5 w-3.5 text-teal-400" />
            <span>8 Operational Questions Audit</span>
            {show8Questions ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {show8Questions && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 rounded-lg bg-slate-950/90 p-3 border border-slate-800 text-xs">
              <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                <span className="font-bold text-teal-400 text-[11px]">1. WHAT CAME IN?</span>
                <p className="mt-1 text-slate-300 leading-relaxed">{questions.whatCameIn}</p>
              </div>
              <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                <span className="font-bold text-teal-400 text-[11px]">2. WHAT DOES IT MEAN?</span>
                <p className="mt-1 text-slate-300 leading-relaxed">{questions.whatDoesItMean}</p>
              </div>
              <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                <span className="font-bold text-teal-400 text-[11px]">3. WHAT SHOULD HAPPEN?</span>
                <p className="mt-1 text-slate-300 leading-relaxed">{questions.whatShouldHappen}</p>
              </div>
              <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                <span className="font-bold text-teal-400 text-[11px]">4. WHO OWNS IT?</span>
                <p className="mt-1 text-slate-300 leading-relaxed">{questions.whoOwnsIt}</p>
              </div>
              <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                <span className="font-bold text-teal-400 text-[11px]">5. CAN ALPHACLONE ACT?</span>
                <p className="mt-1 text-slate-300 leading-relaxed uppercase font-semibold text-sky-400">{questions.canAlphaCloneAct}</p>
              </div>
              <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                <span className="font-bold text-teal-400 text-[11px]">6. WHAT ACTUALLY HAPPENED?</span>
                <p className="mt-1 text-slate-300 leading-relaxed">{questions.whatActuallyHappened || 'Pending execution'}</p>
              </div>
              <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                <span className="font-bold text-teal-400 text-[11px]">7. EXPECTED OUTCOME PRODUCED?</span>
                <p className="mt-1 text-slate-300 leading-relaxed font-semibold text-emerald-400">
                  {questions.didItProduceExpectedOutcome || 'Verification in progress'}
                </p>
              </div>
              <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                <span className="font-bold text-teal-400 text-[11px]">8. WHAT HAPPENS NEXT?</span>
                <p className="mt-1 text-slate-300 leading-relaxed">{questions.whatHappensNext || 'Follow up or close'}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
