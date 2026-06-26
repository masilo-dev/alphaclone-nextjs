'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import type { UserRole } from '@/types';
import {
  type ModuleDashboardId,
  resolveModuleActions,
} from '@/config/moduleDashboardActions';

interface ModuleDashboardActionsProps {
  moduleId: ModuleDashboardId;
  userRole?: UserRole;
  showChartNote?: boolean;
}

export function ModuleDashboardActions({
  moduleId,
  userRole = 'client',
  showChartNote = false,
}: ModuleDashboardActionsProps) {
  const router = useRouter();
  const { title, purpose, playbook, chartNote, actions } = resolveModuleActions(moduleId, userRole);

  const go = (href: string) => {
    router.push(href);
  };

  const primary = actions.find((a) => a.primary) ?? actions[0];
  const secondary = actions.filter((a) => a !== primary);

  return (
    <div className="space-y-4 mb-4 md:mb-5">
      <section className="rounded-xl border border-teal-500/30 bg-gradient-to-br from-teal-500/12 via-slate-900/90 to-slate-950 p-4 md:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-400">
          What to do next
        </p>
        <h2 className="text-xl md:text-2xl font-semibold text-white mt-1">{title}</h2>
        <p className="text-sm md:text-base text-slate-300 mt-2 max-w-3xl leading-relaxed">{purpose}</p>

        <div className="mt-5 rounded-lg bg-slate-950/50 border border-slate-800 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
            Your workflow
          </p>
          <ol className="space-y-2.5">
            {playbook.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm text-slate-200 leading-relaxed">
                <span className="shrink-0 w-6 h-6 rounded-full bg-teal-500/20 text-teal-300 text-xs font-bold flex items-center justify-center">
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {primary ? (
          <button
            type="button"
            onClick={() => go(primary.resolvedHref)}
            className="mt-5 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold shadow-lg shadow-teal-900/30 transition-colors"
          >
            <primary.icon className="w-4 h-4" />
            {primary.label}
            <ChevronRight className="w-4 h-4 opacity-90" />
          </button>
        ) : null}
      </section>

      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3 px-1">
          Go do the work
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {secondary.map((action) => (
            <button
              key={action.resolvedHref + action.label}
              type="button"
              onClick={() => go(action.resolvedHref)}
              className="text-left rounded-xl border border-slate-800 bg-slate-900/70 hover:bg-slate-900 hover:border-slate-600 p-4 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-9 h-9 rounded-lg bg-teal-500/15 flex items-center justify-center">
                  <action.icon className="w-4 h-4 text-teal-400" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white group-hover:text-teal-300 transition-colors">
                    {action.label}
                  </span>
                  <span className="block text-xs text-slate-400 mt-1 leading-relaxed">
                    {action.description}
                  </span>
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {showChartNote ? (
        <p className="text-xs text-slate-500 px-1 leading-relaxed border-l-2 border-slate-700 pl-3">
          {chartNote}
        </p>
      ) : null}
    </div>
  );
}
