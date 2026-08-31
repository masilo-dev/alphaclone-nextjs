'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Calendar, ExternalLink, AlertCircle } from 'lucide-react';
import { getCalApi } from '@calcom/embed-react';
import {
  CAL_EMBED_UI,
  getCalComLink,
  resolvePlatformBookingUrl,
} from '@/lib/marketing/booking';

const Cal = dynamic(() => import('@calcom/embed-react'), { ssr: false });

const EMBED_NAMESPACE = 'alphaclone-booking';
const READY_TIMEOUT_MS = 12_000;

type CalComEmbedProps = {
  bookingUrl?: string;
  title?: string;
  className?: string;
  variant?: 'page' | 'modal';
};

export default function CalComEmbed({
  bookingUrl,
  title = 'Book a demo with AlphaClone Systems',
  className = '',
  variant = 'page',
}: CalComEmbedProps) {
  const resolvedUrl = resolvePlatformBookingUrl(bookingUrl);
  const calLink = getCalComLink(resolvedUrl);

  const [isReady, setIsReady] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    setIsReady(false);
    setHasFailed(false);

    const timeout = window.setTimeout(() => setIsReady(true), READY_TIMEOUT_MS);

    (async () => {
      try {
        const cal = await getCalApi({ namespace: EMBED_NAMESPACE });
        cal('ui', CAL_EMBED_UI);
        setIsReady(true);
      } catch {
        setHasFailed(true);
      }
    })();

    return () => window.clearTimeout(timeout);
  }, [calLink]);

  const shellClass = [
    'cal-embed-shell',
    variant === 'modal' ? 'cal-embed-shell--modal' : 'cal-embed-shell--page',
    isReady ? 'cal-embed-shell--ready' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (hasFailed) {
    return (
      <div className={shellClass}>
        <div className="cal-embed-fallback">
          <AlertCircle className="w-11 h-11 text-amber-400 mb-3" aria-hidden="true" />
          <h3 className="text-lg font-bold text-white mb-2">Continue booking</h3>
          <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
            The scheduler could not load here. Pick a time on our booking page instead.
          </p>
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-sm transition-colors"
          >
            <Calendar className="w-4 h-4" aria-hidden="true" />
            Choose a time
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      {!isReady && (
        <div className="cal-embed-loading" aria-live="polite">
          <div className="cal-embed-skeleton" aria-hidden="true">
            <div className="cal-embed-skeleton__header" />
            <div className="cal-embed-skeleton__grid">
              {Array.from({ length: 12 }).map((_, index) => (
                <div key={index} className="cal-embed-skeleton__cell" />
              ))}
            </div>
          </div>
          <p className="text-sm text-slate-400">Opening scheduler…</p>
        </div>
      )}

      <div className={`cal-embed-host ${isReady ? 'cal-embed-host--visible' : ''}`}>
        <Cal
          namespace={EMBED_NAMESPACE}
          calLink={calLink}
          config={{
            theme: 'dark',
            layout: 'month_view',
            'ui.autoscroll': 'false',
            iframeAttrs: {
              title,
            },
          }}
          style={{
            width: '100%',
            height: '100%',
            minHeight: variant === 'modal' ? '420px' : '520px',
            overflow: 'auto',
          }}
        />
      </div>
    </div>
  );
}
