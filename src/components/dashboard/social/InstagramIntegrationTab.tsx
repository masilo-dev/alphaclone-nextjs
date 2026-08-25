'use client';

import React from 'react';
import { Instagram, Clock, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { WORKSPACE } from '@/constants/design';

/**
 * Instagram self-serve connection is not launch-ready.
 * DMs for connected Meta accounts remain available via Facebook Inbox.
 */
export default function InstagramIntegrationTab() {
  return (
    <div className="relative flex flex-col min-h-0 ac-scroll-full ac-enterprise-module max-w-4xl mx-auto p-4 ac-safe-bottom lg:pb-4">
      <div className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-8`}>
        <div className="flex items-start gap-4 mb-6">
          <div className="w-14 h-14 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
            <Instagram className="w-7 h-7 text-pink-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Instagram Business</h1>
            <p className="text-slate-400 text-sm mt-1">
              Direct Instagram connection is coming soon. Use Facebook Page + Instagram inbox today.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm flex items-start gap-3 mb-6">
          <Clock className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white">Coming soon</p>
            <p className="mt-1 text-amber-100/90">
              Standalone Instagram publishing and inbox controls are being finalized. Connect is disabled until launch QA completes.
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/business/facebook"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm transition-colors"
        >
          Open Facebook &amp; Instagram Inbox
          <ExternalLink className="w-3.5 h-3.5 opacity-70" />
        </Link>
      </div>
    </div>
  );
}
