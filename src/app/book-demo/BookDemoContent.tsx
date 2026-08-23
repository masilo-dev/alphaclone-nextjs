'use client';

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { ArrowLeft, Calendar, CheckCircle2, Clock, ExternalLink, AlertCircle } from 'lucide-react';
import { getBookingConfig, isValidBookingUrl } from '@/lib/marketing/booking';
import { TRIAL_HREF } from '@/lib/marketing/cta';

export default function BookDemoContent() {
  const widgetRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);
  const [iframeFailed, setIframeFailed] = useState(false);

  const config = getBookingConfig('demo');
  const bookingUrl = isValidBookingUrl(config.calendlyUrl)
    ? config.calendlyUrl
    : 'https://calendly.com/bonniealphaclonesystems/30min';

  useEffect(() => {
    if (!bookingUrl) return;

    setWidgetReady(false);
    setIframeFailed(false);

    const win = window as any;

    const initWidget = () => {
      if (!widgetRef.current) return;
      if (win.Calendly && typeof win.Calendly.initInlineWidget === 'function') {
        try {
          widgetRef.current.innerHTML = '';
          win.Calendly.initInlineWidget({
            url: bookingUrl,
            parentElement: widgetRef.current,
            prefill: {},
            utm: { utmSource: 'book-demo-page' },
          });
          setWidgetReady(true);
        } catch (err) {
          console.error('[book-demo] Failed to initialize Calendly widget:', err);
          setIframeFailed(true);
        }
      } else {
        setWidgetReady(true);
      }
    };

    const initTimeout = setTimeout(initWidget, 300);
    const failSafeTimeout = setTimeout(() => {
      if (!widgetReady) setIframeFailed(true);
    }, 7000);

    return () => {
      clearTimeout(initTimeout);
      clearTimeout(failSafeTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptLoaded, bookingUrl]);

  return (
    <div className="marketing-theme min-h-screen text-white">
      <Script
        src="https://assets.calendly.com/assets/external/widget.js"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />

      {/* Page Header */}
      <section className="pt-28 pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center text-teal-400 hover:text-teal-300 transition-colors mb-8 text-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to AlphaClone
          </Link>

          <div className="grid md:grid-cols-2 gap-10 items-start mb-12">
            {/* Left: Text */}
            <div>
              <p className="text-xs font-semibold text-teal-400 uppercase tracking-widest mb-3">Free Live Walkthrough</p>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight mb-4">
                See AlphaClone in <span className="text-teal-400">action.</span>
              </h1>
              <p className="text-lg text-slate-400 mb-8 leading-relaxed">
                Book a free 30-minute call. We will walk you through how AlphaClone replaces your CRM, invoicing, contracts, and project management stack.
              </p>

              <ul className="space-y-3 mb-8">
                {[
                  { icon: Clock, text: '30 minutes — no pressure, no pitch decks' },
                  { icon: CheckCircle2, text: 'Live demo tailored to your business type' },
                  { icon: CheckCircle2, text: 'Q&A with the AlphaClone founding team' },
                  { icon: CheckCircle2, text: 'Get a 14-day free trial link during the call' },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3 text-sm text-slate-300">
                    <Icon className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
                    {text}
                  </li>
                ))}
              </ul>

              <div className="p-4 bg-slate-900/60 border border-slate-700/50 rounded-xl text-sm">
                <p className="text-slate-400">
                  Prefer to explore first?{' '}
                  <Link href={TRIAL_HREF} className="text-teal-400 hover:text-teal-300 font-semibold transition-colors">
                    Start your free trial →
                  </Link>
                </p>
              </div>
            </div>

            {/* Right: Stats/badges */}
            <div className="hidden md:grid grid-cols-2 gap-4">
              {[
                { label: 'Starting from', value: '$15/mo', sub: 'No hidden fees' },
                { label: 'Tools replaced', value: '5–8', sub: 'Per business' },
                { label: 'Setup time', value: '< 1 day', sub: 'Full onboarding' },
                { label: 'Free trial', value: '14 days', sub: 'No card required' },
              ].map(({ label, value, sub }) => (
                <div
                  key={label}
                  className="p-5 bg-slate-900/60 border border-slate-700/50 rounded-xl text-center"
                >
                  <p className="text-2xl font-black text-white mb-1">{value}</p>
                  <p className="text-xs font-semibold text-teal-400 mb-0.5">{label}</p>
                  <p className="text-xs text-slate-500">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Calendly Embed */}
      <section className="px-4 pb-24">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-400" />
              <h2 className="text-base font-bold text-white">Choose a date &amp; time</h2>
            </div>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors font-medium"
            >
              Open in new tab
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="relative min-h-[680px] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            {/* Loading overlay */}
            {!widgetReady && !iframeFailed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900 z-10">
                <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-400">Loading schedule…</p>
              </div>
            )}

            {iframeFailed ? (
              <div className="flex flex-col items-center justify-center min-h-[500px] p-8 text-center">
                <AlertCircle className="w-12 h-12 text-amber-400 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Calendar unavailable here</h3>
                <p className="text-slate-400 max-w-md mb-6 leading-relaxed text-sm">
                  Your browser or privacy settings prevented loading the embedded calendar. Open the booking page directly using the button below.
                </p>
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-base transition-colors shadow-lg"
                >
                  <Calendar className="w-5 h-5" />
                  Book Your Demo
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ) : (
              <div
                ref={widgetRef}
                className="w-full"
                style={{ minHeight: '680px', minWidth: '280px' }}
              />
            )}
          </div>

          <p className="text-center text-xs text-slate-500 mt-4">
            Scheduling powered by Calendly. All times are in your local timezone.
          </p>
        </div>
      </section>
    </div>
  );
}
