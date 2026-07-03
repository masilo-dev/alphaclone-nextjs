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
    <div className="space-y-4 mb-3 md:mb-4">
      <section className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 md:px-5 md:py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-teal-400">
              Insight Layer
            </p>
            <h2 className="text-lg md:text-xl font-bold text-white mt-0.5">{title}</h2>
          </div>
          {primary ? (
            <button
              type="button"
              onClick={() => go(primary.resolvedHref)}
              className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-lg shadow-teal-900/20 transition-all active:scale-95"
            >
              <primary.icon className="w-3.5 h-3.5" />
              {primary.label}
              <ChevronRight className="w-3.5 h-3.5 opacity-90" />
            </button>
          ) : null}
        </div>
        
        <p className="text-sm text-slate-400 mt-2 max-w-4xl leading-relaxed">{purpose}</p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl bg-slate-950/40 border border-white/5 p-3.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2.5">
              Protocol
            </p>
            <ol className="space-y-1.5">
              {playbook.slice(0, 3).map((step, index) => (
                <li key={step} className="flex gap-2.5 text-xs text-slate-300">
                  <span className="shrink-0 w-4.5 h-4.5 rounded-md bg-teal-500/10 text-teal-400 text-[10px] font-black flex items-center justify-center border border-teal-500/20">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          
          <div className="flex flex-col justify-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2.5 px-1">
              Actions
            </p>
            <div className="flex flex-wrap gap-2">
              {secondary.map((action) => (
                <button
                  key={action.resolvedHref + action.label}
                  type="button"
                  onClick={() => go(action.resolvedHref)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/40 border border-white/5 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all active:scale-95"
                >
                  <action.icon className="w-3.5 h-3.5 text-teal-500" />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
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
