'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { UserRole } from '@/types';
import { WORKSPACE } from '@/constants/design';
import {
  type ModuleDashboardId,
  resolveModuleActions,
} from '@/config/moduleDashboardActions';

interface ModuleDashboardActionsProps {
  moduleId: ModuleDashboardId;
  userRole?: UserRole;
  showChartNote?: boolean;
  defaultCollapsed?: boolean;
}

export function ModuleDashboardActions({
  moduleId,
  userRole = 'client',
  showChartNote = false,
  defaultCollapsed = true,
}: ModuleDashboardActionsProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const { title, purpose, playbook, chartNote, actions } = resolveModuleActions(moduleId, userRole);

  const go = (href: string) => {
    router.push(href);
  };

  const primary = actions.find((a) => a.primary) ?? actions[0];
  const secondary = actions.filter((a) => a !== primary);

  return (
    <div className="space-y-3 mb-4 md:mb-5">
      <section className="ac-workspace-callout px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <p className={WORKSPACE.typography.sectionLabel}>What to do next</p>
            <h2 className="text-[15px] font-semibold text-white mt-0.5 truncate">{title}</h2>
            {!expanded ? (
              <p className="text-[12px] text-[var(--ws-text-tertiary)] mt-1 line-clamp-1">{purpose}</p>
            ) : (
              <p className="text-[13px] text-[var(--ws-text-secondary)] mt-2 max-w-3xl leading-relaxed">{purpose}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {primary ? (
              <button
                type="button"
                onClick={() => go(primary.resolvedHref)}
                className="ac-workspace-action-btn ac-workspace-action-btn--primary min-h-9 px-3"
              >
                <primary.icon className="w-4 h-4" />
                {primary.label}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="ac-workspace-action-btn min-h-9 px-3"
              aria-expanded={expanded}
            >
              {expanded ? 'Less' : 'Workflow'}
              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {expanded ? (
          <>
            <div className="mt-4 ac-workspace-panel p-4">
              <p className={WORKSPACE.typography.sectionLabel}>Your workflow</p>
              <ol className="space-y-2 mt-3">
                {playbook.map((step, index) => (
                  <li key={step} className="flex gap-3 text-[13px] text-[var(--ws-text-secondary)] leading-relaxed">
                    <span className="shrink-0 w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center bg-[var(--ws-active)] text-teal-300">
                      {index + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {secondary.map((action) => (
                <button
                  key={action.resolvedHref + action.label}
                  type="button"
                  onClick={() => go(action.resolvedHref)}
                  className="text-left ac-workspace-panel p-3 hover:bg-[var(--ws-panel-hover)] transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <action.icon className="w-4 h-4 text-teal-400 shrink-0" />
                    <span className="text-[12px] font-semibold text-white group-hover:text-teal-300 truncate">
                      {action.label}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 ml-auto shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </section>

      {showChartNote && expanded ? (
        <p className="text-[11px] text-[var(--ws-text-tertiary)] px-1 leading-relaxed border-l-2 border-[var(--ws-border-strong)] pl-3">
          {chartNote}
        </p>
      ) : null}
    </div>
  );
}
