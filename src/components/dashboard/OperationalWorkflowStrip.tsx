'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import type { UserRole } from '@/types';
import {
  type ModuleDashboardId,
  resolveModuleActions,
} from '@/config/moduleDashboardActions';

interface OperationalWorkflowStripProps {
  moduleId: ModuleDashboardId;
  userRole?: UserRole;
  className?: string;
}

/**
 * Compact "don't get lost" bar for operational workspaces (deals, tasks, billing, etc.)
 */
export function OperationalWorkflowStrip({
  moduleId,
  userRole = 'client',
  className = '',
}: OperationalWorkflowStripProps) {
  const router = useRouter();
  const { title, playbook, actions } = resolveModuleActions(moduleId, userRole);
  const primary = actions.find((a) => a.primary) ?? actions[0];
  const quickLinks = actions.filter((a) => a !== primary).slice(0, 3);

  if (!primary) return null;

  return (
    <section
      className={`rounded-xl border border-slate-800 bg-slate-900/60 p-3 md:p-4 ${className}`}
      aria-label="Workflow guidance"
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-400">
            Finish the job
          </p>
          <p className="text-sm font-semibold text-white mt-0.5">{title}</p>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
            {playbook[0]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {quickLinks.map((link) => (
            <button
              key={link.resolvedHref + link.label}
              type="button"
              onClick={() => router.push(link.resolvedHref)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
            >
              {link.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => router.push(primary.resolvedHref)}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white transition-colors"
          >
            {primary.label}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}
