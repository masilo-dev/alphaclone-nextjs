'use client';

import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { checkDocumentQuality, type DocumentQualityInput } from '@/lib/documents/documentQualityCheck';
import { HUMAN_LABELS } from '@/lib/copy/humanLabels';

interface DocumentQualityPanelProps {
  input: DocumentQualityInput;
  className?: string;
}

export function DocumentQualityPanel({ input, className }: DocumentQualityPanelProps) {
  const result = useMemo(() => checkDocumentQuality(input), [input]);

  return (
    <div className={`ac-workspace-panel p-3 ${className || ''}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ws-text-tertiary)]">
          {HUMAN_LABELS.documentQualityScore}
        </span>
        <span
          className={`text-[13px] font-bold ${
            result.score >= 80 ? 'text-emerald-400' : result.score >= 50 ? 'text-amber-400' : 'text-red-400'
          }`}
        >
          {result.score}/100
        </span>
      </div>
      {result.canSend ? (
        <p className="text-[12px] text-emerald-400 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          Ready to send
        </p>
      ) : (
        <p className="text-[12px] text-amber-400 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
          Fix critical issues before sending
        </p>
      )}
      {result.issues.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {result.issues.map((issue) => (
            <li key={issue.id} className="text-[11px] text-[var(--ws-text-secondary)] flex items-start gap-1.5">
              {issue.severity === 'critical' ? (
                <AlertTriangle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <ShieldCheck className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              )}
              {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default DocumentQualityPanel;
