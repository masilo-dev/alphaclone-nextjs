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
}

export function ModuleDashboardActions({
  moduleId,
  userRole = 'client',
}: ModuleDashboardActionsProps) {
  const router = useRouter();
  const { title, hint, actions } = resolveModuleActions(moduleId, userRole);

  const go = (href: string) => {
    router.push(href);
  };

  const primary = actions.find((a) => a.primary) ?? actions[0];
  const secondary = actions.filter((a) => a !== primary);

  return (
    <section className="rounded-xl border border-teal-500/25 bg-gradient-to-br from-teal-500/10 via-slate-900/80 to-slate-900/90 p-4 md:p-5 mb-4 md:mb-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-400/90">
            What to do next
          </p>
          <h2 className="text-lg md:text-xl font-semibold text-white mt-1">{title}</h2>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">{hint}</p>
        </div>

        {primary ? (
          <button
            type="button"
            onClick={() => go(primary.resolvedHref)}
            className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold shadow-lg shadow-teal-900/30 transition-colors"
          >
            <primary.icon className="w-4 h-4" />
            {primary.label}
            <ChevronRight className="w-4 h-4 opacity-80" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/8">
        {secondary.map((action) => (
          <button
            key={action.resolvedHref + action.label}
            type="button"
            onClick={() => go(action.resolvedHref)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700/80 bg-slate-800/50 hover:bg-slate-800 hover:border-slate-600 text-xs font-medium text-slate-200 transition-colors"
          >
            <action.icon className="w-3.5 h-3.5 text-teal-400" />
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}
