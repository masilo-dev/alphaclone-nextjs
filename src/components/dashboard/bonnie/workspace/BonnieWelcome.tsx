'use client';

import React from 'react';
import {
  AlertTriangle,
  CalendarDays,
  FileText,
  Megaphone,
  Receipt,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';

export type BonnieSuggestion = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  icon?: 'crm' | 'invoice' | 'social' | 'calendar' | 'risk' | 'workflow' | 'docs';
};

const ICONS = {
  crm: Users,
  invoice: Receipt,
  social: Megaphone,
  calendar: CalendarDays,
  risk: AlertTriangle,
  workflow: Target,
  docs: FileText,
};

type Props = {
  workspaceName?: string;
  suggestions: BonnieSuggestion[];
  onSelect: (prompt: string) => void;
};

export default function BonnieWelcome({ workspaceName, suggestions, onSelect }: Props) {
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col justify-center px-4 py-6 sm:px-6">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm">
          <Sparkles className="h-4 w-4" aria-hidden />
        </div>
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-teal-700 dark:text-teal-300">
          {workspaceName || 'Your workspace'} · Bonnie AI
        </p>
        <h1 className="mt-1.5 text-balance text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
          What should Bonnie execute?
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-pretty text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          Post socially, chase invoices, find leads, send outreach, and run accounting actions —
          Bonnie executes tools in this workspace.
        </p>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {suggestions.map((item) => {
          const Icon = ICONS[item.icon || 'workflow'] || Target;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.prompt)}
              className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-teal-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-teal-700"
            >
              <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-50">{item.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                {item.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
