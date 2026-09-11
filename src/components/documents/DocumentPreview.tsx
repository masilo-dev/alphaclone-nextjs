'use client';

import React, { useMemo } from 'react';
import { renderDocumentHtml, type RenderDocumentInput } from '@/lib/documents/renderDocument';

type DocumentPreviewProps = {
  input: RenderDocumentInput;
  className?: string;
  hideLabel?: boolean;
};

/** Live HTML preview of a themed quote, invoice, contract, or proposal. */
export function DocumentPreview({ input, className, hideLabel = false }: DocumentPreviewProps) {
  const html = useMemo(() => renderDocumentHtml(input), [input]);

  return (
    <div className={className}>
      {!hideLabel ? (
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
          Preview
        </p>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-white shadow-inner">
        <iframe
          title="Document preview"
          srcDoc={html}
          className="w-full h-[min(520px,65vh)] bg-white"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
