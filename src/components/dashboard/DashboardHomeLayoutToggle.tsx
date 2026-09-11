'use client';

import { LayoutGrid, ListChecks } from 'lucide-react';
import { useWorkspacePreferences } from '@/hooks/useWorkspacePreferences';
import type { DashboardHomeLayout } from '@/types/workspacePreferences';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

const OPTIONS: {
  id: DashboardHomeLayout;
  label: string;
  hint: string;
  icon: typeof LayoutGrid;
}[] = [
  {
    id: 'attention_first',
    label: 'Attention',
    hint: 'What needs you now — alerts and next actions first',
    icon: ListChecks,
  },
  {
    id: 'operating_system',
    label: 'Full OS',
    hint: 'KPIs, charts, modules, and pipeline summary',
    icon: LayoutGrid,
  },
];

interface DashboardHomeLayoutToggleProps {
  className?: string;
}

/** Per-tenant home layout preference — stored in workspace settings, not localStorage. */
export function DashboardHomeLayoutToggle({ className }: DashboardHomeLayoutToggleProps) {
  const { dashboardHomeLayout, saveDashboardHomeLayout, loading } = useWorkspacePreferences();
  const { t } = useLanguage();

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-[8px] border border-[var(--ws-border)] bg-[var(--ws-surface)] p-0.5',
        className,
      )}
      role="group"
      aria-label={t('Dashboard home layout')}
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = dashboardHomeLayout === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={loading}
            title={t(opt.hint)}
            onClick={() => void saveDashboardHomeLayout(opt.id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-[6px] transition-colors',
              active
              ? 'bg-teal-500/15 text-teal-800 dark:bg-teal-500/20 dark:text-teal-100'
              : 'text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)]',
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {t(opt.label)}
          </button>
        );
      })}
    </div>
  );
}
