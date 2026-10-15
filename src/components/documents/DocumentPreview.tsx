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
  const syncHeight = useCallback(() => {
    if (!expandToContent) return;
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    const body = doc.body;
    const docEl = doc.documentElement;
    const content = doc.querySelector('.content');
    const contentHeight = content ? Math.ceil(content.getBoundingClientRect().height) : 0;
    const measuredHeight = Math.max(
      contentHeight,
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0,
      docEl ? docEl.scrollHeight : 0,
      docEl ? docEl.offsetHeight : 0
    );
    if (measuredHeight > 0) {
      setHeight(measuredHeight + 4);
    }
  }, [expandToContent]);

  const onLoad = useCallback(() => {
    observer.current?.disconnect();
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    // The frame stays script-free. Failed media never displays a broken-image icon.
    doc.querySelectorAll('img').forEach(img => {
      const hide = () => { img.hidden = true; };
      img.addEventListener('error', hide, { once: true });
      img.addEventListener('load', syncHeight, { once: true });
      if (img.complete && !img.naturalWidth) hide();
    });
    if (!expandToContent) return;
    syncHeight();
    observer.current = new ResizeObserver(syncHeight);
    if (doc.body) observer.current.observe(doc.body);
    const content = doc.querySelector('.content');
    if (content) observer.current.observe(content);
  }, [expandToContent, syncHeight]);

  useEffect(() => {
    if (!expandToContent) return;
    syncHeight();
    const t1 = setTimeout(syncHeight, 50);
    const t2 = setTimeout(syncHeight, 200);
    const t3 = setTimeout(syncHeight, 600);
    window.addEventListener('resize', syncHeight);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', syncHeight);
      observer.current?.disconnect();
    };
  }, [html, expandToContent, syncHeight]);

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
      <div className={`rounded-xl border border-[var(--ws-border)] bg-white shadow-inner ${expandToContent ? 'overflow-visible' : 'overflow-hidden'}`}>
        <iframe
          ref={frame}
          onLoad={onLoad}
          title="Document preview"
          srcDoc={html}
          scrolling={expandToContent ? 'no' : 'auto'}
          className={expandToContent ? 'block w-full bg-white border-0' : 'w-full h-[min(520px,65vh)] bg-white'}
          style={expandToContent ? { height: `${height}px`, minHeight: '100%' } : undefined}
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
