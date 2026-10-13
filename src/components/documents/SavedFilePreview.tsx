'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

/** Canvas PDF rendering also works on phones without a native PDF iframe viewer. */
export function SavedFilePreview({ url, mimeType, title }: { url: string; mimeType?: string; title: string }) {
  const { t } = useLanguage();
  const pages = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [html, setHtml] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const isPdf = mimeType === 'application/pdf' || /\.pdf(?:[?#]|$)/i.test(url);
  useEffect(() => {
    const controller = new AbortController();
    let task: any;
    setState('loading');
    setHtml(null);
    setText(null);
    pages.current?.replaceChildren();
    (async () => {
      const response = await fetch(url, { credentials: 'same-origin', signal: controller.signal });
      if (!response.ok) throw new Error('File unavailable');
      if (!isPdf) {
        if (mimeType?.includes('wordprocessingml') || /\.docx(?:[?#]|$)/i.test(url)) {
          const mammoth = await import('mammoth');
          const result = await mammoth.convertToHtml({ arrayBuffer: await response.arrayBuffer() });
          const { default: DOMPurify } = await import('dompurify');
          if (!controller.signal.aborted) setHtml(DOMPurify.sanitize(result.value));
        } else if (mimeType?.startsWith('text/') || /\.(?:txt|csv|md)(?:[?#]|$)/i.test(url)) {
          const content = await response.text();
          if (!controller.signal.aborted) setText(content);
        }
        if (!controller.signal.aborted) setState('ready');
        return;
      }
      const data = await response.arrayBuffer();
      if (controller.signal.aborted) return;
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
      task = pdfjs.getDocument({ data });
      const pdf = await task.promise;
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        if (controller.signal.aborted || !pages.current) return;
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: Math.min(2, window.devicePixelRatio || 1) });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        canvas.setAttribute('aria-label', `${title} — ${pageNumber}`);
        pages.current.append(canvas);
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
        if (pageNumber === 1 && !controller.signal.aborted) setState('ready');
      }
    })().catch(() => { if (!controller.signal.aborted) setState('error'); });
    return () => { controller.abort(); void task?.destroy(); };
  }, [url, mimeType, isPdf, attempt, title]);
  return <div className="max-h-[75dvh] overflow-auto rounded-xl border border-[var(--ws-border)]">
    {state === 'loading' && <p className="p-4" role="status">{t('Loading document…')}</p>}
    {state === 'error' && <div className="p-4" role="alert"><p>{t('Document could not be loaded')}</p><button onClick={() => setAttempt(n => n + 1)} className="min-h-11 px-4">{t('Retry document')}</button><a href={url} target="_blank" rel="noreferrer">{t('Download')}</a></div>}
    {html && <div className="break-words bg-white p-4 text-slate-900 [&_img]:max-w-full [&_table]:block [&_table]:overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />}
    {text !== null && <pre className="whitespace-pre-wrap break-words bg-white p-4 text-slate-900">{text}</pre>}
    {!isPdf && state === 'ready' && !html && text === null && (
      mimeType?.startsWith('image/') ? <img src={url} alt={title} className="h-auto w-full bg-white" /> :
      <div className="p-4"><p>{t('Preview unavailable')}</p><a href={url} target="_blank" rel="noreferrer">{t('Download')}</a></div>
    )}
    <div ref={pages} className="space-y-3 bg-white" />
  </div>;
}
