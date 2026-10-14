'use client';

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { renderDocumentHtml, type RenderDocumentInput } from '@/lib/documents/renderDocument';

type DocumentPreviewProps = {
  input: RenderDocumentInput;
  className?: string;
  hideLabel?: boolean;
  expandToContent?: boolean;
};

/** Live HTML preview of a themed quote, invoice, contract, or proposal. */
export function DocumentPreview({ input, className, hideLabel = false, expandToContent = false }: DocumentPreviewProps) {
  const html = useMemo(() => renderDocumentHtml(input), [input]);
  const frame = useRef<HTMLIFrameElement>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const [height, setHeight] = useState(520);
  const onLoad = useCallback(() => {
    observer.current?.disconnect();
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    // The frame stays script-free. Failed media never displays a broken-image icon.
    doc.querySelectorAll('img').forEach(img => {
      const hide = () => { img.hidden = true; };
      img.addEventListener('error', hide, { once: true });
      if (img.complete && !img.naturalWidth) hide();
    });
    if (!expandToContent) return;
    const content = doc.querySelector('.content');
    if (!content) return;
    const resize = () => setHeight(Math.ceil(content.getBoundingClientRect().height) + 2);
    observer.current = new ResizeObserver(resize);
    observer.current.observe(content);
    resize();
  }, [expandToContent]);
  useEffect(() => () => observer.current?.disconnect(), []);

  return (
    <div className={className}>
      {!hideLabel ? (
        <p className="type-caption font-black uppercase tracking-widest text-[var(--ws-text-muted)] mb-2">
          Preview
        </p>
      ) : null}
      {!hideLabel && input.branding?.configurationIssues?.length ? (
        <p role="status" className="mb-2 text-sm text-[var(--ws-text-muted)]">
          Complete your business settings: {input.branding.configurationIssues.join('; ')}.
        </p>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-[var(--ws-border)] bg-white shadow-inner">
        <iframe
          ref={frame}
          onLoad={onLoad}
          title="Document preview"
          srcDoc={html}
          className={expandToContent ? 'block w-full bg-white border-0' : 'w-full h-[min(520px,65vh)] bg-white'}
          style={expandToContent ? { height } : undefined}
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
