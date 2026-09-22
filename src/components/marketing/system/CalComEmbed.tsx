'use client';

import { useEffect, useId, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from '@/contexts/ThemeContext';
import { Calendar, ExternalLink, AlertCircle } from 'lucide-react';
import { getCalApi } from '@calcom/embed-react';
import {
  CAL_EMBED_UI,
  getCalComLink,
  resolvePlatformBookingUrl,
} from '@/lib/marketing/booking';
import { useLanguage } from '@/contexts/LanguageContext';

const Cal = dynamic(() => import('@calcom/embed-react'), { ssr: false });

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
  const { language } = useLanguage();
  const copy = {
    en: { continue: 'Continue booking', failed: 'The scheduler could not load here. Pick a time on our booking page instead.', retry: 'Retry scheduler', choose: 'Choose a time', loading: 'Opening scheduler…' },
    pl: { continue: 'Kontynuuj rezerwację', failed: 'Kalendarz nie mógł się tutaj załadować. Wybierz termin bezpośrednio na stronie rezerwacji.', retry: 'Spróbuj ponownie', choose: 'Wybierz termin', loading: 'Otwieranie kalendarza…' },
    es: { continue: 'Continuar la reserva', failed: 'El calendario no pudo cargarse aquí. Elige una hora directamente en nuestra página de reservas.', retry: 'Reintentar', choose: 'Elegir una hora', loading: 'Abriendo calendario…' },
  }[language];
  const { isDark } = useTheme();
  const theme = isDark ? 'dark' : 'light';
  const instanceId = useId().replace(/[^a-zA-Z0-9-]/g, '');
  const [attempt, setAttempt] = useState(0);
  const namespace = `alphaclone-booking-${instanceId}-${attempt}-${theme}`;
  const resolvedUrl = resolvePlatformBookingUrl(bookingUrl);
  const calLink = getCalComLink(resolvedUrl);

  const [isReady, setIsReady] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    setIsReady(false);
    setHasFailed(false);

    let disposed = false;
    let api: Awaited<ReturnType<typeof getCalApi>> | undefined;
    const onReady = () => {
      if (disposed) return;
      window.clearTimeout(timeout);
      setHasFailed(false);
      setIsReady(true);
    };
    const onFailed = () => {
      if (!disposed) setHasFailed(true);
    };
    const timeout = window.setTimeout(onFailed, READY_TIMEOUT_MS);

    void (async () => {
      try {
        api = await getCalApi({ namespace });
        if (disposed) return;
        api('on', { action: 'linkReady', callback: onReady });
        api('on', { action: 'linkFailed', callback: onFailed });
        api('ui', { ...CAL_EMBED_UI, theme });
      } catch {
        onFailed();
      }
    })();

    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      api?.('off', { action: 'linkReady', callback: onReady });
      api?.('off', { action: 'linkFailed', callback: onFailed });
    };
  }, [calLink, namespace, theme]);

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
          <h3 className="text-lg font-bold text-white mb-2">{copy.continue}</h3>
          <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
            {copy.failed}
          </p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="mb-4 rounded-xl border border-teal-500 px-6 py-3 text-teal-300"
          >
            {copy.retry}
          </button>
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-sm transition-colors"
          >
            <Calendar className="w-4 h-4" aria-hidden="true" />
            {copy.choose}
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
          <p className="text-sm text-slate-400">{copy.loading}</p>
        </div>
      )}

      <div className={`cal-embed-host ${isReady ? 'cal-embed-host--visible' : ''}`}>
        <Cal
          key={`${namespace}-${calLink}`}
          namespace={namespace}
          calLink={calLink}
          config={{
            theme,
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
