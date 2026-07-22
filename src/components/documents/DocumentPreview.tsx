'use client';

import React, { useMemo } from 'react';
import { renderDocumentHtml, type RenderDocumentInput } from '@/lib/documents/renderDocument';

type DocumentPreviewProps = {
  input: RenderDocumentInput;
  className?: string;
};

/** Live HTML preview of a themed quote, invoice, or proposal. */
export function DocumentPreview({ input, className }: DocumentPreviewProps) {
  const html = useMemo(() => renderDocumentHtml(input), [input]);

  return (
    <div className={className}>
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
        Preview
      </p>
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-white shadow-inner">
        <iframe
          title="Document preview"
          srcDoc={html}
          className="w-full h-[min(420px,55vh)] bg-white"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
