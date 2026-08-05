'use client';

import React, { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Inbox, Send, FileEdit, MessageSquare, AlertCircle, Mail } from 'lucide-react';
import type { User } from '@/types';
import { cn } from '@/lib/utils';
import UnifiedInbox from '@/components/dashboard/business/UnifiedInbox';
import UnifiedInboxTab from '@/components/dashboard/business/UnifiedInboxTab';
import { EmailOutreachComposer } from '@/components/dashboard/communication/EmailOutreachComposer';
import type { InboxFolder } from '@/types/unifiedInbox';

type CommsTab = 'inbox' | 'sent' | 'drafts' | 'outreaches' | 'channels' | 'needs-reply';

const TABS: { id: CommsTab; label: string; icon: React.ElementType }[] = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'sent', label: 'Sent', icon: Send },
  { id: 'drafts', label: 'Drafts', icon: FileEdit },
  { id: 'outreaches', label: 'Outreaches', icon: Mail },
  { id: 'channels', label: 'All channels', icon: MessageSquare },
  { id: 'needs-reply', label: 'Needs reply', icon: AlertCircle },
];

interface CommunicationHubProps {
  user: User;
  showLocalTabs?: boolean;
}

export function CommunicationHub({ user: _user, showLocalTabs = true }: CommunicationHubProps) {
  const searchParams = useSearchParams();
  const activeTab = useMemo(() => {
    const requested = searchParams?.get('tab') as CommsTab | null;
    return TABS.some((tab) => tab.id === requested) ? requested! : 'inbox';
  }, [searchParams]);

  const folderMap: Record<string, InboxFolder> = {
    inbox: 'inbox',
    sent: 'sent',
    drafts: 'drafts',
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {showLocalTabs ? (
        <div className="flex items-center gap-1 px-3 md:px-4 pt-2 pb-0 border-b border-white/5 overflow-x-auto ac-scroll-x shrink-0">
          {TABS.map((tab) => (
            <a
              key={tab.id}
              href={tab.id === 'inbox' ? '/dashboard/comms' : `/dashboard/comms?tab=${tab.id}`}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium whitespace-nowrap transition-colors border-b-2 -mb-px rounded-none',
                activeTab === tab.id
                  ? 'border-teal-400 text-teal-300'
                  : 'border-transparent text-[var(--ws-text-secondary)] hover:text-[var(--ws-text-primary)] hover:border-white/20'
              )}
            >
              <tab.icon className="w-3.5 h-3.5" aria-hidden="true" />
              {tab.label}
            </a>
          ))}
        </div>
      ) : null}

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'outreaches' ? (
          <EmailOutreachComposer />
        ) : activeTab === 'channels' || activeTab === 'needs-reply' ? (
          <div className="h-full p-2 md:p-3">
            <UnifiedInboxTab needsReplyOnly={activeTab === 'needs-reply'} />
          </div>
        ) : (
          <div className="h-full p-2 md:p-3">
            <UnifiedInbox
              defaultTab="mailbox"
              initialFolder={folderMap[activeTab] || 'inbox'}
              hideTabSwitcher
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default CommunicationHub;
