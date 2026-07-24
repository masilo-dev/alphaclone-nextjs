'use client';

import React from 'react';
import { CheckCircle2, Loader2, XCircle, Wrench } from 'lucide-react';
import type { BonnieToolStep } from '../BonnieChatPanel';

function friendlyToolLabel(tool: string): string {
  const map: Record<string, string> = {
    get_leads: 'Checking your CRM leads',
    get_clients: 'Reviewing customers',
    get_invoices: 'Looking up invoices',
    create_social_post: 'Preparing a social post',
    send_transactional_email: 'Drafting an email',
    start_invoice_lifecycle: 'Preparing invoice lifecycle',
  };
  if (map[tool]) return map[tool];
  return `Working with ${tool.replace(/_/g, ' ')}`;
}

type Props = {
  tools: BonnieToolStep[];
};

export default function BonnieToolActivityCard({ tools }: Props) {
  if (!tools?.length) return null;

  return (
    <div className="mt-3 space-y-2">
      {tools.map((tool, index) => {
        const pending = tool.approvalRequired && !tool.success;
        const failed = tool.success === false && !tool.approvalRequired;
        return (
          <details
            key={`${tool.tool}-${index}`}
            className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 open:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:open:bg-slate-900"
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200">
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
              ) : failed ? (
                <XCircle className="h-4 w-4 text-rose-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-teal-600" />
              )}
              <span className="min-w-0 flex-1 truncate">
                {pending
                  ? `Bonnie needs approval: ${friendlyToolLabel(tool.tool)}`
                  : failed
                    ? `Could not finish: ${friendlyToolLabel(tool.tool)}`
                    : friendlyToolLabel(tool.tool)}
              </span>
              <Wrench className="h-3.5 w-3.5 text-slate-400 opacity-0 transition group-open:opacity-100" />
            </summary>
            <div className="space-y-1 border-t border-slate-200 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <p>
                <span className="font-semibold">Tool:</span> {tool.tool}
              </p>
              {tool.riskClass && (
                <p>
                  <span className="font-semibold">Risk:</span> {tool.riskClass}
                </p>
              )}
              <p>
                <span className="font-semibold">Status:</span>{' '}
                {pending ? 'Waiting for approval' : failed ? 'Failed' : 'Completed'}
              </p>
              {tool.summary && (
                <p>
                  <span className="font-semibold">Result:</span> {tool.summary}
                </p>
              )}
              {tool.preview?.target && (
                <p>
                  <span className="font-semibold">Target:</span> {tool.preview.target}
                </p>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
