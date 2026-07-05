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
      className={`rounded-2xl border border-white/5 bg-slate-900/55 px-3 py-2.5 ${className}`}
      aria-label="Workflow guidance"
    >
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
        <div className="flex-1 min-w-0">
          <p className="inline-flex h-5 items-center rounded-full border border-white/5 bg-slate-950/70 px-2 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">
            Finish the job
          </p>
          <p className="mt-1 text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400 line-clamp-2">
            {playbook[0]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {quickLinks.map((link) => (
            <button
              key={link.resolvedHref + link.label}
              type="button"
              onClick={() => router.push(link.resolvedHref)}
              className="inline-flex h-8 items-center rounded-full border border-slate-700 bg-slate-950/40 px-2.5 text-[11px] font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
            >
              {link.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => router.push(primary.resolvedHref)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-teal-600 px-2.5 text-[11px] font-bold text-white transition-colors hover:bg-teal-500"
          >
            {primary.label}
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </section>
  );
}
