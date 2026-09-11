'use client';

import React, { useEffect } from 'react';
import { X, Calendar, ExternalLink, Clock, CheckCircle2 } from 'lucide-react';
import { useBookingModal } from '@/contexts/BookingModalContext';
import CalComEmbed from '@/components/marketing/system/CalComEmbed';
import { resolvePlatformBookingUrl } from '@/lib/marketing/booking';

export default function AlphaCloneBookingModal() {
  const {
    isOpen,
    activeConfig,
    customTitle,
    customSubtitle,
    customUrl,
    closeBookingModal,
  } = useBookingModal();

  const title = customTitle || activeConfig.title;
  const subtitle = customSubtitle || activeConfig.subtitle;
  const bookingUrl = resolvePlatformBookingUrl(customUrl || activeConfig.bookingUrl);

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

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeBookingModal();
      }}
    >
      <div className="relative w-full max-w-4xl h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="booking-modal-title" className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight truncate">
                {title}
              </h2>
              <p className="text-xs text-slate-400 line-clamp-1">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <a
              href={bookingUrl}
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

        <div className="flex-1 overflow-y-auto overscroll-contain p-0 sm:p-4 bg-slate-900 text-slate-200 min-h-0">
          <div className="hidden sm:flex flex-wrap items-center justify-between gap-3 mb-3 px-4 pt-4 sm:px-0 sm:pt-0 text-xs text-slate-400">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-300">
                <Clock className="w-3.5 h-3.5 text-teal-400" />
                Choose a time
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                No sales pressure
              </span>
            </div>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-teal-400 hover:text-teal-300 font-medium"
            >
              Open in tab <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <CalComEmbed
            bookingUrl={bookingUrl}
            title={title}
            variant="modal"
          />
        </div>

        <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <span>AlphaClone booking</span>
          <span className="hidden sm:inline">Press ESC to close</span>
        </div>
      </div>
    </div>
  );
}
