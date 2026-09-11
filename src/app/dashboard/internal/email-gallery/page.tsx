'use client';

import { useEffect, useMemo, useState } from 'react';

type GallerySample = {
  id: string;
  label: string;
  description: string;
  html: string;
  text: string;
};

type GalleryResponse = {
  logoUrl: string;
  logoValidation: { ok: boolean; url: string; error?: string };
  mode: string;
  samples: GallerySample[];
};

const MODES = [
  { id: 'default', label: 'Desktop' },
  { id: 'long', label: 'Long content' },
  { id: 'no-images', label: 'Images blocked' },
] as const;

export default function EmailTemplateGalleryPage() {
  const [mode, setMode] = useState<(typeof MODES)[number]['id']>('default');
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [data, setData] = useState<GalleryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>('transactional');

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetch(`/api/email/gallery?mode=${mode}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json() as Promise<GalleryResponse>;
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          if (!json.samples.some((s) => s.id === selectedId)) {
            setSelectedId(json.samples[0]?.id || 'transactional');
          }
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load gallery');
      });
    return () => {
      cancelled = true;
    };
  }, [mode, selectedId]);

  const selected = useMemo(
    () => data?.samples.find((sample) => sample.id === selectedId) || data?.samples[0],
    [data, selectedId],
  );

  const frameWidth = viewport === 'mobile' ? 390 : 760;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Email template gallery</h1>
          <p className="mt-1 text-sm text-slate-600">
            Internal preview for AlphaClone branded email layouts. Authentication required.
          </p>
          {data && (
            <p className="mt-2 text-xs text-slate-500">
              Logo: {data.logoUrl} · Validation: {data.logoValidation.ok ? 'OK' : data.logoValidation.error}
            </p>
          )}
        </header>

        <div className="mb-4 flex flex-wrap gap-2">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={`rounded-md px-3 py-1.5 text-sm ${mode === item.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setViewport('desktop')}
            className={`rounded-md px-3 py-1.5 text-sm ${viewport === 'desktop' ? 'bg-teal-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}
          >
            Desktop width
          </button>
          <button
            type="button"
            onClick={() => setViewport('mobile')}
            className={`rounded-md px-3 py-1.5 text-sm ${viewport === 'mobile' ? 'bg-teal-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}
          >
            Mobile width
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200">
            <ul className="space-y-1">
              {(data?.samples || []).map((sample) => (
                <li key={sample.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(sample.id)}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm ${selectedId === sample.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'}`}
                  >
                    <div className="font-medium">{sample.label}</div>
                    <div className={`text-xs ${selectedId === sample.id ? 'text-slate-200' : 'text-slate-500'}`}>
                      {sample.description}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-medium">{selected?.label || 'Preview'}</h2>
              <span className="text-xs text-slate-500">{frameWidth}px frame</span>
            </div>
            <div className="overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3">
              <div style={{ width: frameWidth, margin: '0 auto' }}>
                {selected?.html ? (
                  <iframe
                    title={`Email preview ${selected.id}`}
                    srcDoc={selected.html}
                    className="h-[920px] w-full border-0 bg-white"
                  />
                ) : (
                  <div className="py-16 text-center text-sm text-slate-500">Loading preview…</div>
                )}
              </div>
            </div>
            {selected?.text && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-700">Plain-text version</summary>
                <pre className="mt-2 overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700">{selected.text}</pre>
              </details>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
