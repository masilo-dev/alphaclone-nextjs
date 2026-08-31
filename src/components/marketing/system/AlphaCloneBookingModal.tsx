'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Calendar, ExternalLink, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import Script from 'next/script';
import { useBookingModal } from '@/contexts/BookingModalContext';
import {
  getBookingEmbedUrl,
  isCalComBookingUrl,
  isValidBookingUrl,
} from '@/lib/marketing/booking';

export default function AlphaCloneBookingModal() {
  const {
    isOpen,
    activeConfig,
    customTitle,
    customSubtitle,
    customUrl,
    closeBookingModal,
  } = useBookingModal();

  const widgetRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);
  const [iframeFailed, setIframeFailed] = useState(false);

  const title = customTitle || activeConfig.title;
  const subtitle = customSubtitle || activeConfig.subtitle;
  const rawUrl = customUrl || activeConfig.calendlyUrl;
  const validUrl = isValidBookingUrl(rawUrl) ? rawUrl : activeConfig.calendlyUrl;
  const embedUrl = getBookingEmbedUrl(validUrl);
  const usesCalCom = isCalComBookingUrl(validUrl);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeBookingModal();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeBookingModal]);

  useEffect(() => {
    if (!isOpen || !validUrl || usesCalCom) return;

    setWidgetReady(false);
    setIframeFailed(false);

    const win = window as Window & {
      Calendly?: { initInlineWidget: (options: Record<string, unknown>) => void };
    };

    const initWidget = () => {
      if (!widgetRef.current) return;
      if (win.Calendly && typeof win.Calendly.initInlineWidget === 'function') {
        try {
          widgetRef.current.innerHTML = '';
          win.Calendly.initInlineWidget({
            url: validUrl,
            parentElement: widgetRef.current,
            prefill: {},
            utm: {},
          });
          setWidgetReady(true);
        } catch (err) {
          console.error('Failed to initialize Calendly inline widget:', err);
          setIframeFailed(true);
        }
      } else {
        setWidgetReady(true);
      }
    };

    const timeout = setTimeout(initWidget, 200);
    const failTimeout = setTimeout(() => {
      if (!widgetReady) {
        setIframeFailed(true);
      }
    }, 6000);

    return () => {
      clearTimeout(timeout);
      clearTimeout(failTimeout);
    };
  }, [isOpen, scriptLoaded, validUrl, usesCalCom, widgetReady]);

  useEffect(() => {
    if (isOpen && usesCalCom) {
      setWidgetReady(false);
      setIframeFailed(false);
    }
  }, [isOpen, usesCalCom, validUrl]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-0 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeBookingModal();
      }}
    >
      {!usesCalCom && (
        <Script
          src="https://assets.calendly.com/assets/external/widget.js"
          strategy="afterInteractive"
          onLoad={() => setScriptLoaded(true)}
        />
      )}

      <div className="relative w-full max-w-4xl min-h-screen sm:min-h-0 sm:max-h-[90vh] bg-slate-900 border border-slate-800 rounded-none sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 id="booking-modal-title" className="text-lg font-bold text-white tracking-tight leading-tight">
                {title}
              </h2>
              <p className="text-xs text-slate-400 line-clamp-1">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={validUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors font-medium"
            >
              Open in new tab
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={closeBookingModal}
              aria-label="Close modal"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-900 text-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 bg-slate-950/40 border border-slate-800 rounded-xl text-xs text-slate-400">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-300">
                <Clock className="w-3.5 h-3.5 text-teal-400" />
                30 minutes
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                No sales pressure
              </span>
            </div>
            <a
              href={validUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="md:hidden inline-flex items-center gap-1 text-teal-400 hover:text-teal-300 font-medium"
            >
              Open in tab <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="relative min-h-[580px] w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
            {!widgetReady && !iframeFailed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 z-10 text-slate-400">
                <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-medium">Loading schedule calendar…</p>
              </div>
            )}

            {iframeFailed ? (
              <div className="p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
                <AlertCircle className="w-10 h-10 text-amber-400 mb-3" />
                <h3 className="text-base font-bold text-white mb-2">Calendar Embed Unavailable</h3>
                <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
                  Your browser or privacy extensions prevented loading the embedded calendar widget. You can open the booking page directly in a new tab.
                </p>
                <a
                  href={validUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-sm transition-colors shadow-lg"
                >
                  <Calendar className="w-4 h-4" />
                  Open Booking Page
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ) : usesCalCom ? (
              <iframe
                title={title}
                src={embedUrl}
                className="w-full border-0 bg-white"
                style={{ minHeight: '620px', height: '620px' }}
                onLoad={() => setWidgetReady(true)}
                onError={() => setIframeFailed(true)}
              />
            ) : (
              <div
                ref={widgetRef}
                className="w-full h-[620px]"
                style={{ minWidth: '280px' }}
              />
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-500">
          <span>AlphaClone Systems — Direct Booking</span>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>
  );
}
