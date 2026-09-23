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
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeBookingModal();
      }}
    >
      <div className="relative w-full max-w-4xl h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="booking-modal-title" className="text-base sm:text-lg font-bold text-slate-950 font-marketing-heading tracking-tight leading-tight truncate">
                {title}
              </h2>
              <p className="type-card-description text-slate-500 line-clamp-1">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 type-caption text-blue-600 hover:text-blue-700 transition-colors font-medium"
            >
              Open in new tab
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={closeBookingModal}
              aria-label="Close modal"
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-0 sm:p-4 bg-white text-slate-800 min-h-0">
          <div className="hidden sm:flex flex-wrap items-center justify-between gap-3 mb-3 px-4 pt-4 sm:px-0 sm:pt-0 type-caption text-slate-500">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                Choose a time
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                No sales pressure
              </span>
            </div>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
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

        <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between type-caption text-slate-500 shrink-0">
          <span>AlphaClone booking</span>
          <span className="hidden sm:inline">Press ESC to close</span>
        </div>
      </div>
    </div>
  );
}
