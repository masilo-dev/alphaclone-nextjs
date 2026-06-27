'use client';

import React, { useState } from 'react';
import { Check, Pencil, ShieldAlert, X } from 'lucide-react';

export type BonnieApprovalCardProps = {
  approvalId: string;
  tool: string;
  riskClass?: string;
  summary?: string;
  preview?: { target?: string; draft?: string };
  onApprove: (editedArgs?: Record<string, unknown>) => Promise<{ success: boolean; message?: string }>;
  onReject: () => Promise<{ success: boolean }>;
  disabled?: boolean;
};

export default function BonnieApprovalCard({
  approvalId,
  tool,
  riskClass,
  summary,
  preview,
  onApprove,
  onReject,
  disabled = false,
}: BonnieApprovalCardProps) {
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(preview?.draft || '');
  const [busy, setBusy] = useState(false);

  const handleApprove = async () => {
    setBusy(true);
    try {
      const editedArgs =
        editing && draftText !== (preview?.draft || '')
          ? { body: draftText, message: draftText, content: draftText, text: draftText }
          : undefined;
      const result = await onApprove(editedArgs);
      if (result.success) setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    try {
      await onReject();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="mb-2 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-400" />
        <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
          Approval required
        </p>
        {riskClass && (
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
            {riskClass}
          </span>
        )}
      </div>

      <p className="text-sm font-medium text-slate-100">
        <span className="font-mono text-teal-300">{tool}</span>
      </p>
      {summary && <p className="mt-1 text-xs text-slate-400">{summary}</p>}
      {preview?.target && (
        <p className="mt-2 text-xs text-slate-300">
          <span className="text-slate-500">Target:</span> {preview.target}
        </p>
      )}

      {(preview?.draft || editing) && (
        <div className="mt-2">
          {editing ? (
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
            />
          ) : preview?.draft ? (
            <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
              {preview.draft}
            </p>
          ) : null}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => void handleApprove()}
          className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          Approve
        </button>
        {preview?.draft && (
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => setEditing((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            {editing ? 'Preview' : 'Edit'}
          </button>
        )}
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => void handleReject()}
          className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>

      <p className="mt-2 text-[10px] text-slate-600 font-mono">ID: {approvalId.slice(0, 8)}…</p>
    </div>
  );
}
