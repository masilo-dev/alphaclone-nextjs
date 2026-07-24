'use client';

import React from 'react';
import { Link2, Shield, X } from 'lucide-react';

export type BonnieContextItem = {
  id: string;
  kind:
    | 'task'
    | 'customer'
    | 'invoice'
    | 'project'
    | 'document'
    | 'workflow'
    | 'app'
    | 'permission'
    | 'memory'
    | 'approval';
  label: string;
  detail?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  items: BonnieContextItem[];
  onRemove: (id: string) => void;
  pendingApprovals?: number;
  connectionStatus?: 'connected' | 'degraded' | 'offline';
};

export default function BonnieContextPanel({
  open,
  onClose,
  items,
  onRemove,
  pendingApprovals = 0,
  connectionStatus = 'connected',
}: Props) {
  if (!open) return null;

  return (
    <aside
      className="flex h-full w-full flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 md:w-[300px]"
      aria-label="Bonnie context"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Context</h2>
          <p className="text-[11px] text-slate-500">What Bonnie is working with</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 dark:hover:bg-slate-900"
          aria-label="Close context panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 overflow-y-auto p-4">
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Connection
          </p>
          <p className="mt-1 text-sm font-medium capitalize text-slate-800 dark:text-slate-100">
            {connectionStatus}
          </p>
          {pendingApprovals > 0 && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              {pendingApprovals} pending approval{pendingApprovals === 1 ? '' : 's'}
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Active items
          </p>
          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500 dark:border-slate-800">
              No context attached. Mention records with @customer, @invoice, @project, and more.
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800"
                >
                  <span className="mt-0.5 text-teal-600">
                    {item.kind === 'permission' ? (
                      <Shield className="h-3.5 w-3.5" />
                    ) : (
                      <Link2 className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {item.label}
                    </p>
                    {item.detail && (
                      <p className="truncate text-[11px] text-slate-500">{item.detail}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900"
                    aria-label={`Remove ${item.label}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
