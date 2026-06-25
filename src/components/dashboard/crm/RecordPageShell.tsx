'use client';

import React from 'react';
import { Edit, MoreHorizontal, LucideIcon } from 'lucide-react';

interface RecordBadge {
  label: string;
  className?: string;
}

interface RecordTab {
  id: string;
  label: string;
}

interface RecordPageShellProps {
  icon?: LucideIcon;
  name: string;
  subtitle?: string;
  badges?: RecordBadge[];
  tabs: RecordTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  onEdit?: () => void;
  children: React.ReactNode;
}

export default function RecordPageShell({
  icon: Icon,
  name,
  subtitle,
  badges = [],
  tabs,
  activeTab,
  onTabChange,
  onEdit,
  children,
}: RecordPageShellProps) {
  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="flex-shrink-0 px-4 py-4 border-b border-white/5 bg-slate-900/50">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {Icon && (
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/20">
                  <Icon className="h-4 w-4 text-teal-400" />
                </div>
              )}
              <h1 className="text-lg font-bold text-white truncate">{name}</h1>
            </div>
            {subtitle && <p className="text-xs text-slate-400 mt-1 truncate">{subtitle}</p>}
            {badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {badges.map((b) => (
                  <span
                    key={b.label}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${b.className ?? 'bg-teal-500/10 text-teal-400 border-teal-500/20'}`}
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {onEdit && (
              <button
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-800 border border-white/5 text-xs font-bold text-slate-300 hover:text-white hover:border-teal-500/30 transition-colors"
              >
                <Edit className="w-3.5 h-3.5" />
                Edit
              </button>
            )}
            <button className="p-2 rounded-lg bg-slate-800 border border-white/5 text-slate-400 hover:text-white transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex gap-1 mt-4 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-shrink-0 px-3 py-2 text-xs font-bold rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
