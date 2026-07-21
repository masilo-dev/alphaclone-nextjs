'use client';

import { Suspense, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Inbox, Loader2, MessageSquare } from 'lucide-react';
import UnifiedInboxView from './UnifiedInboxView';
import UnifiedInboxTab from './UnifiedInboxTab';
import type { InboxProvider } from '@/types/unifiedInbox';

type UnifiedInboxProps = {
  defaultProvider?: InboxProvider;
  /** Which tab to open first when no URL param is set */
  defaultTab?: 'mailbox' | 'channels';
};

type InboxTab = 'mailbox' | 'channels';

function UnifiedInboxContent({ defaultProvider, defaultTab = 'mailbox' }: UnifiedInboxProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get('tab');

  const activeTab: InboxTab = useMemo(() => {
    if (tabParam === 'channels' || tabParam === 'all') return 'channels';
    if (tabParam === 'mailbox' || tabParam === 'mail') return 'mailbox';
    if (pathname?.includes('unified-inbox')) return defaultTab;
    return 'mailbox';
  }, [tabParam, pathname, defaultTab]);

  const setTab = (tab: InboxTab) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('tab', tab);
    const base = pathname || '/dashboard/mail';
    router.replace(`${base}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <div
        className="flex items-center gap-2 p-1 rounded-xl bg-slate-900/80 border border-white/10 w-full sm:w-fit"
        role="tablist"
        aria-label="Inbox views"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'mailbox'}
          aria-controls="inbox-mailbox-panel"
          id="inbox-tab-mailbox"
          onClick={() => setTab('mailbox')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'mailbox'
              ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Inbox className="w-4 h-4" aria-hidden="true" />
          Mailbox
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'channels'}
          aria-controls="inbox-channels-panel"
          id="inbox-tab-channels"
          onClick={() => setTab('channels')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'channels'
              ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <MessageSquare className="w-4 h-4" aria-hidden="true" />
          All channels
        </button>
      </div>

      <p className="text-[11px] text-slate-500 px-1">
        {activeTab === 'mailbox'
          ? 'Read and send from your connected Outlook or Zoho mailbox. Choose Brevo, SendGrid, or Resend when you compose.'
          : 'WhatsApp, social, and synced email activity in one feed — with AI draft replies you approve before sending.'}
      </p>

      <div className="flex-1 min-h-0">
        {activeTab === 'mailbox' ? (
          <div
            id="inbox-mailbox-panel"
            role="tabpanel"
            aria-labelledby="inbox-tab-mailbox"
            className="h-full min-h-0"
          >
            <UnifiedInboxView defaultProvider={defaultProvider} />
          </div>
        ) : (
          <div
            id="inbox-channels-panel"
            role="tabpanel"
            aria-labelledby="inbox-tab-channels"
            className="h-full min-h-0"
          >
            <UnifiedInboxTab />
          </div>
        )}
      </div>
    </div>
  );
}

export default function UnifiedInbox(props: UnifiedInboxProps) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center p-12 gap-4 h-[50vh]">
          <Loader2 className="w-10 h-10 text-teal-500 animate-spin" aria-hidden="true" />
          <p className="text-sm text-slate-400">Loading inbox…</p>
        </div>
      }
    >
      <UnifiedInboxContent {...props} />
    </Suspense>
  );
}
